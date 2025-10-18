import { jest } from '@jest/globals';
import { ScreenshotTool } from './index.js';
import { PDF_VIEWER_EVENTS } from '../../../../../common/event/pdf-viewer-constants.js';
import { AnnotationType } from '../../models/annotation.js';

jest.mock('./screenshot-capturer.js', () => ({
  ScreenshotCapturer: jest.fn().mockImplementation(() => ({
    destroy: jest.fn()
  }))
}));

jest.mock('./qwebchannel-bridge.js', () => ({
  QWebChannelScreenshotBridge: jest.fn().mockImplementation(() => ({
    getMode: jest.fn(() => 'mock'),
    destroy: jest.fn()
  }))
}));

jest.mock('../../../../../common/utils/logger.js', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

describe('ScreenshotTool annotation restoration', () => {
  let tool;
  let eventBus;
  let handlers;
  let pdfViewerManager;
  let viewerContainer;
  let pageDiv;
  let renderMarkerSpy;

  beforeEach(async () => {
    handlers = {};

    viewerContainer = document.createElement('div');
    viewerContainer.id = 'viewerContainer';
    document.body.appendChild(viewerContainer);

    pageDiv = document.createElement('div');
    pageDiv.className = 'page';
    pageDiv.dataset.pageNumber = '3';
    viewerContainer.appendChild(pageDiv);

    eventBus = {
      emit: jest.fn(),
      emitGlobal: jest.fn(),
      on: jest.fn((event, handler) => {
        handlers[event] = handler;
        return () => delete handlers[event];
      }),
      onGlobal: jest.fn((event, handler) => {
        handlers[event] = handler;
        return () => delete handlers[event];
      }),
      off: jest.fn(),
      offGlobal: jest.fn()
    };

    pdfViewerManager = {
      getPageView: jest.fn(() => ({ div: pageDiv }))
    };

    renderMarkerSpy = jest.spyOn(ScreenshotTool.prototype, 'renderScreenshotMarker').mockImplementation(() => {});

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    tool = new ScreenshotTool();
    await tool.initialize({ eventBus, logger, pdfViewerManager });
  });

  afterEach(() => {
    renderMarkerSpy.mockRestore();
    tool.destroy();
    if (viewerContainer?.parentNode) {
      viewerContainer.parentNode.removeChild(viewerContainer);
    }
    viewerContainer = null;
    pageDiv = null;
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  it('renders screenshot markers when annotation data loads', () => {
    const screenshotAnnotation = {
      id: 's-1',
      type: AnnotationType.SCREENSHOT,
      pageNumber: 3,
      data: {
        rectPercent: {
          xPercent: 10,
          yPercent: 20,
          widthPercent: 30,
          heightPercent: 40
        }
      }
    };
    const otherAnnotation = {
      id: 'h-1',
      type: 'text-highlight',
      pageNumber: 1,
      data: {}
    };

    const dataLoadedHandler = handlers[PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED];
    expect(typeof dataLoadedHandler).toBe('function');
    dataLoadedHandler({ annotations: [screenshotAnnotation, otherAnnotation] });

    expect(renderMarkerSpy).toHaveBeenCalledTimes(1);
    expect(renderMarkerSpy).toHaveBeenCalledWith(screenshotAnnotation);
  });
});
