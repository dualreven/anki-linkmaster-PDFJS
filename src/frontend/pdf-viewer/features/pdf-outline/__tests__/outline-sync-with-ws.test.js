/**
 * 目的：验证 pdf-outline 能消费 OUTLINE_LIST_COMPLETED 并同步 OutlineManager（修复“修改后列表未刷新”）。
 * 环境：jsdom（package.json 已配置 jest-environment-jsdom）
 */
import { EventBus } from "../../../../common/event/event-bus.js";
import { getLogger } from "../../../../common/utils/logger.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../../common/event/event-constants.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import FeatureOutline from "../../pdf-outline/index.js";

class StubContainer {
  constructor() { this._store = new Map(); }
  register(key, value) { this._store.set(key, value); }
  registerGlobal(key, value) { this._store.set(key, value); }
  get(name) { return this._store.get(name); }
  resolve(name) { return this._store.get(name); }
  getWSClient() { return { request: async () => ({ type: "ok" }) }; }
}

describe("Outline 与 WS 同步与持久化", () => {
  test("收到 OUTLINE_LIST_COMPLETED 后，内存刷新并持久化到 localStorage", async () => {
    const eventBus = new EventBus({ moduleName: "TestBus", enableValidation: true, logger: getLogger("test") });
    const container = new StubContainer();
    const feature = new FeatureOutline();
    await feature.install({ logger: getLogger("feature"), globalEventBus: eventBus, container });

    // 监听 UI 刷新事件
    let refreshed = null;
    eventBus.on(PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS, (data) => { refreshed = data; }, { subscriberId: "test" });

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

    // 断言：已发射刷新事件且包含 1 项
    expect(refreshed).not.toBeNull();
    expect(Array.isArray(refreshed.outlineItems)).toBe(true);
    expect(refreshed.outlineItems.length).toBe(1);
    expect(refreshed.outlineItems[0].id).toBe("outlineItem-TESTABCD");

    // 校验已持久化（localStorage 有值）
    const key = (() => {
      const params = new URLSearchParams(global.location.search || "");
      const pdfId = params.get("pdf-id") || "default";
      return `pdf-outline:${pdfId}`;
    })();
    const saved = JSON.parse(global.localStorage.getItem(key));
    expect(Array.isArray(saved)).toBe(true);
    expect(saved[0].id).toBe("outlineItem-TESTABCD");
  });

  test("页面整体刷新后从 localStorage 恢复最近一次远端状态", async () => {
    // Step1: 首次实例，收到远端列表并写入 localStorage
    const bus1 = new EventBus({ moduleName: "Bus1", enableValidation: true, logger: getLogger("test") });
    const c1 = new StubContainer();
    const f1 = new FeatureOutline();
    await f1.install({ logger: getLogger("feature"), globalEventBus: bus1, container: c1 });
    const msg1 = {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      request_id: "req-1",
      status: "success",
      data: {
        outline_items: [
          { id: "outlineItem-XYZ12345", name: "章节一(改后)", pageAt: 2, position: 10, children: [] }
        ]
      }
    };
    bus1.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, msg1, { actorId: "test" });
    // Step2: “刷新页面” → 重新创建实例，不再注入新的远端列表
    const bus2 = new EventBus({ moduleName: "Bus2", enableValidation: true, logger: getLogger("test") });
    const c2 = new StubContainer();
    const f2 = new FeatureOutline();
    await f2.install({ logger: getLogger("feature"), globalEventBus: bus2, container: c2 });
    // 监听加载成功（来自存储）
    let loaded = null;
    bus2.on(PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS, (data) => { loaded = data; }, { subscriberId: "test" });
    // 触发文件加载，走存储恢复 + 主动拉远端（无需等待远端）
    bus2.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, {}, { actorId: "test" });
    // 等待微任务
    await new Promise(r => setTimeout(r, 0));
    expect(loaded).not.toBeNull();
    expect(Array.isArray(loaded.outlineItems)).toBe(true);
    expect(loaded.outlineItems.length).toBe(1);
    expect(loaded.outlineItems[0].name).toBe("章节一(改后)");
  });
});
