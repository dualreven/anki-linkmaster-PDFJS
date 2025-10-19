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

describe('ScreenshotTool deferred rendering when page not ready', () => {
  let tool;
  let eventBus;
  let handlers;
  let pdfViewerManager;
  let pdfjsHandlers;
  let viewerContainer;

  beforeEach(async () => {
    handlers = {};
    pdfjsHandlers = {};

    // DOM 基础容器
    viewerContainer = document.createElement('div');
    viewerContainer.id = 'viewerContainer';
    document.body.appendChild(viewerContainer);

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

    // 模拟 pdfViewerManager，初始 getPageView 不可用；提供 pdfjs EventBus
    pdfViewerManager = {
      getPageView: jest.fn(() => null),
      eventBus: {
        on: jest.fn((evt, h) => { pdfjsHandlers[evt] = h; }),
        off: jest.fn()
      }
    };

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
    tool?.destroy?.();
    if (viewerContainer?.parentNode) {
      viewerContainer.parentNode.removeChild(viewerContainer);
    }
    viewerContainer = null;
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  test('queues screenshot marker and renders after pagerendered', () => {
    // 构造一个截图标注（page 5）
    const ann = {
      id: 's-defer-1',
      type: AnnotationType.SCREENSHOT,
      pageNumber: 5,
      data: {
        rectPercent: { xPercent: 10, yPercent: 20, widthPercent: 30, heightPercent: 40 }
      }
    };

    const spyRender = jest.spyOn(ScreenshotTool.prototype, 'renderScreenshotMarker');

    // 发出“标注数据加载完成”，此时 getPageView 返回 null，应进入等待队列
    const onLoaded = handlers[PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED];
    expect(typeof onLoaded).toBe('function');
    onLoaded({ annotations: [ann] });

    // 尚未渲染
    expect(spyRender).not.toHaveBeenCalled();

    // 模拟页面5渲染完成：先让 getPageView 返回有效 pageDiv
    const pageDiv = document.createElement('div');
    pageDiv.className = 'page';
    pageDiv.dataset.pageNumber = '5';
    viewerContainer.appendChild(pageDiv);
    pdfViewerManager.getPageView.mockImplementation((pn) => (pn === 5 ? { div: pageDiv } : null));

    // 触发 pdfjs 的 pagerendered
    expect(typeof pdfjsHandlers['pagerendered']).toBe('function');
    pdfjsHandlers['pagerendered']({ pageNumber: 5 });

    // 现在应完成渲染
    expect(spyRender).toHaveBeenCalledTimes(1);
    expect(spyRender).toHaveBeenCalledWith(ann);
  });
});

