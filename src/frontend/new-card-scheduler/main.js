import { getLogger } from "../common/utils/logger.js";
import defaultEventBus from "../common/event/event-bus.js";
import WSClient from "../common/ws/ws-client.js";
import { WindowControlsComponent } from "../common/components/window-controls/window-controls.js";
import { showInfo, showError } from "../common/utils/notification.js";

import { createCardsEngine } from "./planner/cards-model.js";
import { createCardPlannerApp } from "./planner/app.js";
import { installPlannerSidebarControllerOrThrow } from "./planner/ui/planner-sidebar-controller.js";
import { mountWsStatusPanelOrThrow } from "./ui/ws-status-panel.js";
import { installWsRegistrationWiringOrThrow } from "./wiring/ws-registration.js";

const logger = getLogger("NewCardSchedulerWindow");

export function createPlannerEngineOrThrow() {
  return createCardsEngine();
}

function resolveClientIdFromUrlOrFallback() {
  try {
    const params = new URLSearchParams(window.location.search);
    const cid = params.get("client-id");
    if (cid && cid.trim()) {
      return cid.trim();
    }
  } catch {
    // ignore
  }
  return "new-card-scheduler";
}

function assertRootElOrThrow(rootEl) {
  if (!rootEl) {
    throw new Error("rootEl 必填");
  }
  const ok = rootEl === document || (typeof rootEl === "object" && rootEl instanceof HTMLElement);
  if (!ok) {
    throw new Error("rootEl 必须为 document 或 HTMLElement");
  }
}

function queryRequiredElOrThrow(rootEl, selector, message) {
  const base = rootEl === document ? document : rootEl;
  const el = base.querySelector(selector);
  if (!el) {
    throw new Error(`缺少 ${selector}，${message}`);
  }
  if (!(el instanceof HTMLElement)) {
    throw new Error(`${selector} 必须是 HTMLElement`);
  }
  return el;
}

async function mountWindowControls({ rootEl, bridgeName, clientId, wsClient }) {
  const container = queryRequiredElOrThrow(rootEl, "#window-controls-slot", "无法挂载窗口控制条");

  const controls = new WindowControlsComponent({
    bridgeName,
    clientId,
    wsClient,
    autoLoad: true
  });
  await controls.mount(container);
  return controls;
}

function mountPlannerSidebarToggleOrThrow({ rootEl, logger: injectedLogger }) {
  const toolbarEl = queryRequiredElOrThrow(rootEl, ".toolbar-controls", "无法挂载侧边栏折叠按钮");
  const sidebarEl = queryRequiredElOrThrow(rootEl, "#planner-sidebar", "无法安装侧边栏布局控制器");
  const mainEl = queryRequiredElOrThrow(rootEl, ".main-content", "无法安装侧边栏布局控制器");

  return installPlannerSidebarControllerOrThrow({
    sidebarEl,
    mainEl,
    toolbarEl,
    logger: injectedLogger
  });
}

/**
 * main.js 迁为“可导入、可调用、可卸载”模块：不得自启动。
 *
 * @returns {Promise<{destroy: Function}>}
 */
export async function createNewCardSchedulerAppOrThrow({
  rootEl = document,
  clientId = null,
  wsUrl = null,
  wsPort = null,
  bridgeName = "simpleWindowBridge",
  eventBus = defaultEventBus,
  notification = { showInfo, showError },
  injectedLogger = logger,
  wsClient = null,
  engine = null,
  autoConnect = true,
  mountControls = true,
  mountSidebar = true,
  mountPlanner = true,
  installRegistration = true,
} = {}) {
  assertRootElOrThrow(rootEl);
  if (!eventBus) {
    throw new Error("createNewCardSchedulerAppOrThrow: eventBus 必填");
  }
  if (!notification || typeof notification.showInfo !== "function" || typeof notification.showError !== "function") {
    throw new Error("createNewCardSchedulerAppOrThrow: notification.showInfo/showError 必填");
  }

  const resolvedClientId = typeof clientId === "string" && clientId.trim()
    ? clientId.trim()
    : resolveClientIdFromUrlOrFallback();

  const plannerRoot = queryRequiredElOrThrow(rootEl, "#planner-workspace", "无法启动 Card Planner UI");
  const toolbarEl = queryRequiredElOrThrow(rootEl, ".toolbar-controls", "无法挂载 WS 状态");

  let resolvedWsUrl = wsUrl;
  if (!resolvedWsUrl) {
    const { resolveWebSocketPortSync, DEFAULT_WS_PORT } = await import("../common/utils/ws-port-resolver.js");
    const port = Number.isFinite(wsPort) ? Number(wsPort) : resolveWebSocketPortSync({ fallbackPort: DEFAULT_WS_PORT });
    resolvedWsUrl = `ws://127.0.0.1:${port}`;
  }

  const identity = {
    client_name: resolvedClientId,
    client_id: resolvedClientId,
    module: "new-card-scheduler"
  };

  const client = wsClient || new WSClient(resolvedWsUrl, eventBus, identity);

  const wsStatus = mountWsStatusPanelOrThrow({ toolbarEl, clientId: resolvedClientId, eventBus, wsClient: client });
  wsStatus.setConnecting();
  wsStatus.setRegUnknown();

  const uninstallRegistration = installRegistration
    ? installWsRegistrationWiringOrThrow({
      eventBus,
      wsClient: client,
      clientId: resolvedClientId,
      logger: injectedLogger,
      notification,
      onStatus: ({ status, errorMessage }) => {
        if (status === "registering") {
          wsStatus.setRegRegistering();
          return;
        }
        if (status === "ok") {
          wsStatus.setRegOk();
          return;
        }
        if (status === "failed") {
          wsStatus.setRegFailed(errorMessage || "注册失败");
          return;
        }
        wsStatus.setRegUnknown();
      }
    })
    : null;

  if (autoConnect) {
    try {
      client.connect().catch(() => {
        // 失败细节由 WSClient 通过 eventBus 发射；此处避免未处理的 promise rejection。
      });
    } catch (e) {
      wsStatus.setFailed(e);
      injectedLogger.error("[NewCardScheduler] wsClient.connect failed", e, {
        toast: { type: "error", ms: 4000 }
      });
    }
  }

  const controls = mountControls
    ? await mountWindowControls({ rootEl, bridgeName, clientId: resolvedClientId, wsClient: client })
    : null;

  const sidebarController = mountSidebar
    ? mountPlannerSidebarToggleOrThrow({ rootEl, logger: injectedLogger })
    : null;

  const plannerEngine = engine || createPlannerEngineOrThrow();
  const plannerApp = mountPlanner
    ? createCardPlannerApp({
      root: plannerRoot,
      engine: plannerEngine,
      wsClient: client,
      eventBus,
      logger: injectedLogger,
      notification
    })
    : null;

  if (mountPlanner) {
    notification.showInfo("新卡片规划器窗口已启动", 1500);
  }

  return {
    async destroy() {
      try { plannerApp?.dispose?.(); } catch (e) { injectedLogger.warn("[NewCardScheduler] plannerApp.dispose failed", e); }
      try { sidebarController?.dispose?.(); } catch (e) { injectedLogger.warn("[NewCardScheduler] sidebarController.dispose failed", e); }
      try { controls?.destroy?.(); } catch (e) { injectedLogger.warn("[NewCardScheduler] windowControls.destroy failed", e); }
      try { uninstallRegistration?.(); } catch (e) { injectedLogger.warn("[NewCardScheduler] uninstallRegistration failed", e); }
      try { wsStatus?.destroy?.(); } catch (e) { injectedLogger.warn("[NewCardScheduler] wsStatus.destroy failed", e); }
      try {
        if (typeof client.disconnect === "function") {
          await client.disconnect();
        }
      } catch (e) {
        injectedLogger.warn("[NewCardScheduler] wsClient.disconnect failed", e);
      }
    }
  };
}
