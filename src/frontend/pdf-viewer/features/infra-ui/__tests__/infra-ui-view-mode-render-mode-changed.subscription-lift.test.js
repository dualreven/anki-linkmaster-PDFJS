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

describe("infra-ui: VIEW_MODE.RENDER_MODE_CHANGED subscription lift (regression)", () => {
  test("coordinator should call UILayoutControls public method on VIEW_MODE.RENDER_MODE_CHANGED", () => {
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

    const uiLayoutControls = {
      onRenderModeChanged: jest.fn(),
    };

    const coordinator = createInfraUICoordinator(
      eventBus,
      logger,
      uiControls,
      eventListeners,
      uiLayoutControls,
      {
        viewerManager: { setPageInfo: jest.fn() },
        getPdfViewerManager: () => ({ pagesCount: 0, currentPageNumber: 1 }),
        getUIZoomControls: () => ({ updatePageInfo: jest.fn() }),
      }
    );

    const payload = { newMode: "pdfviewer" };
    eventBus.emit(
      PDF_VIEWER_EVENTS.VIEW_MODE.RENDER_MODE_CHANGED,
      payload,
      { actorId: "Test" }
    );

    expect(uiLayoutControls.onRenderModeChanged).toHaveBeenCalledTimes(1);
    expect(uiLayoutControls.onRenderModeChanged).toHaveBeenCalledWith(payload);

    coordinator.destroy();

    eventBus.emit(
      PDF_VIEWER_EVENTS.VIEW_MODE.RENDER_MODE_CHANGED,
      payload,
      { actorId: "TestAfterDestroy" }
    );

    expect(uiLayoutControls.onRenderModeChanged).toHaveBeenCalledTimes(1);
  });
});
