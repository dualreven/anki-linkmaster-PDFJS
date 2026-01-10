import { EventBus } from "../../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { createInfraUICoordinator } from "../infra-ui-coordinator.js";

function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    event: jest.fn(),
  };
}

describe("infra-ui page info init: RENDER.READY driven (regression)", () => {
  test("should not use setTimeout and should initialize page info on RENDER.READY (one-shot)", () => {
    const setTimeoutSpy = jest.spyOn(global, "setTimeout");
    try {
      const logger = createLogger();
      const eventBus = new EventBus({
        enableValidation: false,
        enableTracing: false,
        logger,
        moduleName: "TestBus",
      });

      const viewerManager = { setPageInfo: jest.fn() };
      const pdfViewerManager = { pagesCount: 10, currentPageNumber: 2 };
      const uiZoomControls = { updatePageInfo: jest.fn() };

      const coordinator = createInfraUICoordinator(
        eventBus,
        logger,
        {
          zoomIn: jest.fn(),
          zoomOut: jest.fn(),
          actualSize: jest.fn(),
          fitWidth: jest.fn(),
          fitHeight: jest.fn(),
          previousPage: jest.fn(),
          nextPage: jest.fn(),
          goToPage: jest.fn(),
          syncZoomState: jest.fn(),
          updatePageInfo: jest.fn(),
        },
        {
          onZoomChanged: jest.fn(),
          onFileLoadRequested: jest.fn(),
          onFileLoadSuccess: jest.fn(),
          onFileLoadFailed: jest.fn(),
          onUrlParamsParsed: jest.fn(),
          onWebSocketResponse: jest.fn(),
          onWebSocketError: jest.fn(),
        },
        { onRenderModeChanged: jest.fn() },
        {
          viewerManager,
          getPdfViewerManager: () => pdfViewerManager,
          getUIZoomControls: () => uiZoomControls,
        }
      );

      eventBus.emit(
        PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
        { pdfDocument: { numPages: 10 } },
        { actorId: "Test" }
      );

      expect(viewerManager.setPageInfo).not.toHaveBeenCalled();
      expect(uiZoomControls.updatePageInfo).not.toHaveBeenCalled();
      expect(setTimeoutSpy).not.toHaveBeenCalled();

      eventBus.emit(PDF_VIEWER_EVENTS.RENDER.READY, {}, { actorId: "Test" });

      expect(viewerManager.setPageInfo).toHaveBeenCalledTimes(1);
      expect(viewerManager.setPageInfo).toHaveBeenCalledWith(2, 10);
      expect(uiZoomControls.updatePageInfo).toHaveBeenCalledTimes(1);
      expect(uiZoomControls.updatePageInfo).toHaveBeenCalledWith(2, 10);
      expect(setTimeoutSpy).not.toHaveBeenCalled();

      // one-shot: second READY should do nothing
      eventBus.emit(PDF_VIEWER_EVENTS.RENDER.READY, {}, { actorId: "TestAgain" });
      expect(viewerManager.setPageInfo).toHaveBeenCalledTimes(1);

      coordinator.destroy();
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });
});

