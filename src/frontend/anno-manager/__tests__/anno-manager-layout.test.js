// 避免真实窗口控制逻辑在测试中运行
global.window = global.window || {};
// 标记测试模式，main.js 中不会自动执行 bootstrap
window.__ANNO_MANAGER_TEST__ = true;

jest.mock("../../common/utils/logger.js", () => ({
  getLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock("../../common/utils/notification.js", () => ({
  showInfo: jest.fn(),
  showSuccess: jest.fn(),
  showError: jest.fn(),
}));

jest.mock("../../common/window/basic-window-controls.js", () => ({
  attachBasicWindowControls: jest.fn().mockResolvedValue(undefined),
}));

import { initAnnoManagerLayout } from "../main.js";

describe("AnnoManager 基础布局骨架", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="app-root anno-manager-root">
        <header class="pdf-home-header anno-manager-header">
          <div class="pdf-home-header-main">
            <h1 class="pdf-home-title">🧩 标注管理器</h1>
            <div class="toolbar-controls" id="window-controls-slot"></div>
          </div>
          <div class="anno-manager-header-toolbar">
            <input id="anno-manager-search-input" />
            <button id="anno-manager-filter-btn"></button>
            <button id="anno-manager-sort-btn"></button>
            <button id="anno-manager-import-btn"></button>
          </div>
        </header>
        <main class="pdf-home-main anno-manager-main">
          <aside class="sidebar anno-manager-sidebar" id="anno-manager-sidebar"></aside>
          <div class="main-content anno-manager-main-content">
            <div class="anno-manager-view-modes">
              <button class="view-mode-btn" data-view-mode="list"></button>
              <button class="view-mode-btn" data-view-mode="grid-2"></button>
            </div>
            <span id="anno-manager-count-badge"></span>
            <div id="anno-manager-results"></div>
          </div>
        </main>
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("初始化后侧边栏包含三块：搜索条件/最近添加/最近访问", () => {
    initAnnoManagerLayout();

    const sections = Array.from(
      document.querySelectorAll(".anno-manager-sidebar-section-title")
    ).map((el) => el.textContent);

    expect(sections).toEqual(["搜索条件", "最近添加", "最近访问"]);
  });

  test("初始化后结果区域存在空状态提示", () => {
    initAnnoManagerLayout();

    const emptyTip = document.querySelector(".anno-manager-empty-tip");
    expect(emptyTip).not.toBeNull();
    expect(emptyTip.textContent || "").toContain("暂无标注数据");
  });

  test("视图模式按钮点击会切换 active 状态", () => {
    initAnnoManagerLayout();

    const buttons = document.querySelectorAll(".view-mode-btn");
    expect(buttons.length).toBeGreaterThanOrEqual(2);

    const listBtn = buttons[0];
    const gridBtn = buttons[1];

    // 初始 list 模式
    listBtn.classList.add("active");

    gridBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(gridBtn.classList.contains("active")).toBe(true);
  });
});

