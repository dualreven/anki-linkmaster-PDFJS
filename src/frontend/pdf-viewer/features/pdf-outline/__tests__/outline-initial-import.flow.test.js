/**
 * 目的：当数据库为空时，FILE.LOAD.SUCCESS 后应从 PDF 原生加载 → 持久化到后端 → 主动拉取列表。
 * 方法：mock OutlineDataProvider 方法，stub WSClient.request 并断言调用序列（bookmark:save → outline-list）。
 */
import { EventBus } from "../../../../common/event/event-bus.js";
import { getLogger } from "../../../../common/utils/logger.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../../common/event/event-constants.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import FeatureOutline from "../../pdf-outline/index.js";
import { setCurrentPDFDocument } from "../../../pdf/current-document-registry.js";
import { OutlineDataProvider } from "../../../outline/outline-data-provider.js";

class StubContainer {
  constructor(wsClient) { this._store = new Map([["wsClient", wsClient]]); }
  register() {}
  registerGlobal() {}
  get(name) { return this._store.get(name); }
  resolve(name) { return this._store.get(name); }
  getWSClient() { return this._store.get("wsClient"); }
}

describe("数据库空时的初次导入持久化流程", () => {
  test("FILE.LOAD.SUCCESS → import native → bulk-save/create → outline-list", async () => {
    const calls = [];
    const wsClient = {
      request: jest.fn(async (type, data) => { calls.push({ type, data }); return { type: `${type.replace(":requested", "")}:completed` }; }),
      isConnected: () => true,
    };
    const eventBus = new EventBus({ moduleName: "TestBus", enableValidation: true, logger: getLogger("test") });
    const { ScopedEventBus } = await import("../../../../common/event/scoped-event-bus.js");
    const scoped = new ScopedEventBus(eventBus, "pdf-viewer");
    const container = new StubContainer(wsClient);
    // mock PDF document + OutlineDataProvider
    setCurrentPDFDocument({ getOutline: async () => [{ title: "A", dest: [1, { name: "XYZ" }, 0, 800, 0] }] });
    jest.spyOn(OutlineDataProvider.prototype, "getOutline").mockImplementation(async () => [{ title: "A", dest: [1, { name: "XYZ" }, 0, 800, 0] }]);
    jest.spyOn(OutlineDataProvider.prototype, "parseDestination").mockImplementation(async () => ({ pageNumber: 1, x: null, y: 800, zoom: null, type: "XYZ" }));

    // 注入 pdf-id，满足持久化 payload
    try { window.history.pushState({}, "", "?pdf-id=jest-pdf"); } catch {}
    // 关闭 UI 侧边栏（避免 jstree 依赖在 jsdom 中报错）
    global.window.__DISABLE_OUTLINE_UI = true;
    const feature = new FeatureOutline();
    await feature.install({ logger: getLogger("feature"), globalEventBus: eventBus, scopedEventBus: scoped, container });
    // 触发 FILE.LOAD.SUCCESS
    eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, {}, { actorId: "test" });
    // 首次列表回执（模拟后端无记录 → 触发导入逻辑）
    eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      status: "success",
      data: { outline_items: null }
    }, { actorId: "test" });
    // 等待任务队列
    await new Promise(r => setTimeout(r, 0));

    const types = calls.map((c) => c.type);
    // 兼容两种导入策略：逐条 create 或一次性 bulk-save
    const hasBulkOrCreate = types.some(t => t === WEBSOCKET_MESSAGE_TYPES.OUTLINE_BULK_SAVE || t === WEBSOCKET_MESSAGE_TYPES.OUTLINE_CREATE);
    expect(hasBulkOrCreate).toBe(true);
    expect(types).toContain(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST);
  });
});
