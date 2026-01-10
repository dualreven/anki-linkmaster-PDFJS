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

import { ObservableState } from "../../../../../common/utils/observable.js";
import { Annotation, AnnotationType } from "../../../../../common/models/annotation.js";
import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";
import { AnnotationSidebarUI } from "../annotation-sidebar-ui.js";

describe("AnnotationSidebarUI（store 驱动）", () => {
  function createStubBus() {
    return {
      emit: jest.fn(() => true),
      emitGlobal: jest.fn(() => true),
      on: jest.fn(() => () => {}),
      onGlobal: jest.fn(() => () => {}),
    };
  }

  function createManagerWithStore(initial = { annotations: [] }) {
    return { store: new ObservableState(initial, { name: "TestAnnotationStore" }) };
  }

  function createHighlightAnnotation(overrides = {}) {
    return new Annotation({
      id: overrides.id || "pdfannotation-_AbC123xyzDEF456",
      type: AnnotationType.TEXT_HIGHLIGHT,
      pageNumber: overrides.pageNumber ?? 5,
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

  test("store.annotations 变化应触发渲染（无需 EventBus CRUD 事件）", () => {
    document.body.innerHTML = "";

    const eventBus = createStubBus();
    const manager = createManagerWithStore();
    const ui = new AnnotationSidebarUI(eventBus, { annotationManager: manager });
    ui.initialize();
    document.body.appendChild(ui.getContentElement());

    // 不应订阅 CRUD 事件（避免 event-driven UI）
    const subscribedEvents = [
      ...eventBus.on.mock.calls.map(([evt]) => evt),
      ...eventBus.onGlobal.mock.calls.map(([evt]) => evt),
    ];
    expect(subscribedEvents).not.toContain(PDF_VIEWER_EVENTS.ANNOTATION.CREATED);
    expect(subscribedEvents).not.toContain(PDF_VIEWER_EVENTS.ANNOTATION.UPDATED);
    expect(subscribedEvents).not.toContain(PDF_VIEWER_EVENTS.ANNOTATION.DELETED);
    expect(subscribedEvents).not.toContain(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED);

    const annotation = createHighlightAnnotation();
    manager.store.set({ annotations: [annotation] });

    const card = ui.getContentElement().querySelector(".annotation-card");
    expect(card).not.toBeNull();

    ui.destroy();
  });

  test("destroy 后 store 更新不应再触发渲染（避免订阅泄漏）", () => {
    document.body.innerHTML = "";

    const eventBus = createStubBus();
    const manager = createManagerWithStore();
    const ui = new AnnotationSidebarUI(eventBus, { annotationManager: manager });
    const renderSpy = jest.spyOn(ui, "render");
    ui.initialize();
    document.body.appendChild(ui.getContentElement());

    renderSpy.mockClear();
    ui.destroy();

    manager.store.set({ annotations: [createHighlightAnnotation({ id: "ann-after-destroy" })] });
    expect(renderSpy).not.toHaveBeenCalled();
  });
});
