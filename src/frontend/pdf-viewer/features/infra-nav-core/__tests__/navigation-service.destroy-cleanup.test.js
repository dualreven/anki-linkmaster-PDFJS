import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { EventBus } from "../../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { NavigationService } from "../services/navigation-service.js";

function createTestLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    event: jest.fn(),
  };
}

describe("NavigationService destroy 清理（订阅/定时器）", () => {
  let eventBus;
  let navigationService;

  beforeEach(() => {
    eventBus = new EventBus({ moduleName: "pdf-viewer-test", enableValidation: true, logger: createTestLogger() });
  });

  afterEach(() => {
    try { navigationService?.destroy?.(); } catch (e) { void e; /* logger-guard */ }
    navigationService = null;
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("destroy() 后不再响应 TOTAL_PAGES_UPDATED", () => {
    navigationService = new NavigationService(eventBus, { navigationTimeout: 1000, scrollDuration: 0 });

    eventBus.emit(
      PDF_VIEWER_EVENTS.NAVIGATION.TOTAL_PAGES_UPDATED,
      { totalPages: 10 },
      { actorId: "tester" }
    );
    expect(navigationService.getTotalPages()).toBe(10);

    navigationService.destroy();
    expect(navigationService.getTotalPages()).toBeNull();

    eventBus.emit(
      PDF_VIEWER_EVENTS.NAVIGATION.TOTAL_PAGES_UPDATED,
      { totalPages: 20 },
      { actorId: "tester" }
    );
    expect(navigationService.getTotalPages()).toBeNull();
  });

  it("destroy() 后允许在同一 EventBus 上重新创建 NavigationService（不触发重复订阅）", () => {
    navigationService = new NavigationService(eventBus, { navigationTimeout: 1000, scrollDuration: 0 });
    navigationService.destroy();

    expect(() => new NavigationService(eventBus, { navigationTimeout: 1000, scrollDuration: 0 })).not.toThrow();
  });

  it("destroy() 会取消 waitForPageReady 的轮询定时器，并让 navigateTo 返回失败", async () => {
    jest.useFakeTimers();
    navigationService = new NavigationService(eventBus, { navigationTimeout: 1000, scrollDuration: 0 });
    eventBus.emit(
      PDF_VIEWER_EVENTS.NAVIGATION.TOTAL_PAGES_UPDATED,
      { totalPages: 10 },
      { actorId: "tester" }
    );

    const navPromise = navigationService.navigateTo({ pageAt: 1, position: null, scroll: false });

    expect(jest.getTimerCount()).toBeGreaterThan(0);

    navigationService.destroy();

    expect(jest.getTimerCount()).toBe(0);

    const result = await navPromise;
    expect(result.success).toBe(false);
    expect(String(result.error || "")).toMatch(/destroy/i);
  });
});

