// @jest-environment jsdom
// UTF-8, \n
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
  viewerContainer.appendChild(page);

  document.body.appendChild(viewerContainer);
  return viewerContainer;
}

describe("NavigationService cleanup regression (unsubscribe + cancel waitForPageReady)", () => {
  let eventBus;
  let navigationService;
  /** @type {Array<jest.Mock>} */
  let unsubscribeSpies;

  beforeEach(() => {
    jest.useFakeTimers();
    unsubscribeSpies = [];

    eventBus = new EventBus({ moduleName: "pdf-viewer-test", enableValidation: true, logger: createTestLogger() });
    const realOn = eventBus.on.bind(eventBus);
    eventBus.on = (eventName, handler, options) => {
      const unsub = realOn(eventName, handler, options);
      const spyUnsub = jest.fn(() => unsub());
      unsubscribeSpies.push(spyUnsub);
      return spyUnsub;
    };
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

  it("destroy() calls all unsubscribes and cancels pending timers", async () => {
    createViewerDomWithPage(1);
    navigationService = new NavigationService(eventBus, { navigationTimeout: 1000, scrollDuration: 0 });

    eventBus.emit(
      PDF_VIEWER_EVENTS.NAVIGATION.TOTAL_PAGES_UPDATED,
      { totalPages: 10 },
      { actorId: "tester" }
    );
    eventBus.emit(
      PDF_VIEWER_EVENTS.PAGE.CHANGING,
      { pageNumber: 1 },
      { actorId: "tester" }
    );

    const navPromise = navigationService.navigateTo({ pageAt: 1, position: null, scroll: false });

    expect(unsubscribeSpies.length).toBeGreaterThanOrEqual(2);
    expect(jest.getTimerCount()).toBeGreaterThan(0);

    navigationService.destroy();

    unsubscribeSpies.forEach((fn) => expect(fn).toHaveBeenCalledTimes(1));
    expect(jest.getTimerCount()).toBe(0);

    const result = await navPromise;
    expect(result.success).toBe(false);
    expect(String(result.error || "")).toMatch(/destroy/i);
  });
});
