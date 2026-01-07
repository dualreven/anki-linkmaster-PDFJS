// 避免 logger / notification 依赖真实实现导致测试环境报错
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

import { AnnotationSidebarUI } from "../annotation-sidebar-ui.js";
import { Annotation, AnnotationType } from "../../../../../common/models/annotation.js";
import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";
import { ObservableState } from "../../../../../common/utils/observable.js";

describe("AnnotationSidebarUI 评论对话框保存行为", () => {
  let eventBus;
  let ui;
  let store;

  beforeEach(() => {
    document.body.innerHTML = "";
    eventBus = {
      emit: jest.fn(() => true),
      emitGlobal: jest.fn(() => true),
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
    jest.clearAllMocks();
  });

  function createHighlightAnnotation() {
    return new Annotation({
      id: "ann-test-comment",
      type: AnnotationType.TEXT_HIGHLIGHT,
      pageNumber: 3,
      data: {
        selectedText: "测试文本",
        highlightColor: "#ffff00",
        lineRects: [{ xPercent: 10, yPercent: 20, widthPercent: 30, heightPercent: 10 }],
      },
    });
  }

  test("在评论对话框中添加评论时，应发出 ANNOTATION.COMMENT.ADD 事件以触发持久化", async () => {
    const annotation = createHighlightAnnotation();
    store.set({ annotations: [annotation] });

    const commentBtn = ui
      .getContentElement()
      .querySelector(".annotation-card .annotation-comment-btn");

    expect(commentBtn).not.toBeNull();

    // 打开评论对话框
    commentBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // 填写评论内容
    const textarea = document.querySelector("textarea");
    expect(textarea).not.toBeNull();
    textarea.value = "新的评论内容";

    // 点击确认按钮（aria-label="确定"）
    const confirmBtn = document.querySelector("button[aria-label=\"确定\"]");
    expect(confirmBtn).not.toBeNull();
    confirmBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 0));

    const calls = eventBus.emit.mock.calls.filter(
      ([evtName]) => evtName === PDF_VIEWER_EVENTS.ANNOTATION.COMMENT.ADD
    );
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const [, payload] = calls[0];
    expect(payload).toMatchObject({
      annotationId: annotation.id,
      content: "新的评论内容",
    });
  });
});
