/**
 * @file 页面导航和缩放功能测试文件
 * @module NavigationZoomTest
 * @description 测试PDF查看器的页面导航和缩放控制功能
 */

import { PDFViewerApp } from '../main.js';
import { EventBus } from '../../common/event/event-bus.js';
import PDF_VIEWER_EVENTS from '../../common/event/pdf_viewer-constants.js';
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

// Mock PDF.js 相关功能
jest.mock('../pdf-manager.js', () => {
  return jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(),
    loadPDF: jest.fn().mockResolvedValue({ numPages: 10 }),
    getPage: jest.fn().mockResolvedValue({
      getViewport: jest.fn().mockReturnValue({ width: 800, height: 600 }),
      cleanup: jest.fn()
    }),
    cleanup: jest.fn(),
    destroy: jest.fn(),
    getCacheStats: jest.fn().mockReturnValue({ totalCached: 0, cachedPages: [] })
  }));
});

describe('PDFViewerApp - 页面导航和缩放功能测试', () => {
  let app;
  let mockEventBus;
  let mockLogger;
  let mockErrorHandler;

  beforeEach(async () => {
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

    // 创建应用实例并初始化
    app = new PDFViewerApp();
    await app.initialize();

    // Mock DOM 元素
    document.body.innerHTML = `
      <div id="pdf_viewer-container"></div>
      <div id="pdf-toolbar"></div>
      <div id="pdf-sidebar"></div>
    `;
  });

  describe('页面导航功能测试', () => {
    beforeEach(async () => {
      // 加载一个测试PDF文档
      const mockPDFDocument = {
        numPages: 5,
        getPage: jest.fn().mockResolvedValue({
          getViewport: jest.fn().mockReturnValue({ width: 800, height: 600 })
        })
      };
      app.loadPDFDocument(mockPDFDocument);
    });

    test('应该正确处理页面跳转事件', async () => {
      // 模拟页面跳转到第3页
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.NAVIGATION.GOTO
      )?.[1]({ pageNumber: 3 });

      const state = app.getState();
      expect(state.currentPage).toBe(3);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        PDF_VIEWER_EVENTS.NAVIGATION.CHANGED,
        expect.objectContaining({
          currentPage: 3,
          totalPages: 5
        }),
        expect.any(Object)
      );
    });

    test('应该正确处理上一页导航', async () => {
      // 先跳转到第3页
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.NAVIGATION.GOTO
      )?.[1]({ pageNumber: 3 });

      // 然后导航到上一页
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.NAVIGATION.PREVIOUS
      )?.[1]();

      const state = app.getState();
      expect(state.currentPage).toBe(2);
    });

    test('应该正确处理下一页导航', async () => {
      // 先跳转到第3页
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.NAVIGATION.GOTO
      )?.[1]({ pageNumber: 3 });

      // 然后导航到下一页
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.NAVIGATION.NEXT
      )?.[1]();

      const state = app.getState();
      expect(state.currentPage).toBe(4);
    });

    test('应该在首页时禁用上一页导航', async () => {
      // 确保在第一页
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.NAVIGATION.GOTO
      )?.[1]({ pageNumber: 1 });

      // 尝试导航到上一页
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.NAVIGATION.PREVIOUS
      )?.[1]();

      const state = app.getState();
      expect(state.currentPage).toBe(1); // 应该保持在第一页
    });

    test('应该在末页时禁用下一页导航', async () => {
      // 跳转到最后一页
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.NAVIGATION.GOTO
      )?.[1]({ pageNumber: 5 });

      // 尝试导航到下一页
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.NAVIGATION.NEXT
      )?.[1]();

      const state = app.getState();
      expect(state.currentPage).toBe(5); // 应该保持在最后一页
    });

    test('应该拒绝无效的页面跳转请求', async () => {
      // 尝试跳转到第0页
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.NAVIGATION.GOTO
      )?.[1]({ pageNumber: 0 });

      // 尝试跳转到超出范围的页面
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.NAVIGATION.GOTO
      )?.[1]({ pageNumber: 6 });

      const state = app.getState();
      expect(state.currentPage).toBe(1); // 应该保持在当前页面
    });

    test('应该正确处理总页数更新事件', async () => {
      // 模拟总页数更新
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.NAVIGATION.TOTAL_PAGES_UPDATED
      )?.[1](8);

      const state = app.getState();
      expect(state.totalPages).toBe(8);
    });
  });

  describe('缩放控制功能测试', () => {
    beforeEach(async () => {
      // 加载一个测试PDF文档
      const mockPDFDocument = {
        numPages: 3,
        getPage: jest.fn().mockResolvedValue({
          getViewport: jest.fn().mockReturnValue({ width: 800, height: 600 })
        })
      };
      app.loadPDFDocument(mockPDFDocument);
    });

    test('应该正确处理放大操作', async () => {
      const initialZoom = app.getState().zoomLevel;
      
      // 触发放大操作
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.ZOOM.IN
      )?.[1]();

      const state = app.getState();
      expect(state.zoomLevel).toBe(initialZoom + 0.25);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        PDF_VIEWER_EVENTS.ZOOM.CHANGED,
        expect.objectContaining({
          zoomLevel: initialZoom + 0.25
        }),
        expect.any(Object)
      );
    });

    test('应该正确处理缩小操作', async () => {
      const initialZoom = app.getState().zoomLevel;
      
      // 触发缩小操作
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.ZOOM.OUT
      )?.[1]();

      const state = app.getState();
      expect(state.zoomLevel).toBe(initialZoom - 0.25);
    });

    test('应该正确处理适应宽度操作', async () => {
      // 触发适应宽度操作
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.ZOOM.FIT_WIDTH
      )?.[1]();

      // 应该触发缩放改变事件
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        PDF_VIEWER_EVENTS.ZOOM.CHANGED,
        expect.any(Object),
        expect.any(Object)
      );
    });

    test('应该正确处理适应高度操作', async () => {
      // 触发适应高度操作
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.ZOOM.FIT_HEIGHT
      )?.[1]();

      // 应该触发缩放改变事件
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        PDF_VIEWER_EVENTS.ZOOM.CHANGED,
        expect.any(Object),
        expect.any(Object)
      );
    });

    test('应该正确处理实际大小操作', async () => {
      // 先设置一个非1.0的缩放级别
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.ZOOM.IN
      )?.[1]();

      // 然后触发实际大小操作
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.ZOOM.ACTUAL_SIZE
      )?.[1]();

      const state = app.getState();
      expect(state.zoomLevel).toBe(1.0);
    });

    test('应该限制缩放范围在0.5到3.0之间', async () => {
      // 多次放大直到超过上限
      for (let i = 0; i < 20; i++) {
        mockEventBus.emit.mock.calls.find(call => 
          call[0] === PDF_VIEWER_EVENTS.ZOOM.IN
        )?.[1]();
      }

      const maxZoomState = app.getState();
      expect(maxZoomState.zoomLevel).toBe(3.0);

      // 多次缩小直到超过下限
      for (let i = 0; i < 20; i++) {
        mockEventBus.emit.mock.calls.find(call => 
          call[0] === PDF_VIEWER_EVENTS.ZOOM.OUT
        )?.[1]();
      }

      const minZoomState = app.getState();
      expect(minZoomState.zoomLevel).toBe(0.5);
    });

    test('应该正确处理外部缩放改变事件', async () => {
      // 模拟外部缩放改变
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.ZOOM.CHANGED
      )?.[1]({ zoomLevel: 2.0 });

      const state = app.getState();
      expect(state.zoomLevel).toBe(2.0);
    });
  });

  describe('页面信息显示测试', () => {
    test('应该正确显示当前页码和总页数', async () => {
      const mockPDFDocument = {
        numPages: 7,
        getPage: jest.fn().mockResolvedValue({
          getViewport: jest.fn().mockReturnValue({ width: 800, height: 600 })
        })
      };
      app.loadPDFDocument(mockPDFDocument);

      // 跳转到第4页
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.NAVIGATION.GOTO
      )?.[1]({ pageNumber: 4 });

      const state = app.getState();
      expect(state.currentPage).toBe(4);
      expect(state.totalPages).toBe(7);
    });

    test('应该在单页文档时正确显示', async () => {
      const mockPDFDocument = {
        numPages: 1,
        getPage: jest.fn().mockResolvedValue({
          getViewport: jest.fn().mockReturnValue({ width: 800, height: 600 })
        })
      };
      app.loadPDFDocument(mockPDFDocument);

      const state = app.getState();
      expect(state.currentPage).toBe(1);
      expect(state.totalPages).toBe(1);
    });

    test('应该在未加载文档时显示默认信息', () => {
      const state = app.getState();
      expect(state.currentPage).toBe(1);
      expect(state.totalPages).toBe(0);
    });
  });

  describe('边界情况和错误处理测试', () => {
    test('应该在未加载PDF时拒绝导航操作', async () => {
      // 不加载PDF文档，直接尝试导航
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.NAVIGATION.NEXT
      )?.[1]();

      const state = app.getState();
      expect(state.currentPage).toBe(1); // 应该保持在第一页
    });

    test('应该在未加载PDF时拒绝缩放操作', async () => {
      // 不加载PDF文档，直接尝试缩放
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.ZOOM.IN
      )?.[1]();

      const state = app.getState();
      expect(state.zoomLevel).toBe(1.0); // 应该保持默认缩放
    });

    test('应该处理页面渲染失败的情况', async () => {
      // 模拟页面渲染失败
      const { PDFManager } = require('../pdf-manager.js');
      PDFManager.mockImplementationOnce(() => ({
        getPage: jest.fn().mockRejectedValue(new Error('页面渲染失败')),
        initialize: jest.fn().mockResolvedValue(),
        loadPDF: jest.fn().mockResolvedValue({ numPages: 3 }),
        cleanup: jest.fn(),
        destroy: jest.fn()
      }));

      const mockPDFDocument = {
        numPages: 3,
        getPage: jest.fn().mockRejectedValue(new Error('页面渲染失败'))
      };
      app.loadPDFDocument(mockPDFDocument);

      // 尝试跳转页面
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.NAVIGATION.GOTO
      )?.[1]({ pageNumber: 2 });

      // 应该触发渲染失败事件
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        PDF_VIEWER_EVENTS.RENDER.PAGE_FAILED,
        expect.any(Object),
        expect.any(Object)
      );
    });

    test('应该处理缩放计算错误的情况', async () => {
      const mockPDFDocument = {
        numPages: 3,
        getPage: jest.fn().mockResolvedValue({
          getViewport: jest.fn().mockImplementation(() => {
            throw new Error('视口计算错误');
          })
        })
      };
      app.loadPDFDocument(mockPDFDocument);

      // 尝试适应宽度操作
      mockEventBus.emit.mock.calls.find(call => 
        call[0] === PDF_VIEWER_EVENTS.ZOOM.FIT_WIDTH
      )?.[1]();

      // 应该处理错误
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('键盘快捷键测试', () => {
    test('应该响应右箭头键导航到下一页', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      document.dispatchEvent(event);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        PDF_VIEWER_EVENTS.NAVIGATION.NEXT,
        undefined,
        expect.any(Object)
      );
    });

    test('应该响应左箭头键导航到上一页', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      document.dispatchEvent(event);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        PDF_VIEWER_EVENTS.NAVIGATION.PREVIOUS,
        undefined,
        expect.any(Object)
      );
    });

    test('应该响应Ctrl+加号键进行放大', () => {
      const event = new KeyboardEvent('keydown', { key: '+', ctrlKey: true });
      document.dispatchEvent(event);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        PDF_VIEWER_EVENTS.ZOOM.IN,
        undefined,
        expect.any(Object)
      );
    });

    test('应该响应Ctrl+减号键进行缩小', () => {
      const event = new KeyboardEvent('keydown', { key: '-', ctrlKey: true });
      document.dispatchEvent(event);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        PDF_VIEWER_EVENTS.ZOOM.OUT,
        undefined,
        expect.any(Object)
      );
    });

    test('应该响应Ctrl+0键重置到实际大小', () => {
      const event = new KeyboardEvent('keydown', { key: '0', ctrlKey: true });
      document.dispatchEvent(event);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        PDF_VIEWER_EVENTS.ZOOM.ACTUAL_SIZE,
        undefined,
        expect.any(Object)
      );
    });

    test('应该忽略输入框中的快捷键', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      input.dispatchEvent(event);

      expect(mockEventBus.emit).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });
  });
});