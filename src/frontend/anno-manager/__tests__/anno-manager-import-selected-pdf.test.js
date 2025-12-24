// 避免真实窗口控制逻辑在测试中运行
global.window = global.window || {};
window.__ANNO_MANAGER_TEST__ = true;

jest.mock("../../common/event/event-bus.js", () => ({
  __esModule: true,
  default: {
    on: jest.fn(),
    emit: jest.fn(),
  },
}));

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

import eventBus from "../../common/event/event-bus.js";
import { showError } from "../../common/utils/notification.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../common/event/event-constants.js";
import { initAnnoManagerLayout } from "../main.js";

describe("AnnoManager 导入行为（使用 Header 选择的 PDF）", () => {
  beforeEach(() => {
    eventBus.on.mockClear();
    eventBus.emit.mockClear();
    showError.mockClear();

    document.body.innerHTML = `
      <div class="app-root anno-manager-root">
        <header class="pdf-home-header anno-manager-header">
          <div class="anno-manager-header-toolbar">
            <select id="anno-manager-pdf-select"></select>
            <button id="anno-manager-import-btn"></button>
          </div>
        </header>
        <main class="pdf-home-main anno-manager-main">
          <aside class="sidebar anno-manager-sidebar" id="anno-manager-sidebar"></aside>
          <div class="main-content anno-manager-main-content">
            <div class="anno-manager-view-modes">
              <button class="view-mode-btn" data-view-mode="list"></button>
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

  test("已选择 PDF 时点击导入，会发 annotation:list:requested（使用选择的 pdf_id）", () => {
    initAnnoManagerLayout();

    const select = /** @type {HTMLSelectElement} */ (document.getElementById("anno-manager-pdf-select"));
    select.innerHTML = `
      <option value="">请选择</option>
      <option value="pdf_123">PDF 123</option>
    `;
    select.value = "pdf_123";

    const btn = /** @type {HTMLButtonElement} */ (document.getElementById("anno-manager-import-btn"));
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(eventBus.emit).toHaveBeenCalledWith(
      WEBSOCKET_EVENTS.MESSAGE.SEND,
      expect.objectContaining({
        type: WEBSOCKET_MESSAGE_TYPES.ANNOTATION_LIST,
        data: { pdf_uuid: "pdf_123" },
      }),
      expect.any(Object)
    );
  });

  test("未选择 PDF 时点击导入，会提示错误且不发送请求", () => {
    initAnnoManagerLayout();

    const btn = /** @type {HTMLButtonElement} */ (document.getElementById("anno-manager-import-btn"));
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(showError).toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalled();
  });
});
