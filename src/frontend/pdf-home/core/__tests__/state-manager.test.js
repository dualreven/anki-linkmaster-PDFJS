/**
 * @file StateManager 单元测试
 * @description 测试响应式状态管理器的核心功能
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { StateManager, createStateManager } from '../state-manager.js';

describe('StateManager', () => {
  let stateManager;

  beforeEach(() => {
    stateManager = new StateManager();
  });

  describe('状态创建', () => {
    it('应该创建 StateManager 实例', () => {
      expect(stateManager).toBeInstanceOf(StateManager);
    });

    it('应该通过工厂函数创建实例', () => {
      const manager = createStateManager();
      expect(manager).toBeInstanceOf(StateManager);
    });

    it('应该成功创建功能域状态', () => {
      const state = stateManager.createState('test', { count: 0 });

      expect(state).toBeDefined();
      expect(state.count).toBe(0);
    });

    it('应该抛出错误：重复创建同名状态', () => {
      stateManager.createState('test', {});

      expect(() => {
        stateManager.createState('test', {});
      }).toThrow(/already exists/);
    });

    it('应该创建带有初始数据的状态', () => {
      const initialData = {
        records: [1, 2, 3],
        selectedIds: [],
        filters: { name: 'test' }
      };

      const state = stateManager.createState('pdf-list', initialData);

      expect(state.records).toEqual([1, 2, 3]);
      expect(state.selectedIds).toEqual([]);
      expect(state.filters).toEqual({ name: 'test' });
    });
  });

  describe('状态访问', () => {
    beforeEach(() => {
      stateManager.createState('test', { count: 0, name: 'test' });
    });

    it('应该获取已存在的状态', () => {
      const state = stateManager.getState('test');

      expect(state).toBeDefined();
      expect(state.count).toBe(0);
    });

    it('应该返回 null：获取不存在的状态', () => {
      const state = stateManager.getState('non-existent');
      expect(state).toBeNull();
    });

    it('应该检查状态是否存在', () => {
      expect(stateManager.hasState('test')).toBe(true);
      expect(stateManager.hasState('non-existent')).toBe(false);
    });

    it('应该获取所有命名空间', () => {
      stateManager.createState('test2', {});
      stateManager.createState('test3', {});

      const namespaces = stateManager.getAllNamespaces();

      expect(namespaces).toHaveLength(3);
      expect(namespaces).toContain('test');
      expect(namespaces).toContain('test2');
      expect(namespaces).toContain('test3');
    });
  });

  describe('响应式状态变化', () => {
    it('应该响应状态变化', () => {
      const state = stateManager.createState('test', { count: 0 });

      state.count = 1;
      expect(state.count).toBe(1);

      state.count = 2;
      expect(state.count).toBe(2);
    });

    it('应该响应嵌套对象的变化', () => {
      const state = stateManager.createState('test', {
        user: { name: 'Alice', age: 25 }
      });

      state.user.name = 'Bob';
      expect(state.user.name).toBe('Bob');

      state.user.age = 30;
      expect(state.user.age).toBe(30);
    });

    it('应该响应数组变化', () => {
      const state = stateManager.createState('test', { items: [1, 2, 3] });

      state.items = [1, 2, 3, 4];
      expect(state.items).toEqual([1, 2, 3, 4]);
    });

    it('应该响应深层嵌套对象的变化', () => {
      const state = stateManager.createState('test', {
        data: {
          level1: {
            level2: {
              value: 'initial'
            }
          }
        }
      });

      state.data.level1.level2.value = 'updated';
      expect(state.data.level1.level2.value).toBe('updated');
    });
  });

  describe('订阅机制', () => {
    it('应该订阅状态变化', () => {
      const state = stateManager.createState('test', { count: 0 });
      const callback = jest.fn();

      state.subscribe('count', callback);

      state.count = 1;

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        1,
        0,
        expect.objectContaining({ path: 'count', newValue: 1, oldValue: 0 })
      );
    });

    it('应该支持多个订阅者', () => {
      const state = stateManager.createState('test', { count: 0 });
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      state.subscribe('count', callback1);
      state.subscribe('count', callback2);
      state.subscribe('count', callback3);

      state.count = 5;

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it('应该返回取消订阅函数', () => {
      const state = stateManager.createState('test', { count: 0 });
      const callback = jest.fn();

      const unsubscribe = state.subscribe('count', callback);

      state.count = 1;
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      state.count = 2;
      expect(callback).toHaveBeenCalledTimes(1); // 仍然是 1 次
    });

    it('应该订阅嵌套属性变化', () => {
      const state = stateManager.createState('test', {
        user: { name: 'Alice', age: 25 }
      });
      const callback = jest.fn();

      state.subscribe('user.name', callback);

      state.user.name = 'Bob';

      expect(callback).toHaveBeenCalledWith(
        'Bob',
        'Alice',
        expect.objectContaining({ path: 'user.name' })
      );
    });

    it('应该在父路径变化时触发订阅', () => {
      const state = stateManager.createState('test', {
        filters: { name: '', status: '' }
      });
      const callback = jest.fn();

      state.subscribe('filters', callback);

      state.filters.name = 'test';

      expect(callback).toHaveBeenCalled();
    });

    it('应该不触发订阅：值没有变化', () => {
      const state = stateManager.createState('test', { count: 0 });
      const callback = jest.fn();

      state.subscribe('count', callback);

      state.count = 0; // 值没有变化

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('计算属性', () => {
    it('应该定义计算属性', () => {
      const state = stateManager.createState('test', {
        firstName: 'John',
        lastName: 'Doe'
      });

      state.defineComputed('fullName', () => {
        return `${state.firstName} ${state.lastName}`;
      });

      expect(state.fullName).toBe('John Doe');
    });

    it('应该自动更新计算属性', () => {
      const state = stateManager.createState('test', {
        price: 100,
        quantity: 2
      });

      state.defineComputed('total', () => {
        return state.price * state.quantity;
      });

      expect(state.total).toBe(200);

      state.price = 150;
      expect(state.total).toBe(300);

      state.quantity = 3;
      expect(state.total).toBe(450);
    });

    it('应该缓存计算属性的值', () => {
      const state = stateManager.createState('test', { count: 0 });
      const getter = jest.fn(() => state.count * 2);

      state.defineComputed('doubled', getter);

      // 第一次访问，应该计算
      expect(state.doubled).toBe(0);
      expect(getter).toHaveBeenCalledTimes(1);

      // 第二次访问，应该使用缓存
      expect(state.doubled).toBe(0);
      expect(getter).toHaveBeenCalledTimes(1); // 仍然是 1 次

      // 状态变化后，重新计算
      state.count = 5;
      expect(state.doubled).toBe(10);
      expect(getter).toHaveBeenCalledTimes(2);
    });

    it('应该抛出错误：重复定义计算属性', () => {
      const state = stateManager.createState('test', { count: 0 });

      state.defineComputed('doubled', () => state.count * 2);

      expect(() => {
        state.defineComputed('doubled', () => state.count * 3);
      }).toThrow(/already exists/);
    });

    it('应该支持复杂的计算属性', () => {
      const state = stateManager.createState('test', {
        records: [
          { id: 1, selected: true },
          { id: 2, selected: false },
          { id: 3, selected: true }
        ]
      });

      state.defineComputed('selectedRecords', () => {
        return state.records.filter(r => r.selected);
      });

      expect(state.selectedRecords).toHaveLength(2);
      expect(state.selectedRecords[0].id).toBe(1);
      expect(state.selectedRecords[1].id).toBe(3);
    });
  });

  describe('状态快照和恢复', () => {
    it('应该生成状态快照', () => {
      const state = stateManager.createState('test', {
        count: 5,
        name: 'test',
        items: [1, 2, 3]
      });

      const snapshot = state.snapshot();

      expect(snapshot).toMatchObject({
        namespace: 'test',
        data: {
          count: 5,
          name: 'test',
          items: [1, 2, 3]
        }
      });

      expect(snapshot.timestamp).toBeGreaterThan(0);
    });

    it('应该从快照恢复状态', () => {
      const state = stateManager.createState('test', {
        count: 5,
        name: 'initial'
      });

      const snapshot = state.snapshot();

      // 修改状态
      state.count = 10;
      state.name = 'modified';

      expect(state.count).toBe(10);
      expect(state.name).toBe('modified');

      // 恢复快照
      state.restore(snapshot);

      expect(state.count).toBe(5);
      expect(state.name).toBe('initial');
    });

    it('应该在恢复后触发订阅', () => {
      const state = stateManager.createState('test', { count: 5 });
      const callback = jest.fn();

      state.subscribe('count', callback);

      const snapshot = state.snapshot();
      state.count = 10;

      callback.mockClear(); // 清除之前的调用记录

      state.restore(snapshot);

      expect(callback).toHaveBeenCalled();
    });

    it('应该抛出错误：命名空间不匹配', () => {
      const state = stateManager.createState('test', { count: 0 });
      const otherState = stateManager.createState('other', { count: 5 });

      const snapshot = otherState.snapshot();

      expect(() => {
        state.restore(snapshot);
      }).toThrow(/namespace mismatch/);
    });

    it('应该在恢复后重新计算计算属性', () => {
      const state = stateManager.createState('test', { count: 5 });

      state.defineComputed('doubled', () => state.count * 2);

      expect(state.doubled).toBe(10);

      const snapshot = state.snapshot();

      state.count = 10;
      expect(state.doubled).toBe(20);

      state.restore(snapshot);
      expect(state.doubled).toBe(10); // 恢复后重新计算
    });
  });

  describe('变化历史', () => {
    it('应该记录状态变化历史', () => {
      const state = stateManager.createState('test', { count: 0 });

      state.count = 1;
      state.count = 2;
      state.count = 3;

      const history = state.getHistory();

      expect(history).toHaveLength(3);
      expect(history[0]).toMatchObject({ path: 'count', oldValue: 0, newValue: 1 });
      expect(history[1]).toMatchObject({ path: 'count', oldValue: 1, newValue: 2 });
      expect(history[2]).toMatchObject({ path: 'count', oldValue: 2, newValue: 3 });
    });

    it('应该限制历史记录的最大数量', () => {
      const state = stateManager.createState('test', { count: 0 });

      // 触发 150 次变化（超过默认的 100 条限制）
      for (let i = 1; i <= 150; i++) {
        state.count = i;
      }

      const history = state.getHistory(150);

      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('应该清除历史记录', () => {
      const state = stateManager.createState('test', { count: 0 });

      state.count = 1;
      state.count = 2;

      expect(state.getHistory()).toHaveLength(2);

      state.clearHistory();

      expect(state.getHistory()).toHaveLength(0);
    });

    it('应该获取指定数量的历史记录', () => {
      const state = stateManager.createState('test', { count: 0 });

      for (let i = 1; i <= 20; i++) {
        state.count = i;
      }

      const last5 = state.getHistory(5);
      expect(last5).toHaveLength(5);
      expect(last5[4]).toMatchObject({ newValue: 20 });
    });
  });

  describe('命名空间隔离', () => {
    it('应该隔离不同命名空间的状态', () => {
      const state1 = stateManager.createState('feature1', { count: 1 });
      const state2 = stateManager.createState('feature2', { count: 2 });

      expect(state1.count).toBe(1);
      expect(state2.count).toBe(2);

      state1.count = 10;
      state2.count = 20;

      expect(state1.count).toBe(10);
      expect(state2.count).toBe(20);
    });

    it('应该隔离不同命名空间的订阅', () => {
      const state1 = stateManager.createState('feature1', { count: 0 });
      const state2 = stateManager.createState('feature2', { count: 0 });

      const callback1 = jest.fn();
      const callback2 = jest.fn();

      state1.subscribe('count', callback1);
      state2.subscribe('count', callback2);

      state1.count = 1;

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();

      state2.count = 2;

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('状态删除和清理', () => {
    it('应该删除功能域状态', () => {
      stateManager.createState('test', { count: 0 });

      expect(stateManager.hasState('test')).toBe(true);

      stateManager.deleteState('test');

      expect(stateManager.hasState('test')).toBe(false);
    });

    it('应该清除所有状态', () => {
      stateManager.createState('test1', {});
      stateManager.createState('test2', {});
      stateManager.createState('test3', {});

      expect(stateManager.getAllNamespaces()).toHaveLength(3);

      stateManager.clear();

      expect(stateManager.getAllNamespaces()).toHaveLength(0);
    });
  });

  describe('复杂场景', () => {
    it('应该支持完整的状态管理流程', () => {
      // 创建状态
      const state = stateManager.createState('pdf-list', {
        records: [],
        selectedIds: [],
        filters: { name: '', star: 0 }
      });

      // 定义计算属性
      state.defineComputed('selectedRecords', () => {
        return state.records.filter(r => state.selectedIds.includes(r.id));
      });

      // 订阅状态变化
      const recordsCallback = jest.fn();
      state.subscribe('records', recordsCallback);

      // 修改状态
      state.records = [
        { id: 1, name: 'file1.pdf', star: 5 },
        { id: 2, name: 'file2.pdf', star: 3 },
        { id: 3, name: 'file3.pdf', star: 4 }
      ];

      expect(recordsCallback).toHaveBeenCalledTimes(1);

      // 选中记录
      state.selectedIds = [1, 3];

      // 计算属性应该自动更新
      expect(state.selectedRecords).toHaveLength(2);
      expect(state.selectedRecords[0].id).toBe(1);
      expect(state.selectedRecords[1].id).toBe(3);

      // 生成快照
      const snapshot = state.snapshot();

      // 修改状态
      state.filters.name = 'test';
      state.selectedIds = [];

      // 恢复快照
      state.restore(snapshot);

      expect(state.filters.name).toBe('');
      expect(state.selectedIds).toEqual([1, 3]);
      expect(state.selectedRecords).toHaveLength(2);
    });

    it('应该支持多功能域协同工作', () => {
      const listState = stateManager.createState('pdf-list', {
        records: [{ id: 1, name: 'test.pdf' }]
      });

      const editorState = stateManager.createState('pdf-editor', {
        currentRecord: null
      });

      // 列表选中记录
      listState.selectedId = 1;

      // 编辑器打开记录
      editorState.currentRecord = listState.records[0];

      expect(editorState.currentRecord.id).toBe(1);
      expect(editorState.currentRecord.name).toBe('test.pdf');

      // 命名空间隔离
      expect(listState.currentRecord).toBeUndefined();
      expect(editorState.records).toBeUndefined();
    });
  });
});
