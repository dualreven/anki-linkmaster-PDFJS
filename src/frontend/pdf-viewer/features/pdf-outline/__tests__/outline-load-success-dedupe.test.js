/**
 * 回归测试：
 * - 当 WebSocket 入站桥接（ws-inbound-bridge）与 OutlineFeature 同时存在时，
 *   `PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS` 不应被重复发射（避免冗余刷新/重复渲染）。
 *
 * 说明：
 * - 本测试显式安装一个“最小版 inbound bridge”（仿照 WebSocketAdapter 的行为）：
 *   监听 `WEBSOCKET_EVENTS.MESSAGE.RECEIVED` 并调用 `handleViewerWsInbound(...)`。
 */

import { EventBus } from "../../../../common/event/event-bus.js";
import { getLogger } from "../../../../common/utils/logger.js";
import { ScopedEventBus } from "../../../../common/event/scoped-event-bus.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../../common/event/event-constants.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import FeatureOutline from "../index.js";
import { installWsInboundBridge, resetWsInboundBridgeContractForTests } from "./ws-inbound-bridge.testkit.js";

class StubContainer {
  constructor(wsClient) { this._store = new Map([["wsClient", wsClient]]); }
  register() {}
  registerGlobal() {}
  get(name) { return this._store.get(name); }
  resolve(name) { return this._store.get(name); }
  getWSClient() { return this._store.get("wsClient"); }
}

describe("OUTLINE.LOAD.SUCCESS 去重", () => {
  beforeEach(() => {
    resetWsInboundBridgeContractForTests();
  });

  test("OUTLINE_LIST_COMPLETED 仅触发一次 OUTLINE.LOAD.SUCCESS", async () => {
    const logger = getLogger("test");
    const wsClient = { request: jest.fn(async () => ({ ok: true })) };
    const container = new StubContainer(wsClient);

    const eventBus = new EventBus({ moduleName: "TestBus", enableValidation: true, logger });
    const scoped = new ScopedEventBus(eventBus, "pdf-viewer");

    // 关闭 UI 动态 import（避免 jstree 依赖）
    global.window.__DISABLE_OUTLINE_UI = true;

    // 1) 安装 OutlineFeature
    const feature = new FeatureOutline();
    await feature.install({ logger, globalEventBus: eventBus, scopedEventBus: scoped, container });

    // 2) 安装“最小版 inbound bridge”（模拟 WebSocketAdapter#setupIncomingMessageHandlers 的行为）
    installWsInboundBridge({ eventBus, wsClient, logger, pdfIdProvider: () => "jest-pdf" });

    // 3) 统计 OUTLINE.LOAD.SUCCESS
    let count = 0;
    eventBus.on(
      PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS,
      () => { count += 1; },
      { subscriberId: "test" }
    );

    // 4) 触发一条“列表回执”
    eventBus.emit(
      WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
      {
        type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
        data: { outline_items: [{ id: "outlineItem-DEDUP", name: "章", pageAt: 1, position: null, children: [] }] }
      },
      { actorId: "test" }
    );

    await new Promise(r => setTimeout(r, 0));
    expect(count).toBe(1);
  });
});
