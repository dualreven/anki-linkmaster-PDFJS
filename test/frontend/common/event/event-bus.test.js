/**
 * EventBus 集成测试文件
 * @file 测试 EventBus 模块的事件发布/订阅功能和模块间通信机制
 * @module EventBusIntegrationTest
 */

import { EventBus } from '../../../../src/frontend/common/event/event-bus.js';
import { PDF_MANAGEMENT_EVENTS, UI_EVENTS } from '../../../../src/frontend/common/event/event-constants.js';

/**
 * 测试 EventBus 事件发布功能
 */
describe('EventBus 事件发布功能测试', () => {
  let eventBus;

  beforeEach(() => {
    // 创建新的 EventBus 实例用于测试
    eventBus = new EventBus({ enableValidation: true, logLevel: 'error' });
  });

  afterEach(() => {
    eventBus.destroy();
  });

  /**
   * 测试有效事件发布
   */
  test('发布有效事件 - 应成功执行回调', () => {
    const mockCallback = jest.fn();
    const testData = { message: '测试数据' };

    // 订阅事件
    eventBus.on(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, mockCallback);

    // 发布事件
    eventBus.emit(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, testData);

    // 验证回调被调用
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith(testData);
  });

  /**
   * 测试多个订阅者
   */
  test('发布事件到多个订阅者 - 所有订阅者都应收到事件', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    const callback3 = jest.fn();
    const testData = { count: 3 };

    // 订阅多个回调
    eventBus.on(PDF_MANAGEMENT_EVENTS.ADD.COMPLETED, callback1);
    eventBus.on(PDF_MANAGEMENT_EVENTS.ADD.COMPLETED, callback2);
    eventBus.on(PDF_MANAGEMENT_EVENTS.ADD.COMPLETED, callback3);

    // 发布事件
    eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.COMPLETED, testData);

    // 验证所有回调都被调用
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(1);
    expect(callback1).toHaveBeenCalledWith(testData);
    expect(callback2).toHaveBeenCalledWith(testData);
    expect(callback3).toHaveBeenCalledWith(testData);
  });

  /**
   * 测试无效事件发布
   */
  test('发布无效事件 - 应被阻止并记录错误', () => {
    const mockCallback = jest.fn();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // 订阅有效事件
    eventBus.on(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, mockCallback);

    // 发布无效事件
    eventBus.emit('invalid:event:format', { data: 'test' });

    // 验证回调没有被调用
    expect(mockCallback).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  /**
   * 测试发布空数据
   */
  test('发布事件带空数据 - 应正常处理', () => {
    const mockCallback = jest.fn();

    eventBus.on(UI_EVENTS.SELECTION.CHANGED, mockCallback);
    eventBus.emit(UI_EVENTS.SELECTION.CHANGED, null);

    expect(mockCallback).toHaveBeenCalledWith(null);
  });

  /**
   * 测试发布复杂对象数据
   */
  test('发布复杂对象数据 - 应正确传递', () => {
    const mockCallback = jest.fn();
    const complexData = {
      pdfList: [
        { id: 1, name: 'test1.pdf', size: 1024 },
        { id: 2, name: 'test2.pdf', size: 2048 }
      ],
      metadata: {
        timestamp: new Date(),
        totalCount: 2
      }
    };

    eventBus.on(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, mockCallback);
    eventBus.emit(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, complexData);

    expect(mockCallback).toHaveBeenCalledWith(complexData);
  });
});

/**
 * 测试 EventBus 事件订阅功能
 */
describe('EventBus 事件订阅功能测试', () => {
  let eventBus;

  beforeEach(() => {
    eventBus = new EventBus({ enableValidation: true, logLevel: 'error' });
  });

  afterEach(() => {
    eventBus.destroy();
  });

  /**
   * 测试基本订阅功能
   */
  test('订阅有效事件 - 应返回取消订阅函数', () => {
    const mockCallback = jest.fn();
    
    const unsubscribe = eventBus.on(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, mockCallback);
    
    expect(typeof unsubscribe).toBe('function');
    
    // 测试取消订阅功能
    unsubscribe();
    eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, {});
    
    expect(mockCallback).not.toHaveBeenCalled();
  });

  /**
   * 测试订阅无效事件
   */
  test('订阅无效事件 - 应抛出错误', () => {
    const mockCallback = jest.fn();
    
    expect(() => {
      eventBus.on('invalid-format', mockCallback);
    }).toThrow('无效的事件名称');
  });

  /**
   * 测试多次订阅同一事件
   */
  test('多次订阅同一事件 - 应支持多个订阅者', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    const callback3 = jest.fn();
    
    eventBus.on(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, callback1);
    eventBus.on(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, callback2);
    eventBus.on(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, callback3);
    
    eventBus.emit(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, { id: 1 });
    
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(1);
  });

  /**
   * 测试一次性订阅
   */
  test('一次性订阅 - 应自动取消订阅', () => {
    const mockCallback = jest.fn();
    
    eventBus.once(PDF_MANAGEMENT_EVENTS.OPEN.COMPLETED, mockCallback);
    
    // 第一次发布应触发回调
    eventBus.emit(PDF_MANAGEMENT_EVENTS.OPEN.COMPLETED, { id: 1 });
    expect(mockCallback).toHaveBeenCalledTimes(1);
    
    // 第二次发布不应触发回调
    eventBus.emit(PDF_MANAGEMENT_EVENTS.OPEN.COMPLETED, { id: 2 });
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  /**
   * 测试取消订阅功能
   */
  test('取消订阅 - 应正确移除订阅者', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    
    const unsubscribe1 = eventBus.on(UI_EVENTS.ERROR.SHOW, callback1);
    eventBus.on(UI_EVENTS.ERROR.SHOW, callback2);
    
    // 取消第一个订阅
    unsubscribe1();
    
    eventBus.emit(UI_EVENTS.ERROR.SHOW, { message: '错误消息' });
    
    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledTimes(1);
  });
});

/**
 * 测试 EventBus 模块间通信机制
 */
describe('EventBus 模块间通信测试', () => {
  let eventBus;

  beforeEach(() => {
    eventBus = new EventBus({ enableValidation: true, logLevel: 'error' });
  });

  afterEach(() => {
    eventBus.destroy();
  });

  /**
   * 测试跨模块事件通信
   */
  test('PDF管理模块到UI模块通信 - 应成功传递事件', () => {
    const pdfCallback = jest.fn();
    const uiCallback = jest.fn();
    
    // 模拟PDF管理模块订阅
    eventBus.on(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, pdfCallback);
    
    // 模拟UI模块订阅
    eventBus.on(UI_EVENTS.SELECTION.CHANGED, uiCallback);
    
    // PDF模块发布事件
    eventBus.emit(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, {
      pdfList: [{ id: 1, name: 'test.pdf' }]
    });
    
    // UI模块发布事件
    eventBus.emit(UI_EVENTS.SELECTION.CHANGED, {
      selectedIds: [1]
    });
    
    expect(pdfCallback).toHaveBeenCalledTimes(1);
    expect(uiCallback).toHaveBeenCalledTimes(1);
  });

  /**
   * 测试事件响应链
   */
  test('事件响应链 - 应正确处理连续事件', () => {
    const requestCallback = jest.fn();
    const completedCallback = jest.fn();
    
    eventBus.on(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, requestCallback);
    eventBus.on(PDF_MANAGEMENT_EVENTS.ADD.COMPLETED, completedCallback);
    
    // 模拟添加PDF的完整流程
    eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, {
      filePath: '/path/to/file.pdf'
    });
    
    // 模拟处理完成后发布完成事件
    eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.COMPLETED, {
      id: 123,
      name: 'file.pdf'
    });
    
    expect(requestCallback).toHaveBeenCalledTimes(1);
    expect(completedCallback).toHaveBeenCalledTimes(1);
  });

  /**
   * 测试无订阅者事件
   */
  test('发布无订阅者事件 - 应正常处理', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // 发布没有订阅者的事件
    eventBus.emit(PDF_MANAGEMENT_EVENTS.BATCH.REQUESTED, {
      ids: [1, 2, 3]
    });
    
    // 不应有错误发生
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    
    consoleErrorSpy.mockRestore();
  });
});

/**
 * 测试 EventBus 状态管理功能
 */
describe('EventBus 状态管理功能测试', () => {
  let eventBus;

  beforeEach(() => {
    eventBus = new EventBus({ enableValidation: true, logLevel: 'error' });
  });

  afterEach(() => {
    eventBus.destroy();
  });

  /**
   * 测试事件订阅状态管理
   */
  test('订阅状态管理 - 应正确跟踪订阅者', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    
    const unsubscribe1 = eventBus.on(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, callback1);
    eventBus.on(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, callback2);
    
    // 发布事件验证两个订阅者
    eventBus.emit(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, { id: 1 });
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
    
    // 取消一个订阅
    unsubscribe1();
    
    // 再次发布事件
    eventBus.emit(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, { id: 2 });
    expect(callback1).toHaveBeenCalledTimes(1); // 不应再被调用
    expect(callback2).toHaveBeenCalledTimes(2); // 应被再次调用
  });

  /**
   * 测试销毁功能
   */
  test('销毁事件总线 - 应清除所有订阅', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    
    eventBus.on(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, callback1);
    eventBus.on(UI_EVENTS.SELECTION.CHANGED, callback2);
    
    // 销毁事件总线
    eventBus.destroy();
    
    // 发布事件不应触发回调
    eventBus.emit(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, {});
    eventBus.emit(UI_EVENTS.SELECTION.CHANGED, {});
    
    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).not.toHaveBeenCalled();
  });

  /**
   * 测试重新初始化
   */
  test('销毁后重新使用 - 应正常工作', () => {
    const callback = jest.fn();
    
    eventBus.on(PDF_MANAGEMENT_EVENTS.ADD.COMPLETED, callback);
    eventBus.destroy();
    
    // 重新订阅
    eventBus.on(PDF_MANAGEMENT_EVENTS.ADD.COMPLETED, callback);
    eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.COMPLETED, { id: 1 });
    
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

/**
 * 测试 EventBus 错误处理和调试功能
 */
describe('EventBus 错误处理和调试功能测试', () => {
  let eventBus;

  beforeEach(() => {
    eventBus = new EventBus({ enableValidation: true, logLevel: 'error' });
  });

  afterEach(() => {
    eventBus.destroy();
  });

  /**
   * 测试回调函数错误处理
   */
  test('回调函数抛出错误 - 应捕获并记录错误', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const errorCallback = () => {
      throw new Error('测试错误');
    };
    
    eventBus.on(PDF_MANAGEMENT_EVENTS.OPEN.FAILED, errorCallback);
    
    // 发布事件，应捕获回调中的错误
    eventBus.emit(PDF_MANAGEMENT_EVENTS.OPEN.FAILED, {
      error: '文件不存在'
    });
    
    // 验证错误被记录
    expect(consoleErrorSpy).toHaveBeenCalled();
    
    consoleErrorSpy.mockRestore();
  });

  /**
   * 测试禁用验证模式
   */
  test('禁用验证模式 - 应允许无效事件', () => {
    const eventBusNoValidation = new EventBus({ enableValidation: false });
    const mockCallback = jest.fn();
    
    // 应允许订阅无效事件
    eventBusNoValidation.on('invalid:event', mockCallback);
    eventBusNoValidation.emit('invalid:event', { data: 'test' });
    
    expect(mockCallback).toHaveBeenCalledTimes(1);
    
    eventBusNoValidation.destroy();
  });

  /**
   * 测试事件名称验证
   */
  test('事件名称验证 - 应正确验证格式', () => {
    // 测试有效事件名称
    expect(() => {
      eventBus.on('module:action:status', jest.fn());
    }).not.toThrow();
    
    // 测试无效事件名称
    expect(() => {
      eventBus.on('invalid-format', jest.fn());
    }).toThrow('无效的事件名称');
    
    expect(() => {
      eventBus.on('module:action', jest.fn()); // 缺少第三部分
    }).toThrow('无效的事件名称');
  });
});

/**
 * 测试 EventBus 与现有架构的兼容性
 */
describe('EventBus 与现有架构兼容性测试', () => {
  let eventBus;

  beforeEach(() => {
    eventBus = new EventBus({ enableValidation: true, logLevel: 'error' });
  });

  afterEach(() => {
    eventBus.destroy();
  });

  /**
   * 测试与事件常量兼容性
   */
  test('使用预定义事件常量 - 应正常工作', () => {
    const callbacks = {};
    const testData = { test: 'data' };
    
    // 测试所有预定义事件类型
    Object.values(PDF_MANAGEMENT_EVENTS).forEach(category => {
      Object.values(category).forEach(eventName => {
        if (typeof eventName === 'string') {
          callbacks[eventName] = jest.fn();
          eventBus.on(eventName, callbacks[eventName]);
          eventBus.emit(eventName, testData);
        }
      });
    });
    
    // 验证所有回调都被调用
    Object.values(callbacks).forEach(callback => {
      expect(callback).toHaveBeenCalledWith(testData);
    });
  });

  /**
   * 测试默认导出实例
   */
  test('默认导出实例 - 应正常工作', async () => {
    // 导入默认实例
    const defaultEventBus = await import('../../../../src/frontend/common/event/event-bus.js');
    
    const mockCallback = jest.fn();
    defaultEventBus.default.on(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, mockCallback);
    defaultEventBus.default.emit(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, {});
    
    expect(mockCallback).toHaveBeenCalledTimes(1);
    
    // 清理
    defaultEventBus.default.off(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, mockCallback);
  });

  /**
   * 测试类导出兼容性
   */
  test('类导出 - 应支持创建多个实例', () => {
    const instance1 = new EventBus();
    const instance2 = new EventBus();
    
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    
    instance1.on(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, callback1);
    instance2.on(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, callback2);
    
    instance1.emit(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, {});
    instance2.emit(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, {});
    
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
    
    instance1.destroy();
    instance2.destroy();
  });
});