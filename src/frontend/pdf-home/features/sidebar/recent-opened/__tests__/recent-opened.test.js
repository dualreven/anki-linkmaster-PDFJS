/**
 * @jest-environment jsdom
 */

import { RecentOpenedFeature } from "../index.js";
import { WEBSOCKET_EVENTS } from "../../../../../common/event/event-constants.js";

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  event: jest.fn(),
});

// 轻量 Mock 事件总线，避免引入 logger/import.meta 解析问题
class MockBus {
  constructor() { this._handlers = new Map(); }
  on(event, handler) {
    if (!this._handlers.has(event)) {this._handlers.set(event, new Set());}
    this._handlers.get(event).add(handler);
    return () => { this._handlers.get(event)?.delete(handler); };
  }
  emit(event, payload) {
    const set = this._handlers.get(event);
    if (!set) {return;}
    for (const h of Array.from(set)) { try { h(payload); } catch {} }
  }
}

describe("RecentOpenedFeature 最近阅读", () => {
  let feature;
  let globalEventBus;
  let scopedEventBus;
  let context;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="sidebar">
        <div class="sidebar-panel">
          <div class="sidebar-section" id="recent-opened-section">
            <h3 class="sidebar-section-title"><span>📖 最近阅读</span></h3>
            <ul class="sidebar-list" id="recent-opened-list"><li class="sidebar-empty">暂无阅读记录</li></ul>
          </div>
        </div>
      </div>
    `;

    globalEventBus = new MockBus();
    scopedEventBus = globalEventBus;

    context = {
      logger: createLogger(),
      scopedEventBus,
      globalEventBus,
      container: { register: jest.fn(), get: jest.fn() },
    };

    feature = new RecentOpenedFeature();
  });

  afterEach(async () => {
    try { if (feature) {await feature.uninstall();} } catch {}
    document.body.innerHTML = "";
  });

  it("安装时应发送 visited_at 降序的搜索请求（限制前 N 条）并能渲染响应", async () => {
    const sent = [];
    const unsub = globalEventBus.on(WEBSOCKET_EVENTS.MESSAGE.SEND, (msg) => { sent.push(msg); }, { subscriberId: "jest-opened" });

    await feature.install(context);

    // 最近阅读安装时应发起一次请求
    expect(sent.length).toBe(1);
    const req = sent[0];
    expect(req).toHaveProperty("type", "pdf-library:search:requested");
    expect(req.data).toBeDefined();
    expect(Array.isArray(req.data.sort)).toBe(true);
    expect(req.data.sort[0]).toEqual({ field: "visited_at", direction: "desc" });

    // 回发响应以渲染列表
    const rid = req.request_id;
    const files = [
      { id: "id-1", title: "第一本" },
      { id: "id-2", title: "第二本" },
    ];
    globalEventBus.emit("websocket:message:response", {
      type: "pdf-library:search:completed",
      status: "success",
      request_id: rid,
      data: { files, total_count: 2, search_text: "" },
    });

    const list = document.getElementById("recent-opened-list");
    const items = list.querySelectorAll(".sidebar-item");
    expect(items.length).toBe(2);
    expect(items[0].querySelector(".sidebar-item-text").textContent).toBe("第一本");
    expect(items[1].querySelector(".sidebar-item-text").textContent).toBe("第二本");

    unsub();
  });

  it("点击任一项应触发全量 visited_at 降序搜索（通过 SearchManager 路径）", async () => {
    await feature.install(context);
    // 预先渲染两条
    const list = document.getElementById("recent-opened-list");
    list.innerHTML = [
      "<li class=\"sidebar-item\" data-id=\"a\"><span class=\"sidebar-item-icon\">📖</span><span class=\"sidebar-item-text\">A</span></li>",
      "<li class=\"sidebar-item\" data-id=\"b\"><span class=\"sidebar-item-icon\">📖</span><span class=\"sidebar-item-text\">B</span></li>",
    ].join("\n");

    const got = [];
    const unsub = globalEventBus.on("search:query:requested", (payload) => { got.push(payload); }, { subscriberId: "jest-opened-click" });

    // 点击第一项
    list.querySelector(".sidebar-item").click();

    expect(got.length).toBe(1);
    expect(got[0]).toHaveProperty("searchText", "");
    // 默认显示条数：RecentOpenedFeatureConfig.config.defaultDisplayLimit = 5
    expect(got[0].pagination).toEqual({ limit: 5, offset: 0, need_total: true });
    expect(got[0].sort[0]).toEqual({ field: "visited_at", direction: "desc" });
    expect(got[0]).toHaveProperty("focusId", "a");

    unsub();
  });
});
