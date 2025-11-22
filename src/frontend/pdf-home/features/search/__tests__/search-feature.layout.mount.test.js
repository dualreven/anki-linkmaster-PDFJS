/**
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { EventBus } from "../../../../common/event/event-bus.js";
import { ScopedEventBus } from "../../../../common/event/scoped-event-bus.js";
import { SearchFeature } from "../index.js";

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  event: jest.fn(),
});

describe("SearchFeature 布局挂载", () => {
  let feature;
  let globalEventBus;
  let scopedEventBus;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div class="app-root">
        <header class="pdf-home-header">HEADER</header>
        <main class="pdf-home-main">
          <aside id="sidebar" class="sidebar"></aside>
          <div class="main-content">
            <div class="search-results-header"></div>
            <div id="pdf-table-container"></div>
          </div>
        </main>
      </div>
    `;

    globalEventBus = new EventBus({ moduleName: "pdf-home-search-layout-test", enableValidation: false });
    scopedEventBus = new ScopedEventBus(globalEventBus, "search");

    const context = {
      logger: createLogger(),
      scopedEventBus,
      globalEventBus,
      container: {
        has: jest.fn(() => false),
        register: jest.fn(),
      },
    };

    feature = new SearchFeature();
    await feature.install(context);
  });

  afterEach(async () => {
    if (feature) {
      await feature.uninstall();
      feature = null;
    }
    document.body.innerHTML = "";
  });

  it("会将搜索面板挂载到 .main-content 内部且位于内容最上方", () => {
    const mainContent = document.querySelector(".main-content");
    expect(mainContent).toBeTruthy();

    const searchPanel = mainContent.querySelector(".search-panel");
    expect(searchPanel).toBeTruthy();

    // search-panel 应该是 main-content 的第一个子元素
    expect(mainContent.firstElementChild).toBe(searchPanel);

    // 搜索结果头部仍然存在于 search-panel 之后
    const resultsHeader = mainContent.querySelector(".search-results-header");
    expect(resultsHeader).toBeTruthy();
    expect(resultsHeader.previousElementSibling).toBe(searchPanel);
  });
});

