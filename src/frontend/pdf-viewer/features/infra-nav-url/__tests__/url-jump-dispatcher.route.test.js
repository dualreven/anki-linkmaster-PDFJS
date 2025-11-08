/**
 * URLJumpDispatcher 路由测试（两种来源之一：URL 参数）
 * 验证：annotation/anchor/outline/page 四类跳转的事件或导航调用是否正确触发
 */
import { URLJumpDispatcher } from "../components/url-jump-dispatcher.js";
import { EventBus } from "../../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";

// stub logger to avoid import.meta in jest
jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })
}), { virtual: true });

describe("URLJumpDispatcher routing", () => {
  let eventBus;
  let nav;
  let dispatcher;

  beforeEach(() => {
    eventBus = new EventBus({ enableValidation: false });
    nav = { navigateTo: jest.fn(async () => ({ success: true, actualPage: 5, actualPosition: 50 })) };
    dispatcher = new URLJumpDispatcher({ eventBus, navigationService: nav });
  });

  afterEach(() => {
    eventBus?.destroy();
  });

  test("annotationId → 发射 ANNOTATION.NAVIGATION.JUMP_REQUESTED", async () => {
    const spy = jest.fn();
    eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED, spy);
    const parsed = { annotationId: "ann-123" };
    const r = await dispatcher.tryExecute(parsed, { annotationDataLoaded: true });
    expect(r).toEqual({ type: "annotation", success: true });
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toEqual({ id: "ann-123" });
  });

  test("anchorId → 发射 ANCHOR.NAVIGATE.REQUESTED", async () => {
    const spy = jest.fn();
    eventBus.on(PDF_VIEWER_EVENTS.ANCHOR.NAVIGATE.REQUESTED, spy);
    const parsed = { anchorId: "pdfanchor-a1b2c3d4e5f6" };
    const r = await dispatcher.tryExecute(parsed);
    expect(r).toEqual({ type: "anchor", success: true });
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toEqual({ anchorId: "pdfanchor-a1b2c3d4e5f6" });
  });

  test("outlineItemId → 发射 OUTLINE.NAVIGATE_BY_ID.REQUESTED", async () => {
    const spy = jest.fn();
    eventBus.on(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE_BY_ID.REQUESTED, spy);
    const parsed = { outlineItemId: "outline-xyz" };
    const r = await dispatcher.tryExecute(parsed);
    expect(r).toEqual({ type: "outline", success: true });
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toEqual({ outlineItemId: "outline-xyz" });
  });

  test("pageAt/position → 调用 navigationService.navigateTo", async () => {
    const parsed = { pageAt: 7, position: 42 };
    const r = await dispatcher.tryExecute(parsed);
    expect(nav.navigateTo).toHaveBeenCalledWith({ pageAt: 7, position: 42 });
    expect(r.type).toBe("page");
    expect(r.success).toBe(true);
  });
});
