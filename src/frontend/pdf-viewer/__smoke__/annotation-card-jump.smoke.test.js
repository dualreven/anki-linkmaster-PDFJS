jest.mock("../../common/utils/logger.js", () => {
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
jest.mock("../../common/utils/thirdparty-toast.js", () => ({
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
}));
jest.mock("../../common/utils/notification.js", () => ({
  showInfo: jest.fn(),
}));

import { AnnotationSidebarUI } from "../features/annotation/components/annotation-sidebar-ui.js";
import { Annotation, AnnotationType } from "../features/annotation/models/annotation.js";
import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";

/**
 * 极简冒烟测试：验证“标注卡片跳转”关键链路至少能发出跳转请求事件。
 * 关注点：
 * - 点击 .annotation-jump-btn → 触发 ANNOTATION.JUMP_TO（兼容常量）
 */
describe("SMOKE: Annotation card jump", () => {
  test("clicking card .annotation-jump-btn emits JUMP_TO", () => {
    document.body.innerHTML = "";
    const eventBus = {
      emit: jest.fn(() => true),
      emitGlobal: jest.fn(() => true),
      on: jest.fn(() => () => {}),
      onGlobal: jest.fn(() => () => {}),
    };

    const ui = new AnnotationSidebarUI(eventBus);
    ui.initialize();
    document.body.appendChild(ui.getContentElement());

    const ann = new Annotation({
      id: "pdfannotation-SMOKETEST____ok",
      type: AnnotationType.TEXT_HIGHLIGHT,
      pageNumber: 3,
      data: {
        selectedText: "smoke",
        highlightColor: "#ffff00",
        lineRects: [{ xPercent: 0, yPercent: 10, widthPercent: 50, heightPercent: 10 }],
      },
    });
    ui.addAnnotationCard(ann);

    const btn = ui.getContentElement().querySelector(".annotation-card .annotation-jump-btn");
    expect(btn).not.toBeNull();
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(eventBus.emit).toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.ANNOTATION.JUMP_TO,
      expect.objectContaining({ id: ann.id, annotation: expect.any(Object) })
    );

    ui.destroy();
  });
});
