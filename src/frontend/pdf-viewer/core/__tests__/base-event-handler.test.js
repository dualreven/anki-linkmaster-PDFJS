/**
 * @file BaseEventHandler 单元测试
 * @description 测试事件处理器基类的核心功能
 */

import { BaseEventHandler } from '../base-event-handler.js';
import { EventBus } from '../../../common/event/event-bus.js';

// 创建测试用的具体子类
class TestEventHandler extends BaseEventHandler {
  constructor(context, eventBus, name) {
    super(context, eventBus, name);
    this.setupCalled = false;
    this.testHandlerCalled = false;
  }

  setup() {
    this.setupCalled = true;
    this._on('test:event', this.handleTestEvent);
  }

  handleTestEvent = (data) => {
    this.testHandlerCalled = true;
    return data;
  }
}

// 创建没有实现setup的错误子类
class BrokenEventHandler extends BaseEventHandler {
  // 故意不实现 setup()
}

describe('BaseEventHandler', () => {
  let eventBus;
  let context;
  let handler;

  beforeEach(() => {
    // 创建EventBus实例（禁用验证以支持测试）
    eventBus = new EventBus({ enableValidation: false });
    context = { name: 'test-context' };
  });

  afterEach(() => {
    if (handler) {
      handler.destroy();
    }
    eventBus.destroy();
  });

  describe('构造函数', () => {
    test('应该禁止直接实例化抽象类', () => {
      expect(() => {
        new BaseEventHandler(context, eventBus, 'TestHandler');
      }).toThrow('BaseEventHandler is abstract and cannot be instantiated directly');
    });

    test('应该允许子类实例化', () => {
      handler = new TestEventHandler(context, eventBus, 'TestHandler');

      expect(handler).toBeInstanceOf(BaseEventHandler);
      expect(handler).toBeInstanceOf(TestEventHandler);
      expect(handler.context).toBe(context);
    });

    test('缺少eventBus时应该抛出错误', () => {
      expect(() => {
        new TestEventHandler(context, null, 'TestHandler');
      }).toThrow('EventBus is required');
    });

    test('应该使用类名作为默认名称', () => {
      handler = new TestEventHandler(context, eventBus);

      // Logger应该使用类名
      expect(handler.constructor.name).toBe('TestEventHandler');
    });

    test('应该接受自定义名称', () => {
      handler = new TestEventHandler(context, eventBus, 'CustomName');

      expect(handler).toBeDefined();
    });
  });

  describe('setup() 抽象方法', () => {
    test('未实现setup()应该抛出错误', () => {
      handler = new BrokenEventHandler(context, eventBus);

      expect(() => {
        handler.setup();
      }).toThrow('BrokenEventHandler must implement setup() method');
    });

    test('实现了setup()应该正常调用', () => {
      handler = new TestEventHandler(context, eventBus);

      handler.setup();

      expect(handler.setupCalled).toBe(true);
    });
  });

  describe('_on() 事件监听', () => {
    test('应该注册事件监听器', () => {
      handler = new TestEventHandler(context, eventBus);

      const callback = jest.fn();
      handler._on('test:event', callback);

      expect(handler.getListenerCount()).toBe(1);
      expect(handler.getRegisteredEvents()).toContain('test:event');
    });

    test('应该正确触发回调', () => {
      handler = new TestEventHandler(context, eventBus);

      const callback = jest.fn();
      handler._on('test:event', callback);

      eventBus.emit('test:event', { data: 'test' });

      expect(callback).toHaveBeenCalledWith({ data: 'test' });
    });

    test('应该捕获同步错误', () => {
      handler = new TestEventHandler(context, eventBus);

      const errorCallback = jest.fn(() => {
        throw new Error('Sync error');
      });

      handler._on('error:event', errorCallback);

      // 应该不会抛出错误
      expect(() => {
        eventBus.emit('error:event', {});
      }).not.toThrow();

      expect(errorCallback).toHaveBeenCalled();
    });

    test('应该捕获异步错误', async () => {
      handler = new TestEventHandler(context, eventBus);

      const asyncErrorCallback = jest.fn(async () => {
        throw new Error('Async error');
      });

      handler._on('async:error', asyncErrorCallback);

      // 发射事件
      eventBus.emit('async:error', {});

      // 等待异步处理
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(asyncErrorCallback).toHaveBeenCalled();
    });

    test('应该返回取消订阅函数', () => {
      handler = new TestEventHandler(context, eventBus);

      const callback = jest.fn();
      const unsubscribe = handler._on('test:event', callback);

      expect(typeof unsubscribe).toBe('function');
      expect(handler.getListenerCount()).toBe(1);

      unsubscribe();

      // 取消订阅后监听器计数不变（因为_on内部追踪）
      // 但事件总线中已取消订阅
      eventBus.emit('test:event', {});
      expect(callback).not.toHaveBeenCalled();
    });

    test('应该支持subscriberId选项', () => {
      handler = new TestEventHandler(context, eventBus);

      const callback = jest.fn();
      handler._on('test:event', callback, {
        subscriberId: 'custom-subscriber-id'
      });

      eventBus.emit('test:event', {});

      expect(callback).toHaveBeenCalledTimes(1);
      expect(handler.getListenerCount()).toBe(1);
    });

    test('callback不是函数时应该抛出错误', () => {
      handler = new TestEventHandler(context, eventBus);

      expect(() => {
        handler._on('test:event', 'not-a-function');
      }).toThrow('Callback must be a function');
    });

    test('应该保持this上下文', () => {
      handler = new TestEventHandler(context, eventBus);

      let receivedThis;
      const callback = function(data) {
        receivedThis = this;
      };

      handler._on('test:event', callback);
      eventBus.emit('test:event', {});

      // 回调中的this应该是handler实例
      expect(receivedThis).toBe(handler);
    });
  });

  describe('_emit() 事件发射', () => {
    test('应该发射事件并传递数据', () => {
      handler = new TestEventHandler(context, eventBus);

      const listener = jest.fn();
      eventBus.on('test:event', listener);

      handler._emit('test:event', { data: 'test' });

      expect(listener).toHaveBeenCalledWith({ data: 'test' });
    });

    test('应该支持空数据发射', () => {
      handler = new TestEventHandler(context, eventBus);

      const listener = jest.fn();
      eventBus.on('test:event', listener);

      handler._emit('test:event', {});

      expect(listener).toHaveBeenCalledWith({});
    });

    test('应该支持自定义metadata（用于内部日志）', () => {
      handler = new TestEventHandler(context, eventBus);

      const listener = jest.fn();
      eventBus.on('test:event', listener);

      // metadata 用于内部日志，不传递给监听器
      handler._emit('test:event', { value: 123 }, {
        customField: 'value',
        actorId: 'CustomActor'
      });

      // 监听器只接收数据，不接收metadata
      expect(listener).toHaveBeenCalledWith({ value: 123 });
    });
  });

  describe('destroy() 清理', () => {
    test('应该清理所有监听器', () => {
      handler = new TestEventHandler(context, eventBus);

      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      handler._on('event1', callback1);
      handler._on('event2', callback2);
      handler._on('event3', callback3);

      expect(handler.getListenerCount()).toBe(3);

      handler.destroy();

      expect(handler.getListenerCount()).toBe(0);
      expect(handler.getRegisteredEvents()).toEqual([]);
    });

    test('销毁后发射事件不应该触发回调', () => {
      handler = new TestEventHandler(context, eventBus);

      const callback = jest.fn();
      handler._on('test:event', callback);

      handler.destroy();

      eventBus.emit('test:event', {});

      expect(callback).not.toHaveBeenCalled();
    });

    test('应该捕获取消订阅时的错误', () => {
      handler = new TestEventHandler(context, eventBus);

      // 手动添加一个会抛出错误的取消订阅函数
      handler['#listeners'] = [{
        event: 'test:event',
        unsubscribe: () => {
          throw new Error('Unsubscribe error');
        }
      }];

      // 应该不会抛出错误
      expect(() => {
        handler.destroy();
      }).not.toThrow();
    });
  });

  describe('getListenerCount()', () => {
    test('初始应该返回0', () => {
      handler = new TestEventHandler(context, eventBus);

      expect(handler.getListenerCount()).toBe(0);
    });

    test('注册监听器后应该增加', () => {
      handler = new TestEventHandler(context, eventBus);

      handler._on('event1', () => {});
      expect(handler.getListenerCount()).toBe(1);

      handler._on('event2', () => {});
      expect(handler.getListenerCount()).toBe(2);
    });

    test('销毁后应该返回0', () => {
      handler = new TestEventHandler(context, eventBus);

      handler._on('event1', () => {});
      handler._on('event2', () => {});

      handler.destroy();

      expect(handler.getListenerCount()).toBe(0);
    });
  });

  describe('getRegisteredEvents()', () => {
    test('初始应该返回空数组', () => {
      handler = new TestEventHandler(context, eventBus);

      expect(handler.getRegisteredEvents()).toEqual([]);
    });

    test('应该返回所有已注册的事件名', () => {
      handler = new TestEventHandler(context, eventBus);

      handler._on('event1', () => {});
      handler._on('event2', () => {});
      handler._on('event3', () => {});

      const events = handler.getRegisteredEvents();

      expect(events).toHaveLength(3);
      expect(events).toContain('event1');
      expect(events).toContain('event2');
      expect(events).toContain('event3');
    });

    test('销毁后应该返回空数组', () => {
      handler = new TestEventHandler(context, eventBus);

      handler._on('event1', () => {});
      handler._on('event2', () => {});

      handler.destroy();

      expect(handler.getRegisteredEvents()).toEqual([]);
    });
  });

  describe('实际使用场景', () => {
    test('模拟完整的事件处理流程', () => {
      handler = new TestEventHandler(context, eventBus, 'PDFEventHandler');

      // 1. 设置监听器
      handler.setup();
      expect(handler.setupCalled).toBe(true);

      // 2. 触发事件
      eventBus.emit('test:event', { data: 'test' });
      expect(handler.testHandlerCalled).toBe(true);

      // 3. 清理
      handler.destroy();
      expect(handler.getListenerCount()).toBe(0);
    });

    test('多个handler实例应该独立', () => {
      const handler1 = new TestEventHandler(context, eventBus, 'Handler1');
      const handler2 = new TestEventHandler(context, eventBus, 'Handler2');

      handler1._on('event1', () => {});
      handler1._on('event2', () => {});

      handler2._on('event3', () => {});

      expect(handler1.getListenerCount()).toBe(2);
      expect(handler2.getListenerCount()).toBe(1);

      handler1.destroy();

      expect(handler1.getListenerCount()).toBe(0);
      expect(handler2.getListenerCount()).toBe(1);

      handler2.destroy();
    });

    test('错误处理不应该影响其他监听器', () => {
      handler = new TestEventHandler(context, eventBus);

      const errorCallback = jest.fn(() => {
        throw new Error('Error in handler');
      });
      const normalCallback = jest.fn();

      // 同一事件注册两个监听器
      handler._on('test:event', errorCallback);
      eventBus.on('test:event', normalCallback);  // 直接在eventBus上注册

      eventBus.emit('test:event', {});

      // 两个回调都应该被调用
      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });
  });
});
