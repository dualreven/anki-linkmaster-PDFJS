import { createInfraUICoordinator } from "../infra-ui-coordinator.js";
import { EventBus } from "../../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";

describe("InfraUICoordinator cleanup (regression)", () => {
  function createLogger() {
    return {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      event: jest.fn(),
    };
  }

  test("destroy should unsubscribe all subscriptions (events after destroy do nothing)", () => {
    const logger = createLogger();
    const eventBus = new EventBus({
      enableValidation: false,
      enableTracing: false,
      logger,
      moduleName: "TestBus",
    });

    const uiControls = {
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
    };

    const eventListeners = {
      onZoomChanged: jest.fn(),
      onFileLoadRequested: jest.fn(),
      onFileLoadSuccess: jest.fn(),
      onFileLoadFailed: jest.fn(),
      onUrlParamsParsed: jest.fn(),
      onWebSocketResponse: jest.fn(),
      onWebSocketError: jest.fn(),
    };

    const uiLayoutControls = { onRenderModeChanged: jest.fn() };
    const viewerManager = { setPageInfo: jest.fn() };
    const pdfViewerManager = { pagesCount: 10, currentPageNumber: 2 };
    const uiZoomControls = { updatePageInfo: jest.fn() };

    const coordinator = createInfraUICoordinator(
      eventBus,
      logger,
      uiControls,
      eventListeners,
      uiLayoutControls,
      {
        viewerManager,
        getPdfViewerManager: () => pdfViewerManager,
        getUIZoomControls: () => uiZoomControls,
      }
    );

    eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.IN, { delta: 0.1 }, { actorId: "Test" });
    expect(uiControls.zoomIn).toHaveBeenCalledTimes(1);

    eventBus.emit(
      PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
      { pdfDocument: { numPages: 10 } },
      { actorId: "Test" }
    );
    eventBus.emit(PDF_VIEWER_EVENTS.RENDER.READY, {}, { actorId: "Test" });
    expect(viewerManager.setPageInfo).toHaveBeenCalledTimes(1);

    coordinator.destroy();

    eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.IN, { delta: 0.1 }, { actorId: "AfterDestroy" });
    expect(uiControls.zoomIn).toHaveBeenCalledTimes(1);

    eventBus.emit(
      PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
      { pdfDocument: { numPages: 10 } },
      { actorId: "AfterDestroy" }
    );
    eventBus.emit(PDF_VIEWER_EVENTS.RENDER.READY, {}, { actorId: "AfterDestroy" });
    expect(viewerManager.setPageInfo).toHaveBeenCalledTimes(1);
  });
});
