/**
 * 目的：验证 pdf-outline 能消费 OUTLINE_LIST_COMPLETED 并同步 OutlineManager（修复“修改后列表未刷新”）。
 * 环境：jsdom（package.json 已配置 jest-environment-jsdom）
 */
import { EventBus } from "../../../../common/event/event-bus.js";
import { getLogger } from "../../../../common/utils/logger.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../../common/event/event-constants.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import FeatureOutline from "../../pdf-outline/index.js";
import { setCurrentPDFDocument } from "../../../pdf/current-document-registry.js";
import { OutlineDataProvider } from "../../../outline/outline-data-provider.js";
import { installWsInboundBridge, resetWsInboundBridgeContractForTests } from "./ws-inbound-bridge.testkit.js";

class StubContainer {
  constructor() { this._store = new Map(); }
  register(key, value) { this._store.set(key, value); }
  registerGlobal(key, value) { this._store.set(key, value); }
  get(name) { return this._store.get(name); }
  resolve(name) { return this._store.get(name); }
  getWSClient() { return { request: async () => ({ type: "ok" }) }; }
}

describe("Outline 与 WS 同步与持久化", () => {
  beforeEach(() => {
    resetWsInboundBridgeContractForTests();
  });

  test("收到 OUTLINE_LIST_COMPLETED 后，内存刷新并发出一次渲染事件", async () => {
    const eventBus = new EventBus({ moduleName: "TestBus", enableValidation: true, logger: getLogger("test") });
    const { ScopedEventBus } = await import("../../../../common/event/scoped-event-bus.js");
    const scoped = new ScopedEventBus(eventBus, "pdf-viewer");
    const container = new StubContainer();
    global.window.__DISABLE_OUTLINE_UI = true;
    const feature = new FeatureOutline();
    await feature.install({ logger: getLogger("feature"), globalEventBus: eventBus, scopedEventBus: scoped, container });
    installWsInboundBridge({ eventBus, wsClient: container.getWSClient(), logger: getLogger("bridge"), pdfIdProvider: () => "jest-pdf" });
    try { window.history.pushState({}, "", "?pdf-id=jest-pdf"); } catch {}

    // 监听 UI 刷新事件
    let refreshed = null;
    let count = 0;
    eventBus.on(PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS, (data) => { refreshed = data; count += 1; }, { subscriberId: "test" });

    // 触发“文件已加载”以启动初始化流程（无超时）
    eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, { pdfId: "test-id" }, { actorId: "test" });

    // 模拟后端返回 outline 列表（初始）
    const message = {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      request_id: "req-1",
      status: "success",
      data: {
        outline_items: [
          { id: "outlineItem-TESTABCD", name: "一级", pageAt: 1, position: null, children: [] }
        ]
      }
    };
    eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, message, { actorId: "test" });
    await new Promise(r => setTimeout(r, 0));

    // 断言：只发一次渲染事件且包含 1 项
    expect(refreshed).not.toBeNull();
    expect(count).toBe(1);
    expect(Array.isArray(refreshed.outlineItems)).toBe(true);
    expect(refreshed.outlineItems.length).toBe(1);
    expect(refreshed.outlineItems[0].id).toBe("outlineItem-TESTABCD");
  });

  test("后端空→从PDF导入→持久化→再次拉取→只渲染一次", async () => {
    const eventBus = new EventBus({ moduleName: "TestBus", enableValidation: true, logger: getLogger("test") });
    const { ScopedEventBus } = await import("../../../../common/event/scoped-event-bus.js");
    const scoped = new ScopedEventBus(eventBus, "pdf-viewer");
    const container = new StubContainer();
    // stub wsClient.request 为同步成功
    container.getWSClient = () => ({ request: async () => ({ ok: true }) });
    global.window.__DISABLE_OUTLINE_UI = true;
    const feature = new FeatureOutline();
    await feature.install({ logger: getLogger("feature"), globalEventBus: eventBus, scopedEventBus: scoped, container });
    installWsInboundBridge({ eventBus, wsClient: container.getWSClient(), logger: getLogger("bridge"), pdfIdProvider: () => "jest-pdf" });

    // 订阅渲染事件计数
    let successCount = 0;
    let last = null;
    eventBus.on(PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS, (data) => { successCount += 1; last = data; }, { subscriberId: "test" });

    // 启动初始化流程
    try { window.history.pushState({}, "", "?pdf-id=jest-pdf"); } catch {}
    // 提供 PDF 文档与解析器，确保能走“导入→持久化→再拉取→一次性渲染最终列表”路径
    setCurrentPDFDocument({ getOutline: async () => [{ title: "A", dest: [1, { name: "XYZ" }, 0, 800, 0] }] });
    jest.spyOn(OutlineDataProvider.prototype, "getOutline").mockImplementation(async () => [{ title: "A", dest: [1, { name: "XYZ" }, 0, 800, 0] }]);
    jest.spyOn(OutlineDataProvider.prototype, "parseDestination").mockImplementation(async () => ({ pageNumber: 1, x: null, y: 800, zoom: null, type: "XYZ" }));
    eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, { pdfId: "test-id" }, { actorId: "test" });
    await new Promise(r => setTimeout(r, 0));

    // 1) 初次列表（后端为空）
    eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      status: "success",
      data: { outline_items: null }
    }, { actorId: "test" });
    await new Promise(r => setTimeout(r, 0));
    // 2) 导入完成并持久化成功
    eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_BULK_SAVE_COMPLETED,
      status: "success",
      data: {}
    }, { actorId: "test" });
    // 等待一拍，确保初始流程已注册第二次列表监听（避免竞态）
    await new Promise(r => setTimeout(r, 0));
    // 3) 再次拉取（后端返回实际数据）
    eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      status: "success",
      data: { outline_items: [{ id: "outlineItem-ONLYONCE", name: "章节", pageAt: 1, position: null, children: [] }] }
    }, { actorId: "test" });
    // 等待微任务
    await new Promise(r => setTimeout(r, 0));

    expect(successCount).toBe(1);
    expect(last).not.toBeNull();
    expect(Array.isArray(last.outlineItems)).toBe(true);
    expect(last.outlineItems.length).toBe(1);
    expect(last.outlineItems[0].id).toBe("outlineItem-ONLYONCE");
  });
});
