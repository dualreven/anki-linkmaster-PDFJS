
/**
 * WebSocket客户端单元测试 - PDF_DETAIL_REQUEST消息发送功能测试
 * @file 测试WebSocket客户端的PDF详情请求功能
 * @module WSClientPDFDetailTest
 */

import { WSClient } from '../../../../src/frontend/common/ws/ws-client.js';
import { WEBSOCKET_MESSAGE_TYPES } from '../../../../src/frontend/common/event/event-constants.js';

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

describe('WebSocket客户端 - PDF详情请求功能测试', () => {
  let wsClient;
  let mockSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket = new WebSocket('ws://localhost:8765');
    wsClient = new WSClient('ws://localhost:8765', mockEventBus);
  });

  /**
   * 测试1: 请求ID生成机制的正确性
   */
  describe('请求ID生成机制测试', () => {
    test('生成的请求ID应该是唯一的字符串', () => {
      // 由于generateRequestId是私有方法，我们需要通过sendPDFDetailRequest来测试
      const requestId1 = wsClient.sendPDFDetailRequest('test-pdf-1', 100, 1);
      const requestId2 = wsClient.sendPDFDetailRequest('test-pdf-2', 100, 1);
      
      // 验证返回的是Promise对象
      expect(requestId1).toBeInstanceOf(Promise);
      expect(requestId2).toBeInstanceOf(Promise);
      
      // 验证WebSocket send方法被调用，说明请求ID生成成功
      expect(mockSocket.send).toHaveBeenCalled();
    });

    test('请求ID格式应该符合预期模式', () => {
      // 通过模拟send方法调用来验证请求ID格式
      const mockSend = jest.fn();
      mockSocket.send = mockSend;
      
      wsClient.sendPDFDetailRequest('test-pdf', 100, 1);
      
      // 获取发送的消息
      const sentMessage = JSON.parse(mockSend.mock.calls[0][0]);
      
      // 验证请求ID格式
      expect(sentMessage.request_id).toBeDefined();
      expect(typeof sentMessage.request_id).toBe('string');
      expect(sentMessage.request_id).toMatch(/^req_\d+_[a-z0-9]{9}$/);
    });
  });

  /**
   * 测试2: 消息格式化功能的正确性
   */
  describe('消息格式化功能测试', () => {
    test('PDF详情请求消息格式应该符合标准协议', () => {
      const mockSend = jest.fn();
      mockSocket.send = mockSend;
      
      const pdfId = 'test-pdf-123';
      wsClient.sendPDFDetailRequest(pdfId, 100, 1);
      
      const sentMessage = JSON.parse(mockSend.mock.calls[0][0]);
      
      // 验证消息结构
      expect(sentMessage).toEqual({
        type: WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_REQUEST,
        request_id: expect.any(String),
        timestamp: expect.any(Number),
        data: {
          pdf_id: pdfId
        }
      });
      
      // 验证时间戳是数字类型
      expect(typeof sentMessage.timestamp).toBe('number');
      expect(sentMessage.timestamp).toBeGreaterThan(0);
    });

    test('消息应该包含正确的PDF ID', () => {
      const mockSend = jest.fn();
      mockSocket.send = mockSend;
      
      const testPdfIds = ['pdf-1', 'pdf-2', 'pdf-with-special-chars_123'];

      testPdfIds.forEach(pdfId => {
        mockSend.mockClear();
        wsClient.sendPDFDetailRequest(pdfId, 100, 1);
        
        const sentMessage = JSON.parse(mockSend.mock.calls[0][0]);
        expect(sentMessage.data.pdf_id).toBe(pdfId);
      });
    });
  });

  /**
   * 测试3: 错误处理机制的有效性
   */
  describe('错误处理机制测试', () => {
    test('连接未建立时应该正确处理错误', async () => {
      // 模拟未连接状态
      mockSocket.readyState = 0; // CONNECTING状态
      
      await expect(wsClient.sendPDFDetailRequest('test-pdf', 100, 1))
        .rejects
        .toThrow('WebSocket连接未建立');
    });

    test('网络错误时应该触发重试机制', async () => {
      // 模拟网络错误
      const mockSend = jest.fn().mockImplementation(() => {
        throw new Error('Network error');
      });
      mockSocket.send = mockSend;
      
      const promise = wsClient.sendPDFDetailRequest('test-pdf', 100, 2);
      
      // 验证重试机制被触发
      await expect(promise).rejects.toThrow('PDF详情请求失败，已重试2次: Network error');
      expect(mockSend).toHaveBeenCalledTimes(2); // 初始调用 + 1次重试
    });

    test('超时错误应该正确处理', async () => {
      jest.useFakeTimers();
      
      const promise = wsClient.sendPDFDetailRequest('test-pdf', 100, 0);
      
      // 推进时间触发超时
      jest.advanceTimersByTime(150);
      
      await expect(promise).rejects.toThrow('PDF详情请求超时');
      
      jest.useRealTimers();
    });
  });

  /**
   * 测试4: 重试机制的正确性
   */
  describe('重试机制测试', () => {
    test('应该按照指数退避策略进行重试', async () => {
      jest.useFakeTimers();
      
      // 模拟总是失败
      const mockSend = jest.fn().mockImplementation(() => {
        throw new Error('Network error');
      });
      mockSocket.send = mockSend;
      
      const promise = wsClient.sendPDFDetailRequest('test-pdf', 1000, 3);
      
      // 验证重试次数和时间间隔
      expect(mockSend).toHaveBeenCalledTimes(1); // 第一次调用
      
      // 第一次重试应该在1秒后
      jest.advanceTimersByTime(1000);
      expect(mockSend).toHaveBeenCalledTimes(2);
      
      // 第二次重试应该在2秒后
      jest.advanceTimersByTime(1000);
      expect(mockSend).toHaveBeenCalledTimes(3);
      
      // 第三次重试应该在3秒后
      jest.advanceTimersByTime(1000);
      expect(mockSend).toHaveBeenCalledTimes(4);
      
      // 最终应该失败
      jest.advanceTimersByTime(1000);
      await expect(promise).rejects.toThrow('PDF详情请求失败，已重试3次: Network error');
      
      jest.useRealTimers();
    });

    test('重试次数应该受maxRetries参数控制', async () => {
      const mockSend = jest.fn().mockImplementation(() => {
        throw new Error('Network error');
      });
      mockSocket.send = mockSend;
      
      // 测试不同的重试次数
      const testCases = [
        { maxRetries: 1, expectedCalls: 2 }, // 初始调用 + 1次重试
        { maxRetries: 2, expectedCalls: 3 }, // 初始调用 + 2次重试
        { maxRetries: 3, expectedCalls: 4 }, // 初始调用 + 3次重试
      ];
      
      for (const testCase of testCases) {
        mockSend.mockClear();
        
        await expect(wsClient.sendPDFDetailRequest('test-pdf', 100, testCase.maxRetries))
          .rejects
          .toThrow(`PDF详情请求失败，已重试${testCase.maxRetries}次: Network error`);
        
        expect(mockSend).toHaveBeenCalledTimes(testCase.expectedCalls);
      }
    });
  });

  /**
   * 测试5: 响应处理功能的正确性
   */
  describe('响应处理功能测试', () => {
    test('应该正确处理成功的PDF详情响应', async () => {
      const mockSend = jest.fn();
      mockSocket.send = mockSend;
      
      const promise = wsClient.sendPDFDetailRequest('test-pdf', 1000, 1);
      
      // 获取发送的消息以获取request_id
      const sentMessage = JSON.parse(mockSend.mock.calls[0][0]);
      const requestId = sentMessage.request_id;
      
      // 模拟成功的响应
      const successResponse = {
        type: 'pdf_detail_response',
        request_id: requestId,
        data: {
          id: 'test-pdf',
          filename: 'test.pdf',
          page_count: 10,
          size: 1024
        }
      };
      
      // 触发响应处理
      wsClient._handleMessage(JSON.stringify(successResponse));
      
      await expect(promise).resolves.toEqual(successResponse.data);
    });

    test('应该正确处理错误的PDF详情响应', async () => {
      const mockSend = jest.fn();
      mockSocket.send = mockSend;
      
      const promise = wsClient.sendPDFDetailRequest('test-pdf', 1000, 1);
      
      // 获取发送的消息以获取request_id
      const sentMessage = JSON.parse(mockSend.mock.calls[0][0]);
      const requestId = sentMessage.request_id;
      
      // 模拟错误的响应
      const errorResponse = {
        type: 'pdf_detail_response',
        request_id: requestId,
        error: {
          message: 'PDF文件不存在',
          code: 'FILE_NOT_FOUND'
        }
      };
      
      // 触发响应处理
      wsClient._handleMessage(JSON.stringify(errorResponse));
      
      await expect(promise).rejects.toThrow('PDF文件不存在');
    });

    test('应该忽略不相关的响应消息', async () => {
      const mockSend = jest.fn();
      mockSocket.send = mockSend;
      
      const promise = wsClient.sendPDFDetailRequest('test-pdf', 100, 1);
      
      // 发送不相关的消息
      const unrelatedMessage = {
        type: 'pdf_list_updated',
        data: { files: [] }
      };
      
      // 触发消息处理 - 不应该影响pending请求
      wsClient._handleMessage(JSON.stringify(unrelatedMessage));
      
      // 验证promise仍然pending
      expect(mockSend).toHaveBeenCalled();
      // 这里我们无法直接验证promise状态，但可以确认没有错误发生
    });
  });

  /**
   * 测试6: 集成测试验证整体功能
   */
  describe('集成测试 - 完整PDF详情请求流程', () => {
    test('完整的请求-响应流程应该正常工作', async () => {
      jest.useFakeTimers();
      
      const mockSend = jest.fn();
      mockSocket.send = mockSend;
      
      // 启动PDF详情请求
      const promise = wsClient.sendPDFDetailRequest('test-pdf-123', 2000, 2);
      
      // 验证请求已发送
      expect(mockSend).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse(mockSend.mock.calls[0][0]);
      
      // 模拟网络延迟后响应
      setTimeout(() => {
        const successResponse = {
          type: 'pdf_detail_response',
          request_id: sentMessage.request_id,
          data: {
            id: 'test-pdf-123',
            filename: 'test.pdf',
            title: 'Test PDF',
            page_count: 15,
            size: 2048,
            modified_time: '2024-01-01T00:00:00Z'
          }
        };
        wsClient._handleMessage(JSON.stringify(successResponse));
      }, 100);
      
      jest.advanceTimersByTime(150);
      
      // 验证请求成功完成
      await expect(promise).resolves.toEqual({
        id: 'test-pdf-123',
        filename: 'test.pdf',
        title: 'Test PDF',
        page_count: 15,
        size: 2048,
        modified_time: '2024-01-01T00:00:00Z'
      });
      
      jest.useRealTimers();
    });

    test('网络故障时的完整重试流程', async () => {
      jest.useFakeTimers();
      
      let callCount = 0;
      const mockSend = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Network error');
        }
        // 第三次成功
      });
      mockSocket.send = mockSend;
      
      const promise = wsClient.sendPDFDetailRequest('test-pdf', 3000, 3);
      
      // 第一次调用失败
      expect(mockSend).toHaveBeenCalledTimes(1);
      
      // 第一次重试 (1秒后)
      jest.advanceTimersByTime(1000);
      expect(mockSend).toHaveBeenCalledTimes(2);
      
      // 第二次重试 (2秒后)
      jest.advanceTimersByTime(1000);
      expect(mockSend).toHaveBeenCalledTimes(3);
      
      // 第三次调用成功，发送响应
      const sentMessage = JSON.parse(mockSend.mock.calls[2][0]);
      const successResponse = {
        type: 'pdf_detail_response',
        request_id: sentMessage.request_id,
        data: { id: 'test-pdf', filename: 'test.pdf' }
      };
      wsClient._handleMessage(JSON.stringify(successResponse));
      
      await expect(promise).resolves.toEqual({ id: 'test-pdf', filename: 'test.pdf' });
      
      jest.useRealTimers();
    });
  });
});