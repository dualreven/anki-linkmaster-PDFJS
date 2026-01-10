/**
 * @file PDFViewerManager PDF.js EventBus bridge uninstall 测试
 */

import { jest } from "@jest/globals";

jest.mock("pdfjs-dist", () => ({ version: "0-test" }), { virtual: true });

jest.mock("@pdfjs/web/pdf_viewer.mjs", () => {
  class EventBus {
    #handlers = new Map();

    on(name, handler) {
      const list = this.#handlers.get(name) ?? [];
      list.push(handler);
      this.#handlers.set(name, list);
    }

    off(name, handler) {
      const list = this.#handlers.get(name) ?? [];
      this.#handlers.set(name, list.filter((fn) => fn !== handler));
    }

    dispatch(name, evt) {
      const list = this.#handlers.get(name) ?? [];
      list.forEach((fn) => fn(evt));
    }
  }

  return {
    EventBus,
    PDFViewer: class {
      constructor() {}
      setDocument() {}
      setPageNumber() {}
    },
    PDFLinkService: class {
      constructor() {}
      setViewer() {}
      setDocument() {}
    },
    ScrollMode: {},
    SpreadMode: {},
  };
}, { virtual: true });

import { PDFViewerManager } from "../pdf-viewer-manager.js";
import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";

describe("PDFViewerManager event bridge uninstall", () => {
  function createContainer() {
    const container = document.createElement("div");
    const viewer = document.createElement("div");
    viewer.className = "pdfViewer";
    container.appendChild(viewer);
    return container;
  }

  test("initialize → destroy → initialize: pdfjs 事件桥接不应重复触发（可卸载）", () => {
    const appEventBus = { emit: jest.fn() };
    const manager = new PDFViewerManager(appEventBus);
    const container = createContainer();

    manager.initialize(container);
    const pdfjsBus = manager.eventBus;

    pdfjsBus.dispatch(PDF_VIEWER_EVENTS.PDFJS_EVENTS.PAGE.CHANGING, { pageNumber: 1 });
    const firstEmitCount = appEventBus.emit.mock.calls.length;
    expect(firstEmitCount).toBe(1);

    manager.destroy();
    pdfjsBus.dispatch(PDF_VIEWER_EVENTS.PDFJS_EVENTS.PAGE.CHANGING, { pageNumber: 2 });
    expect(appEventBus.emit.mock.calls.length).toBe(firstEmitCount);

    manager.initialize(container);
    const pdfjsBus2 = manager.eventBus;
    pdfjsBus2.dispatch(PDF_VIEWER_EVENTS.PDFJS_EVENTS.PAGE.CHANGING, { pageNumber: 3 });
    expect(appEventBus.emit.mock.calls.length).toBe(firstEmitCount + 1);
  });
});

