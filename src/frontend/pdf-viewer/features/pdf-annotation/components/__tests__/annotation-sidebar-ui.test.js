import { AnnotationSidebarUI } from "../annotation-sidebar-ui.js";
import { Annotation, AnnotationType } from "../../../../../common/models/annotation.js";
import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";
import { ObservableState } from "../../../../../common/utils/observable.js";

describe("AnnotationSidebarUI delete button", () => {
  let eventBus;
  let ui;
  let store;

  beforeEach(() => {
    document.body.innerHTML = "";
    eventBus = {
      emit: jest.fn(),
      on: jest.fn(() => () => {}),
      onGlobal: jest.fn(() => () => {}),
    };

    store = new ObservableState({ annotations: [] }, { name: "TestAnnotationStore" });
    ui = new AnnotationSidebarUI(eventBus, { annotationManager: { store } });
    ui.initialize();
    document.body.appendChild(ui.getContentElement());
  });

  afterEach(() => {
    ui.destroy();
  });

  const createHighlightAnnotation = () => new Annotation({
    id: "ann-test",
    type: AnnotationType.TEXT_HIGHLIGHT,
    pageNumber: 1,
    data: {
      selectedText: "测试文本",
      highlightColor: "#ffff00",
      lineRects: [{ xPercent: 10, yPercent: 20, widthPercent: 30, heightPercent: 10 }],
    },
  });

  it("emits delete event when delete button confirmed", async () => {
    const annotation = createHighlightAnnotation();
    store.set({ annotations: [annotation] });

    const deleteBtn = ui
      .getContentElement()
      .querySelector(".annotation-card .annotation-delete-btn");

    expect(deleteBtn).not.toBeNull();

    eventBus.emit.mockClear();
    deleteBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // 等待确认对话框出现
    await new Promise(resolve => setTimeout(resolve, 0));

    // 查找并点击"删除"按钮
    const buttons = Array.from(document.body.querySelectorAll("button"));
    const deleteConfirmBtn = buttons.find(btn => btn.textContent === "删除");

    expect(deleteConfirmBtn).not.toBeNull();
    deleteConfirmBtn.click();

    // 等待事件发出
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(eventBus.emit).toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.ANNOTATION.DELETE,
      { id: annotation.id }
    );
  });

  it("does not emit delete event when user cancels", async () => {
    const annotation = createHighlightAnnotation();
    store.set({ annotations: [annotation] });

    const deleteBtn = ui
      .getContentElement()
      .querySelector(".annotation-card .annotation-delete-btn");

    eventBus.emit.mockClear();
    deleteBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // 等待确认对话框出现
    await new Promise(resolve => setTimeout(resolve, 0));

    // 查找并点击"取消"按钮
    const buttons = Array.from(document.body.querySelectorAll("button"));
    const cancelBtn = buttons.find(btn => btn.textContent === "取消");

    expect(cancelBtn).not.toBeNull();
    cancelBtn.click();

    // 等待事件处理
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(eventBus.emit).not.toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.ANNOTATION.DELETE,
      expect.anything()
    );
  });
});
