import { EventListeners } from "../components/ui-manager-core-event-listeners.js";

describe("infra-ui EventListeners: remove fallback + no setTimeout (regression)", () => {
  test("onZoomChanged should not fallback pdfId from filename", () => {
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const zoomManager = { applyEngineScale: jest.fn() };
    const setCurrentPdfId = jest.fn();
    const updateCopyButtonVisibility = jest.fn();

    const listeners = new EventListeners({
      logger,
      zoomManager,
      getCurrentPdfId: () => null,
      setCurrentPdfId,
      updateCopyButtonVisibility,
      viewerManager: null,
      domManager: { setLoadingState: jest.fn() },
      getPdfViewerManager: () => null,
      getUIZoomControls: () => null,
      requestPdfTitleFromDB: jest.fn(),
      updateHeaderTitle: jest.fn(),
      getPendingDetailRequestId: () => null,
      setPendingDetailRequestId: jest.fn(),
    });

    listeners.onZoomChanged({ scale: 1.25, filename: "abc.pdf" });

    expect(zoomManager.applyEngineScale).toHaveBeenCalledWith(1.25);
    expect(setCurrentPdfId).not.toHaveBeenCalled();
    expect(updateCopyButtonVisibility).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  test("onFileLoadSuccess should not use setTimeout (page info init moved out of EventListeners)", () => {
    const setTimeoutSpy = jest.spyOn(global, "setTimeout");
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

    const viewerManager = { setLoading: jest.fn(), setPageInfo: jest.fn(), setError: jest.fn() };
    const domManager = { setLoadingState: jest.fn() };
    const pdfViewerManager = {
      load: jest.fn(),
      pagesCount: 10,
      currentPageNumber: 2,
    };

    const listeners = new EventListeners({
      logger,
      zoomManager: null,
      getCurrentPdfId: () => "x",
      setCurrentPdfId: jest.fn(),
      updateCopyButtonVisibility: jest.fn(),
      viewerManager,
      domManager,
      getPdfViewerManager: () => pdfViewerManager,
      getUIZoomControls: () => ({ updatePageInfo: jest.fn() }),
      requestPdfTitleFromDB: jest.fn(),
      updateHeaderTitle: jest.fn(),
      getPendingDetailRequestId: () => null,
      setPendingDetailRequestId: jest.fn(),
    });

    const pdfDocument = { numPages: 10 };
    listeners.onFileLoadSuccess({ pdfDocument });

    expect(pdfViewerManager.load).toHaveBeenCalledWith(pdfDocument);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(viewerManager.setPageInfo).not.toHaveBeenCalled();

    setTimeoutSpy.mockRestore();
  });
});
