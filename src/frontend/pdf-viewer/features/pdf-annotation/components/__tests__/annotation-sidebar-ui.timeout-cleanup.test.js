// 必须先 mock，避免被 logger.js 的 import.meta 解析影响
jest.mock("../../../../../common/utils/logger.js", () => {
  return {
    getLogger: () => ({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }),
    setModuleLogLevel: jest.fn(),
    LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" },
  };
});
jest.mock("../../../../../common/utils/notification.js", () => ({
  showSuccess: jest.fn(),
  showError: jest.fn(),
  showInfo: jest.fn(),
}));

import { ObservableState } from "../../../../../common/utils/observable.js";
import { Annotation, AnnotationType } from "../../../../../common/models/annotation.js";
import { AnnotationSidebarUI } from "../annotation-sidebar-ui.js";

describe("AnnotationSidebarUI timeout cleanup", () => {
  /** @type {any} */
  let originalScrollIntoView = null;

  beforeEach(() => {
    document.body.innerHTML = "";
    jest.useFakeTimers();
    originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
    originalScrollIntoView = null;
    jest.useRealTimers();
  });

  function createStubBus() {
    return {
      emit: jest.fn(() => true),
      emitGlobal: jest.fn(() => true),
      on: jest.fn(() => () => {}),
      onGlobal: jest.fn(() => () => {}),
    };
  }

  function createHighlightAnnotation(overrides = {}) {
    return new Annotation({
      id: overrides.id || "ann-timeout-test",
      type: AnnotationType.TEXT_HIGHLIGHT,
      pageNumber: overrides.pageNumber ?? 1,
      data: {
        selectedText: "测试文本",
        highlightColor: "#ffff00",
        lineRects: overrides.lineRects ?? [
          { xPercent: 10, yPercent: 20, widthPercent: 30, heightPercent: 10 },
        ],
        ...(overrides.data || {}),
      },
    });
  }

  test("destroy 后推进 timers，不应再写入 DOM（清理 highlight timeout）", () => {
    const setPropertySpy = jest.spyOn(CSSStyleDeclaration.prototype, "setProperty");

    const eventBus = createStubBus();
    const store = new ObservableState({ annotations: [] }, { name: "TestAnnotationStore" });
    const ui = new AnnotationSidebarUI(eventBus, { annotationManager: { store } });
    ui.initialize();
    document.body.appendChild(ui.getContentElement());

    const annotation = createHighlightAnnotation();
    store.set({ annotations: [annotation] });

    ui.highlightAndScrollToCard(annotation.id);
    setPropertySpy.mockClear();

    ui.destroy();
    jest.advanceTimersByTime(3000);

    expect(setPropertySpy).not.toHaveBeenCalled();
  });
});

