/**
 * @file 错误处理器测试
 * @module ErrorHandlerTest
 * @description 测试错误处理器的功能，包括错误日志记录和用户友好错误信息显示
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ErrorHandler, AppError, ErrorType } from '../../../../src/frontend/common/error/error-handler.js';
import Logger from '../../../../src/frontend/common/utils/logger.js';
import { SYSTEM_EVENTS, UI_EVENTS } from '../../../../src/frontend/common/event/event-constants.js';

// 模拟事件总线
const mockEventBus = {
  emit: jest.fn()
};

// 模拟Logger
jest.mock('../../../../src/frontend/common/utils/logger.js');
const mockLogger = new Logger('TestLogger');

describe('ErrorHandler', () => {
  let errorHandler;

  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
    
    // 创建新的错误处理器实例
    errorHandler = new ErrorHandler(mockEventBus);
    errorHandler.logger = mockLogger;
  });

  describe('错误日志记录', () => {
    it('应该正确记录错误日志，包含错误信息和上下文', () => {
      // 准备测试数据
      const error = new Error('测试错误');
      const context = '测试上下文';
      
      // 执行测试
      errorHandler.handleError(error, context);
      
      // 验证结果
      expect(mockLogger.error).toHaveBeenCalledWith(
        `错误发生在 [${context}]: ${error.message}`,
        error
      );
    });

    it('应该记录完整的错误信息，包括堆栈跟踪', () => {
      // 准备测试数据
      const error = new Error('测试错误');
      error.stack = '错误堆栈跟踪信息';
      
      // 执行测试
      errorHandler.handleError(error, '测试上下文');
      
      // 验证结果
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('错误发生在 [测试上下文]: 测试错误'),
        error
      );
    });

    it('应该记录错误类型和代码', () => {
      // 准备测试数据
      const error = new AppError('业务错误', ErrorType.BUSINESS, 'BUSINESS_ERROR_001');
      
      // 执行测试
      errorHandler.handleError(error, '测试上下文');
      
      // 验证结果
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('错误发生在 [测试上下文]: 业务错误'),
        error
      );
    });

    it('应该记录时间戳', () => {
      // 准备测试数据
      const error = new Error('测试错误');
      const beforeTest = new Date().toISOString();
      
      // 执行测试
      errorHandler.handleError(error, '测试上下文');
      
      // 验证结果
      expect(mockLogger.error).toHaveBeenCalled();
      
      // 检查事件总线是否收到包含时间戳的错误信息
      const errorInfo = mockEventBus.emit.mock.calls[0][1];
      expect(errorInfo.timestamp).toBeDefined();
      expect(new Date(errorInfo.timestamp).getTime()).toBeGreaterThanOrEqual(new Date(beforeTest).getTime());
    });
  });

  describe('错误事件发送', () => {
    it('应该发送错误事件到事件总线', () => {
      // 准备测试数据
      const error = new Error('测试错误');
      const context = '测试上下文';
      
      // 执行测试
      errorHandler.handleError(error, context);
      
      // 验证结果
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        SYSTEM_EVENTS.ERROR.OCCURRED,
        expect.objectContaining({
          message: error.message,
          stack: error.stack,
          type: ErrorType.SYSTEM,
          code: null,
          context,
          timestamp: expect.any(String)
        })
      );
    });

    it('应该发送用户友好的错误信息到事件总线', () => {
      // 准备测试数据
      const error = new AppError('业务错误', ErrorType.BUSINESS, 'BUSINESS_ERROR_001');
      
      // 执行测试
      errorHandler.handleError(error, '测试上下文');
      
      // 验证结果
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        UI_EVENTS.ERROR.SHOW,
        expect.objectContaining({
          message: '业务错误',
          type: ErrorType.BUSINESS
        })
      );
    });
  });

  describe('用户友好错误信息', () => {
    it('应该为业务错误显示原始错误消息', () => {
      // 准备测试数据
      const error = new AppError('业务逻辑错误', ErrorType.BUSINESS);
      
      // 执行测试
      errorHandler.handleError(error, '测试上下文');
      
      // 验证结果
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        UI_EVENTS.ERROR.SHOW,
        expect.objectContaining({
          message: '业务逻辑错误',
          type: ErrorType.BUSINESS
        })
      );
    });

    it('应该为网络错误显示网络相关消息', () => {
      // 准备测试数据
      const error = new AppError('连接失败', ErrorType.NETWORK);
      
      // 执行测试
      errorHandler.handleError(error, '测试上下文');
      
      // 验证结果
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        UI_EVENTS.ERROR.SHOW,
        expect.objectContaining({
          message: '网络连接失败，请检查网络设置',
          type: ErrorType.NETWORK
        })
      );
    });

    it('应该为系统错误显示系统相关消息', () => {
      // 准备测试数据
      const error = new AppError('系统崩溃', ErrorType.SYSTEM);
      
      // 执行测试
      errorHandler.handleError(error, '测试上下文');
      
      // 验证结果
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        UI_EVENTS.ERROR.SHOW,
        expect.objectContaining({
          message: '系统错误，请联系管理员',
          type: ErrorType.SYSTEM
        })
      );
    });

    it('应该为未知错误类型显示默认消息', () => {
      // 准备测试数据
      const error = new Error('未知错误');
      
      // 执行测试
      errorHandler.handleError(error, '测试上下文');
      
      // 验证结果
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        UI_EVENTS.ERROR.SHOW,
        expect.objectContaining({
          message: '系统错误，请联系管理员',
          type: ErrorType.SYSTEM
        })
      );
    });
  });

  describe('错误创建方法', () => {
    it('应该正确创建业务错误', () => {
      // 执行测试
      const error = errorHandler.createBusinessError('业务错误', 'BUSINESS_001');
      
      // 验证结果
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('业务错误');
      expect(error.type).toBe(ErrorType.BUSINESS);
      expect(error.code).toBe('BUSINESS_001');
    });

    it('应该正确创建网络错误', () => {
      // 执行测试
      const error = errorHandler.createNetworkError('网络错误', 'NETWORK_001');
      
      // 验证结果
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('网络错误');
      expect(error.type).toBe(ErrorType.NETWORK);
      expect(error.code).toBe('NETWORK_001');
    });

    it('应该正确创建系统错误', () => {
      // 执行测试
      const error = errorHandler.createSystemError('系统错误', 'SYSTEM_001');
      
      // 验证结果
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('系统错误');
      expect(error.type).toBe(ErrorType.SYSTEM);
      expect(error.code).toBe('SYSTEM_001');
    });
  });
});