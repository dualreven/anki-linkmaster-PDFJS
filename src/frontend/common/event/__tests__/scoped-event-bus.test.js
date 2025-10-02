/**
 * @file ScopedEventBus 单元测试
 * @description 测试作用域事件总线的命名空间隔离功能
 */

import { ScopedEventBus, createScopedEventBus } from '../scoped-event-bus.js';
import { EventBus } from '../event-bus.js';

describe('ScopedEventBus', () => {
  let globalEventBus;

  beforeEach(() => {
    // 禁用事件名称验证以支持@scope/格式
    globalEventBus = new EventBus({ enableValidation: false });
  });

  afterEach(() => {
    globalEventBus.destroy();
  });

  describe('构造函数', () => {
    test('应该正确创建实例', () => {
      const scopedBus = new ScopedEventBus(globalEventBus, 'test-module');

      expect(scopedBus).toBeInstanceOf(ScopedEventBus);
      expect(scopedBus.getScope()).toBe('test-module');
      expect(scopedBus.getListenerCount()).toBe(0);
    });

    test('缺少globalEventBus时应该抛出错误', () => {
      expect(() => {
        new ScopedEventBus(null, 'test-module');
      }).toThrow('globalEventBus is required');
    });

    test('缺少scope时应该抛出错误', () => {
      expect(() => {
        new ScopedEventBus(globalEventBus, '');
      }).toThrow('scope must be a non-empty string');
    });

    test('scope不是字符串时应该抛出错误', () => {
      expect(() => {
        new ScopedEventBus(globalEventBus, 123);
      }).toThrow('scope must be a non-empty string');
    });
  });

  describe('工厂函数', () => {
    test('createScopedEventBus应该创建实例', () => {
      const scopedBus = createScopedEventBus(globalEventBus, 'factory-test');

      expect(scopedBus).toBeInstanceOf(ScopedEventBus);
      expect(scopedBus.getScope()).toBe('factory-test');
    });
  });

  describe('模块内事件（自动添加命名空间）', () => {
    test('on/emit应该自动添加命名空间前缀', (done) => {
      const scopedBus = new ScopedEventBus(globalEventBus, 'module-a');
      const testData = { value: 'test' };

      scopedBus.on('test:event', (data) => {
        expect(data).toEqual(testData);
        done();
      });

      scopedBus.emit('test:event', testData);
    });

    test('不同作用域的事件应该隔离', () => {
      const moduleA = new ScopedEventBus(globalEventBus, 'module-a');
      const moduleB = new ScopedEventBus(globalEventBus, 'module-b');

      const handlerA = jest.fn();
      const handlerB = jest.fn();

      // 两个模块都监听同名事件
      moduleA.on('same:event', handlerA);
      moduleB.on('same:event', handlerB);

      // moduleA发射事件
      moduleA.emit('same:event', { source: 'A' });

      // 只有moduleA的处理器被调用
      expect(handlerA).toHaveBeenCalledWith(
        { source: 'A' },
        expect.objectContaining({ actorId: 'module-a' })
      );
      expect(handlerB).not.toHaveBeenCalled();
    });

    test('同一作用域内事件应该正常通信', () => {
      const scopedBus = new ScopedEventBus(globalEventBus, 'module-a');

      const handler1 = jest.fn();
      const handler2 = jest.fn();

      scopedBus.on('event:1', handler1);
      scopedBus.on('event:2', handler2);

      scopedBus.emit('event:1', { data: 1 });
      scopedBus.emit('event:2', { data: 2 });

      expect(handler1).toHaveBeenCalledWith({ data: 1 }, expect.any(Object));
      expect(handler2).toHaveBeenCalledWith({ data: 2 }, expect.any(Object));
    });

    test('off应该正确移除监听器', () => {
      const scopedBus = new ScopedEventBus(globalEventBus, 'module-a');
      const handler = jest.fn();

      scopedBus.on('test:event', handler);
      scopedBus.emit('test:event', { data: 1 });

      expect(handler).toHaveBeenCalledTimes(1);

      scopedBus.off('test:event', handler);
      scopedBus.emit('test:event', { data: 2 });

      // 移除后不再被调用
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('全局事件（不添加命名空间）', () => {
    test('onGlobal/emitGlobal应该使用原始事件名', (done) => {
      const scopedBus = new ScopedEventBus(globalEventBus, 'module-a');
      const testData = { value: 'global' };

      scopedBus.onGlobal('global:event', (data) => {
        expect(data).toEqual(testData);
        done();
      });

      scopedBus.emitGlobal('global:event', testData);
    });

    test('不同模块应该能监听同一个全局事件', () => {
      const moduleA = new ScopedEventBus(globalEventBus, 'module-a');
      const moduleB = new ScopedEventBus(globalEventBus, 'module-b');

      const handlerA = jest.fn();
      const handlerB = jest.fn();

      moduleA.onGlobal('global:event', handlerA);
      moduleB.onGlobal('global:event', handlerB);

      moduleA.emitGlobal('global:event', { source: 'A' });

      // 两个模块的处理器都应该被调用
      expect(handlerA).toHaveBeenCalledWith(
        { source: 'A' },
        expect.objectContaining({ actorId: 'module-a' })
      );
      expect(handlerB).toHaveBeenCalledWith(
        { source: 'A' },
        expect.objectContaining({ actorId: 'module-a' })
      );
    });

    test('模块可以同时使用模块内和全局事件', () => {
      const scopedBus = new ScopedEventBus(globalEventBus, 'module-a');

      const scopedHandler = jest.fn();
      const globalHandler = jest.fn();

      scopedBus.on('scoped:event', scopedHandler);
      scopedBus.onGlobal('global:event', globalHandler);

      scopedBus.emit('scoped:event', { type: 'scoped' });
      scopedBus.emitGlobal('global:event', { type: 'global' });

      expect(scopedHandler).toHaveBeenCalledWith({ type: 'scoped' }, expect.any(Object));
      expect(globalHandler).toHaveBeenCalledWith({ type: 'global' }, expect.any(Object));
    });

    test('offGlobal应该正确移除全局监听器', () => {
      const scopedBus = new ScopedEventBus(globalEventBus, 'module-a');
      const handler = jest.fn();

      scopedBus.onGlobal('global:event', handler);
      scopedBus.emitGlobal('global:event', { data: 1 });

      expect(handler).toHaveBeenCalledTimes(1);

      scopedBus.offGlobal('global:event', handler);
      scopedBus.emitGlobal('global:event', { data: 2 });

      // 移除后不再被调用
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('事件选项和元数据', () => {
    test('on应该传递事件选项', (done) => {
      const scopedBus = new ScopedEventBus(globalEventBus, 'module-a');

      scopedBus.on('test:event', () => {
        done();
      }, { once: true });

      scopedBus.emit('test:event', {});
      scopedBus.emit('test:event', {}); // 第二次不应该触发
    });

    test('emit应该包含actorId元数据', (done) => {
      const scopedBus = new ScopedEventBus(globalEventBus, 'module-a');

      scopedBus.on('test:event', (data, metadata) => {
        expect(metadata.actorId).toBe('module-a');
        done();
      });

      scopedBus.emit('test:event', {});
    });

    test('emit应该允许自定义元数据', (done) => {
      const scopedBus = new ScopedEventBus(globalEventBus, 'module-a');

      scopedBus.on('test:event', (data, metadata) => {
        expect(metadata.customField).toBe('custom-value');
        done();
      });

      scopedBus.emit('test:event', {}, { customField: 'custom-value' });
    });
  });

  describe('destroy方法', () => {
    test('destroy应该清理所有监听器', () => {
      const scopedBus = new ScopedEventBus(globalEventBus, 'module-a');

      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const globalHandler = jest.fn();

      scopedBus.on('event:1', handler1);
      scopedBus.on('event:2', handler2);
      scopedBus.onGlobal('global:event', globalHandler);

      expect(scopedBus.getListenerCount()).toBe(3);

      scopedBus.destroy();

      expect(scopedBus.getListenerCount()).toBe(0);

      // 销毁后发射事件，处理器不应该被调用
      scopedBus.emit('event:1', {});
      scopedBus.emit('event:2', {});
      scopedBus.emitGlobal('global:event', {});

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(globalHandler).not.toHaveBeenCalled();
    });
  });

  describe('监听器计数', () => {
    test('getListenerCount应该返回正确的监听器数量', () => {
      const scopedBus = new ScopedEventBus(globalEventBus, 'module-a');

      expect(scopedBus.getListenerCount()).toBe(0);

      scopedBus.on('event:1', () => {});
      expect(scopedBus.getListenerCount()).toBe(1);

      scopedBus.on('event:2', () => {});
      expect(scopedBus.getListenerCount()).toBe(2);

      scopedBus.onGlobal('global:event', () => {});
      expect(scopedBus.getListenerCount()).toBe(3);
    });
  });

  describe('实际使用场景', () => {
    test('模拟多模块协作场景', () => {
      const pdfModule = createScopedEventBus(globalEventBus, 'pdf-manager');
      const uiModule = createScopedEventBus(globalEventBus, 'ui-manager');
      const bookmarkModule = createScopedEventBus(globalEventBus, 'bookmark-manager');

      const pdfLoadedHandler = jest.fn();
      const uiUpdateHandler = jest.fn();
      const globalPageChangeHandler = jest.fn();

      // 各模块监听自己的内部事件
      pdfModule.on('file:loaded', pdfLoadedHandler);
      uiModule.on('update:required', uiUpdateHandler);

      // 各模块监听全局事件
      pdfModule.onGlobal('pdf:page:changed', globalPageChangeHandler);
      uiModule.onGlobal('pdf:page:changed', globalPageChangeHandler);
      bookmarkModule.onGlobal('pdf:page:changed', globalPageChangeHandler);

      // PDF模块发射内部事件
      pdfModule.emit('file:loaded', { filename: 'test.pdf' });
      expect(pdfLoadedHandler).toHaveBeenCalled();
      expect(uiUpdateHandler).not.toHaveBeenCalled(); // UI模块不应该收到

      // PDF模块发射全局事件
      pdfModule.emitGlobal('pdf:page:changed', { page: 5 });
      expect(globalPageChangeHandler).toHaveBeenCalledTimes(3); // 三个模块都应该收到
    });
  });
});
