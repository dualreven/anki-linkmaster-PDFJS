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

describe("AnnoManager 导入行为（通过弹窗选择 PDF）", () => {
  beforeEach(() => {
    eventBus.on.mockClear();
    eventBus.emit.mockClear();
    showError.mockClear();

    document.body.innerHTML = `
      <div class="app-root anno-manager-root">
        <header class="pdf-home-header anno-manager-header">
          <div class="anno-manager-header-toolbar">
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

  test("点击导入：先请求 PDF 列表，再弹窗选择，确认后发送 annotation:list:requested", async () => {
    let receivedHandler = null;
    eventBus.on.mockImplementation((eventName, cb) => {
      if (eventName === WEBSOCKET_EVENTS.MESSAGE.RECEIVED) {
        receivedHandler = cb;
      }
      return () => { receivedHandler = null; };
    });

    const sent = [];
    eventBus.emit.mockImplementation((eventName, message) => {
      if (eventName === WEBSOCKET_EVENTS.MESSAGE.SEND) {
        sent.push(message);
      }
    });

    initAnnoManagerLayout();

    const btn = /** @type {HTMLButtonElement} */ (document.getElementById("anno-manager-import-btn"));
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(sent[0]).toEqual(expect.objectContaining({ type: WEBSOCKET_MESSAGE_TYPES.GET_PDF_LIST }));
    expect(sent[0].request_id).toEqual(expect.any(String));
    expect(typeof receivedHandler).toBe("function");

    const rid = sent[0].request_id;
    receivedHandler({
      type: WEBSOCKET_MESSAGE_TYPES.PDF_LIST_COMPLETED,
      request_id: rid,
      data: { files: [{ id: "pdf_123", filename: "a.pdf" }] }
    });

    // 等待导入流程继续执行并挂载弹窗 DOM
    await Promise.resolve();

    const modal = document.getElementById("anno-manager-import-modal");
    expect(modal).not.toBeNull();

    const select = /** @type {HTMLSelectElement} */ (document.getElementById("anno-manager-import-modal-select"));
    select.value = "pdf_123";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    const confirm = /** @type {HTMLButtonElement} */ (document.getElementById("anno-manager-import-modal-confirm"));
    expect(confirm.disabled).toBe(false);
    confirm.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // 等待导入流程恢复执行并发送 annotation:list
    await Promise.resolve();

    expect(sent).toContainEqual(expect.objectContaining({
      type: WEBSOCKET_MESSAGE_TYPES.ANNOTATION_LIST,
      data: { pdf_uuid: "pdf_123" },
    }));
  });

  test("取消弹窗不会发送 annotation:list:requested", async () => {
    let receivedHandler = null;
    eventBus.on.mockImplementation((eventName, cb) => {
      if (eventName === WEBSOCKET_EVENTS.MESSAGE.RECEIVED) {
        receivedHandler = cb;
      }
      return () => { receivedHandler = null; };
    });

    const sent = [];
    eventBus.emit.mockImplementation((eventName, message) => {
      if (eventName === WEBSOCKET_EVENTS.MESSAGE.SEND) {
        sent.push(message);
      }
    });

    initAnnoManagerLayout();

    const btn = /** @type {HTMLButtonElement} */ (document.getElementById("anno-manager-import-btn"));
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const rid = sent[0].request_id;
    receivedHandler({
      type: WEBSOCKET_MESSAGE_TYPES.PDF_LIST_COMPLETED,
      request_id: rid,
      data: { files: [{ id: "pdf_123", filename: "a.pdf" }] }
    });

    await Promise.resolve();

    const cancel = /** @type {HTMLButtonElement} */ (document.getElementById("anno-manager-import-modal-cancel"));
    cancel.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // 仅应发送 pdf list 请求，不应发送 annotation list
    expect(sent.filter((m) => m.type === WEBSOCKET_MESSAGE_TYPES.ANNOTATION_LIST)).toEqual([]);
  });
});
