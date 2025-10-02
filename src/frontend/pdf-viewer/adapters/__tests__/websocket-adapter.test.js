/**
 * @file WebSocketAdapter 单元测试
 * @description 测试WebSocket适配器的消息转换和队列管理功能
 */

import { WebSocketAdapter, createWebSocketAdapter } from '../websocket-adapter.js';
import { EventBus } from '../../../common/event/event-bus.js';
import { PDF_VIEWER_EVENTS } from '../../../common/event/pdf-viewer-constants.js';
import { WEBSOCKET_MESSAGE_EVENTS } from '../../../common/event/event-constants.js';

describe('WebSocketAdapter', () => {
  let eventBus;
  let mockWSClient;
  let adapter;

  beforeEach(() => {
    // 创建EventBus实例（禁用验证以支持测试）
    eventBus = new EventBus({ enableValidation: false });

    // 创建模拟的WSClient
    mockWSClient = {
      send: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnected: jest.fn(() => true)
    };
  });

  afterEach(() => {
    if (adapter) {
      adapter.destroy();
    }
    eventBus.destroy();
  });

  describe('构造函数', () => {
    test('应该正确创建实例', () => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus);

      expect(adapter).toBeInstanceOf(WebSocketAdapter);
      expect(adapter.getState().initialized).toBe(false);
      expect(adapter.getState().queuedMessages).toBe(0);
    });

    test('缺少wsClient时应该抛出错误', () => {
      expect(() => {
        new WebSocketAdapter(null, eventBus);
      }).toThrow('WebSocketAdapter: wsClient is required');
    });

    test('缺少eventBus时应该抛出错误', () => {
      expect(() => {
        new WebSocketAdapter(mockWSClient, null);
      }).toThrow('WebSocketAdapter: eventBus is required');
    });
  });

  describe('工厂函数', () => {
    test('createWebSocketAdapter应该创建实例', () => {
      adapter = createWebSocketAdapter(mockWSClient, eventBus);

      expect(adapter).toBeInstanceOf(WebSocketAdapter);
      expect(adapter.getState().initialized).toBe(false);
    });
  });

  describe('setupMessageHandlers', () => {
    test('应该设置消息处理器', () => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus);

      // 设置前，activeListeners应该为0
      expect(adapter.getState().activeListeners).toBe(0);

      adapter.setupMessageHandlers();

      // 设置后，应该有监听器注册
      expect(adapter.getState().activeListeners).toBeGreaterThan(0);
    });
  });

  describe('传入消息处理 (WebSocket → EventBus)', () => {
    beforeEach(() => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus);
      adapter.setupMessageHandlers();
      adapter.onInitialized(); // 标记为已初始化
    });

    test('应该处理 load_pdf_file 消息', () => {
      const fileData = {
        filename: 'test.pdf',
        url: 'http://localhost/test.pdf',
        file_path: '/path/to/test.pdf'
      };

      const handler = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, handler);

      adapter.handleMessage({
        type: 'load_pdf_file',
        data: fileData
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'test.pdf',
          file_path: '/path/to/test.pdf',
          filePath: '/path/to/test.pdf',
          url: 'http://localhost/test.pdf'
        })
      );
    });

    test('应该处理旧格式的 load_pdf_file 消息（fileId）', (done) => {
      const fileData = {
        filename: 'legacy.pdf',
        url: 'http://localhost/legacy.pdf',
        fileId: 'legacy-file-id'
      };

      eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, (data) => {
        expect(data.filename).toBe('legacy.pdf');
        expect(data.fileId).toBe('legacy-file-id');
        done();
      });

      adapter.handleMessage({
        type: 'load_pdf_file',
        data: fileData
      });
    });

    test('应该处理 navigate_page 消息', () => {
      const handler = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.GOTO, handler);

      adapter.handleMessage({
        type: 'navigate_page',
        data: { page_number: 5 }
      });

      expect(handler).toHaveBeenCalledWith(
        { pageNumber: 5 }
      );
    });

    test('应该处理 set_zoom 消息（level）', (done) => {
      eventBus.on(PDF_VIEWER_EVENTS.ZOOM.CHANGED, (data) => {
        expect(data.level).toBe(1.5);
        done();
      });

      adapter.handleMessage({
        type: 'set_zoom',
        data: { level: 1.5 }
      });
    });

    test('应该处理 set_zoom 消息（scale）', (done) => {
      eventBus.on(PDF_VIEWER_EVENTS.ZOOM.CHANGED, (data) => {
        expect(data.scale).toBe(2.0);
        done();
      });

      adapter.handleMessage({
        type: 'set_zoom',
        data: { scale: 2.0 }
      });
    });

    test('应该忽略未知消息类型', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      adapter.handleMessage({
        type: 'unknown_message_type',
        data: {}
      });

      // 验证没有抛出错误
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    test('应该验证 load_pdf_file 消息格式', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // 缺少必需字段
      adapter.handleMessage({
        type: 'load_pdf_file',
        data: { filename: 'test.pdf' } // 缺少url
      });

      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    test('应该验证 navigate_page 消息格式', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // page_number不是数字
      adapter.handleMessage({
        type: 'navigate_page',
        data: { page_number: 'invalid' }
      });

      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('传出消息处理 (EventBus → WebSocket)', () => {
    beforeEach(() => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus);
      adapter.setupMessageHandlers();
      adapter.onInitialized();
    });

    test('应该发送 pdf_loaded 消息', () => {
      eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, {
        filePath: '/path/to/file.pdf',
        filename: 'file.pdf',
        totalPages: 10,
        url: 'http://localhost/file.pdf'
      });

      expect(mockWSClient.send).toHaveBeenCalledWith({
        type: 'pdf_loaded',
        data: {
          file_path: '/path/to/file.pdf',
          filename: 'file.pdf',
          total_pages: 10,
          url: 'http://localhost/file.pdf'
        }
      });
    });

    test('应该发送 page_changed 消息', () => {
      eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.CHANGED, {
        pageNumber: 3,
        totalPages: 10
      });

      expect(mockWSClient.send).toHaveBeenCalledWith({
        type: 'page_changed',
        data: {
          page_number: 3,
          total_pages: 10
        }
      });
    });

    test('应该发送 zoom_changed 消息', () => {
      eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.CHANGED, {
        level: 1.5,
        scale: 1.5
      });

      expect(mockWSClient.send).toHaveBeenCalledWith({
        type: 'zoom_changed',
        data: {
          level: 1.5,
          scale: 1.5
        }
      });
    });
  });

  describe('消息队列处理', () => {
    test('未初始化时应该缓存消息', () => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus);
      adapter.setupMessageHandlers();
      // 不调用 onInitialized()

      const handler = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, handler);

      adapter.handleMessage({
        type: 'load_pdf_file',
        data: {
          filename: 'queued.pdf',
          url: 'http://localhost/queued.pdf',
          file_path: '/queued.pdf'
        }
      });

      // 消息应该被缓存，处理器不应该被调用
      expect(handler).not.toHaveBeenCalled();
      expect(adapter.getState().queuedMessages).toBe(1);
    });

    test('初始化后应该处理队列中的消息', (done) => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus);
      adapter.setupMessageHandlers();

      // 添加多个消息到队列
      adapter.handleMessage({
        type: 'load_pdf_file',
        data: {
          filename: 'queued1.pdf',
          url: 'http://localhost/queued1.pdf',
          file_path: '/queued1.pdf'
        }
      });

      adapter.handleMessage({
        type: 'navigate_page',
        data: { page_number: 5 }
      });

      expect(adapter.getState().queuedMessages).toBe(2);

      const loadHandler = jest.fn();
      const navHandler = jest.fn();

      eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, loadHandler);
      eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.GOTO, navHandler);

      // 调用 onInitialized() 应该处理队列
      adapter.onInitialized();

      // 等待事件处理
      setTimeout(() => {
        expect(loadHandler).toHaveBeenCalled();
        expect(navHandler).toHaveBeenCalled();
        expect(adapter.getState().queuedMessages).toBe(0);
        done();
      }, 10);
    });

    test('初始化后的新消息应该立即处理', (done) => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus);
      adapter.setupMessageHandlers();
      adapter.onInitialized(); // 标记为已初始化

      const handler = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, handler);

      adapter.handleMessage({
        type: 'load_pdf_file',
        data: {
          filename: 'immediate.pdf',
          url: 'http://localhost/immediate.pdf',
          file_path: '/immediate.pdf'
        }
      });

      // 等待事件处理
      setTimeout(() => {
        expect(handler).toHaveBeenCalled();
        expect(adapter.getState().queuedMessages).toBe(0);
        done();
      }, 10);
    });
  });

  describe('destroy方法', () => {
    test('应该清理所有监听器', () => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus);
      adapter.setupMessageHandlers();

      expect(adapter.getState().activeListeners).toBeGreaterThan(0);

      adapter.destroy();

      expect(adapter.getState().activeListeners).toBe(0);
      expect(adapter.getState().initialized).toBe(false);
    });

    test('销毁后发射事件不应该触发WebSocket发送', () => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus);
      adapter.setupMessageHandlers();
      adapter.onInitialized();

      adapter.destroy();

      mockWSClient.send.mockClear();

      eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, {
        filePath: '/test.pdf',
        filename: 'test.pdf',
        totalPages: 10,
        url: 'http://localhost/test.pdf'
      });

      // 销毁后不应该发送消息
      expect(mockWSClient.send).not.toHaveBeenCalled();
    });

    test('销毁后应该清空消息队列', () => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus);
      adapter.setupMessageHandlers();

      // 添加消息到队列
      adapter.handleMessage({
        type: 'load_pdf_file',
        data: {
          filename: 'queued.pdf',
          url: 'http://localhost/queued.pdf',
          file_path: '/queued.pdf'
        }
      });

      expect(adapter.getState().queuedMessages).toBe(1);

      adapter.destroy();

      expect(adapter.getState().queuedMessages).toBe(0);
    });
  });

  describe('getState方法', () => {
    test('应该返回正确的状态', () => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus);

      let state = adapter.getState();
      expect(state.initialized).toBe(false);
      expect(state.queuedMessages).toBe(0);
      expect(state.activeListeners).toBe(0);

      adapter.setupMessageHandlers();
      state = adapter.getState();
      expect(state.activeListeners).toBeGreaterThan(0);

      adapter.onInitialized();
      state = adapter.getState();
      expect(state.initialized).toBe(true);
    });
  });

  describe('实际使用场景', () => {
    test('模拟完整的消息流转', (done) => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus);
      adapter.setupMessageHandlers();

      // 场景1: 应用未初始化，收到加载PDF消息
      adapter.handleMessage({
        type: 'load_pdf_file',
        data: {
          filename: 'document.pdf',
          url: 'http://localhost/document.pdf',
          file_path: '/document.pdf'
        }
      });

      // 消息应该被缓存
      expect(adapter.getState().queuedMessages).toBe(1);

      // 场景2: 应用初始化完成
      const loadHandler = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, loadHandler);

      adapter.onInitialized();

      // 场景3: 文件加载完成，发送通知到后端
      setTimeout(() => {
        expect(loadHandler).toHaveBeenCalled();

        mockWSClient.send.mockClear();

        eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, {
          filePath: '/document.pdf',
          filename: 'document.pdf',
          totalPages: 100,
          url: 'http://localhost/document.pdf'
        });

        expect(mockWSClient.send).toHaveBeenCalledWith({
          type: 'pdf_loaded',
          data: {
            file_path: '/document.pdf',
            filename: 'document.pdf',
            total_pages: 100,
            url: 'http://localhost/document.pdf'
          }
        });

        done();
      }, 10);
    });

    test('模拟页面导航流程', () => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus);
      adapter.setupMessageHandlers();
      adapter.onInitialized();

      // 后端请求导航到第5页
      const navHandler = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.GOTO, navHandler);

      adapter.handleMessage({
        type: 'navigate_page',
        data: { page_number: 5 }
      });

      expect(navHandler).toHaveBeenCalledWith(
        { pageNumber: 5 }
      );

      // 前端确认页面已改变，通知后端
      mockWSClient.send.mockClear();

      eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.CHANGED, {
        pageNumber: 5,
        totalPages: 100
      });

      expect(mockWSClient.send).toHaveBeenCalledWith({
        type: 'page_changed',
        data: {
          page_number: 5,
          total_pages: 100
        }
      });
    });
  });
});
