/**
 * @jest-environment jsdom
 *
 * 回归目标：
 * - setupAnnotationAutoLoadOnFileLoad 必须返回 unsubs[]
 * - 调用 unsubs 后，不应再响应 FILE.LOAD.SUCCESS / RESUME.FLOW.DONE 等全局事件（防订阅泄漏）
 */

import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_EVENTS } from "../../../../common/event/event-constants.js";
import { setupAnnotationAutoLoadOnFileLoad } from "../annotation-feature-autoload.js";

describe("setupAnnotationAutoLoadOnFileLoad — subscriptions cleanup", () => {
  test("必须返回 unsubs[] 且可彻底注销 onGlobal 订阅", () => {
    const handlers = new Map();
    const eventBus = {
      onGlobal: jest.fn((event, handler) => {
        handlers.set(String(event), handler);
        return () => handlers.delete(String(event));
      }),
      emit: jest.fn(),
    };
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

    let currentPdfId = null;
    const unsubs = setupAnnotationAutoLoadOnFileLoad({
      eventBus,
      logger,
      annotationManager: { setPdfId: jest.fn() },
      ensureAllOverlays: jest.fn(),
      getCurrentPdfId: () => currentPdfId,
      setCurrentPdfId: (v) => { currentPdfId = v; },
      getHasLoadedOnce: () => false,
      setHasLoadedOnce: jest.fn(),
    });

    expect(Array.isArray(unsubs)).toBe(true);
    // 当前实现注册 4 个 onGlobal（FILE.LOAD.SUCCESS / RESUME.FLOW.DONE / WS.ESTABLISHED / SIDEBAR.OPENED）
    expect(unsubs.length).toBe(4);
    for (const off of unsubs) {
      expect(typeof off).toBe("function");
    }

    // 触发一次 resume-flow-done：应发出 ANNOTATION.DATA.LOAD
    const resumeHandler = handlers.get(String(PDF_VIEWER_EVENTS.RESUME.FLOW.DONE));
    expect(typeof resumeHandler).toBe("function");
    resumeHandler({ pdfId: "aaaaaaaaaaaa" });
    expect(eventBus.emit).toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD,
      { pdfId: "aaaaaaaaaaaa" },
      expect.objectContaining({ actorId: "AnnotationFeature" })
    );

    // 清理订阅
    for (const off of unsubs) { off(); }

    // 断言：所有 handler 都已被移除（不再响应）
    expect(handlers.has(String(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS))).toBe(false);
    expect(handlers.has(String(PDF_VIEWER_EVENTS.RESUME.FLOW.DONE))).toBe(false);
    expect(handlers.has(String(WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED))).toBe(false);
    expect(handlers.has(String(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPENED_COMPLETED))).toBe(false);
  });
});

