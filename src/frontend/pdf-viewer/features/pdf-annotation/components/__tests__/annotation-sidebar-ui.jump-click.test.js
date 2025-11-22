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
jest.mock("../../../../../common/utils/thirdparty-toast.js", () => ({
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
}));
jest.mock("../../../../../common/utils/notification.js", () => ({
  showInfo: jest.fn(),
}));

import { AnnotationSidebarUI } from "../annotation-sidebar-ui.js";
import { Annotation, AnnotationType } from "../../../../../common/models/annotation.js";
import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";

/**
 * 冒烟/功能完整性：AnnotationSidebarUI 卡片跳转
 * - 覆盖两条触发路径：
 *   1) 右上角“🧭 跳转”按钮（类名 .annotation-jump-btn）→ 发射 ANNOTATION.JUMP_TO（别名 JUMP_REQUESTED）
 *   2) 卡片内部委托按钮（类名 .jump-btn + data-annotation-id）→ 发射全局 URL_PARAMS.REQUESTED
 */
describe("AnnotationSidebarUI jump actions", () => {
  let eventBus;
  let ui;

  beforeEach(() => {
    // JSDOM 初始化
    document.body.innerHTML = "";
    // 事件总线桩（遵循项目 EventBus 的基本接口）
    eventBus = {
      emit: jest.fn(() => true),
      emitGlobal: jest.fn(() => true),
      on: jest.fn(() => () => {}),
      onGlobal: jest.fn(() => () => {}),
    };
    // 实例化 UI
    ui = new AnnotationSidebarUI(eventBus);
    ui.initialize();
    document.body.appendChild(ui.getContentElement());
  });

  afterEach(() => {
    ui.destroy();
    jest.clearAllMocks();
  });

  function createHighlightAnnotation(overrides = {}) {
    return new Annotation({
      id: overrides.id || "pdfannotation-_AbC123xyzDEF456",
      type: AnnotationType.TEXT_HIGHLIGHT,
      pageNumber: overrides.pageNumber ?? 5,
      data: {
        selectedText: "测试文本",
        highlightColor: "#ffff00",
        // lineRects 用于计算 position 百分比（yPercent + heightPercent/2）
        lineRects: overrides.lineRects ?? [
          { xPercent: 10, yPercent: 20, widthPercent: 30, heightPercent: 10 },
        ],
        ...(overrides.data || {}),
      },
    });
  }

  test("点击卡片右上角跳转按钮，应发射全局 ANNOTATION.NAVIGATION.JUMP_REQUESTED", () => {
    const annotation = createHighlightAnnotation();
    ui.addAnnotationCard(annotation);

    const jumpBtn = ui
      .getContentElement()
      .querySelector(".annotation-card .annotation-jump-btn");

    expect(jumpBtn).not.toBeNull();

    eventBus.emitGlobal.mockClear();
    jumpBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // 至少一次发射（JUMP_REQUESTED + JUMP_SUCCESS）
    expect(eventBus.emitGlobal.mock.calls.length).toBeGreaterThanOrEqual(1);
    // 第一次应为 JUMP_REQUESTED，载荷包含完整 annotation 对象
    const [evtName, payload] = eventBus.emitGlobal.mock.calls[0];
    expect(evtName).toBe(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED);
    expect(payload).toMatchObject({ annotation: expect.any(Object) });
    expect(payload.annotation.id).toBe(annotation.id);
  });

  test("点击委托跳转按钮(.jump-btn[data-annotation-id])，应发射全局 ANNOTATION.NAVIGATION.JUMP_REQUESTED", () => {
    const annotation = createHighlightAnnotation({
      pageNumber: 7,
      lineRects: [{ xPercent: 0, yPercent: 33.3, widthPercent: 100, heightPercent: 12.4 }],
    });
    ui.addAnnotationCard(annotation);

    // 在该卡片内模拟工具自带的跳转按钮（委托选择器匹配 .jump-btn）
    const card = ui.getContentElement().querySelector(
      `.annotation-card[data-annotation-id="${annotation.id}"]`
    );
    expect(card).not.toBeNull();
    const delegatedBtn = document.createElement("button");
    delegatedBtn.className = "jump-btn";
    delegatedBtn.setAttribute("data-annotation-id", annotation.id);
    card.appendChild(delegatedBtn);

    eventBus.emitGlobal.mockClear();
    delegatedBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // 可能发出两次（REQUESTED + SUCCESS），此处校验至少一次，且首条为 REQUESTED
    expect(eventBus.emitGlobal.mock.calls.length).toBeGreaterThanOrEqual(1);
    const [evtName, payload] = eventBus.emitGlobal.mock.calls[0];
    expect(evtName).toBe(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED);
    // 载荷包含 annotation 对象（内含 pageNumber 等）
    expect(payload).toMatchObject({ annotation: expect.any(Object) });
    expect(payload.annotation.id).toBe(annotation.id);
    expect(payload.annotation.pageNumber).toBe(annotation.pageNumber);
  });
});
