import { jest } from "@jest/globals";
import { TextHighlightTool } from "./index.js";
import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";
import { PDF_TRANSLATOR_EVENTS } from "../../../pdf-translator/events.js";

let mockHighlightRendererInstance;
let mockHighlightActionMenuInstance;
let pdfJsEventHandlers;
let pdfViewerManager;
let pageDiv;
let viewerContainer;
let mockAnnotationStore;

jest.mock("./highlight-renderer.js", () => ({
  HighlightRenderer: jest.fn().mockImplementation(() => mockHighlightRendererInstance)
}));

jest.mock("./floating-color-toolbar.js", () => ({
  FloatingColorToolbar: jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
    hide: jest.fn()
  }))
}));

jest.mock("./highlight-action-menu.js", () => ({
  HighlightActionMenu: jest.fn().mockImplementation((options) => {
    mockHighlightActionMenuInstance = {
      attach: jest.fn(),
      detach: jest.fn(),
      updateColor: jest.fn(),
      destroy: jest.fn(),
      options
    };
    return mockHighlightActionMenuInstance;
  })
}));

describe("TextHighlightTool integration with action menu", () => {
  let tool;
  let eventBus;
  let handlers;
  let logger;
  let container;
  let annotationManager;

  const createMockStore = (initialState = {}) => {
    let state = {
      annotations: [],
      ...initialState
    };

    /** @type {Set<{ selector: Function, callback: Function }>} */
    const subs = new Set();

    return {
      get: () => state,
      set: (partial) => {
        state = { ...state, ...partial };
        subs.forEach((sub) => {
          sub.callback(sub.selector(state));
        });
      },
      subscribe: (selector, callback, options = {}) => {
        const sub = { selector, callback };
        subs.add(sub);
        if (options.fireImmediately) {
          callback(selector(state));
        }
        return () => subs.delete(sub);
      },
      _subCount: () => subs.size,
    };
  };

  beforeEach(async () => {
    handlers = {};
    pdfJsEventHandlers = {};

    viewerContainer = document.createElement("div");
    viewerContainer.id = "viewerContainer";
    document.body.appendChild(viewerContainer);

    pageDiv = document.createElement("div");
    pageDiv.className = "page";
    pageDiv.dataset.pageNumber = "1";
    viewerContainer.appendChild(pageDiv);

    const pdfjsEventBus = {
      on: jest.fn((event, handler) => {
        pdfJsEventHandlers[event] = handler;
        return () => delete pdfJsEventHandlers[event];
      })
    };

    eventBus = {
      emit: jest.fn(),
      emitGlobal: jest.fn(),
      on: jest.fn((event, handler) => {
        handlers[event] = handler;
        return () => delete handlers[event];
      }),
      onGlobal: jest.fn((event, handler) => {
        handlers[event] = handler;
        return () => delete handlers[event];
      }),
      off: jest.fn(),
      offGlobal: jest.fn()
    };

    mockHighlightRendererInstance = {
      renderHighlight: jest.fn().mockReturnValue({
        container: document.createElement("div"),
        boundingBox: { left: 10, top: 20, right: 110, bottom: 60, width: 100, height: 40 }
      }),
      removeHighlight: jest.fn(),
      updateHighlightColor: jest.fn(),
      clearPageHighlights: jest.fn(),
      clearAllHighlights: jest.fn(),
      destroy: jest.fn()
    };

    mockHighlightActionMenuInstance = null;

    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    pdfViewerManager = {
      eventBus: pdfjsEventBus,
      getPageView: jest.fn(() => ({ div: pageDiv }))
    };

    mockAnnotationStore = createMockStore({ annotations: [] });
    annotationManager = { store: mockAnnotationStore };
    container = {
      get: jest.fn((key) => {
        if (key === "annotationManager") {return annotationManager;}
        return null;
      })
    };

    tool = new TextHighlightTool();
    await tool.initialize({ eventBus, logger, pdfViewerManager, container });
  });

  afterEach(() => {
    tool.destroy();
    jest.clearAllMocks();
    pdfJsEventHandlers = {};
    if (viewerContainer?.parentNode) {
      viewerContainer.parentNode.removeChild(viewerContainer);
    }
    viewerContainer = null;
    pageDiv = null;
  });

  const createAnnotation = () => ({
    id: "ann-1",
    type: "text-highlight",
    pageNumber: 1,
    data: {
      selectedText: "Sample text",
      highlightColor: "#ffeb3b",
      textRanges: [],
      lineRects: []
    }
  });

  it("attaches highlight action menu when annotation is created", () => {
    const annotation = createAnnotation();
    const textLayer = document.createElement("div");
    textLayer.className = "textLayer";
    pageDiv.appendChild(textLayer);
    mockAnnotationStore.set({ annotations: [annotation] });

    expect(mockHighlightRendererInstance.renderHighlight).toHaveBeenCalledWith(
      annotation.pageNumber,
      annotation.data.textRanges,
      annotation.data.highlightColor,
      annotation.id,
      annotation.data.lineRects
    );
    expect(mockHighlightActionMenuInstance).not.toBeNull();
    expect(mockHighlightActionMenuInstance.attach).toHaveBeenCalled();
  });

  it("emits update request when color change handler triggered", () => {
    const annotation = createAnnotation();
    const textLayer = document.createElement("div");
    textLayer.className = "textLayer";
    pageDiv.appendChild(textLayer);
    mockAnnotationStore.set({ annotations: [annotation] });

    const { onColorChange } = mockHighlightActionMenuInstance.options;
    onColorChange(annotation, "#4caf50");

    expect(mockHighlightRendererInstance.updateHighlightColor).toHaveBeenCalledWith(annotation.id, "#4caf50");
    expect(mockHighlightActionMenuInstance.updateColor).toHaveBeenCalledWith(annotation.id, "#4caf50");
    expect(eventBus.emit).toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.ANNOTATION.UPDATE,
      expect.objectContaining({
        id: annotation.id,
        changes: {
          data: {
            highlightColor: "#4caf50"
          }
        }
      })
    );
  });

  it("emits navigation and sidebar events when jump handler triggered", () => {
    const annotation = createAnnotation();
    const textLayer = document.createElement("div");
    textLayer.className = "textLayer";
    pageDiv.appendChild(textLayer);
    mockAnnotationStore.set({ annotations: [annotation] });

    const { onJump } = mockHighlightActionMenuInstance.options;
    eventBus.emit.mockClear();
    eventBus.emitGlobal.mockClear();
    onJump(annotation);

    expect(eventBus.emitGlobal).toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPEN_REQUESTED,
      { sidebarId: "annotation" }
    );
    expect(eventBus.emit).toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.ANNOTATION.SELECT,
      { id: annotation.id }
    );
    expect(eventBus.emitGlobal).toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED,
      { annotation }
    );
  });

  it("emits translator event when translate handler triggered", () => {
    const annotation = createAnnotation();
    const textLayer = document.createElement("div");
    textLayer.className = "textLayer";
    pageDiv.appendChild(textLayer);
    mockAnnotationStore.set({ annotations: [annotation] });

    const { onTranslate } = mockHighlightActionMenuInstance.options;
    eventBus.emit.mockClear();
    eventBus.emitGlobal.mockClear();
    onTranslate(annotation);

    expect(eventBus.emitGlobal).toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPEN_REQUESTED,
      { sidebarId: "translate" }
    );
    expect(eventBus.emitGlobal).toHaveBeenCalledWith(
      PDF_TRANSLATOR_EVENTS.TEXT.SELECTED,
      expect.objectContaining({
        text: annotation.data.selectedText,
        annotationId: annotation.id
      })
    );
  });

  it("renders highlights when store updates and text layer is ready", () => {
    const annotation = createAnnotation();
    const textLayer = document.createElement("div");
    textLayer.className = "textLayer";
    pageDiv.appendChild(textLayer);
    mockAnnotationStore.set({ annotations: [annotation] });

    expect(mockHighlightRendererInstance.renderHighlight).toHaveBeenCalledWith(
      annotation.pageNumber,
      annotation.data.textRanges,
      annotation.data.highlightColor,
      annotation.id,
      annotation.data.lineRects
    );
  });

  it("queues highlight rendering until text layer finished rendering", () => {
    const annotation = createAnnotation();
    mockAnnotationStore.set({ annotations: [annotation] });

    expect(mockHighlightRendererInstance.renderHighlight).not.toHaveBeenCalled();

    const textLayer = document.createElement("div");
    textLayer.className = "textLayer";
    pageDiv.appendChild(textLayer);

    const textLayerHandler = pdfJsEventHandlers.textlayerrendered;
    expect(typeof textLayerHandler).toBe("function");
    textLayerHandler({ pageNumber: annotation.pageNumber });

    expect(mockHighlightRendererInstance.renderHighlight).toHaveBeenCalledWith(
      annotation.pageNumber,
      annotation.data.textRanges,
      annotation.data.highlightColor,
      annotation.id,
      annotation.data.lineRects
    );
  });

  it("removes highlight overlay when store deletes the annotation", () => {
    const annotation = createAnnotation();
    const textLayer = document.createElement("div");
    textLayer.className = "textLayer";
    pageDiv.appendChild(textLayer);

    mockAnnotationStore.set({ annotations: [annotation] });
    expect(mockHighlightRendererInstance.renderHighlight).toHaveBeenCalled();

    mockHighlightRendererInstance.renderHighlight.mockClear();
    mockHighlightRendererInstance.removeHighlight.mockClear();
    mockHighlightActionMenuInstance.detach.mockClear();

    mockAnnotationStore.set({ annotations: [] });

    expect(mockHighlightRendererInstance.removeHighlight).toHaveBeenCalledWith(annotation.id);
    expect(mockHighlightActionMenuInstance.detach).toHaveBeenCalledWith(annotation.id);
    expect(mockHighlightRendererInstance.renderHighlight).not.toHaveBeenCalled();
  });

  it("unsubscribes from store on destroy (no further store-driven updates)", () => {
    expect(mockAnnotationStore._subCount()).toBeGreaterThan(0);

    // destroy should unsubscribe store subscription
    tool.destroy();
    expect(mockAnnotationStore._subCount()).toBe(0);

    // even if store changes later, there should be no new render work triggered by this tool
    mockHighlightRendererInstance.renderHighlight.mockClear();

    const annotation = createAnnotation();
    mockAnnotationStore.set({ annotations: [annotation] });
    expect(mockHighlightRendererInstance.renderHighlight).not.toHaveBeenCalled();

    // prevent afterEach double-destroy
    tool = { destroy() {} };
  });
});
