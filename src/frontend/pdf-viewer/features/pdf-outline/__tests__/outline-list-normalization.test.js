/**
 * 目的：验证后端返回的大纲列表在 replaceFromRemote 时被正确归一化
 * - id 转字符串并去空白
 * - pageAt 非法时回退为 1
 * - position 取整并限制 0~100，非法为 null
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

describe("OUTLINE_LIST_COMPLETED → 列表归一化", () => {
  test("pageAt/position 正确归一化", async () => {
    const wsClient = { request: jest.fn(async () => ({ ok: true })) };
    const container = new StubContainer(wsClient);
    const eventBus = new EventBus({ moduleName: "TestBus", enableValidation: true, logger: getLogger("test") });
    const { ScopedEventBus } = await import("../../../../common/event/scoped-event-bus.js");
    const scoped = new ScopedEventBus(eventBus, "pdf-viewer");
    global.window.__DISABLE_OUTLINE_UI = true;
    const feature = new FeatureOutline();
    await feature.install({ logger: getLogger("feature"), globalEventBus: eventBus, scopedEventBus: scoped, container });

    let last = null;
    eventBus.on(PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS, (d) => { last = d; }, { subscriberId: "test" });

    eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      data: {
        outline_items: [
          { id: 12345, name: "A", pageAt: "0", position: -10.9, children: [] },
          { id: " outlineItem-XYZ ", name: "B", pageAt: 9, position: 150.4, children: [] }
        ]
      }
    }, { actorId: "test" });
    await new Promise(r => setTimeout(r, 0));

    expect(last).not.toBeNull();
    const items = last.outlineItems;
    expect(items[0]).toEqual(expect.objectContaining({ id: "12345", pageAt: 1, position: 0 }));
    expect(items[1]).toEqual(expect.objectContaining({ id: "outlineItem-XYZ", pageAt: 9, position: 100 }));
  });
});

