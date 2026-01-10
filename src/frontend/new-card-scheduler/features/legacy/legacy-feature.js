import { showError, showInfo } from "../../../common/utils/notification.js";
import { WindowControlsComponent } from "../../../common/components/window-controls/window-controls.js";
import WSClient from "../../../common/ws/ws-client.js";

import { createCardsEngine } from "../../planner/cards-model.js";
import { createCardPlannerApp } from "../../planner/app.js";
import { installPlannerSidebarControllerOrThrow } from "../../planner/ui/planner-sidebar-controller.js";
import { mountWsStatusPanelOrThrow } from "../../ui/ws-status-panel.js";
import { installWsRegistrationWiringOrThrow } from "../../wiring/ws-registration.js";

function resolveClientIdFromUrl() {
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

function resolveRootElOrThrow({ rootEl }) {
  if (rootEl) {
    if (!(rootEl instanceof HTMLElement)) {
      throw new Error("bootstrap: rootEl 必须是 HTMLElement");
    }
    return rootEl;
  }
  const el = document.getElementById("planner-workspace");
  if (!el) {
    throw new Error("缺少 #planner-workspace，无法启动 Card Planner UI");
  }
  return el;
}

function mountPlannerSidebarToggleOrThrow({ logger }) {
  const toolbarEl = document.querySelector(".toolbar-controls");
  if (!toolbarEl) {
    throw new Error("缺少 .toolbar-controls，无法挂载侧边栏折叠按钮");
  }

  const sidebarEl = document.getElementById("planner-sidebar");
  if (!sidebarEl) {
    throw new Error("缺少 #planner-sidebar，无法安装侧边栏布局控制器");
  }

  const mainEl = document.querySelector(".main-content");
  if (!mainEl) {
    throw new Error("缺少 .main-content，无法安装侧边栏布局控制器");
  }

  return installPlannerSidebarControllerOrThrow({
    sidebarEl,
    mainEl,
    toolbarEl,
    logger
  });
}

async function mountWindowControlsOrThrow({ clientId, wsClient }) {
  const container = document.querySelector("#window-controls-slot");
  if (!container) {
    throw new Error("缺少 #window-controls-slot，无法挂载窗口控制条");
  }

  const controls = new WindowControlsComponent({
    bridgeName: "simpleWindowBridge",
    clientId,
    wsClient,
    autoLoad: true
  });
  await controls.mount(container);
  return controls;
}

export class LegacyNewCardSchedulerFeature {
  name = "new-card-scheduler.legacy";
  version = "0.1.0";
  dependencies = [];

  #options;
  #disposed = false;

  #wsClient = null;
  #wsStatus = null;
  #uninstallWsRegistration = null;
  #plannerApp = null;
  #sidebarController = null;
  #windowControls = null;

  constructor(options = {}) {
    this.#options = options;
  }

  async install(context) {
    const eventBus = context?.eventBus;
    const logger = context?.logger;
    if (!eventBus) {
      throw new Error("LegacyNewCardSchedulerFeature.install: context.eventBus 缺失");
    }

    const notification = this.#options.notification || { showInfo, showError };
    if (!notification || typeof notification.showInfo !== "function" || typeof notification.showError !== "function") {
      throw new Error("LegacyNewCardSchedulerFeature.install: notification.showInfo/showError 必填");
    }

    const root = resolveRootElOrThrow({ rootEl: this.#options.rootEl });
    const clientId = typeof this.#options.clientId === "string" && this.#options.clientId.trim()
      ? this.#options.clientId.trim()
      : resolveClientIdFromUrl();

    const wsUrl = await (async () => {
      if (typeof this.#options.wsUrl === "string" && this.#options.wsUrl.trim()) {
        return this.#options.wsUrl.trim();
      }
      const { resolveWebSocketPortSync, DEFAULT_WS_PORT } = await import("../../../common/utils/ws-port-resolver.js");
      const wsPort = resolveWebSocketPortSync({ fallbackPort: DEFAULT_WS_PORT });
      return `ws://localhost:${wsPort}`;
    })();

    const identity = {
      client_name: clientId,
      client_id: clientId,
      module: "new-card-scheduler"
    };

    const wsClient = new WSClient(wsUrl, eventBus, identity);
    this.#wsClient = wsClient;

    const toolbarEl = document.querySelector(".toolbar-controls");
    if (!toolbarEl) {
      throw new Error("缺少 .toolbar-controls，无法挂载 WS 状态");
    }

    const wsStatus = mountWsStatusPanelOrThrow({ toolbarEl, clientId, eventBus, wsClient });
    this.#wsStatus = wsStatus;
    wsStatus.setConnecting();
    wsStatus.setRegUnknown();

    this.#uninstallWsRegistration = installWsRegistrationWiringOrThrow({
      eventBus,
      wsClient,
      clientId,
      logger,
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
    });

    try {
      wsClient.connect().catch(() => {
        // 失败细节由 WSClient 通过 eventBus 发射；此处避免未处理的 promise rejection。
      });
    } catch (e) {
      wsStatus.setFailed(e);
      logger?.error?.("[NewCardScheduler] wsClient.connect failed", e, {
        toast: { type: "error", ms: 4000 }
      });
    }

    if (this.#options.enableWindowControls !== false) {
      this.#windowControls = await mountWindowControlsOrThrow({ clientId, wsClient });
    }

    this.#sidebarController = mountPlannerSidebarToggleOrThrow({ logger });

    const engine = createCardsEngine();
    this.#plannerApp = createCardPlannerApp({
      root,
      engine,
      wsClient,
      eventBus,
      logger,
      notification
    });

    notification.showInfo("新卡片规划器窗口已启动", 1500);
  }

  async uninstall() {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;

    try { this.#plannerApp?.dispose?.(); } catch { /* ignore */ }
    this.#plannerApp = null;

    try { this.#sidebarController?.dispose?.(); } catch { /* ignore */ }
    this.#sidebarController = null;

    try { this.#windowControls?.destroy?.(); } catch { /* ignore */ }
    this.#windowControls = null;

    try { this.#uninstallWsRegistration?.(); } catch { /* ignore */ }
    this.#uninstallWsRegistration = null;

    try { this.#wsStatus?.destroy?.(); } catch { /* ignore */ }
    this.#wsStatus = null;

    try { await this.#wsClient?.disconnect?.(); } catch { /* ignore */ }
    this.#wsClient = null;
  }
}

