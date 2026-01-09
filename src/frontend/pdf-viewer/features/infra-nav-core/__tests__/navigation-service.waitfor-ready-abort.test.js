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

function createViewerDomWithPage(pageNumber = 1) {
  const viewerContainer = document.createElement("div");
  viewerContainer.id = "viewerContainer";

  const page = document.createElement("div");
  page.className = "page";
  page.setAttribute("data-page-number", String(pageNumber));
  // 默认 offsetHeight 为 0（未就绪），用于触发 waitForPageReady 的轮询
  viewerContainer.appendChild(page);

  document.body.appendChild(viewerContainer);
  return viewerContainer;
}

describe("NavigationService waitForPageReady 可取消（destroy abort）", () => {
  let eventBus;
  let navigationService;

  beforeEach(() => {
    jest.useFakeTimers();
    eventBus = new EventBus({ moduleName: "pdf-viewer-test", enableValidation: true, logger: createTestLogger() });
  });

  afterEach(() => {
    try { navigationService?.destroy?.(); } catch (e) { void e; /* logger-guard */ }
    navigationService = null;

    const viewerContainer = document.getElementById("viewerContainer");
    if (viewerContainer) {
      viewerContainer.remove();
    }

    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("destroy 后应取消 50ms 轮询，并且不产生 NAVIGATION.GOTO side-effect（同页+scroll=false）", async () => {
    createViewerDomWithPage(1);
    navigationService = new NavigationService(eventBus, { navigationTimeout: 1000, scrollDuration: 0 });

    eventBus.emit(
      PDF_VIEWER_EVENTS.PAGE.CHANGING,
      { pageNumber: 1 },
      { actorId: "tester" }
    );

    const gotoEvents = [];
    eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.GOTO,
      (payload) => gotoEvents.push(payload),
      { subscriberId: "test-goto-listener" }
    );

    const navPromise = navigationService.navigateTo({ pageAt: 1, position: null, scroll: false });

    expect(jest.getTimerCount()).toBeGreaterThan(0);
    jest.advanceTimersByTime(120);
    expect(jest.getTimerCount()).toBeGreaterThan(0);

    navigationService.destroy();

    expect(jest.getTimerCount()).toBe(0);
    expect(gotoEvents).toHaveLength(0);

    const result = await navPromise;
    expect(result.success).toBe(false);
    expect(String(result.error || "")).toMatch(/destroy/i);
  });

  it("destroy 后应取消 viewerContainer 缺失时的固定延迟 fallback，并且不产生 NAVIGATION.GOTO side-effect（同页+scroll=false）", async () => {
    navigationService = new NavigationService(eventBus, { navigationTimeout: 1000, scrollDuration: 0 });

    eventBus.emit(
      PDF_VIEWER_EVENTS.PAGE.CHANGING,
      { pageNumber: 1 },
      { actorId: "tester" }
    );

    const gotoEvents = [];
    eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.GOTO,
      (payload) => gotoEvents.push(payload),
      { subscriberId: "test-goto-listener-2" }
    );

    const navPromise = navigationService.navigateTo({ pageAt: 1, position: null, scroll: false });

    expect(jest.getTimerCount()).toBeGreaterThan(0);

    navigationService.destroy();

    expect(jest.getTimerCount()).toBe(0);
    expect(gotoEvents).toHaveLength(0);

    const result = await navPromise;
    expect(result.success).toBe(false);
    expect(String(result.error || "")).toMatch(/destroy/i);
  });
});

