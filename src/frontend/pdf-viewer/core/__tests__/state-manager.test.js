/**
 * @file StateManager 单元测试
 * @description 测试应用状态管理器的状态管理和事件发射功能
 */

import { StateManager } from "../state-manager.js";
import { EventBus } from "../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";

describe("StateManager", () => {
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

  describe("构造函数", () => {
    test("应该正确创建实例", () => {
      stateManager = new StateManager(eventBus);

      expect(stateManager).toBeInstanceOf(StateManager);
      expect(stateManager.isInitialized()).toBe(false);
    });

    test("不传入eventBus也应该正常工作", () => {
      stateManager = new StateManager();

      expect(stateManager).toBeInstanceOf(StateManager);
      expect(stateManager.getState()).toBeDefined();
    });
  });

  describe("getState()", () => {
    test("应该返回完整状态快照", () => {
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

    test("状态应该是快照，修改不影响内部状态", () => {
      stateManager = new StateManager(eventBus);

      const state = stateManager.getState();
      state.currentPage = 999;

      expect(stateManager.getCurrentPage()).toBe(1);
    });
  });

  describe("初始化状态管理", () => {
    test("setInitialized()应该更新状态", () => {
      stateManager = new StateManager(eventBus);

      stateManager.setInitialized(true);

      expect(stateManager.isInitialized()).toBe(true);
    });

    test("setInitialized()应该发射状态变更事件", () => {
      stateManager = new StateManager(eventBus);

      const listener = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.STATE.CHANGED, listener);

      stateManager.setInitialized(true);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          field: "initialized",
          oldValue: false,
          newValue: true,
          state: expect.objectContaining({ initialized: true })
        })
      );
    });

    test("相同值不应该触发事件", () => {
      stateManager = new StateManager(eventBus);
      stateManager.setInitialized(true);

      const listener = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.STATE.CHANGED, listener);

      stateManager.setInitialized(true);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("文件状态管理", () => {
    test("setCurrentFile()应该更新状态", () => {
      stateManager = new StateManager(eventBus);

      stateManager.setCurrentFile("/path/to/file.pdf");

      expect(stateManager.getCurrentFile()).toBe("/path/to/file.pdf");
    });

    test("setCurrentFile()应该发射状态变更事件", () => {
      stateManager = new StateManager(eventBus);

      const listener = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.STATE.CHANGED, listener);

      stateManager.setCurrentFile("/test.pdf");

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          field: "currentFile",
          oldValue: null,
          newValue: "/test.pdf"
        })
      );
    });

    test("应该支持null值", () => {
      stateManager = new StateManager(eventBus);

      stateManager.setCurrentFile("/file.pdf");
      stateManager.setCurrentFile(null);

      expect(stateManager.getCurrentFile()).toBeNull();
    });
  });

  describe("页面状态管理", () => {
    test("setCurrentPage()应该更新状态", () => {
      stateManager = new StateManager(eventBus);

      stateManager.setCurrentPage(5);

      expect(stateManager.getCurrentPage()).toBe(5);
    });

    test("setCurrentPage()应该发射状态变更事件", () => {
      stateManager = new StateManager(eventBus);

      const listener = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.STATE.CHANGED, listener);

      stateManager.setCurrentPage(10);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          field: "currentPage",
          oldValue: 1,
          newValue: 10
        })
      );
    });

    test("setTotalPages()应该更新状态", () => {
      stateManager = new StateManager(eventBus);

      stateManager.setTotalPages(100);

      expect(stateManager.getTotalPages()).toBe(100);
    });

    test("setTotalPages()应该发射状态变更事件", () => {
      stateManager = new StateManager(eventBus);

      const listener = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.STATE.CHANGED, listener);

      stateManager.setTotalPages(50);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          field: "totalPages",
          oldValue: 0,
          newValue: 50
        })
      );
    });
  });

  describe("缩放状态管理", () => {
    test("setZoomLevel()应该更新状态", () => {
      stateManager = new StateManager(eventBus);

      stateManager.setZoomLevel(1.5);

      expect(stateManager.getZoomLevel()).toBe(1.5);
    });

    test("setZoomLevel()应该发射状态变更事件", () => {
      stateManager = new StateManager(eventBus);

      const listener = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.STATE.CHANGED, listener);

      stateManager.setZoomLevel(2.0);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          field: "zoomLevel",
          oldValue: 1.0,
          newValue: 2.0
        })
      );
    });
  });

  describe("reset()", () => {
    test("应该重置所有状态到初始值", () => {
      stateManager = new StateManager(eventBus);

      stateManager.setInitialized(true);
      stateManager.setCurrentFile("/file.pdf");
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

    test("应该发射重置事件", () => {
      stateManager = new StateManager(eventBus);

      const listener = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.STATE.RESET, listener);

      stateManager.reset();

      expect(listener).toHaveBeenCalled();
    });

    test("没有eventBus时reset不应该抛出错误", () => {
      stateManager = new StateManager();

      expect(() => stateManager.reset()).not.toThrow();
    });
  });

  describe("事件发射", () => {
    test("没有eventBus时不应该发射事件", () => {
      stateManager = new StateManager();

      expect(() => {
        stateManager.setCurrentPage(5);
        stateManager.setZoomLevel(2.0);
      }).not.toThrow();
    });

    test("状态变更应该包含完整状态快照", () => {
      stateManager = new StateManager(eventBus);

      stateManager.setCurrentFile("/test.pdf");
      stateManager.setTotalPages(10);

      const listener = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.STATE.CHANGED, listener);

      stateManager.setCurrentPage(5);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          state: {
            initialized: false,
            currentFile: "/test.pdf",
            currentPage: 5,
            totalPages: 10,
            zoomLevel: 1.0
          }
        })
      );
    });
  });

  describe("实际使用场景", () => {
    test("模拟PDF加载流程", () => {
      stateManager = new StateManager(eventBus);

      const stateChanges = [];
      eventBus.on(PDF_VIEWER_EVENTS.STATE.CHANGED, (data) => {
        stateChanges.push(data.field);
      });

      // 1. 加载文件
      stateManager.setCurrentFile("/document.pdf");
      stateManager.setTotalPages(50);

      // 2. 初始化完成
      stateManager.setInitialized(true);

      // 3. 导航到第5页
      stateManager.setCurrentPage(5);

      // 4. 调整缩放
      stateManager.setZoomLevel(1.5);

      expect(stateChanges).toEqual([
        "currentFile",
        "totalPages",
        "initialized",
        "currentPage",
        "zoomLevel"
      ]);

      expect(stateManager.getState()).toEqual({
        initialized: true,
        currentFile: "/document.pdf",
        currentPage: 5,
        totalPages: 50,
        zoomLevel: 1.5
      });
    });

    test("模拟文件切换", () => {
      stateManager = new StateManager(eventBus);

      // 加载第一个文件
      stateManager.setCurrentFile("/file1.pdf");
      stateManager.setTotalPages(10);
      stateManager.setCurrentPage(5);

      // 切换到第二个文件
      stateManager.setCurrentFile("/file2.pdf");
      stateManager.setTotalPages(20);
      stateManager.setCurrentPage(1);

      expect(stateManager.getState()).toEqual({
        initialized: false,
        currentFile: "/file2.pdf",
        currentPage: 1,
        totalPages: 20,
        zoomLevel: 1.0
      });
    });
  });

  describe("batchUpdate()", () => {
    test("批量更新多个字段时 STATE.CHANGED 只触发一次", () => {
      stateManager = new StateManager(eventBus);

      const listener = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.STATE.CHANGED, listener);

      stateManager.batchUpdate((sm) => {
        sm.setCurrentFile("/batch.pdf");
        sm.setTotalPages(10);
        sm.setCurrentPage(3);
        sm.setZoomLevel(1.25);
      });

      // 只发一次（批量）
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          field: "batchUpdate",
          changes: expect.any(Array),
          state: expect.objectContaining({
            currentFile: "/batch.pdf",
            totalPages: 10,
            currentPage: 3,
            zoomLevel: 1.25
          })
        })
      );
    });

    test("非法入参必须 throw", () => {
      stateManager = new StateManager(eventBus);
      // @ts-ignore - intentional invalid param
      expect(() => stateManager.batchUpdate()).toThrow();
      // @ts-ignore - intentional invalid param
      expect(() => stateManager.batchUpdate(123)).toThrow();
    });

    test("禁止嵌套 batchUpdate", () => {
      stateManager = new StateManager(eventBus);
      expect(() => {
        stateManager.batchUpdate(() => {
          stateManager.batchUpdate(() => {});
        });
      }).toThrow();
    });

    test("fn throw 后必须恢复可用状态，且 throw 场景不发 STATE.CHANGED", () => {
      stateManager = new StateManager(eventBus);

      const listener = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.STATE.CHANGED, listener);

      expect(() => {
        stateManager.batchUpdate((sm) => {
          sm.setCurrentPage(2);
          throw new Error("boom");
        });
      }).toThrow("boom");

      // throw 时不发 batchUpdate 的聚合事件
      expect(listener).not.toHaveBeenCalled();

      // 后续仍可继续 batchUpdate（不应误判为嵌套/坏状态）
      stateManager.batchUpdate((sm) => {
        sm.setCurrentPage(3);
        sm.setZoomLevel(1.1);
      });
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ field: "batchUpdate" }));
    });
  });

  describe("setMany()", () => {
    test("批量更新多个字段时 STATE.CHANGED 只触发一次", () => {
      stateManager = new StateManager(eventBus);

      const listener = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.STATE.CHANGED, listener);

      stateManager.setMany({
        currentFile: "/many.pdf",
        totalPages: 11,
        currentPage: 4,
        zoomLevel: 1.3
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          field: "batchUpdate",
          state: expect.objectContaining({
            currentFile: "/many.pdf",
            totalPages: 11,
            currentPage: 4,
            zoomLevel: 1.3
          })
        })
      );
    });

    test("非法入参必须 throw", () => {
      stateManager = new StateManager(eventBus);
      // @ts-ignore - intentional invalid param
      expect(() => stateManager.setMany()).toThrow();
      // @ts-ignore - intentional invalid param
      expect(() => stateManager.setMany(null)).toThrow();
      // @ts-ignore - intentional invalid param
      expect(() => stateManager.setMany(123)).toThrow();
      // @ts-ignore - intentional invalid param
      expect(() => stateManager.setMany([])).toThrow();
      expect(() => stateManager.setMany({ unknownField: 1 })).toThrow();
    });

    test("batchUpdate 内调用 setMany 不应触发嵌套 batchUpdate", () => {
      stateManager = new StateManager(eventBus);

      const listener = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.STATE.CHANGED, listener);

      stateManager.batchUpdate((sm) => {
        sm.setMany({ currentPage: 2, zoomLevel: 1.2 });
        sm.setTotalPages(10);
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ field: "batchUpdate" }));
    });
  });

  describe("batchUpdate(updates)", () => {
    test("支持传入 plain object 批量更新（STATE.CHANGED 仍只触发一次）", () => {
      stateManager = new StateManager(eventBus);

      const listener = jest.fn();
      eventBus.on(PDF_VIEWER_EVENTS.STATE.CHANGED, listener);

      stateManager.batchUpdate({
        currentFile: "/obj-batch.pdf",
        totalPages: 22,
        currentPage: 6,
        zoomLevel: 1.4
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          field: "batchUpdate",
          state: expect.objectContaining({
            currentFile: "/obj-batch.pdf",
            totalPages: 22,
            currentPage: 6,
            zoomLevel: 1.4
          })
        })
      );
    });
  });

  describe("FIELD_CHANGED（更细粒度回调）", () => {
    test("单字段变化会触发 field listener；相同值不触发；unsubscribe 后不再触发", () => {
      stateManager = new StateManager(eventBus);

      const onPage = jest.fn();
      const unsubscribe = stateManager.onFieldChanged("currentPage", onPage);

      stateManager.setCurrentPage(2);
      expect(onPage).toHaveBeenCalledTimes(1);
      expect(onPage).toHaveBeenCalledWith(expect.objectContaining({
        field: "currentPage",
        oldValue: 1,
        newValue: 2,
        state: expect.objectContaining({ currentPage: 2 })
      }));

      // no-op change should not notify
      stateManager.setCurrentPage(2);
      expect(onPage).toHaveBeenCalledTimes(1);

      unsubscribe();
      stateManager.setCurrentPage(3);
      expect(onPage).toHaveBeenCalledTimes(1);
    });

    test("batchUpdate 内多字段变化会按字段各触发一次", () => {
      stateManager = new StateManager(eventBus);

      const onFile = jest.fn();
      const onTotal = jest.fn();
      stateManager.onFieldChanged("currentFile", onFile);
      stateManager.onFieldChanged("totalPages", onTotal);

      stateManager.batchUpdate((sm) => {
        sm.setCurrentFile("/f.pdf");
        sm.setTotalPages(9);
      });

      expect(onFile).toHaveBeenCalledTimes(1);
      expect(onTotal).toHaveBeenCalledTimes(1);
      expect(onFile).toHaveBeenCalledWith(expect.objectContaining({ field: "currentFile", newValue: "/f.pdf" }));
      expect(onTotal).toHaveBeenCalledWith(expect.objectContaining({ field: "totalPages", newValue: 9 }));
    });

    test("非法字段必须 throw（Fail-Fast）", () => {
      stateManager = new StateManager(eventBus);
      // @ts-ignore - intentional invalid field
      expect(() => stateManager.onFieldChanged("unknownField", () => {})).toThrow();
    });
  });
});
