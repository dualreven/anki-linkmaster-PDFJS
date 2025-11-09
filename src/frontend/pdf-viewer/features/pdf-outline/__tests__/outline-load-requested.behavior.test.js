/**
 * 目的：验证 UI 晚到时的 OUTLINE.LOAD.REQUESTED 行为
 * - 列表未就绪：LOAD.REQUESTED 不触发渲染
 * - 列表就绪后：LOAD.REQUESTED 会立即重发一次 OUTLINE.LOAD.SUCCESS
 */
import { EventBus } from "../../../../common/event/event-bus.js";
import { getLogger } from "../../../../common/utils/logger.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../../common/event/event-constants.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import FeatureOutline from "../../pdf-outline/index.js";

class StubContainer {
  constructor(wsClient) { this._store = new Map([["wsClient", wsClient]]); }
  register() {}
  registerGlobal() {}
  get(name) { return this._store.get(name); }
  resolve(name) { return this._store.get(name); }
  getWSClient() { return this._store.get("wsClient"); }
}

describe("UI 晚到的 LOAD.REQUESTED 行为", () => {
  test("未就绪时无效；就绪后可触发一次刷新", async () => {
    const wsClient = { request: jest.fn(async () => ({ ok: true })) };
    const container = new StubContainer(wsClient);
    const eventBus = new EventBus({ moduleName: "TestBus", enableValidation: true, logger: getLogger("test") });
    const { ScopedEventBus } = await import("../../../../common/event/scoped-event-bus.js");
    const scoped = new ScopedEventBus(eventBus, "pdf-viewer");
    global.window.__DISABLE_OUTLINE_UI = true;
    const feature = new FeatureOutline();
    await feature.install({ logger: getLogger("feature"), globalEventBus: eventBus, scopedEventBus: scoped, container });

    let count = 0;
    eventBus.on(PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS, () => { count += 1; }, { subscriberId: "test" });

    // 1) 列表未就绪，LOAD.REQUESTED 不应触发渲染
    eventBus.emit(PDF_VIEWER_EVENTS.OUTLINE.LOAD.REQUESTED, {}, { actorId: "test" });
    await new Promise(r => setTimeout(r, 0));
    expect(count).toBe(0);

    // 2) 后端列表到达，触发第一次渲染
    eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      data: { outline_items: [{ id: "outlineItem-ONE", name: "一", pageAt: 1, position: null, children: [] }] }
    }, { actorId: "test" });
    await new Promise(r => setTimeout(r, 0));
    expect(count).toBe(1);

    // 3) UI 晚到后主动请求一遍：应再次触发渲染
    eventBus.emit(PDF_VIEWER_EVENTS.OUTLINE.LOAD.REQUESTED, {}, { actorId: "test" });
    await new Promise(r => setTimeout(r, 0));
    expect(count).toBe(2);
  });
});

