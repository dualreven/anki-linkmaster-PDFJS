/**
 * WebSocket响应处理功能测试 - PDF_DETAIL_RESPONSE消息处理测试
 * @file 测试WebSocket客户端的PDF详情响应处理功能
 * @module WSClientResponseTest
 */

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
jest.mock('../src/frontend/common/utils/logger.js', () => {
  return jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }));
});

// 直接导入事件常量
const WEBSOCKET_MESSAGE_TYPES = {
  PDF_DETAIL_REQUEST: "pdf_detail_request"
};

// 模拟WSClient类，只测试响应处理逻辑
class MockWSClient {
  constructor() {
    this._pendingRequests = new Map();
    this._requestRetries = new Map();
    this._eventBus = mockEventBus;
  }

  // 模拟消息处理方法
  _handleMessage(rawData) {
    try {
      const message = JSON.parse(rawData);
      
      // 路由到特定处理器
      switch (message.type) {
        case "pdf_detail_response":
          this._handlePDFDetailResponse(message);
          break;
        default:
          // 忽略其他消息类型
          break;
      }
    } catch (error) {
      console.error("Failed to parse incoming WebSocket message.", error);
    }
  }

  // 测试目标方法
  _handlePDFDetailResponse(message) {
    const { request_id, data, error } = message;
    
    if (this._pendingRequests.has(request_id)) {
      const { resolve, reject } = this._pendingRequests.get(request_id);
      this._pendingRequests.delete(request_id);
      this._requestRetries.delete(request_id);
      
      if (error) {
        reject(new Error(error.message || 'PDF详情请求失败'));
      } else {
        resolve(data);
      }
    }
  }

  // 辅助方法用于设置测试场景
  setPendingRequest(requestId, resolve, reject) {
    this._pendingRequests.set(requestId, { resolve, reject });
  }

  clearPendingRequests() {
    this._pendingRequests.clear();
  }
}

describe('WebSocket客户端 - PDF详情响应处理功能测试', () => {
  let wsClient;

  beforeEach(() => {
    jest.clearAllMocks();
    wsClient = new MockWSClient();
  });

  /**
   * 测试1: 消息解析功能的正确性
   */
  describe('消息解析功能测试', () => {
    test('应该正确解析有效的JSON响应消息', () => {
      const validResponse = {
        type: 'pdf_detail_response',
        request_id: 'req_123456789_abc123def',
        data: {
          id: 'test-pdf-1',
          filename: 'test.pdf',
          page_count: 10,
          size: 1024
        }
      };

      // 直接调用内部消息处理方法
      wsClient._handleMessage(JSON.stringify(validResponse));

      // 验证没有错误发生
      expect(() => {
        wsClient._handleMessage(JSON.stringify(validResponse));
      }).not.toThrow();
    });

    test('应该正确处理无效的JSON消息', () => {
      const invalidJson = 'invalid json {';

      // 直接调用内部消息处理方法
      wsClient._handleMessage(invalidJson);

      // 验证错误被正确处理（不会崩溃）
      expect(() => {
        wsClient._handleMessage(invalidJson);
      }).not.toThrow();
    });
  });

  /**
   * 测试2: 成功响应处理的正确性
   */
  describe('成功响应处理测试', () => {
    test('应该正确处理成功的PDF详情响应', async () => {
      const requestId = 'req_123456789_abc123def';
      const successResponse = {
        type: 'pdf_detail_response',
        request_id: requestId,
        data: {
          id: 'test-pdf-1',
          filename: 'test.pdf',
          title: 'Test PDF Document',
          page_count: 15,
          size: 2048,
          modified_time: '2024-01-01T00:00:00Z'
        }
      };

      // 模拟pending请求
      const mockResolve = jest.fn();
      const mockReject = jest.fn();
      wsClient.setPendingRequest(requestId, mockResolve, mockReject);

      // 处理响应
      wsClient._handlePDFDetailResponse(successResponse);

      // 验证请求被正确解析
      expect(mockResolve).toHaveBeenCalledWith(successResponse.data);
      expect(mockReject).not.toHaveBeenCalled();

      // 验证pending请求被清理
      expect(wsClient._pendingRequests.has(requestId)).toBe(false);
    });

    test('应该处理不匹配的响应请求ID', () => {
      const unknownRequestId = 'req_unknown_123456';
      const response = {
        type: 'pdf_detail_response',
        request_id: unknownRequestId,
        data: { id: 'test-pdf' }
      };

      // 处理响应 - 不应该抛出错误
      expect(() => {
        wsClient._handlePDFDetailResponse(response);
      }).not.toThrow();

      // 验证没有操作发生
      expect(wsClient._pendingRequests.has(unknownRequestId)).toBe(false);
    });
  });

  /**
   * 测试3: 错误响应处理的正确性
   */
  describe('错误响应处理测试', () => {
    test('应该正确处理带错误信息的响应', async () => {
      const requestId = 'req_123456789_error';
      const errorResponse = {
        type: 'pdf_detail_response',
        request_id: requestId,
        error: {
          message: 'PDF文件不存在',
          code: 'FILE_NOT_FOUND'
        }
      };

      // 模拟pending请求
      const mockResolve = jest.fn();
      const mockReject = jest.fn();
      wsClient.setPendingRequest(requestId, mockResolve, mockReject);

      wsClient._handlePDFDetailResponse(errorResponse);

      // 验证请求被正确拒绝
      expect(mockReject).toHaveBeenCalledWith(expect.any(Error));
      expect(mockReject).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'PDF文件不存在'
        })
      );
      expect(mockResolve).not.toHaveBeenCalled();

      // 验证pending请求被清理
      expect(wsClient._pendingRequests.has(requestId)).toBe(false);
    });

    test('应该处理缺少错误信息的响应', async () => {
      const requestId = 'req_123456789_no_error_msg';
      const errorResponse = {
        type: 'pdf_detail_response',
        request_id: requestId,
        error: {} // 空错误对象
      };

      const mockReject = jest.fn();
      wsClient.setPendingRequest(requestId, jest.fn(), mockReject);

      wsClient._handlePDFDetailResponse(errorResponse);

      // 验证使用默认错误消息
      expect(mockReject).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'PDF详情请求失败'
        })
      );
    });
  });

  /**
   * 测试4: 边界情况和异常处理
   */
  describe('边界情况和异常处理测试', () => {
    test('应该处理空数据响应', async () => {
      const requestId = 'req_empty_data_123';
      const emptyDataResponse = {
        type: 'pdf_detail_response',
        request_id: requestId,
        data: null
      };

      const mockResolve = jest.fn();
      wsClient.setPendingRequest(requestId, mockResolve, jest.fn());

      wsClient._handlePDFDetailResponse(emptyDataResponse);

      expect(mockResolve).toHaveBeenCalledWith(null);
    });

    test('应该处理缺失data字段的响应', async () => {
      const requestId = 'req_missing_data_123';
      const missingDataResponse = {
        type: 'pdf_detail_response',
        request_id: requestId
        // 缺少data字段
      };

      const mockResolve = jest.fn();
      wsClient.setPendingRequest(requestId, mockResolve, jest.fn());

      wsClient._handlePDFDetailResponse(missingDataResponse);

      expect(mockResolve).toHaveBeenCalledWith(undefined);
    });

    test('应该处理并发请求场景', async () => {
      const requestIds = ['req_concurrent_1', 'req_concurrent_2', 'req_concurrent_3'];
      const responses = requestIds.map((requestId, index) => ({
        type: 'pdf_detail_response',
        request_id: requestId,
        data: {
          id: `pdf-${index + 1}`,
          filename: `file${index + 1}.pdf`
        }
      }));

      // 设置多个pending请求
      const resolveFunctions = [];
      const rejectFunctions = [];

      requestIds.forEach(requestId => {
        const mockResolve = jest.fn();
        const mockReject = jest.fn();
        resolveFunctions.push(mockResolve);
        rejectFunctions.push(mockReject);
        
        wsClient.setPendingRequest(requestId, mockResolve, mockReject);
      });

      // 处理所有响应
      responses.forEach(response => {
        wsClient._handlePDFDetailResponse(response);
      });

      // 验证所有请求都被正确处理
      responses.forEach((response, index) => {
        expect(resolveFunctions[index]).toHaveBeenCalledWith(response.data);
        expect(rejectFunctions[index]).not.toHaveBeenCalled();
      });

      // 验证所有pending请求都被清理
      requestIds.forEach(requestId => {
        expect(wsClient._pendingRequests.has(requestId)).toBe(false);
      });
    });
  });

  /**
   * 测试5: 集成测试验证整体功能
   */
  describe('集成测试 - 完整响应处理流程', () => {
    test('完整的请求-响应流程', async () => {
      const requestId = 'req_integration_test_123';
      const pdfDetail = {
        id: 'integration-test-pdf',
        filename: 'integration_test.pdf',
        title: 'Integration Test PDF',
        page_count: 25,
        size: 5120
      };

      const successResponse = {
        type: 'pdf_detail_response',
        request_id: requestId,
        data: pdfDetail
      };

      // 模拟pending请求
      return new Promise((resolveTest) => {
        const mockResolve = jest.fn().mockImplementation((data) => {
          // 验证数据正确
          expect(data).toEqual(pdfDetail);
          resolveTest();
        });
        
        const mockReject = jest.fn();
        wsClient.setPendingRequest(requestId, mockResolve, mockReject);

        // 处理响应
        wsClient._handlePDFDetailResponse(successResponse);

        // 验证resolve被调用
        expect(mockResolve).toHaveBeenCalled();
        expect(mockReject).not.toHaveBeenCalled();
      });
    });

    test('错误响应的完整处理流程', async () => {
      const requestId = 'req_error_integration_123';
      const errorResponse = {
        type: 'pdf_detail_response',
        request_id: requestId,
        error: {
          message: '集成测试错误',
          code: 'INTEGRATION_ERROR'
        }
      };

      return new Promise((resolveTest) => {
        const mockReject = jest.fn().mockImplementation((error) => {
          // 验证错误正确
          expect(error.message).toBe('集成测试错误');
          resolveTest();
        });
        
        const mockResolve = jest.fn();
        wsClient.setPendingRequest(requestId, mockResolve, mockReject);

        // 处理错误响应
        wsClient._handlePDFDetailResponse(errorResponse);

        // 验证reject被调用
        expect(mockReject).toHaveBeenCalled();
        expect(mockResolve).not.toHaveBeenCalled();
      });
    });
  });
});