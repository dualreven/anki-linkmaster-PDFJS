import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { RecentAddedFeature } from "../index.js";
import { WEBSOCKET_MESSAGE_TYPES, WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_EVENTS, SEARCH_EVENTS } from "../../../../../common/event/event-constants.js";

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  event: jest.fn()
});

const STORAGE_KEY = "pdf-home:recent-added";

// 简易事件总线桩，避免引入项目Logger/ImportMeta等在Jest下的问题
class SimpleEventBus {
  constructor() {
    this.handlers = new Map();
  }
  on(name, fn) {
    if (!this.handlers.has(name)) {this.handlers.set(name, new Set());}
    this.handlers.get(name).add(fn);
    return () => this.handlers.get(name)?.delete(fn);
  }
  emit(name, data) {
    const set = this.handlers.get(name);
    if (set) {Array.from(set).forEach(fn => fn(data));}
  }
  onGlobal(name, fn, _opts) { return this.on(name, fn); }
  emitGlobal(name, data) { this.emit(name, data); }
}

describe("RecentAddedFeature 最近添加插件", () => {
  let feature;
  let context;
  let globalEventBus;
  let scopedEventBus;
  let sentMessages;

  beforeEach(async () => {
    window.localStorage.clear();
    document.body.innerHTML = `
      <div id="sidebar">
        <div class="sidebar-panel">
          <div class="sidebar-section" id="recent-added-section">
            <h3 class="sidebar-section-title">
              <span>➕ 最近添加</span>
            </h3>
            <ul class="sidebar-list" id="recent-added-list">
              <li class="sidebar-empty">暂无添加记录</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    globalEventBus = new SimpleEventBus();
    scopedEventBus = globalEventBus;

    sentMessages = [];
    globalEventBus.on(WEBSOCKET_EVENTS.MESSAGE.SEND, (msg) => {
      sentMessages.push(msg);
    }, { subscriberId: "capture-ws-send" });

    context = {
      logger: createLogger(),
      scopedEventBus,
      globalEventBus,
      container: { register: jest.fn(), get: jest.fn() }
    };

    feature = new RecentAddedFeature();
    await feature.install(context);
  });

  afterEach(async () => {
    if (feature) {
      await feature.uninstall();
      feature = null;
    }
    document.body.innerHTML = "";
  });

  it("首次安装时读取空存储并显示占位", () => {
    const list = document.querySelector("#recent-added-list");
    expect(list).not.toBeNull();
    expect(list.querySelector(".sidebar-empty")).not.toBeNull();
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    expect(Array.isArray(stored)).toBe(true);
    expect(stored.length).toBe(0);
  });

  it("启动时会请求DB按创建时间降序加载最近添加，并以书名展示", () => {
    // 捕获最近的 search 请求
    const searchMsg = sentMessages.find(m => m && m.type === WEBSOCKET_MESSAGE_TYPES.SEARCH_PDF);
    expect(searchMsg).toBeTruthy();
    expect(Array.isArray(searchMsg?.data?.sort)).toBe(true);
    expect(searchMsg.data.sort[0]).toEqual({ field: "created_at", direction: "desc" });

    // 模拟后端回执（search:completed）
    const resp = {
      type: "pdf-library:search:completed",
      status: "success",
      request_id: searchMsg.request_id,
      data: {
        files: [
          { id: "id1", title: "T1", filename: "f1.pdf", created_at: 100 },
          { id: "id2", title: "T2", filename: "f2.pdf", created_at: 200 },
          { id: "id3", title: "T3", filename: "f3.pdf", created_at: 150 }
        ],
        total_count: 3,
        search_text: ""
      }
    };
    globalEventBus.emit(WEBSOCKET_MESSAGE_EVENTS.RESPONSE, resp);

    const texts = Array.from(document.querySelectorAll("#recent-added-list .sidebar-item-text")).map(el => el.textContent);
    // 应使用书名展示，且顺序来自后端（desc），这里验证存在即可
    expect(texts).toContain("T1");
    expect(texts).toContain("T2");
    expect(texts).toContain("T3");
  });

  it("收到 search:results:updated 后刷新并渲染到UI，点击触发按创建时间降序的搜索（带 focusId）", () => {
    // 外部发出“搜索结果更新”通知 → 触发最近添加刷新
    globalEventBus.emit(SEARCH_EVENTS.RESULTS.UPDATED, {});
    // 捕获发出的刷新请求
    const searchMsg2 = sentMessages.filter(m => m && m.type === WEBSOCKET_MESSAGE_TYPES.SEARCH_PDF).pop();
    expect(searchMsg2).toBeTruthy();

    // 回发响应以渲染列表（含标题）
    const resp2 = {
      type: "pdf-library:search:completed",
      status: "success",
      request_id: searchMsg2.request_id,
      data: {
        files: [{ id: "abc123", title: "A-Title", filename: "A.pdf" }],
        total_count: 1,
        search_text: ""
      }
    };
    globalEventBus.emit(WEBSOCKET_MESSAGE_EVENTS.RESPONSE, resp2);

    const items = document.querySelectorAll("#recent-added-list .sidebar-item");
    expect(items.length).toBe(1);
    expect(items[0].querySelector(".sidebar-item-text").textContent).toBe("A-Title");

    // 点击触发“全量按 created_at 降序”的标准搜索（通过 SearchManager）
    const got = [];
    const unsub = globalEventBus.on(SEARCH_EVENTS.QUERY.REQUESTED, (payload) => got.push(payload));
    items[0].click();
    expect(got.length).toBe(1);
    expect(got[0].sort[0]).toEqual({ field: "created_at", direction: "desc" });
    expect(got[0].focusId).toBe("abc123");
    unsub();
  });

  it("多次刷新响应应覆盖渲染列表（后到覆盖先到）", () => {
    // 第一次刷新
    globalEventBus.emit(SEARCH_EVENTS.RESULTS.UPDATED, {});
    const msgA = sentMessages.find(m => m && m.type === WEBSOCKET_MESSAGE_TYPES.SEARCH_PDF);
    globalEventBus.emit(WEBSOCKET_MESSAGE_EVENTS.RESPONSE, {
      type: "pdf-library:search:completed",
      status: "success",
      request_id: msgA.request_id,
      data: { files: [{ id: "id1", title: "A" }], total_count: 1, search_text: "" }
    });

    // 第二次刷新（覆盖为 B, C）
    globalEventBus.emit(SEARCH_EVENTS.RESULTS.UPDATED, {});
    const msgB = sentMessages.filter(m => m && m.type === WEBSOCKET_MESSAGE_TYPES.SEARCH_PDF).pop();
    globalEventBus.emit(WEBSOCKET_MESSAGE_EVENTS.RESPONSE, {
      type: "pdf-library:search:completed",
      status: "success",
      request_id: msgB.request_id,
      data: { files: [{ id: "id2", title: "B" }, { id: "id3", title: "C" }], total_count: 2, search_text: "" }
    });

    const texts = Array.from(document.querySelectorAll("#recent-added-list .sidebar-item-text")).map(el => el.textContent);
    expect(texts).toEqual(["B", "C"]);
  });
});

