import { EventBus } from "../../../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";
import { installUIManagerCoreInfraAssembly } from "../ui-manager-core-infra-assembly.js";

jest.mock("../ui-manager-core-copy-pdf-id.js", () => {
  const installCopyPdfIdButton = jest.fn(() => {
    return {
      updateCopyButtonVisibility: jest.fn(),
      unsubs: [],
    };
  });
  return {
    installCopyPdfIdButton,
  };
});

function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    event: jest.fn(),
  };
}

describe("UIManagerCoreInfraAssembly wiring (regression)", () => {
  test("should route VIEW_MODE.RENDER_MODE_CHANGED to uiLayoutControls (no direct subscriptions in components)", () => {
    const logger = createLogger();
    const eventBus = new EventBus({
      enableValidation: false,
      enableTracing: false,
      logger,
      moduleName: "TestBus",
    });

    const uiLayoutControls = { onRenderModeChanged: jest.fn() };

    const { unsubs } = installUIManagerCoreInfraAssembly({
      eventBus,
      logger,
      viewerManager: { setPageInfo: jest.fn() },
      zoomManager: { applyEngineScale: jest.fn() },
      layoutManager: { store: { get: jest.fn() } },
      domManager: { setLoadingState: jest.fn() },
      getPdfViewerManager: () => ({ pagesCount: 10, currentPageNumber: 1 }),
      getUIZoomControls: () => ({ updatePageInfo: jest.fn() }),
      uiControls: {
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
      uiLayoutControls,
      getCurrentPdfId: () => null,
      setCurrentPdfId: jest.fn(),
      getPendingDetailRequestId: () => null,
      setPendingDetailRequestId: jest.fn(),
      documentRef: document,
      windowRef: window,
    });

    const payload = { newMode: "pdfviewer" };
    eventBus.emit(
      PDF_VIEWER_EVENTS.VIEW_MODE.RENDER_MODE_CHANGED,
      payload,
      { actorId: "Test" }
    );

    expect(uiLayoutControls.onRenderModeChanged).toHaveBeenCalledTimes(1);
    expect(uiLayoutControls.onRenderModeChanged).toHaveBeenCalledWith(payload);

    unsubs.forEach((unsub) => unsub());
  });
});
