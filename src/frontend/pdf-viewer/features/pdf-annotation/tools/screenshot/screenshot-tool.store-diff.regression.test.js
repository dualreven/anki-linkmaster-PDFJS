import { jest } from "@jest/globals";
import { ScreenshotTool } from "./index.js";
import { AnnotationType } from "../../../../../common/models/annotation.js";
import { ObservableState } from "../../../../../common/utils/observable.js";

jest.mock("./screenshot-capturer.js", () => ({
  ScreenshotCapturer: jest.fn().mockImplementation(() => ({
    destroy: jest.fn()
  }))
}));

jest.mock("./qwebchannel-bridge.js", () => ({
  QWebChannelScreenshotBridge: jest.fn().mockImplementation(() => ({
    getMode: jest.fn(() => "mock"),
    destroy: jest.fn()
  }))
}));

describe("ScreenshotTool store-diff (regression)", () => {
  let tool;
  let eventBus;
  let pdfViewerManager;
  let annotationManager;
  let viewerContainer;
  let pageDiv;

  let renderMarkerSpy;
  let removeMarkerSpy;

  beforeEach(async () => {
    viewerContainer = document.createElement("div");
    viewerContainer.id = "viewerContainer";
    document.body.appendChild(viewerContainer);

    pageDiv = document.createElement("div");
    pageDiv.className = "page";
    pageDiv.dataset.pageNumber = "3";
    viewerContainer.appendChild(pageDiv);

    eventBus = {
      emit: jest.fn(),
      emitGlobal: jest.fn(),
      on: jest.fn(() => () => {}),
      onGlobal: jest.fn(() => () => {}),
      off: jest.fn(),
      offGlobal: jest.fn()
    };

    pdfViewerManager = {
      getPageView: jest.fn(() => ({ div: pageDiv }))
    };

    annotationManager = {
      store: new ObservableState({ annotations: [] }, { name: "TestAnnotationStore" })
    };

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    renderMarkerSpy = jest
      .spyOn(ScreenshotTool.prototype, "renderScreenshotMarker")
      .mockImplementation(() => {});
    removeMarkerSpy = jest
      .spyOn(ScreenshotTool.prototype, "removeScreenshotMarker")
      .mockImplementation(() => {});

    tool = new ScreenshotTool();
    await tool.initialize({ eventBus, logger, pdfViewerManager, annotationManager });
  });

  afterEach(() => {
    try { tool?.destroy?.(); } catch (e) { void e; }
    renderMarkerSpy.mockRestore();
    removeMarkerSpy.mockRestore();
    if (viewerContainer?.parentNode) {
      viewerContainer.parentNode.removeChild(viewerContainer);
    }
    viewerContainer = null;
    pageDiv = null;
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  test("store add/remove screenshot should render/remove marker; destroy should stop reacting", () => {
    const screenshotAnnotation = {
      id: "s-1",
      type: AnnotationType.SCREENSHOT,
      pageNumber: 3,
      data: {
        rectPercent: {
          xPercent: 10,
          yPercent: 20,
          widthPercent: 30,
          heightPercent: 40
        },
        markerColor: "#ff9800"
      }
    };

    annotationManager.store.set({ annotations: [screenshotAnnotation] });
    expect(renderMarkerSpy).toHaveBeenCalledTimes(1);
    expect(renderMarkerSpy).toHaveBeenCalledWith(screenshotAnnotation);

    annotationManager.store.set({ annotations: [] });
    expect(removeMarkerSpy).toHaveBeenCalledTimes(1);
    expect(removeMarkerSpy).toHaveBeenCalledWith("s-1");

    tool.destroy();
    annotationManager.store.set({ annotations: [screenshotAnnotation] });
    expect(renderMarkerSpy).toHaveBeenCalledTimes(1);
    expect(removeMarkerSpy).toHaveBeenCalledTimes(1);
  });

  test("setting same screenshot state twice should not re-render", () => {
    const screenshotAnnotation = {
      id: "s-2",
      type: AnnotationType.SCREENSHOT,
      pageNumber: 3,
      data: {
        rectPercent: {
          xPercent: 1,
          yPercent: 2,
          widthPercent: 3,
          heightPercent: 4
        },
        markerColor: "#ff9800"
      }
    };

    annotationManager.store.set({ annotations: [screenshotAnnotation] });
    expect(renderMarkerSpy).toHaveBeenCalledTimes(1);

    const sameButNewObject = JSON.parse(JSON.stringify(screenshotAnnotation));
    annotationManager.store.set({ annotations: [sameButNewObject] });
    expect(renderMarkerSpy).toHaveBeenCalledTimes(1);
  });
});

