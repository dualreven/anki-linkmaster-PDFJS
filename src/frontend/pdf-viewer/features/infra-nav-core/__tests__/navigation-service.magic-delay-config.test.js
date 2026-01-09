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

function createReadyViewerDom(pageNumber = 1) {
  const viewerContainer = document.createElement("div");
  viewerContainer.id = "viewerContainer";

  const page = document.createElement("div");
  page.className = "page";
  page.setAttribute("data-page-number", String(pageNumber));
  Object.defineProperty(page, "offsetHeight", {
    configurable: true,
    get() {
      return 1000;
    }
  });
  viewerContainer.appendChild(page);

  document.body.appendChild(viewerContainer);
  return viewerContainer;
}

describe("NavigationService postPageReadyDelayMs 可配置", () => {
  let eventBus;
  let navigationService;

  beforeEach(() => {
    jest.useFakeTimers();
    eventBus = new EventBus({ moduleName: "pdf-viewer-test", enableValidation: true, logger: createTestLogger() });
    createReadyViewerDom(1);
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

  it("postPageReadyDelayMs=0 时，不需要推进时间也能完成 navigateTo", async () => {
    navigationService = new NavigationService(eventBus, { scrollDuration: 0, postPageReadyDelayMs: 0 });

    eventBus.emit(
      PDF_VIEWER_EVENTS.PAGE.CHANGING,
      { pageNumber: 1 },
      { actorId: "tester" }
    );

    const scrollSpy = jest.spyOn(navigationService, "scrollToPosition").mockResolvedValue(50);

    const result = await navigationService.navigateTo({ pageAt: 1, position: 50, scroll: true });

    expect(scrollSpy).toHaveBeenCalledWith(50, 1);
    expect(result.success).toBe(true);
    expect(result.actualPage).toBe(1);
    expect(result.actualPosition).toBe(50);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("默认仍等待 100ms（fake timers 下不推进时间则不会完成）", async () => {
    navigationService = new NavigationService(eventBus, { scrollDuration: 0 });

    eventBus.emit(
      PDF_VIEWER_EVENTS.PAGE.CHANGING,
      { pageNumber: 1 },
      { actorId: "tester" }
    );

    jest.spyOn(navigationService, "scrollToPosition").mockResolvedValue(50);

    let settled = false;
    const promise = navigationService.navigateTo({ pageAt: 1, position: 50, scroll: true }).then((r) => {
      settled = true;
      return r;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    jest.advanceTimersByTime(100);
    const result = await promise;
    expect(result.success).toBe(true);
  });
});

