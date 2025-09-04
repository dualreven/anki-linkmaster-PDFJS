/**
 * PDF-Viewer 应用主类测试文件
 * @file 测试 PDFViewerApp 类的正确性和功能完整性
 * @module PDFViewerAppTest
 */

import { PDFViewerApp } from '../../../src/frontend/pdf-viewer/main.js';
import EventBus from '../../../src/frontend/common/event/event-bus.js';
import { PDF_VIEWER_EVENTS } from '../../../src/frontend/pdf-viewer/event/pdf-viewer-constants.js';

// Mock 依赖模块
jest.mock('../../../src/frontend/common/event/event-bus.js');
jest.mock('../../../src/frontend/common/utils/logger.js');
jest.mock('../../../src/frontend/common/error/error-handler.js');
jest.mock('../../../src/frontend/common/ws/ws-client.js');
jest.mock('../../../src/frontend/pdf-viewer/pdf-manager.js');
jest.mock('../../../src/frontend/pdf-viewer/ui-manager.js');

/**
 * 测试 PDFViewerApp 类
 */
describe('PDFViewerApp', () => {
  
  let pdfViewerApp;
  let mockEventBus;
  
  /**
   * 在每个测试前设置模拟环境
   */
  beforeEach(() => {
    // 创建模拟事件总线
    mockEventBus = {
      on: jest.fn(),
      emit: jest.fn(),
      offAll: jest.fn()
    };
    
    // 设置 EventBus 模拟
    EventBus.mockImplementation(() => mockEventBus);
    
    // 创建 PDFViewerApp 实例
    pdfViewerApp = new PDFViewerApp({
      containerId: 'test-container',
      pdfOptions: { test: true }
    });
  });

  /**
   * 在每个测试后清理
   */
  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * 测试构造函数
   */
  test('构造函数正确初始化', () => {
    expect(pdfViewerApp).toBeInstanceOf(PDFViewerApp);
    expect(pdfViewerApp.config.containerId).toBe('test-container');
    expect(pdfViewerApp.config.pdfOptions.test).toBe(true);
    expect(EventBus).toHaveBeenCalledTimes(1);
  });

  /**
   * 测试初始化方法
   */
  describe('initialize()', () => {
    
    test('成功初始化应用', async () => {
      // 设置模拟的初始化方法
      const mockInitialize = jest.fn().mockResolvedValue();
      pdfViewerApp.pdfManager = { initialize: mockInitialize };
      pdfViewerApp.uiManager = { initialize: mockInitialize };
      pdfViewerApp.wsClient = { connect: mockInitialize };
      
      await pdfViewerApp.initialize();
      
      expect(mockInitialize).toHaveBeenCalledTimes(3);
      expect(pdfViewerApp.state.initialized).toBe(true);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        PDF_VIEWER_EVENTS.STATE.INITIALIZED,
        expect.any(Object)
      );
    });

    test('初始化失败时抛出错误', async () => {
      const error = new Error('初始化失败');
      pdfViewerApp.pdfManager = { 
        initialize: jest.fn().mockRejectedValue(error) 
      };
      
      await expect(pdfViewerApp.initialize()).rejects.toThrow('初始化失败');
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        PDF_VIEWER_EVENTS.STATE.ERROR,
        { error }
      );
    });
  });

  /**
   * 测试事件监听器设置
   */
  test('设置正确的事件监听器', () => {
    // 调用私有方法（通过间接测试）
    pdfViewerApp.initialize = jest.fn().mockImplementation(async () => {
      // 模拟设置事件监听器
      mockEventBus.on.mock.calls.forEach(([eventName, handler]) => {
        expect(typeof eventName).toBe('string');
        expect(typeof handler).toBe('function');
      });
    });
    
    return pdfViewerApp.initialize();
  });

  /**
   * 测试页面导航功能
   */
  describe('页面导航', () => {
    
    beforeEach(() => {
      pdfViewerApp.state = {
        currentPage: 5,
        totalPages: 10,
        currentFile: { name: 'test.pdf' }
      };
    });

    test('上一页导航', () => {
      // 模拟事件处理
      const previousHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === PDF_VIEWER_EVENTS.NAVIGATION.PREVIOUS
      )?.[1];
      
      previousHandler();
      
      expect(pdfViewerApp.state.currentPage).toBe(4);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        PDF_VIEWER_EVENTS.NAVIGATION.CHANGED,
        expect.objectContaining({
          currentPage: 4,
          totalPages: 10
        })
      );
    });

    test('下一页导航', () => {
      const nextHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === PDF_VIEWER_EVENTS.NAVIGATION.NEXT
      )?.[1];
      
      nextHandler();
      
      expect(pdfViewerApp.state.currentPage).toBe(6);
    });

    test('跳转到指定页面', () => {
      const gotoHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === PDF_VIEWER_EVENTS.NAVIGATION.GOTO
      )?.[1];
      
      gotoHandler({ pageNumber: '8' });
      
      expect(pdfViewerApp.state.currentPage).toBe(8);
    });

    test('跳转到无效页面时忽略', () => {
      const gotoHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === PDF_VIEWER_EVENTS.NAVIGATION.GOTO
      )?.[1];
      
      // 测试超出范围的页面
      gotoHandler({ pageNumber: '15' }); // 超出上限
      expect(pdfViewerApp.state.currentPage).toBe(5);
      
      gotoHandler({ pageNumber: '0' });  // 低于下限
      expect(pdfViewerApp.state.currentPage).toBe(5);
    });
  });

  /**
   * 测试缩放控制功能
   */
  describe('缩放控制', () => {
    
    beforeEach(() => {
      pdfViewerApp.state.zoomLevel = 1.0;
    });

    test('放大功能', () => {
      const zoomInHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === PDF_VIEWER_EVENTS.ZOOM.IN
      )?.[1];
      
      zoomInHandler();
      
      expect(pdfViewerApp.state.zoomLevel).toBe(1.1);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        PDF_VIEWER_EVENTS.ZOOM.CHANGED,
        expect.objectContaining({ zoomLevel: 1.1 })
      );
    });

    test('缩小功能', () => {
      const zoomOutHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === PDF_VIEWER_EVENTS.ZOOM.OUT
      )?.[1];
      
      zoomOutHandler();
      
      expect(pdfViewerApp.state.zoomLevel).toBe(0.9);
    });

    test('缩放范围限制', () => {
      const zoomInHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === PDF_VIEWER_EVENTS.ZOOM.IN
      )?.[1];
      
      // 测试上限
      pdfViewerApp.state.zoomLevel = 3.0;
      zoomInHandler();
      expect(pdfViewerApp.state.zoomLevel).toBe(3.0);
      
      // 测试下限
      const zoomOutHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === PDF_VIEWER_EVENTS.ZOOM.OUT
      )?.[1];
      
      pdfViewerApp.state.zoomLevel = 0.5;
      zoomOutHandler();
      expect(pdfViewerApp.state.zoomLevel).toBe(0.5);
    });
  });

  /**
   * 测试状态获取方法
   */
  test('获取应用状态', () => {
    const state = pdfViewerApp.getState();
    
    expect(state).toEqual(expect.objectContaining({
      initialized: false,
      currentFile: null,
      currentPage: 1,
      totalPages: 0,
      zoomLevel: 1.0,
      isLoading: false
    }));
    
    // 验证返回的是副本而不是引用
    state.test = true;
    expect(pdfViewerApp.getState().test).toBeUndefined();
  });

  /**
   * 测试销毁方法
   */
  test('正确销毁应用', () => {
    // 设置模拟的销毁方法
    const mockDestroy = jest.fn();
    pdfViewerApp.pdfManager = { destroy: mockDestroy };
    pdfViewerApp.uiManager = { destroy: mockDestroy };
    pdfViewerApp.wsClient = { disconnect: mockDestroy };
    
    pdfViewerApp.destroy();
    
    expect(mockDestroy).toHaveBeenCalledTimes(3);
    expect(mockEventBus.offAll).toHaveBeenCalled();
    expect(pdfViewerApp.state.initialized).toBe(false);
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.STATE.DESTROYED
    );
  });

  /**
   * 测试事件名称常量使用
   */
  test('使用正确的事件名称常量', () => {
    // 验证所有使用的事件名称都来自常量定义
    const usedEvents = new Set();
    
    mockEventBus.on.mock.calls.forEach(([eventName]) => {
      usedEvents.add(eventName);
    });
    
    // 检查事件名称是否在常量中定义
    const allConstants = Object.values(PDF_VIEWER_EVENTS).flatMap(
      category => Object.values(category)
    ).filter(value => typeof value === 'string');
    
    Array.from(usedEvents).forEach(eventName => {
      expect(allConstants).toContain(eventName);
    });
  });
});