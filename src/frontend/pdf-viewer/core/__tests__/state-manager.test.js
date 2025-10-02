/**
 * @file StateManager 单元测试
 * @description 测试应用状态管理器的状态管理和事件发射功能
 */

import { StateManager } from '../state-manager.js';
import { EventBus } from '../../../common/event/event-bus.js';
import { PDF_VIEWER_EVENTS } from '../../../common/event/pdf-viewer-constants.js';

describe('StateManager', () => {
  let eventBus;
  let stateManager;

  beforeEach(() => {
    // 创建EventBus实例（禁用验证）
    eventBus = new EventBus({ enableValidation: false });
  });

  afterEach(() => {
    if (stateManager) {
      stateManager.reset();
    }
    eventBus.destroy();
  });

  describe('构造函数', () => {
    test('应该正确创建实例', () => {
      stateManager = new StateManager(eventBus);

      expect(stateManager).toBeInstanceOf(StateManager);
      expect(stateManager.isInitialized()).toBe(false);
    });

    test('不传入eventBus也应该正常工作', () => {
      stateManager = new StateManager();

      expect(stateManager).toBeInstanceOf(StateManager);
      expect(stateManager.getState()).toBeDefined();
    });
  });

  describe('getState()', () => {
    test('应该返回完整状态快照', () => {
      stateManager = new StateManager(eventBus);

      const state = stateManager.getState();

      expect(state).toEqual({
        initialized: false,
        currentFile: null,
        currentPage: 1,
        totalPages: 0,
        zoomLevel: 1.0
      });
    });

    test('状态应该是快照，修改不影响内部状态', () => {
      stateManager = new StateManager(eventBus);

      const state = stateManager.getState();
      state.currentPage = 999;

      expect(stateManager.getCurrentPage()).toBe(1);
    });
  });

  describe('初始化状态管理', () => {
    test('setInitialized()应该更新状态', () => {
      stateManager = new StateManager(eventBus);

      stateManager.setInitialized(true);

      expect(stateManager.isInitialized()).toBe(true);
    });

    test('setInitialized()应该发射状态变更事件', () => {
      stateManager = new StateManager(eventBus);

      const listener = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.STATE.CHANGED, listener);

      stateManager.setInitialized(true);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          field: 'initialized',
          oldValue: false,
          newValue: true,
          state: expect.objectContaining({ initialized: true })
        })
      );
    });

    test('相同值不应该触发事件', () => {
      stateManager = new StateManager(eventBus);
      stateManager.setInitialized(true);

      const listener = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.STATE.CHANGED, listener);

      stateManager.setInitialized(true);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('文件状态管理', () => {
    test('setCurrentFile()应该更新状态', () => {
      stateManager = new StateManager(eventBus);

      stateManager.setCurrentFile('/path/to/file.pdf');

      expect(stateManager.getCurrentFile()).toBe('/path/to/file.pdf');
    });

    test('setCurrentFile()应该发射状态变更事件', () => {
      stateManager = new StateManager(eventBus);

      const listener = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.STATE.CHANGED, listener);

      stateManager.setCurrentFile('/test.pdf');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          field: 'currentFile',
          oldValue: null,
          newValue: '/test.pdf'
        })
      );
    });

    test('应该支持null值', () => {
      stateManager = new StateManager(eventBus);

      stateManager.setCurrentFile('/file.pdf');
      stateManager.setCurrentFile(null);

      expect(stateManager.getCurrentFile()).toBeNull();
    });
  });

  describe('页面状态管理', () => {
    test('setCurrentPage()应该更新状态', () => {
      stateManager = new StateManager(eventBus);

      stateManager.setCurrentPage(5);

      expect(stateManager.getCurrentPage()).toBe(5);
    });

    test('setCurrentPage()应该发射状态变更事件', () => {
      stateManager = new StateManager(eventBus);

      const listener = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.STATE.CHANGED, listener);

      stateManager.setCurrentPage(10);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          field: 'currentPage',
          oldValue: 1,
          newValue: 10
        })
      );
    });

    test('setTotalPages()应该更新状态', () => {
      stateManager = new StateManager(eventBus);

      stateManager.setTotalPages(100);

      expect(stateManager.getTotalPages()).toBe(100);
    });

    test('setTotalPages()应该发射状态变更事件', () => {
      stateManager = new StateManager(eventBus);

      const listener = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.STATE.CHANGED, listener);

      stateManager.setTotalPages(50);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          field: 'totalPages',
          oldValue: 0,
          newValue: 50
        })
      );
    });
  });

  describe('缩放状态管理', () => {
    test('setZoomLevel()应该更新状态', () => {
      stateManager = new StateManager(eventBus);

      stateManager.setZoomLevel(1.5);

      expect(stateManager.getZoomLevel()).toBe(1.5);
    });

    test('setZoomLevel()应该发射状态变更事件', () => {
      stateManager = new StateManager(eventBus);

      const listener = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.STATE.CHANGED, listener);

      stateManager.setZoomLevel(2.0);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          field: 'zoomLevel',
          oldValue: 1.0,
          newValue: 2.0
        })
      );
    });
  });

  describe('reset()', () => {
    test('应该重置所有状态到初始值', () => {
      stateManager = new StateManager(eventBus);

      stateManager.setInitialized(true);
      stateManager.setCurrentFile('/file.pdf');
      stateManager.setCurrentPage(10);
      stateManager.setTotalPages(100);
      stateManager.setZoomLevel(2.0);

      stateManager.reset();

      expect(stateManager.getState()).toEqual({
        initialized: false,
        currentFile: null,
        currentPage: 1,
        totalPages: 0,
        zoomLevel: 1.0
      });
    });

    test('应该发射重置事件', () => {
      stateManager = new StateManager(eventBus);

      const listener = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.STATE.RESET, listener);

      stateManager.reset();

      expect(listener).toHaveBeenCalled();
    });

    test('没有eventBus时reset不应该抛出错误', () => {
      stateManager = new StateManager();

      expect(() => stateManager.reset()).not.toThrow();
    });
  });

  describe('事件发射', () => {
    test('没有eventBus时不应该发射事件', () => {
      stateManager = new StateManager();

      expect(() => {
        stateManager.setCurrentPage(5);
        stateManager.setZoomLevel(2.0);
      }).not.toThrow();
    });

    test('状态变更应该包含完整状态快照', () => {
      stateManager = new StateManager(eventBus);

      stateManager.setCurrentFile('/test.pdf');
      stateManager.setTotalPages(10);

      const listener = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.STATE.CHANGED, listener);

      stateManager.setCurrentPage(5);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          state: {
            initialized: false,
            currentFile: '/test.pdf',
            currentPage: 5,
            totalPages: 10,
            zoomLevel: 1.0
          }
        })
      );
    });
  });

  describe('实际使用场景', () => {
    test('模拟PDF加载流程', () => {
      stateManager = new StateManager(eventBus);

      const stateChanges = [];
      eventBus.on(PDF_VIEWER_EVENTS.STATE.CHANGED, (data) => {
        stateChanges.push(data.field);
      });

      // 1. 加载文件
      stateManager.setCurrentFile('/document.pdf');
      stateManager.setTotalPages(50);

      // 2. 初始化完成
      stateManager.setInitialized(true);

      // 3. 导航到第5页
      stateManager.setCurrentPage(5);

      // 4. 调整缩放
      stateManager.setZoomLevel(1.5);

      expect(stateChanges).toEqual([
        'currentFile',
        'totalPages',
        'initialized',
        'currentPage',
        'zoomLevel'
      ]);

      expect(stateManager.getState()).toEqual({
        initialized: true,
        currentFile: '/document.pdf',
        currentPage: 5,
        totalPages: 50,
        zoomLevel: 1.5
      });
    });

    test('模拟文件切换', () => {
      stateManager = new StateManager(eventBus);

      // 加载第一个文件
      stateManager.setCurrentFile('/file1.pdf');
      stateManager.setTotalPages(10);
      stateManager.setCurrentPage(5);

      // 切换到第二个文件
      stateManager.setCurrentFile('/file2.pdf');
      stateManager.setTotalPages(20);
      stateManager.setCurrentPage(1);

      expect(stateManager.getState()).toEqual({
        initialized: false,
        currentFile: '/file2.pdf',
        currentPage: 1,
        totalPages: 20,
        zoomLevel: 1.0
      });
    });
  });
});
