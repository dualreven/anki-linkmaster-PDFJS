/**
 * 为“简单工具窗口”（anno-manager / new-card-scheduler / custom-reviewer）挂载窗口控制条。
 *
 * 复用现有的 WindowControlsComponent + WSClient：
 * - 通过 resolveWebSocketPortSync 推导 MsgCenter 端口；
 * - 创建 WSClient，并使用 client_name/client_id 标识窗口；
 * - 将窗口控制按钮挂载到指定容器，并通过 QWebChannel 调用 PyQt SimpleWindowBridge。
 */

import { getLogger } from "../utils/logger.js";
import eventBus from "../event/event-bus.js";
import WSClient from "../ws/ws-client.js";
import { resolveWebSocketPortSync, DEFAULT_WS_PORT } from "../utils/ws-port-resolver.js";
import { WindowControlsComponent } from "../components/window-controls/window-controls.js";

const logger = getLogger("BasicWindowControls");

/**
 * 挂载基础窗口控制条
 * @param {Object} options
 * @param {string} options.clientId - 窗口对应的 client_id（如 'anno-manager'）
 * @param {string} options.moduleName - 模块名（用于 WS 身份，如 'anno-manager'）
 * @param {string} [options.bridgeName='simpleWindowBridge'] - QWebChannel Bridge 名称
 * @param {string} [options.containerSelector='#window-controls-slot'] - 控件挂载容器选择器
 */
export async function attachBasicWindowControls(options) {
  const clientId = options.clientId;
  const moduleName = options.moduleName;
  const bridgeName = options.bridgeName || "simpleWindowBridge";
  const containerSelector = options.containerSelector || "#window-controls-slot";

  if (!clientId || !moduleName) {
    throw new Error("attachBasicWindowControls: clientId 和 moduleName 为必填参数");
  }

  logger.info(
    "[BasicWindowControls] attaching window controls",
    { clientId, moduleName, bridgeName, containerSelector }
  );

  // 1. 解析 WebSocket 端口并创建 WSClient
  const wsPort = resolveWebSocketPortSync({ fallbackPort: DEFAULT_WS_PORT });
  const wsUrl = `ws://localhost:${wsPort}`;
  const identity = {
    client_name: clientId,
    client_id: clientId,
    module: moduleName
  };

  const wsClient = new WSClient(wsUrl, eventBus, identity);

  try {
    wsClient.connect();
  } catch (e) {
    logger.error("[BasicWindowControls] wsClient.connect failed", e, {
      toast: { type: "error", ms: 4000 }
    });
  }

  // 2. 创建窗口控制组件并挂载到 DOM
  const controls = new WindowControlsComponent({
    bridgeName,
    clientId,
    wsClient,
    autoLoad: true
  });

  const container = document.querySelector(containerSelector);
  if (!container) {
    logger.error(
      "[BasicWindowControls] container not found for selector",
      { selector: containerSelector },
      { toast: { type: "error", ms: 4000 } }
    );
    return;
  }

  await controls.mount(container);
  logger.info("[BasicWindowControls] window controls attached successfully");
}

