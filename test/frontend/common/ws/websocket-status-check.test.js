/**
 * WebSocket客户端状态检查测试
 * @file 测试WebSocket客户端的初始化状态、连接配置和基本功能
 * @module WSClientStatusCheckTest
 */

import { WSClient } from '../../../../src/frontend/common/ws/ws-client.js';
import { WEBSOCKET_EVENTS } from '../../../../src/frontend/common/event/event-constants.js';

// Mock WebSocket全局对象
global.WebSocket = jest.fn().mockImplementation(() => ({
  readyState: 1, // OPEN状态
  send: jest.fn(),
  close: jest.fn(),
  onopen: null,
  onmessage: null,
  onclose: null,
  onerror: null,
}));

// Mock事件总线
const mockEventBus = {
  on: jest.fn(),
  emit: jest.fn(),
};

// Mock Logger
jest.mock('../../../../src/frontend/common/utils/logger.js', () => {
  return jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }));
});

describe('WebSocket客户端 - 状态检查测试', () => {
  let wsClient;
  let mockSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket = new WebSocket('ws://localhost:8765');
    wsClient = new WSClient('ws://localhost:8765', mockEventBus);
  });

  /**
   * 测试1: 初始化状态检查
   */
  describe('初始化状态检查', () => {
    test('构造函数应该正确初始化所有属性', () => {
      // 验证私有属性初始化
      expect(wsClient).toBeInstanceOf(WSClient);
      
      // 通过公共方法验证状态
      expect(wsClient.isConnected()).toBe(false);
      
      // 验证事件监听器设置
      expect(mockEventBus.on).toHaveBeenCalledWith(
        WEBSOCKET_EVENTS.MESSAGE.SEND,
        expect.any(Function),
        { subscriberId: "WSClient" }
      );
    });

    test('应该使用正确的URL初始化', () => {
      const customUrl = 'ws://custom-host:8080';
      const customWsClient = new WSClient(customUrl, mockEventBus);
      
      // 验证URL被正确设置（通过connect方法验证）
      customWsClient.connect();
      expect(global.WebSocket).toHaveBeenCalledWith(customUrl);
    });
  });

  /**
   * 测试2: 连接状态管理
   */
  describe('连接状态管理测试', () => {
    test('connect方法应该建立WebSocket连接', () => {
      wsClient.connect();
      
      // 验证WebSocket被创建
      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:8765');
      expect(mockSocket.onopen).toBeDefined();
      expect(mockSocket.onmessage).toBeDefined();
      expect(mockSocket.onclose).toBeDefined();
      expect(mockSocket.onerror).toBeDefined();
    });

    test('isConnected方法应该正确反映连接状态', () => {
      // 初始状态应该是未连接
      expect(wsClient.isConnected()).toBe(false);
      
      // 模拟连接建立
      wsClient.connect();
      mockSocket.onopen();
      
      // 连接后状态应该是已连接
      expect(wsClient.isConnected()).toBe(true);
      
      // 模拟连接关闭
      mockSocket.onclose();
      expect(wsClient.isConnected()).toBe(false);
    });

    test('disconnect方法应该正确关闭连接', () => {
      wsClient.connect();
      wsClient.disconnect();
      
      // 验证close方法被调用
      expect(mockSocket.close).toHaveBeenCalledWith(1000, "Client initiated disconnect.");
      expect(wsClient.isConnected()).toBe(false);
    });
  });

  /**
   * 测试3: 事件处理配置
   */
  describe('事件处理配置测试', () => {
    test('应该正确设置WebSocket事件处理器', () => {
      wsClient.connect();
      
      // 验证所有事件处理器都被设置
      expect(mockSocket.onopen).toBeInstanceOf(Function);
      expect(mockSocket.onmessage).toBeInstanceOf(Function);
      expect(mockSocket.onclose).toBeInstanceOf(Function);
      expect(mockSocket.onerror).toBeInstanceOf(Function);
    });

    test('连接建立时应该触发正确的事件', () => {
      wsClient.connect();
      mockSocket.onopen();
      
      // 验证连接建立事件被触发
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED,
        undefined,
        { actorId: "WSClient" }
      );
    });

    test('连接关闭时应该触发正确的事件', () => {
      wsClient.connect();
      mockSocket.onclose();
      
      // 验证连接关闭事件被触发
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        WEBSOCKET_EVENTS.CONNECTION.CLOSED,
        undefined,
        { actorId: "WSClient" }
      );
    });

    test('连接错误时应该触发正确的事件', () => {
      const testError = new Error('Connection failed');
      wsClient.connect();
      mockSocket.onerror(testError);
      
      // 验证连接错误事件被触发
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        WEBSOCKET_EVENTS.CONNECTION.ERROR,
        testError,
        { actorId: "WSClient" }
      );
    });
  });

  /**
   * 测试4: 消息发送功能状态
   */
  describe('消息发送功能状态测试', () => {
    test('连接建立时应该能够发送消息', () => {
      wsClient.connect();
      mockSocket.onopen();
      
      const testMessage = { type: 'test_message', data: { test: 'data' } };
      wsClient.send(testMessage);
      
      // 验证消息被发送
      expect(mockSocket.send).toHaveBeenCalledWith(JSON.stringify({
        type: 'test_message',
        data: { test: 'data' },
        timestamp: expect.any(String)
      }));
    });

    test('未连接时消息应该进入队列', () => {
      const testMessage = { type: 'test_message', data: { test: 'data' } };
      wsClient.send(testMessage);
      
      // 验证消息没有被立即发送，而是进入队列
      expect(mockSocket.send).not.toHaveBeenCalled();
      
      // 建立连接后应该清空队列
      wsClient.connect();
      mockSocket.onopen();
      expect(mockSocket.send).toHaveBeenCalled(); // 队列消息被发送
    });

    test('发送失败时应该触发错误事件', () => {
      const sendError = new Error('Send failed');
      mockSocket.send.mockImplementation(() => { throw sendError; });
      
      wsClient.connect();
      mockSocket.onopen();
      
      const testMessage = { type: 'test_message', data: { test: 'data' } };
      wsClient.send(testMessage);
      
      // 验证发送失败事件被触发
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        WEBSOCKET_EVENTS.MESSAGE.SEND_FAILED,
        { type: 'test_message', error: sendError },
        { actorId: "WSClient" }
      );
    });
  });

  /**
   * 测试5: 重连机制状态
   */
  describe('重连机制状态测试', () => {
    test('连接关闭时应该尝试重连', () => {
      jest.useFakeTimers();
      
      wsClient.connect();
      mockSocket.onclose();
      
      // 验证重连尝试被调度
      expect(setTimeout).toHaveBeenCalled();
      
      jest.advanceTimersByTime(1000); // 第一次重试延迟
      expect(global.WebSocket).toHaveBeenCalledTimes(2); // 初始连接 + 第一次重试
      
      jest.useRealTimers();
    });

    test('达到最大重试次数后应该停止重连', () => {
      jest.useFakeTimers();
      
      wsClient.connect();
      
      // 模拟多次连接失败
      for (let i = 0; i < 6; i++) {
        mockSocket.onclose();
        jest.advanceTimersByTime(1000 * (i + 1));
      }
      
      // 验证重连失败事件被触发
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        WEBSOCKET_EVENTS.RECONNECT.FAILED,
        undefined,
        { actorId: "WSClient" }
      );
      
      jest.useRealTimers();
    });
  });

  /**
   * 测试6: 消息处理状态
   */
  describe('消息处理状态测试', () => {
    test('应该能够正确处理收到的消息', () => {
      wsClient.connect();
      
      const testMessage = {
        type: 'test_message',
        data: { content: 'test' },
        timestamp: new Date().toISOString()
      };
      
      mockSocket.onmessage({ data: JSON.stringify(testMessage) });
      
      // 验证消息接收事件被触发
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
        testMessage,
        { actorId: "WSClient" }
      );
    });

    test('应该正确处理无效的JSON消息', () => {
      wsClient.connect();
      
      const invalidMessage = 'invalid json {';
      mockSocket.onmessage({ data: invalidMessage });
      
      // 验证没有抛出错误，错误被正确处理
      expect(() => {
        mockSocket.onmessage({ data: invalidMessage });
      }).not.toThrow();
    });
  });

  /**
   * 测试7: 配置参数验证
   */
  describe('配置参数验证测试', () => {
    test('默认重连配置应该符合预期', () => {
      // 通过多次重连失败来验证默认配置
      jest.useFakeTimers();
      
      wsClient.connect();
      
      // 模拟5次重连失败（默认最大重试次数为5）
      for (let i = 0; i < 5; i++) {
        mockSocket.onclose();
        jest.advanceTimersByTime(1000 * (i + 1));
      }
      
      // 第6次重连应该失败
      mockSocket.onclose();
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        WEBSOCKET_EVENTS.RECONNECT.FAILED,
        undefined,
        { actorId: "WSClient" }
      );
      
      jest.useRealTimers();
    });

    test('消息队列功能应该正常工作', () => {
      // 发送多条消息在未连接状态
      const messages = [
        { type: 'message1', data: { test: 1 } },
        { type: 'message2', data: { test: 2 } },
        { type: 'message3', data: { test: 3 } }
      ];
      
      messages.forEach(msg => wsClient.send(msg));
      
      // 建立连接后应该发送所有队列消息
      wsClient.connect();
      mockSocket.onopen();
      
      // 验证所有消息都被发送
      expect(mockSocket.send).toHaveBeenCalledTimes(3);
    });
  });
});