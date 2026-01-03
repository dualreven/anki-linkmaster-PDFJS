/**
 * UIManagerCore 销毁时 DOM 监听器解绑测试
 * - 防回归：避免 addEventListener 使用 bind() 导致 removeEventListener 无法移除
 */

import { UIManagerCore } from "../components/ui-manager-core.js";
import { EventBus } from "../../../../common/event/event-bus.js";

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
  }
}));

jest.mock("../components/ui-layout-controls.js", () => ({
  UILayoutControls: class {
    setup() {}
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

describe("UIManagerCore.destroy()", () => {
  let eventBus;

  beforeEach(() => {
    mountMinimalDOM();
    document.execCommand = jest.fn().mockReturnValue(true);
    eventBus = new EventBus({ enableValidation: true });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  test("destroy() 会正确移除 wheel/resize 监听器（同一 handler 引用）", async () => {
    const viewerContainer = document.getElementById("viewerContainer");
    expect(viewerContainer).not.toBeNull();

    const addWheelSpy = jest.spyOn(viewerContainer, "addEventListener");
    const removeWheelSpy = jest.spyOn(viewerContainer, "removeEventListener");
    const addWinSpy = jest.spyOn(window, "addEventListener");
    const removeWinSpy = jest.spyOn(window, "removeEventListener");

    const ui = new UIManagerCore(eventBus);
    await ui.initialize();

    const wheelAddCall = addWheelSpy.mock.calls.find((c) => c[0] === "wheel");
    expect(wheelAddCall).toBeDefined();
    const wheelHandler = wheelAddCall[1];
    expect(typeof wheelHandler).toBe("function");

    const resizeAddCall = addWinSpy.mock.calls.find((c) => c[0] === "resize");
    const resizeHandler = resizeAddCall ? resizeAddCall[1] : null;

    ui.destroy();

    const wheelRemovedWithSameHandler = removeWheelSpy.mock.calls.some(
      (c) => c[0] === "wheel" && c[1] === wheelHandler
    );
    expect(wheelRemovedWithSameHandler).toBe(true);

    if (resizeHandler) {
      const resizeRemovedWithSameHandler = removeWinSpy.mock.calls.some(
        (c) => c[0] === "resize" && c[1] === resizeHandler
      );
      expect(resizeRemovedWithSameHandler).toBe(true);
    }
  });
});

