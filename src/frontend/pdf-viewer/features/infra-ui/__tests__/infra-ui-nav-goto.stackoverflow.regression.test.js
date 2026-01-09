import { EventBus } from "../../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { createInfraUICoordinator } from "../infra-ui-coordinator.js";
import { UIControls } from "../components/ui-manager-core-ui-controls.js";

function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    event: jest.fn(),
  };
}

describe("InfraUI NAVIGATION.GOTO — prevent sync recursion (regression)", () => {
  test("NAVIGATION.GOTO handler should not cause recursive GOTO loop (no stack overflow)", () => {
    const logger = createLogger();
    const eventBus = new EventBus({ enableValidation: false, enableTracing: false, logger, moduleName: "TestBus" });

    let emitCount = 0;
    let currentPageNumber = 1;
    const pdfViewerManager = {
      pagesCount: 999,
    };

    Object.defineProperty(pdfViewerManager, "currentPageNumber", {
      configurable: true,
      enumerable: true,
      get: () => currentPageNumber,
      set: (v) => {
        currentPageNumber = v;
        emitCount += 1;

        // 模拟“同步闭环导致爆栈”的核心条件（稳定复现，不依赖真实 UI/DOM）
        if (emitCount > 10) {
          throw new RangeError("Maximum call stack size exceeded");
        }

        eventBus.emit(
          PDF_VIEWER_EVENTS.NAVIGATION.GOTO,
          { pageNumber: v, positionPercent: null },
          { actorId: "PdfViewerManagerStub" }
        );
      }
    });

    const uiControls = new UIControls(logger, pdfViewerManager, null, { updatePageInfo: jest.fn() });
    const eventListeners = {
      onZoomChanged: jest.fn(),
      onFileLoadRequested: jest.fn(),
      onFileLoadSuccess: jest.fn(),
      onFileLoadFailed: jest.fn(),
      onUrlParamsParsed: jest.fn(),
      onWebSocketResponse: jest.fn(),
      onWebSocketError: jest.fn(),
    };

    const coordinator = createInfraUICoordinator(eventBus, logger, uiControls, eventListeners);

    eventBus.emit(
      PDF_VIEWER_EVENTS.NAVIGATION.GOTO,
      { pageNumber: 5, positionPercent: null },
      { actorId: "Test" }
    );

    coordinator.destroy();

    const hasStackOverflowLog = logger.error.mock.calls.some((args) => String(args?.[0] || "").includes("Maximum call stack size exceeded"));
    const hasCallbackErrorLog = logger.error.mock.calls.some((args) => String(args?.[0] || "").includes("事件回调执行出错"));

    expect(hasStackOverflowLog).toBe(false);
    expect(hasCallbackErrorLog).toBe(false);
    expect(emitCount).toBe(1);
  });
});

