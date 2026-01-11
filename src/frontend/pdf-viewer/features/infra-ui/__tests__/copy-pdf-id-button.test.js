/**
 * 复制 PDF ID 按钮行为测试
 * - 场景A：URL 含 pdf-id
 * - 场景B：无 pdf-id，基于 FILE.LOAD.SUCCESS 的 filename 回填（修复验证）
 */

import { UIManagerCore } from "../components/ui-manager-core.js";
import { EventBus } from "../../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";

// 避免引入真实的 PDF.js 与复杂 UI 控件，使用最小 stub
jest.mock("../components/pdf-viewer-manager.js", () => ({
  PDFViewerManager: class {
    constructor() {
      this.pagesCount = 1;
      this.currentPageNumber = 1;
      this.currentScale = 1.0;
    }
    initialize() {}
    load() {}
  }
}));

jest.mock("../components/ui-zoom-controls.js", () => ({
  UIZoomControls: class {
    async setupZoomControls() {}
    setScale() {}
    updatePageInfo() {}
    destroy() {}
  }
}));

jest.mock("../components/ui-layout-controls.js", () => ({
  UILayoutControls: class {
    setup() {}
    onRenderModeChanged() {}
    destroy() {}
  }
}));

function mountMinimalDOM() {
  document.body.innerHTML = `
    <div class="container">
      <header>
        <div class="header-left">
          <button id="copy-pdf-id-btn" class="btn copy-id-btn" title="复制 PDF ID" style="display:none;"></button>
          <h1 id="pdf-title">PDF阅读器-D</h1>
        </div>
      </header>
      <main>
        <div id="viewerContainer" class="pdf-container">
          <div id="viewer" class="pdfViewer"></div>
        </div>
      </main>
    </div>
    <!-- 浮动控制面板的必需控件（最小集） -->
    <div id="floating-controls" class="floating-controls">
      <div class="zoom-controls">
        <button id="zoom-out" class="btn">-</button>
        <span id="zoom-level">100%</span>
        <button id="zoom-in" class="btn">+</button>
      </div>
      <div class="page-controls">
        <button id="prev-page" class="btn">←</button>
        <input type="number" id="page-input" class="page-input" min="1" value="1" />
        <span id="page-total">/ 1</span>
        <button id="next-page" class="btn">→</button>
      </div>
    </div>
  `;
}

describe("复制 PDF ID 按钮", () => {
  let originalClipboard;
  let eventBus;
  let ui;

  beforeEach(() => {
    // 准备 jsdom DOM
    mountMinimalDOM();

    // stub 复制命令（UI 使用 document.execCommand 实现复制）
    document.execCommand = jest.fn().mockReturnValue(true);

    // Mock navigator.clipboard
    originalClipboard = global.navigator.clipboard;
    global.navigator.clipboard = { writeText: jest.fn().mockResolvedValue(undefined) };

    // 使用无需事件名校验的 EventBus
    eventBus = new EventBus({ enableValidation: true });
    ui = null;
  });

  afterEach(() => {
    if (ui) {
      try {
        ui.destroy();
      } catch {
        // ignore
      }
      ui = null;
    }
    // 还原 clipboard
    global.navigator.clipboard = originalClipboard;
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  test("收到 URL_PARAMS.PARSED(pdfId=sample) 后按钮可见且可复制", async () => {
    ui = new UIManagerCore(eventBus);
    await ui.initialize();

    // 通过事件传入 pdfId（真实运行中由 URLNavigationFeature 触发）
    eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.PARSED, { pdfId: "sample", pageAt: null, position: null });

    const btn = document.getElementById("copy-pdf-id-btn");
    expect(btn).not.toBeNull();

    // 等待事件处理
    await Promise.resolve();

    expect(btn.style.display).toBe("flex");

    // 触发点击并断言 UI 效果（execCommand 分支）
    btn.click();
    await Promise.resolve();

    expect(document.execCommand).toHaveBeenCalledWith("copy");
    expect(btn.classList.contains("copied")).toBe(true);
    expect(btn.title).toBe("已复制: sample");
  });

  test("无 pdf-id 时通过事件回填 id（doc）并可复制", async () => {
    ui = new UIManagerCore(eventBus);
    await ui.initialize();

    // 发送 FILE.LOAD.SUCCESS 事件（模拟加载完成）
    eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, { filename: "doc.pdf", pdfDocument: { numPages: 1 } });

    const btn = document.getElementById("copy-pdf-id-btn");
    expect(btn).not.toBeNull();

    // 等待事件处理与可能的异步 UI 同步
    await new Promise((r) => setTimeout(r, 10));

    // 通过事件回填 pdfId（真实运行中通常由 URL 解析提供）
    eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.PARSED, { pdfId: "doc" });
    await Promise.resolve();

    // 按钮应显示
    expect(btn.style.display).toBe("flex");

    btn.click();
    await Promise.resolve();

    expect(document.execCommand).toHaveBeenCalledWith("copy");
    expect(btn.classList.contains("copied")).toBe(true);
    expect(btn.title).toBe("已复制: doc");
  });
});
