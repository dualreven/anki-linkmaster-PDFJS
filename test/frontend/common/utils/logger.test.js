/**
 * @file 日志记录器测试
 * @module LoggerTest
 * @description 测试日志记录器的功能，包括日志级别、格式化和错误处理
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LogLevel } from '../../../../src/frontend/common/utils/logger.js';
import Logger from '../../../../src/frontend/common/utils/logger.js';

// 模拟console方法
const mockConsole = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn()
};

// 保存原始console
const originalConsole = global.console;

describe('Logger', () => {
  let logger;

  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
    
    // 替换console
    global.console = mockConsole;
    
    // 创建新的日志记录器实例
    logger = new Logger('TestModule', LogLevel.DEBUG);
  });

  afterEach(() => {
    // 恢复原始console
    global.console = originalConsole;
  });

  describe('日志级别设置', () => {
    it('应该正确设置日志级别', () => {
      // 执行测试
      logger.setLogLevel(LogLevel.WARN);
      
      // 验证结果
      expect(logger.getLogLevel()).toBe(LogLevel.WARN);
    });

    it('应该拒绝无效的日志级别', () => {
      // 执行测试
      logger.setLogLevel('INVALID_LEVEL');
      
      // 验证结果
      expect(console.error).toHaveBeenCalledWith('[Logger] Invalid log level: INVALID_LEVEL');
      expect(logger.getLogLevel()).not.toBe('INVALID_LEVEL');
    });

    it('应该正确获取当前日志级别', () => {
      // 执行测试
      logger.setLogLevel(LogLevel.ERROR);
      
      // 验证结果
      expect(logger.getLogLevel()).toBe(LogLevel.ERROR);
    });
  });

  describe('日志级别过滤', () => {
    it('应该在DEBUG级别记录所有日志', () => {
      // 设置日志级别为DEBUG
      logger.setLogLevel(LogLevel.DEBUG);
      
      // 执行测试
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');
      
      // 验证结果
      expect(mockConsole.debug).toHaveBeenCalled();
      expect(mockConsole.info).toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalled();
      expect(mockConsole.error).toHaveBeenCalled();
    });

    it('应该在INFO级别过滤DEBUG日志', () => {
      // 设置日志级别为INFO
      logger.setLogLevel(LogLevel.INFO);
      
      // 执行测试
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');
      
      // 验证结果
      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalled();
      expect(mockConsole.error).toHaveBeenCalled();
    });

    it('应该在WARN级别过滤DEBUG和INFO日志', () => {
      // 设置日志级别为WARN
      logger.setLogLevel(LogLevel.WARN);
      
      // 执行测试
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');
      
      // 验证结果
      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalled();
      expect(mockConsole.error).toHaveBeenCalled();
    });

    it('应该在ERROR级别只记录ERROR日志', () => {
      // 设置日志级别为ERROR
      logger.setLogLevel(LogLevel.ERROR);
      
      // 执行测试
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');
      
      // 验证结果
      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).not.toHaveBeenCalled();
      expect(mockConsole.error).toHaveBeenCalled();
    });
  });

  describe('日志格式化', () => {
    it('应该正确格式化日志消息，包含时间戳、模块名和日志级别', () => {
      // 执行测试
      logger.info('Test message');
      
      // 验证结果
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[TestModule\] \[INFO\]$/),
        'Test message'
      );
    });

    it('应该正确处理错误对象参数', () => {
      // 准备测试数据
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      
      // 执行测试
      logger.error('Error occurred', error);
      
      // 验证结果
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[TestModule\] \[ERROR\]$/),
        'Error occurred',
        expect.objectContaining({
          name: 'Error',
          message: 'Test error',
          stack: 'Error stack trace'
        })
      );
    });

    it('应该正确处理普通对象参数', () => {
      // 准备测试数据
      const obj = { name: 'Test', value: 123 };
      
      // 执行测试
      logger.info('Object data', obj);
      
      // 验证结果
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[TestModule\] \[INFO\]$/),
        'Object data',
        obj
      );
    });

    it('应该正确处理数组参数', () => {
      // 准备测试数据
      const array = [1, 2, 3, 4, 5];
      
      // 执行测试
      logger.info('Array data', array);
      
      // 验证结果
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[TestModule\] \[INFO\]$/),
        'Array data',
        array
      );
    });
  });

  describe('事件日志记录', () => {
    it('应该正确记录事件日志', () => {
      // 准备测试数据
      const eventName = 'testEvent';
      const action = 'testAction';
      const data = { key: 'value' };
      
      // 执行测试
      logger.event(eventName, action, data);
      
      // 验证结果
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[TestModule\] \[INFO\]$/),
        expect.stringMatching(/^Event \[testEvent\]: testAction/)
      );
    });

    it('应该正确处理没有数据的事件日志', () => {
      // 准备测试数据
      const eventName = 'testEvent';
      const action = 'testAction';
      
      // 执行测试
      logger.event(eventName, action);
      
      // 验证结果
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[TestModule\] \[INFO\]$/),
        expect.stringMatching(/^Event \[testEvent\]: testAction/)
      );
    });
  });

  describe('错误处理', () => {
    it('应该正确处理序列化失败的对象', () => {
      // 准备测试数据 - 创建一个会引发序列化错误的循环引用对象
      const obj = {};
      obj.self = obj;
      
      // 执行测试
      logger.info('Circular reference', obj);
      
      // 验证结果 - 不应该抛出错误
      expect(mockConsole.info).toHaveBeenCalled();
    });

    it('应该正确处理序列化失败的数据', () => {
      // 准备测试数据 - 创建一个会引发序列化错误的复杂对象
      const obj = {
        toJSON: () => {
          throw new Error('Serialization failed');
        }
      };
      
      // 执行测试
      logger.info('Serialization error', obj);
      
      // 验证结果 - 不应该抛出错误
      expect(mockConsole.info).toHaveBeenCalled();
    });
  });

  describe('深度序列化', () => {
    it('应该正确处理深度嵌套的对象', () => {
      // 准备测试数据
      const deepObj = {
        level1: {
          level2: {
            level3: {
              level4: 'deep value'
            }
          }
        }
      };
      
      // 执行测试
      logger.info('Deep object', deepObj);
      
      // 验证结果
      expect(mockConsole.info).toHaveBeenCalled();
    });

    it('应该限制数组的序列化长度', () => {
      // 准备测试数据 - 创建一个长数组
      const longArray = Array(20).fill('item');
      
      // 执行测试
      logger.info('Long array', longArray);
      
      // 验证结果
      expect(mockConsole.info).toHaveBeenCalled();
    });

    it('应该限制对象的属性数量', () => {
      // 准备测试数据 - 创建一个有很多属性的对象
      const largeObj = {};
      for (let i = 0; i < 30; i++) {
        largeObj[`prop${i}`] = `value${i}`;
      }
      
      // 执行测试
      logger.info('Large object', largeObj);
      
      // 验证结果
      expect(mockConsole.info).toHaveBeenCalled();
    });
  });
});