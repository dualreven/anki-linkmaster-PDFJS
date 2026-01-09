import { getLogger } from "../common/utils/logger.js";
import eventBus from "../common/event/event-bus.js";
import WSClient from "../common/ws/ws-client.js";
import { resolveWebSocketPortSync, DEFAULT_WS_PORT } from "../common/utils/ws-port-resolver.js";
import { WindowControlsComponent } from "../common/components/window-controls/window-controls.js";
import { showInfo, showError } from "../common/utils/notification.js";

import { createFakeEngine } from "./planner/engine/fake-engine.js";
import { createCardPlannerApp } from "./planner/app.js";
import { installPlannerSidebarControllerOrThrow } from "./planner/ui/planner-sidebar-controller.js";

const logger = getLogger("NewCardSchedulerWindow");

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

async function mountWindowControls({ bridgeName, clientId, wsClient }) {
  const container = document.querySelector("#window-controls-slot");
  if (!container) {
    throw new Error("缺少 #window-controls-slot，无法挂载窗口控制条");
  }

  const controls = new WindowControlsComponent({
    bridgeName,
    clientId,
    wsClient,
    autoLoad: true
  });
  await controls.mount(container);
}

function mountPlannerSidebarToggleOrThrow() {
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

async function bootstrap() {
  logger.info("[NewCardScheduler] bootstrap start");

  const root = document.getElementById("planner-workspace");
  if (!root) {
    throw new Error("缺少 #planner-workspace，无法启动 Card Planner UI");
  }

  const clientId = resolveClientIdFromUrl();

  const wsPort = resolveWebSocketPortSync({ fallbackPort: DEFAULT_WS_PORT });
  const wsUrl = `ws://localhost:${wsPort}`;
  const identity = {
    client_name: clientId,
    client_id: clientId,
    module: "new-card-scheduler"
  };
  const wsClient = new WSClient(wsUrl, eventBus, identity);

  try {
    wsClient.connect();
  } catch (e) {
    logger.error("[NewCardScheduler] wsClient.connect failed", e, {
      toast: { type: "error", ms: 4000 }
    });
  }

  await mountWindowControls({
    bridgeName: "simpleWindowBridge",
    clientId,
    wsClient
  });

  mountPlannerSidebarToggleOrThrow();

  const engine = createFakeEngine();
  createCardPlannerApp({
    root,
    engine,
    wsClient,
    eventBus,
    logger,
    notification: { showInfo, showError }
  });

  showInfo("新卡片规划器窗口已启动", 1500);
}

bootstrap().catch((e) => {
  logger.error("[NewCardScheduler] bootstrap failed", e, {
    toast: { type: "error", ms: 4000 }
  });
});
