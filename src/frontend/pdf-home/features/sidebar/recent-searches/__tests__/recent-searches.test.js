import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { EventBus } from "../../../../../common/event/event-bus.js";
import { ScopedEventBus } from "../../../../../common/event/scoped-event-bus.js";
import { RecentSearchesFeature } from "../index.js";
import { SEARCH_EVENTS } from "../../../../../common/event/event-constants.js";

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  event: jest.fn()
});

const STORAGE_KEY = "pdf-home:recent-searches";

describe("RecentSearchesFeature 最近搜索插件", () => {
  let feature;
  let context;
  let globalEventBus;
  let scopedEventBus;

  beforeEach(async () => {
    window.localStorage.clear();
    document.body.innerHTML = `
      <div id="sidebar">
        <div class="sidebar-panel">
          <div class="sidebar-section" id="recent-searches-section">
            <h3 class="sidebar-section-title">
              <span>🔍 最近搜索</span>
            </h3>
            <ul class="sidebar-list" id="recent-searches-list">
              <li class="sidebar-empty">暂无搜索记录</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    globalEventBus = new EventBus({ moduleName: "recent-searches-test", enableValidation: false });
    scopedEventBus = new ScopedEventBus(globalEventBus, "recent-searches-test");

    context = {
      logger: createLogger(),
      scopedEventBus,
      globalEventBus,
      container: {
        register: jest.fn(),
        get: jest.fn()
      }
    };

    feature = new RecentSearchesFeature();
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
    const list = document.querySelector("#recent-searches-list");
    expect(list).not.toBeNull();
    // 初始应包含空占位
    expect(list.querySelector(".sidebar-empty")).not.toBeNull();
    // 本地存储应为空数组
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    expect(Array.isArray(stored)).toBe(true);
    expect(stored.length).toBe(0);
  });

  it("收到全局搜索请求时写入存储并渲染到UI", async () => {
    const searchText = "deep learning";
    globalEventBus.emit(SEARCH_EVENTS.QUERY.REQUESTED, { searchText });

    // 断言存储
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    expect(stored.length).toBe(1);
    expect(stored[0].text).toBe(searchText);

    // 断言UI渲染
    const list = document.querySelector("#recent-searches-list");
    const items = list.querySelectorAll(".sidebar-item");
    expect(items.length).toBe(1);
    expect(items[0].querySelector(".sidebar-item-text").textContent).toBe(searchText);
  });

  it("点击最近搜索项会重新触发全局搜索事件", () => {
    const searchText = "transformer attention";
    globalEventBus.emit(SEARCH_EVENTS.QUERY.REQUESTED, { searchText });

    const handler = jest.fn();
    const unsubscribe = globalEventBus.on(SEARCH_EVENTS.QUERY.REQUESTED, (data) => {
      handler(data.searchText);
    }, { subscriberId: "test-listener" });

    const firstItem = document.querySelector("#recent-searches-list .sidebar-item");
    expect(firstItem).not.toBeNull();
    firstItem.click();

    expect(handler).toHaveBeenCalled();
    expect(handler).toHaveBeenCalledWith(searchText);

    unsubscribe();
  });

  it("重复搜索提升到列表顶部且不重复存储", () => {
    const a = "nlp";
    const b = "cv";
    globalEventBus.emit(SEARCH_EVENTS.QUERY.REQUESTED, { searchText: a });
    globalEventBus.emit(SEARCH_EVENTS.QUERY.REQUESTED, { searchText: b });

    // 再次搜索 a，应移动到顶部
    globalEventBus.emit(SEARCH_EVENTS.QUERY.REQUESTED, { searchText: a });

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    expect(stored.length).toBe(2);
    expect(stored[0].text).toBe(a);
    expect(stored[1].text).toBe(b);

    const texts = Array.from(document.querySelectorAll("#recent-searches-list .sidebar-item-text")).map(el => el.textContent);
    expect(texts[0]).toBe(a);
    expect(texts[1]).toBe(b);
  });
});

