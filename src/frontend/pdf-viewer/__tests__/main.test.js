/**
 * @file PDFViewerApp 主应用测试文件
 * @module PDFViewerAppTest
 * @description 测试 PDFViewerApp 的核心功能
 */

import { PDFViewerApp } from '../main.js';
import { EventBus } from '../../common/event/event-bus.js';
import { PDF_VIEWER_EVENTS } from '../../common/event/pdf-viewer-constants.js';
import { jest } from '@jest/globals';

// Mock 依赖模块
jest.mock('../../common/event/event-bus.js', () => {
  return {
    EventBus: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      emit: jest.fn(),
      destroy: jest.fn()
    }))
  };
});

jest.mock('../../common/utils/logger.js', () => {
  return jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }));
});

jest.mock('../../common/error/error-handler.js', () => {
  return jest.fn().mockImplementation(() => ({
    handleError: jest.fn()
  }));
});

describe('PDFViewerApp', () => {
  let app;
  let mockEventBus;
  let mockLogger;
  let mockErrorHandler;

  beforeEach(() => {
    mockEventBus = new EventBus();
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };
    mockErrorHandler = {
      handleError: jest.fn()
    };

    // 重置所有 mock
    jest.clearAllMocks();
  });

  describe('构造函数', () => {
    test('应该正确初始化所有模块', () => {
      app = new PDFViewerApp();
      
      expect(EventBus).toHaveBeenCalled();
      expect(app.getEventBus()).toBeDefined();
    });

    test('应该设置私有属性', () => {
      app = new PDFViewerApp();
      
      // 验证私有属性存在
      expect(app.getEventBus()).toBeDefined();
    });
  });

  describe('initialize()', () => {
    beforeEach(() => {
      app = new PDFViewerApp();
      
      // Mock DOM 元素
      document.body.innerHTML = `
        <div id="pdf_viewer-container"></div>
        <div id="pdf-toolbar"></div>
        <div id="pdf-sidebar"></div>
      `;
    });

    test('应该成功初始化应用', async () => {
      const result = await app.initialize();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Initializing PDF Viewer App...');
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        PDF_VIEWER_EVENTS.STATE.INITIALIZED,
        undefined,
        expect.any(Object)
      );
    });

    test('初始化失败时应该正确处理错误', async () => {
      // 强制初始化失败
      const error = new Error('初始化失败');
      mockEventBus.emit.mockRejectedValueOnce(error);

      await expect(app.initialize()).rejects.toThrow('初始化失败');
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(error, 'App.initialize');
    });
  });

  describe('destroy()', () => {
    test('应该正确销毁所有资源', () => {
      app = new PDFViewerApp();
      
      app.destroy();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Destroying PDF Viewer App...');
      expect(mockEventBus.destroy).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('PDF Viewer App destroyed.');
    });
  });

  describe('getState()', () => {
    test('应该返回正确的应用状态', () => {
      app = new PDFViewerApp();
      
      const state = app.getState();
      
      expect(state).toEqual({
        initialized: false,
        currentFile: null,
        currentPage: 1,
        totalPages: 0,
        zoomLevel: 1.0
      });
    });
  });

  describe('事件处理', () => {
    test('应该正确处理文件加载事件', async () => {
      app = new PDFViewerApp();
      await app.initialize();

      const testFile = { filename: 'test.pdf', url: 'blob:test' };
      
      // 模拟文件加载请求
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED
      )?.[1](testFile);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
        expect.any(Object),
        expect.any(Object)
      );
    });

    test('应该正确处理页面导航事件', async () => {
      app = new PDFViewerApp();
      await app.initialize();

      // 模拟页面跳转
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.NAVIGATION.GOTO
      )?.[1]({ pageNumber: 2 });

      const state = app.getState();
      expect(state.currentPage).toBe(2);
    });
  });
});

// 集成测试
describe('PDFViewerApp 集成测试', () => {
  test('应该能够加载PDF文件并渲染页面', async () => {
    const app = new PDFViewerApp();
    await app.initialize();

    // 模拟PDF文件加载
    const mockPDFDocument = {
      numPages: 10,
      getPage: jest.fn().mockResolvedValue({
        getViewport: jest.fn().mockReturnValue({ width: 800, height: 600 })
      })
    };

    // 触发文件加载
    app.loadPDFDocument(mockPDFDocument);

    const state = app.getState();
    expect(state.totalPages).toBe(10);
    expect(state.currentPage).toBe(1);
  });

  test('应该处理PDF加载错误', async () => {
    const app = new PDFViewerApp();
    await app.initialize();

    const error = new Error('PDF加载失败');
    
    // 模拟加载失败
    app.handlePDFLoadError(error);

    expect(mockEventBus.emit).toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.FILE.LOAD.FAILED,
      expect.any(Object),
      expect.any(Object)
    );
    expect(mockErrorHandler.handleError).toHaveBeenCalledWith(error, 'PDFLoad');
  });
});