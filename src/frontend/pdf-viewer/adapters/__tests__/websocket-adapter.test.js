/**
 * @file WebSocketAdapter 单元测试
 * @description 测试WebSocket适配器的消息转换和队列管理功能
 */

import { WebSocketAdapter, createWebSocketAdapter } from "../websocket-adapter.js";
import { EventBus } from "../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_MESSAGE_TYPES } from "../../../common/event/event-constants.js";
import * as wsInboundBridge from "../ws-inbound-bridge.js";
import { handleLoadPdfFileMessage } from "../websocket-adapter-load-pdf-file.js";
import { handleViewerNavigateMessage } from "../websocket-adapter-viewer-navigate.js";

describe("WebSocketAdapter", () => {
  let eventBus;
  let mockWSClient;
  let adapter;
  let mockPdfIdProvider;
  let handleViewerWsInboundSpy;

  beforeEach(() => {
    eventBus = new EventBus({ enableValidation: false });

    mockWSClient = {
      send: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnected: jest.fn(() => true)
    };

    mockPdfIdProvider = jest.fn(() => "mock-pdf-id-123");

    handleViewerWsInboundSpy = jest.spyOn(wsInboundBridge, "handleViewerWsInbound");
    handleViewerWsInboundSpy.mockImplementation(({ message, eventBus, wsClient, logger, pdfIdProvider, viewerInstanceId }) => {
      // Delegate to actual helper functions for accurate behavior
      if (message.type === "load_pdf_file") {
        handleLoadPdfFileMessage({ data: message.data, eventBus, logger });
      } else if (message.type === "navigate_page") {
        const { page_number } = message.data;
        if (typeof page_number !== "number") {
          logger.warn("Invalid navigate_page message: page_number must be a number", message.data);
          return;
        }
        eventBus.emit(
          PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED,
          { pdfId: pdfIdProvider(), pageAt: page_number }, // Use the mockPdfIdProvider value
          { actorId: "WebSocketAdapter" }
        );
      } else if (message.type === "set_zoom") {
        const { level, scale } = message.data;
        if (level === undefined && scale === undefined) {
          logger.warn("Invalid set_zoom message: must provide either level or scale", message.data);
          return;
        }
        eventBus.emit(
          PDF_VIEWER_EVENTS.ZOOM.CHANGED,
          { level, scale },
          { actorId: "WebSocketAdapter" }
        );
      } else if (message.type === WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED) {
        handleViewerNavigateMessage({
          message,
          correlationId: message?.request_id || null,
          eventBus,
          wsClient,
          logger,
          viewerInstanceId,
          pdfIdProvider // Pass the pdfIdProvider to the navigate message handler
        });
      } else {
        logger.warn(`handleViewerWsInbound mock: Unhandled message type ${message.type}`);
      }
    });
  });

  afterEach(() => {
    if (adapter) {
      adapter.destroy();
    }
    eventBus.destroy();
    handleViewerWsInboundSpy.mockRestore();
  });

  describe("构造函数", () => {
    test("应该正确创建实例", () => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus, mockPdfIdProvider);

      expect(adapter).toBeInstanceOf(WebSocketAdapter);
      expect(adapter.getState().initialized).toBe(false);
      expect(adapter.getState().queuedMessages).toBe(0);
    });

    test("缺少wsClient时应该抛出错误", () => {
      expect(() => {
        new WebSocketAdapter(null, eventBus);
      }).toThrow("WebSocketAdapter: wsClient is required");
    });

    test("缺少eventBus时应该抛出错误", () => {
      expect(() => {
        new WebSocketAdapter(mockWSClient, null);
      }).toThrow("WebSocketAdapter: eventBus is required");
    });
  });

  describe("工厂函数", () => {
    test("createWebSocketAdapter应该创建实例", () => {
      adapter = createWebSocketAdapter(mockWSClient, eventBus, mockPdfIdProvider);

      expect(adapter).toBeInstanceOf(WebSocketAdapter);
      expect(adapter.getState().initialized).toBe(false);
    });
  });

  describe("setupMessageHandlers", () => {
    test("应该设置消息处理器", () => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus, mockPdfIdProvider);

      // 设置前，activeListeners应该为0
      expect(adapter.getState().activeListeners).toBe(0);

      adapter.setupMessageHandlers();

      // 设置后，应该有监听器注册
      expect(adapter.getState().activeListeners).toBeGreaterThan(0);
    });
  });

  describe("传入消息处理 (WebSocket → EventBus)", () => {
    beforeEach(() => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus, mockPdfIdProvider);
      adapter.setupMessageHandlers();
      adapter.onInitialized(); // 标记为已初始化
    });

    test("应该处理 load_pdf_file 消息", () => {
      const fileData = {
        filename: "test.pdf",
        url: "http://localhost/test.pdf",
        file_path: "/path/to/test.pdf"
      };

      const handler = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, handler);

      const message = {
        type: "load_pdf_file",
        data: fileData
      };
      adapter.handleMessage(message);

      expect(handleViewerWsInboundSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: message,
          eventBus: eventBus,
          wsClient: mockWSClient,
          logger: expect.any(Object), // Logger instance
          pdfIdProvider: mockPdfIdProvider,
          viewerInstanceId: expect.any(String) // Viewer instance ID
        })
      );

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: "test.pdf",
          file_path: "/path/to/test.pdf",
          filePath: "/path/to/test.pdf",
          url: "http://localhost/test.pdf"
        })
      );
    });

    test("应该处理旧格式的 load_pdf_file 消息（fileId）", (done) => {
      const fileData = {
        filename: "legacy.pdf",
        url: "http://localhost/legacy.pdf",
        fileId: "legacy-file-id"
      };

      eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, (data) => {
        expect(data.filename).toBe("legacy.pdf");
        expect(data.fileId).toBe("legacy-file-id");
        expect(data.pdfId).toBe("legacy-file-id");
        done();
      });

      const message = {
        type: "load_pdf_file",
        data: fileData
      };
      adapter.handleMessage(message);

      expect(handleViewerWsInboundSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: message,
          eventBus: eventBus,
          wsClient: mockWSClient,
          logger: expect.any(Object),
          pdfIdProvider: mockPdfIdProvider,
          viewerInstanceId: expect.any(String)
        })
      );
    });

    test("load_pdf_file: filename 含 12hex 时应透传 pdfId", () => {
      const handler = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, handler);

      const message = {
        type: "load_pdf_file",
        data: {
          filename: "0c251de0e2ac.pdf",
          url: "http://localhost/0c251de0e2ac.pdf",
          file_path: "/path/to/0c251de0e2ac.pdf"
        }
      };
      adapter.handleMessage(message);

      expect(handleViewerWsInboundSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: message,
          eventBus: eventBus,
          wsClient: mockWSClient,
          logger: expect.any(Object),
          pdfIdProvider: mockPdfIdProvider,
          viewerInstanceId: expect.any(String)
        })
      );

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ pdfId: "0c251de0e2ac" }));
    });

    test("应该处理 navigate_page 消息", () => {
      const handler = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED, handler);

      const message = {
        type: "navigate_page",
        data: { page_number: 5 }
      };
      adapter.handleMessage(message);

      expect(handleViewerWsInboundSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: message,
          eventBus: eventBus,
          wsClient: mockWSClient,
          logger: expect.any(Object),
          pdfIdProvider: mockPdfIdProvider,
          viewerInstanceId: expect.any(String)
        })
      );

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ pageAt: 5 }));
    });

    test("应该处理 set_zoom 消息（level）", (done) => {
      eventBus.on(PDF_VIEWER_EVENTS.ZOOM.CHANGED, (data) => {
        expect(data.level).toBe(1.5);
        done();
      });

      const message = {
        type: "set_zoom",
        data: { level: 1.5 }
      };
      adapter.handleMessage(message);

      expect(handleViewerWsInboundSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: message,
          eventBus: eventBus,
          wsClient: mockWSClient,
          logger: expect.any(Object),
          pdfIdProvider: mockPdfIdProvider,
          viewerInstanceId: expect.any(String)
        })
      );
    });

    test("应该处理 set_zoom 消息（scale）", (done) => {
      eventBus.on(PDF_VIEWER_EVENTS.ZOOM.CHANGED, (data) => {
        expect(data.scale).toBe(2.0);
        done();
      });

      const message = {
        type: "set_zoom",
        data: { scale: 2.0 }
      };
      adapter.handleMessage(message);

      expect(handleViewerWsInboundSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: message,
          eventBus: eventBus,
          wsClient: mockWSClient,
          logger: expect.any(Object),
          pdfIdProvider: mockPdfIdProvider,
          viewerInstanceId: expect.any(String)
        })
      );
    });

    test("应该忽略未知消息类型", () => {
      mockWSClient.send.mockClear();
      const message = { type: "unknown_message_type", data: {} };
      adapter.handleMessage(message);
      expect(handleViewerWsInboundSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: message,
          eventBus: eventBus,
          wsClient: mockWSClient,
          logger: expect.any(Object),
          pdfIdProvider: mockPdfIdProvider,
          viewerInstanceId: expect.any(String)
        })
      );
      expect(mockWSClient.send).not.toHaveBeenCalled();
    });

    test("应该验证 load_pdf_file 消息格式", () => {
      const handler = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, handler);
      const message = {
        type: "load_pdf_file",
        data: { filename: "test.pdf" } // 缺少url
      };
      adapter.handleMessage(message);
      expect(handleViewerWsInboundSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: message,
          eventBus: eventBus,
          wsClient: mockWSClient,
          logger: expect.any(Object),
          pdfIdProvider: mockPdfIdProvider,
          viewerInstanceId: expect.any(String)
        })
      );
      // 不应触发事件，因为mocked handler会判断缺少url
      expect(handler).not.toHaveBeenCalled();
    });

    test("应该验证 navigate_page 消息格式", () => {
      const handler = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED, handler);
      const message = {
        type: "navigate_page",
        data: { page_number: "invalid" }
      };
      adapter.handleMessage(message);
      expect(handleViewerWsInboundSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: message,
          eventBus: eventBus,
          wsClient: mockWSClient,
          logger: expect.any(Object),
          pdfIdProvider: mockPdfIdProvider,
          viewerInstanceId: expect.any(String)
        })
      );
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("传出消息处理 (EventBus → WebSocket)", () => {
    beforeEach(() => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus, mockPdfIdProvider);
      adapter.setupMessageHandlers();
      adapter.onInitialized();
    });

    test("文件加载完成后不再发送 pdf_loaded 消息（已移除）", () => {
      eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, {
        filePath: "/path/to/file.pdf",
        filename: "file.pdf",
        totalPages: 10,
        url: "http://localhost/file.pdf"
      });
      // 不应发送任何 pdf_loaded 类型的消息
      const calls = mockWSClient.send.mock.calls.map(c => c[0]);
      expect(calls.find(m => m && m.type === "pdf_loaded")).toBeUndefined();
    });

    test("应该发送 page_changed 消息", () => {
      eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.CHANGED, {
        pageNumber: 3,
        totalPages: 10
      });

      // 适配器现在会附带 metadata 字段（例如版本号），这里使用宽匹配忽略该字段
      expect(mockWSClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "page_changed",
          data: {
            page_number: 3,
            total_pages: 10
          }
        })
      );
    });

    test("应该发送 zoom_changed 消息", () => {
      eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.CHANGED, {
        level: 1.5,
        scale: 1.5
      });

      // 同上：放宽匹配以忽略 metadata
      expect(mockWSClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "zoom_changed",
          data: {
            level: 1.5,
            scale: 1.5
          }
        })
      );
    });
  });

  describe("消息队列处理", () => {
    test("未初始化时应该缓存消息", () => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus, mockPdfIdProvider);
      adapter.setupMessageHandlers();
      // 不调用 onInitialized()

      const handler = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, handler);

      const message = {
        type: "load_pdf_file",
        data: {
          filename: "queued.pdf",
          url: "http://localhost/queued.pdf",
          file_path: "/queued.pdf"
        }
      };
      adapter.handleMessage(message);

      // 消息应该被缓存，处理器不应该被调用
      expect(handler).not.toHaveBeenCalled();
      expect(adapter.getState().queuedMessages).toBe(1);
      expect(handleViewerWsInboundSpy).not.toHaveBeenCalled();
    });

    test("初始化后应该处理队列中的消息", (done) => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus, mockPdfIdProvider);
      adapter.setupMessageHandlers();

      const message1 = {
        type: "load_pdf_file",
        data: {
          filename: "queued1.pdf",
          url: "http://localhost/queued1.pdf",
          file_path: "/queued1.pdf"
        }
      };
      adapter.handleMessage(message1);

      const message2 = {
        type: "navigate_page",
        data: { page_number: 5 }
      };
      adapter.handleMessage(message2);

      expect(adapter.getState().queuedMessages).toBe(2);
      expect(handleViewerWsInboundSpy).not.toHaveBeenCalled(); // Should not be called yet

      const loadHandler = jest.fn();
      const navHandler = jest.fn();

      eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, loadHandler);
      eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED, navHandler);

      // 调用 onInitialized() 应该处理队列
      adapter.onInitialized();

      // 等待事件处理
      setTimeout(() => {
        expect(handleViewerWsInboundSpy).toHaveBeenCalledTimes(2);
        expect(handleViewerWsInboundSpy).toHaveBeenCalledWith(
          expect.objectContaining({ message: message1 })
        );
        expect(handleViewerWsInboundSpy).toHaveBeenCalledWith(
          expect.objectContaining({ message: message2 })
        );

        expect(loadHandler).toHaveBeenCalled();
        expect(navHandler).toHaveBeenCalled();
        expect(adapter.getState().queuedMessages).toBe(0);
        done();
      }, 10);
    });

    test("初始化后的新消息应该立即处理", (done) => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus, mockPdfIdProvider);
      adapter.setupMessageHandlers();
      adapter.onInitialized(); // 标记为已初始化

      const handler = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, handler);

      const message = {
        type: "load_pdf_file",
        data: {
          filename: "immediate.pdf",
          url: "http://localhost/immediate.pdf",
          file_path: "/immediate.pdf"
        }
      };
      adapter.handleMessage(message);

      // 等待事件处理
      setTimeout(() => {
        expect(handleViewerWsInboundSpy).toHaveBeenCalledWith(
          expect.objectContaining({ message: message })
        );
        expect(handler).toHaveBeenCalled();
        expect(adapter.getState().queuedMessages).toBe(0);
        done();
      }, 10);
    });
  });

  describe("destroy方法", () => {
    test("应该清理所有监听器", () => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus, mockPdfIdProvider);
      adapter.setupMessageHandlers();

      expect(adapter.getState().activeListeners).toBeGreaterThan(0);

      adapter.destroy();

      expect(adapter.getState().activeListeners).toBe(0);
      expect(adapter.getState().initialized).toBe(false);
    });

    test("销毁后发射事件不应该触发WebSocket发送", () => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus, mockPdfIdProvider);
      adapter.setupMessageHandlers();
      adapter.onInitialized();

      adapter.destroy();

      mockWSClient.send.mockClear();

      eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, {
        filePath: "/test.pdf",
        filename: "test.pdf",
        totalPages: 10,
        url: "http://localhost/test.pdf"
      });

      // 销毁后不应该发送消息
      expect(mockWSClient.send).not.toHaveBeenCalled();
    });

    test("销毁后应该清空消息队列", () => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus, mockPdfIdProvider);
      adapter.setupMessageHandlers();

      // 添加消息到队列
      adapter.handleMessage({
        type: "load_pdf_file",
        data: {
          filename: "queued.pdf",
          url: "http://localhost/queued.pdf",
          file_path: "/queued.pdf"
        }
      });

      expect(adapter.getState().queuedMessages).toBe(1);

      adapter.destroy();

      expect(adapter.getState().queuedMessages).toBe(0);
    });

    test("应该清理所有由该adapter订阅的eventBus监听器（无泄漏）", () => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus, mockPdfIdProvider);
      adapter.setupMessageHandlers(); // 这会注册监听器

      // 验证在destroy之前有监听器
      expect(adapter.getState().activeListeners).toBeGreaterThan(0);

      adapter.destroy();

      // 验证在destroy之后没有该adapter的监听器
      expect(adapter.getState().activeListeners).toBe(0);
    });
  });

  describe("getState方法", () => {
    test("应该返回正确的状态", () => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus, mockPdfIdProvider);

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

  describe("实际使用场景", () => {
    test("模拟完整的消息流转", async () => { // Changed to async test
      adapter = new WebSocketAdapter(mockWSClient, eventBus, mockPdfIdProvider);
      adapter.setupMessageHandlers();

      // Ensure pdfIdProvider returns null for this test to prevent VisitedAt logic
      mockPdfIdProvider.mockReturnValue(null);

      // 场景1: 应用未初始化，收到加载PDF消息
      const message1 = {
        type: "load_pdf_file",
        data: {
          filename: "document.pdf",
          url: "http://localhost/document.pdf",
          file_path: "/document.pdf"
        }
      };
      adapter.handleMessage(message1);

      // 消息应该被缓存
      expect(adapter.getState().queuedMessages).toBe(1);
      expect(handleViewerWsInboundSpy).not.toHaveBeenCalled();

      // 场景2: 应用初始化完成
      const loadHandler = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, loadHandler);

      adapter.onInitialized();

      // Wait for any promises to resolve due to async operations in handleViewerWsInbound mock
      await Promise.resolve(); // Simulate microtask queue

      // 场景3: 文件加载完成，不再发送 legacy 的 pdf_loaded 消息
      expect(handleViewerWsInboundSpy).toHaveBeenCalledWith(
        expect.objectContaining({ message: message1 })
      );
      expect(loadHandler).toHaveBeenCalled();

      mockWSClient.send.mockClear();

      eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, {
        filePath: "/document.pdf",
        filename: "document.pdf",
        totalPages: 100,
        url: "http://localhost/document.pdf"
      });

      // 未提供 pdf-id 场景下不会发送 visited_at 更新；也不应发送 pdf_loaded
      expect(mockWSClient.send).not.toHaveBeenCalled();
    });

    test("模拟页面导航流程", () => {
      adapter = new WebSocketAdapter(mockWSClient, eventBus, mockPdfIdProvider);
      adapter.setupMessageHandlers();
      adapter.onInitialized();

      // 后端请求导航到第5页
      const navHandler = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED, navHandler);

      const message = {
        type: "navigate_page",
        data: { page_number: 5 }
      };
      adapter.handleMessage(message);

      expect(handleViewerWsInboundSpy).toHaveBeenCalledWith(
        expect.objectContaining({ message: message })
      );
      expect(navHandler).toHaveBeenCalledWith(expect.objectContaining({ pageAt: 5 }));

      // 前端确认页面已改变，通知后端
      mockWSClient.send.mockClear();

      eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.CHANGED, {
        pageNumber: 5,
        totalPages: 100
      });

      // 同上：适配器附带 metadata，使用 objectContaining 进行宽匹配
      expect(mockWSClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "page_changed",
          data: {
            page_number: 5,
            total_pages: 100
          }
        })
      );
    });
  });
});
