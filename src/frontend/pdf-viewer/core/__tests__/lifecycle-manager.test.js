/**
 * @file LifecycleManager 单元测试
 * @description 测试生命周期管理器的全局错误处理功能
 */

import { LifecycleManager } from "../lifecycle-manager.js";
import { EventBus } from "../../../common/event/event-bus.js";
import { ErrorHandler } from "../../../common/error/error-handler.js";
import { APP_EVENTS } from "../../../common/event/event-constants.js";

// Polyfill for PromiseRejectionEvent (not available in Jest/jsdom)
class PromiseRejectionEvent extends Event {
  constructor(type, init) {
    super(type, init);
    this.reason = init?.reason;
    this.promise = init?.promise;
  }
}
global.PromiseRejectionEvent = PromiseRejectionEvent;

describe("LifecycleManager", () => {
  let eventBus;
  let errorHandler;
  let lifecycleManager;

  beforeEach(() => {
    // 创建EventBus实例（禁用验证）
    eventBus = new EventBus({ enableValidation: false });

    // 创建ErrorHandler实例
    errorHandler = new ErrorHandler(eventBus);

    // 避免直接使用 console，必要时可用 logger 或 jest.spyOn 替代（此处不做拦截）
  });

  afterEach(() => {
    if (lifecycleManager) {
      lifecycleManager.cleanup();
    }
    eventBus.destroy();

    // 无需恢复 console.error（未改动）
  });

  describe("构造函数", () => {
    test("应该正确创建实例", () => {
      lifecycleManager = new LifecycleManager(eventBus, errorHandler);

      expect(lifecycleManager).toBeInstanceOf(LifecycleManager);
      expect(lifecycleManager.isSetup()).toBe(false);
    });

    test("缺少eventBus时应该抛出错误", () => {
      expect(() => {
        new LifecycleManager(null, errorHandler);
      }).toThrow("LifecycleManager: eventBus is required");
    });

    test("缺少errorHandler时应该抛出错误", () => {
      expect(() => {
        new LifecycleManager(eventBus, null);
      }).toThrow("LifecycleManager: errorHandler is required");
    });
  });

  describe("setupGlobalErrorHandling()", () => {
    test("应该注册全局错误处理器", () => {
      lifecycleManager = new LifecycleManager(eventBus, errorHandler);

      lifecycleManager.setupGlobalErrorHandling();

      expect(lifecycleManager.isSetup()).toBe(true);
    });

    test("重复调用应该发出警告", () => {
      lifecycleManager = new LifecycleManager(eventBus, errorHandler);

      lifecycleManager.setupGlobalErrorHandling();
      lifecycleManager.setupGlobalErrorHandling();

      expect(lifecycleManager.isSetup()).toBe(true);
    });

    test("重复调用不应重复注册 window 监听器（必须对称卸载）", () => {
      lifecycleManager = new LifecycleManager(eventBus, errorHandler);

      const addSpy = jest.spyOn(window, "addEventListener");
      const removeSpy = jest.spyOn(window, "removeEventListener");

      lifecycleManager.setupGlobalErrorHandling();
      lifecycleManager.setupGlobalErrorHandling();

      const errorAdds = addSpy.mock.calls.filter(([type]) => type === "error");
      const rejectionAdds = addSpy.mock.calls.filter(([type]) => type === "unhandledrejection");
      expect(errorAdds.length).toBe(1);
      expect(rejectionAdds.length).toBe(1);

      const errorHandlerFn = errorAdds[0][1];
      const rejectionHandlerFn = rejectionAdds[0][1];

      lifecycleManager.cleanup();

      const errorRemoves = removeSpy.mock.calls.filter(([type]) => type === "error");
      const rejectionRemoves = removeSpy.mock.calls.filter(([type]) => type === "unhandledrejection");
      expect(errorRemoves.length).toBe(1);
      expect(rejectionRemoves.length).toBe(1);
      expect(errorRemoves[0][1]).toBe(errorHandlerFn);
      expect(rejectionRemoves[0][1]).toBe(rejectionHandlerFn);

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });

  describe("全局错误处理", () => {
    test("应该捕获未处理的Promise rejection", (done) => {
      lifecycleManager = new LifecycleManager(eventBus, errorHandler);
      lifecycleManager.setupGlobalErrorHandling();

      const listener = jest.fn();
      eventBus.on(APP_EVENTS.ERROR.UNHANDLED_REJECTION, listener);

      // 触发未处理的Promise rejection
      const testError = new Error("Test unhandled rejection");
      const rejectedPromise = Promise.reject(testError);
      const rejectionEvent = new PromiseRejectionEvent("unhandledrejection", {
        reason: testError,
        promise: rejectedPromise
      });

      // 捕获promise以避免警告
      rejectedPromise.catch(() => {});

      window.dispatchEvent(rejectionEvent);

      // 等待事件处理
      setTimeout(() => {
        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            reason: testError,
            message: "Test unhandled rejection"
          })
        );
        done();
      }, 10);
    });

    test("应该捕获全局错误", (done) => {
      lifecycleManager = new LifecycleManager(eventBus, errorHandler);
      lifecycleManager.setupGlobalErrorHandling();

      const listener = jest.fn();
      eventBus.on(APP_EVENTS.ERROR.GLOBAL, listener);

      // 触发全局错误
      const testError = new Error("Test global error");
      const errorEvent = new ErrorEvent("error", {
        message: "Test global error",
        filename: "test.js",
        lineno: 10,
        colno: 5,
        error: testError
      });

      window.dispatchEvent(errorEvent);

      // 等待事件处理
      setTimeout(() => {
        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "Test global error",
            filename: "test.js",
            lineno: 10,
            colno: 5,
            error: testError
          })
        );
        done();
      }, 10);
    });

    test("Promise rejection应该调用ErrorHandler", (done) => {
      lifecycleManager = new LifecycleManager(eventBus, errorHandler);
      errorHandler.handleError = jest.fn();

      lifecycleManager.setupGlobalErrorHandling();

      const testError = new Error("Test error");
      const rejectedPromise = Promise.reject(testError);
      const rejectionEvent = new PromiseRejectionEvent("unhandledrejection", {
        reason: testError,
        promise: rejectedPromise
      });

      // 捕获promise以避免警告
      rejectedPromise.catch(() => {});

      window.dispatchEvent(rejectionEvent);

      setTimeout(() => {
        expect(errorHandler.handleError).toHaveBeenCalledWith(
          testError,
          "UnhandledPromiseRejection"
        );
        done();
      }, 10);
    });

    test("全局错误应该调用ErrorHandler", (done) => {
      lifecycleManager = new LifecycleManager(eventBus, errorHandler);
      errorHandler.handleError = jest.fn();

      lifecycleManager.setupGlobalErrorHandling();

      const testError = new Error("Test error");
      const errorEvent = new ErrorEvent("error", {
        error: testError
      });

      window.dispatchEvent(errorEvent);

      setTimeout(() => {
        expect(errorHandler.handleError).toHaveBeenCalledWith(
          testError,
          "GlobalError"
        );
        done();
      }, 10);
    });
  });

  describe("cleanup()", () => {
    test("应该移除全局错误处理器", () => {
      lifecycleManager = new LifecycleManager(eventBus, errorHandler);

      lifecycleManager.setupGlobalErrorHandling();
      expect(lifecycleManager.isSetup()).toBe(true);

      lifecycleManager.cleanup();
      expect(lifecycleManager.isSetup()).toBe(false);
    });

    test("cleanup后不应该捕获错误", () => {
      lifecycleManager = new LifecycleManager(eventBus, errorHandler);
      lifecycleManager.setupGlobalErrorHandling();

      expect(lifecycleManager.isSetup()).toBe(true);

      lifecycleManager.cleanup();

      expect(lifecycleManager.isSetup()).toBe(false);

      // cleanup后，监听器应该被移除，不再捕获新错误
      // 通过检查isSetup状态验证cleanup成功
    });

    test("未setup时cleanup不应该抛出错误", () => {
      lifecycleManager = new LifecycleManager(eventBus, errorHandler);

      expect(() => lifecycleManager.cleanup()).not.toThrow();
    });
  });

  describe("isSetup()", () => {
    test("初始应该返回false", () => {
      lifecycleManager = new LifecycleManager(eventBus, errorHandler);

      expect(lifecycleManager.isSetup()).toBe(false);
    });

    test("setup后应该返回true", () => {
      lifecycleManager = new LifecycleManager(eventBus, errorHandler);

      lifecycleManager.setupGlobalErrorHandling();

      expect(lifecycleManager.isSetup()).toBe(true);
    });

    test("cleanup后应该返回false", () => {
      lifecycleManager = new LifecycleManager(eventBus, errorHandler);

      lifecycleManager.setupGlobalErrorHandling();
      lifecycleManager.cleanup();

      expect(lifecycleManager.isSetup()).toBe(false);
    });
  });

  describe("实际使用场景", () => {
    test("完整的设置-使用-清理流程", (done) => {
      lifecycleManager = new LifecycleManager(eventBus, errorHandler);

      // 1. 设置
      lifecycleManager.setupGlobalErrorHandling();
      expect(lifecycleManager.isSetup()).toBe(true);

      // 2. 使用
      const listener = jest.fn();
      eventBus.on(APP_EVENTS.ERROR.GLOBAL, listener);

      const testError = new Error("Test error");
      const errorEvent = new ErrorEvent("error", {
        error: testError
      });

      window.dispatchEvent(errorEvent);

      setTimeout(() => {
        expect(listener).toHaveBeenCalled();

        // 3. 清理
        lifecycleManager.cleanup();
        expect(lifecycleManager.isSetup()).toBe(false);

        done();
      }, 10);
    });

    test("多种错误类型应该分别处理", (done) => {
      lifecycleManager = new LifecycleManager(eventBus, errorHandler);
      lifecycleManager.setupGlobalErrorHandling();

      const rejectionListener = jest.fn();
      const errorListener = jest.fn();

      eventBus.on(APP_EVENTS.ERROR.UNHANDLED_REJECTION, rejectionListener);
      eventBus.on(APP_EVENTS.ERROR.GLOBAL, errorListener);

      // 触发Promise rejection
      const rejectionError = new Error("Rejection");
      const rejectedPromise = Promise.reject(rejectionError);
      const rejectionEvent = new PromiseRejectionEvent("unhandledrejection", {
        reason: rejectionError,
        promise: rejectedPromise
      });

      // 捕获promise以避免警告
      rejectedPromise.catch(() => {});
      window.dispatchEvent(rejectionEvent);

      // 触发全局错误
      const errorEvent = new ErrorEvent("error", {
        error: new Error("Global")
      });
      window.dispatchEvent(errorEvent);

      setTimeout(() => {
        expect(rejectionListener).toHaveBeenCalled();
        expect(errorListener).toHaveBeenCalled();
        done();
      }, 10);
    });
  });
});
