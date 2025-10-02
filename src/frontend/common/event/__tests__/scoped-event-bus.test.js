/**
 * @file ScopedEventBus 单元测试
 * @description 测试作用域事件总线的核心功能
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ScopedEventBus, createScopedEventBus } from '../scoped-event-bus.js';

// Mock EventBus（模拟全局事件总线）
class MockEventBus {
  constructor() {
    this.events = new Map();
    this.emitCalls = [];
    this.onCalls = [];
  }

  emit(event, data, metadata) {
    this.emitCalls.push({ event, data, metadata });
    const listeners = this.events.get(event) || [];
    listeners.forEach(callback => callback(data, metadata));
    return true;
  }

  on(event, callback, options) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event).push(callback);
    this.onCalls.push({ event, callback, options });

    // 返回取消订阅函数
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const listeners = this.events.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  once(event, callback, options) {
    const wrappedCallback = (data, metadata) => {
      callback(data, metadata);
      this.off(event, wrappedCallback);
    };
    return this.on(event, wrappedCallback, options);
  }

  clear() {
    this.events.clear();
    this.emitCalls = [];
    this.onCalls = [];
  }
}

describe('ScopedEventBus', () => {
  let globalEventBus;
  let scopedEventBus;

  beforeEach(() => {
    globalEventBus = new MockEventBus();
    scopedEventBus = new ScopedEventBus('pdf-list', globalEventBus);
  });

  describe('构造函数和基本属性', () => {
    it('应该创建 ScopedEventBus 实例', () => {
      expect(scopedEventBus).toBeInstanceOf(ScopedEventBus);
      expect(scopedEventBus.getNamespace()).toBe('pdf-list');
    });

    it('应该通过工厂函数创建实例', () => {
      const bus = createScopedEventBus('pdf-editor', globalEventBus);
      expect(bus).toBeInstanceOf(ScopedEventBus);
      expect(bus.getNamespace()).toBe('pdf-editor');
    });

    it('应该抛出错误：缺少命名空间', () => {
      expect(() => {
        new ScopedEventBus('', globalEventBus);
      }).toThrow(/valid namespace/);
    });

    it('应该抛出错误：缺少全局 EventBus', () => {
      expect(() => {
        new ScopedEventBus('test', null);
      }).toThrow(/global EventBus/);
    });

    it('应该获取全局 EventBus 实例', () => {
      expect(scopedEventBus.getGlobalEventBus()).toBe(globalEventBus);
    });
  });

  describe('本地事件（带命名空间）', () => {
    it('应该 emit 时自动添加命名空间前缀', () => {
      scopedEventBus.emit('table:row:selected', { id: 123 });

      expect(globalEventBus.emitCalls).toHaveLength(1);
      expect(globalEventBus.emitCalls[0].event).toBe('@pdf-list/table:row:selected');
      expect(globalEventBus.emitCalls[0].data).toEqual({ id: 123 });
      expect(globalEventBus.emitCalls[0].metadata.namespace).toBe('pdf-list');
    });

    it('应该 on 时自动添加命名空间前缀', () => {
      const callback = jest.fn();
      scopedEventBus.on('table:row:selected', callback);

      expect(globalEventBus.onCalls).toHaveLength(1);
      expect(globalEventBus.onCalls[0].event).toBe('@pdf-list/table:row:selected');
    });

    it('应该正确触发本地监听器', () => {
      const callback = jest.fn();
      scopedEventBus.on('table:row:selected', callback);
      scopedEventBus.emit('table:row:selected', { id: 456 });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        { id: 456 },
        expect.objectContaining({ namespace: 'pdf-list' })
      );
    });

    it('应该返回取消监听函数', () => {
      const callback = jest.fn();
      const unsubscribe = scopedEventBus.on('test:event', callback);

      scopedEventBus.emit('test:event', { data: 1 });
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      scopedEventBus.emit('test:event', { data: 2 });
      expect(callback).toHaveBeenCalledTimes(1); // 仍然是 1 次
    });

    it('应该支持 off 方法', () => {
      const callback = jest.fn();
      scopedEventBus.on('test:event', callback);
      scopedEventBus.off('test:event', callback);

      scopedEventBus.emit('test:event', { data: 1 });
      expect(callback).not.toHaveBeenCalled();
    });

    it('应该支持 once 方法（只触发一次）', () => {
      const callback = jest.fn();
      scopedEventBus.once('test:event', callback);

      scopedEventBus.emit('test:event', { data: 1 });
      scopedEventBus.emit('test:event', { data: 2 });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        { data: 1 },
        expect.any(Object)
      );
    });
  });

  describe('全局事件（无命名空间）', () => {
    it('应该 emitGlobal 不添加命名空间前缀', () => {
      scopedEventBus.emitGlobal('pdf:list:updated', { records: [] });

      expect(globalEventBus.emitCalls).toHaveLength(1);
      expect(globalEventBus.emitCalls[0].event).toBe('pdf:list:updated');
      expect(globalEventBus.emitCalls[0].metadata.source).toBe('pdf-list');
    });

    it('应该 onGlobal 不添加命名空间前缀', () => {
      const callback = jest.fn();
      scopedEventBus.onGlobal('pdf:list:updated', callback);

      expect(globalEventBus.onCalls).toHaveLength(1);
      expect(globalEventBus.onCalls[0].event).toBe('pdf:list:updated');
    });

    it('应该正确触发全局监听器', () => {
      const callback = jest.fn();
      scopedEventBus.onGlobal('global:event', callback);
      scopedEventBus.emitGlobal('global:event', { data: 'test' });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        { data: 'test' },
        expect.objectContaining({ source: 'pdf-list' })
      );
    });

    it('应该支持 offGlobal 方法', () => {
      const callback = jest.fn();
      scopedEventBus.onGlobal('global:event', callback);
      scopedEventBus.offGlobal('global:event', callback);

      scopedEventBus.emitGlobal('global:event', { data: 1 });
      expect(callback).not.toHaveBeenCalled();
    });

    it('应该支持 onceGlobal 方法', () => {
      const callback = jest.fn();
      scopedEventBus.onceGlobal('global:event', callback);

      scopedEventBus.emitGlobal('global:event', { data: 1 });
      scopedEventBus.emitGlobal('global:event', { data: 2 });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('命名空间隔离', () => {
    it('应该不同命名空间的事件互不干扰', () => {
      const listBus = new ScopedEventBus('pdf-list', globalEventBus);
      const editorBus = new ScopedEventBus('pdf-editor', globalEventBus);

      const listCallback = jest.fn();
      const editorCallback = jest.fn();

      listBus.on('event:triggered', listCallback);
      editorBus.on('event:triggered', editorCallback);

      // 触发 pdf-list 的事件
      listBus.emit('event:triggered', { from: 'list' });

      expect(listCallback).toHaveBeenCalledTimes(1);
      expect(editorCallback).not.toHaveBeenCalled();

      // 触发 pdf-editor 的事件
      editorBus.emit('event:triggered', { from: 'editor' });

      expect(listCallback).toHaveBeenCalledTimes(1);
      expect(editorCallback).toHaveBeenCalledTimes(1);
    });

    it('应该全局事件可以被所有命名空间监听', () => {
      const listBus = new ScopedEventBus('pdf-list', globalEventBus);
      const editorBus = new ScopedEventBus('pdf-editor', globalEventBus);

      const listCallback = jest.fn();
      const editorCallback = jest.fn();

      listBus.onGlobal('shared:event', listCallback);
      editorBus.onGlobal('shared:event', editorCallback);

      // 任意一个功能域触发全局事件
      listBus.emitGlobal('shared:event', { data: 'shared' });

      // 两个功能域都应该收到
      expect(listCallback).toHaveBeenCalledTimes(1);
      expect(editorCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('工具方法', () => {
    it('应该获取命名空间', () => {
      expect(scopedEventBus.getNamespace()).toBe('pdf-list');
    });

    it('应该获取本地事件列表', () => {
      scopedEventBus.on('event1', jest.fn());
      scopedEventBus.on('event2', jest.fn());

      const events = scopedEventBus.getLocalEvents();
      expect(events).toContain('event1');
      expect(events).toContain('event2');
    });

    it('应该清除所有本地监听器', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      scopedEventBus.on('event1', callback1);
      scopedEventBus.on('event2', callback2);

      scopedEventBus.clearLocalListeners();

      scopedEventBus.emit('event1', {});
      scopedEventBus.emit('event2', {});

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    it('应该销毁作用域事件总线', () => {
      const callback = jest.fn();
      scopedEventBus.on('test:event', callback);

      scopedEventBus.destroy();

      scopedEventBus.emit('test:event', {});
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('边界情况', () => {
    it('应该处理已带命名空间前缀的事件名', () => {
      scopedEventBus.emit('@pdf-list/event:name', { data: 1 });

      // 不应该重复添加前缀
      expect(globalEventBus.emitCalls[0].event).toBe('@pdf-list/event:name');
    });

    it('应该支持带元数据的事件', () => {
      scopedEventBus.emit('test:event', { data: 1 }, { priority: 'high' });

      expect(globalEventBus.emitCalls[0].metadata).toMatchObject({
        namespace: 'pdf-list',
        priority: 'high'
      });
    });

    it('应该支持多个监听器监听同一事件', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      scopedEventBus.on('event', callback1);
      scopedEventBus.on('event', callback2);
      scopedEventBus.on('event', callback3);

      scopedEventBus.emit('event', { data: 1 });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });
  });

  describe('复杂场景', () => {
    it('应该支持功能域之间通过全局事件通信', () => {
      const listBus = new ScopedEventBus('pdf-list', globalEventBus);
      const editorBus = new ScopedEventBus('pdf-editor', globalEventBus);

      const editorCallback = jest.fn();

      // editor 监听全局更新事件
      editorBus.onGlobal('pdf:list:updated', editorCallback);

      // list 发出全局更新事件
      listBus.emitGlobal('pdf:list:updated', { records: [1, 2, 3] });

      expect(editorCallback).toHaveBeenCalledWith(
        { records: [1, 2, 3] },
        expect.objectContaining({ source: 'pdf-list' })
      );
    });

    it('应该同时支持本地和全局事件', () => {
      const localCallback = jest.fn();
      const globalCallback = jest.fn();

      scopedEventBus.on('local:event', localCallback);
      scopedEventBus.onGlobal('global:event', globalCallback);

      scopedEventBus.emit('local:event', { type: 'local' });
      scopedEventBus.emitGlobal('global:event', { type: 'global' });

      expect(localCallback).toHaveBeenCalledWith(
        { type: 'local' },
        expect.any(Object)
      );
      expect(globalCallback).toHaveBeenCalledWith(
        { type: 'global' },
        expect.any(Object)
      );
    });

    it('应该支持订阅者 ID', () => {
      const callback = jest.fn();
      scopedEventBus.on('test:event', callback, {
        subscriberId: 'my-component'
      });

      expect(globalEventBus.onCalls[0].options.subscriberId).toBe('my-component');
    });
  });
});
