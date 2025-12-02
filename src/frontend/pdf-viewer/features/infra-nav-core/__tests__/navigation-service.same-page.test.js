import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { EventBus } from "../../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { NavigationService } from "../services/navigation-service.js";

function createViewerDom() {
  const viewerContainer = document.createElement("div");
  viewerContainer.id = "viewerContainer";
  const page3 = document.createElement("div");
  page3.className = "page";
  page3.setAttribute("data-page-number", "3");
  Object.defineProperty(page3, "offsetHeight", {
    configurable: true,
    get() {
      return 1000;
    }
  });
  viewerContainer.appendChild(page3);

  const page4 = document.createElement("div");
  page4.className = "page";
  page4.setAttribute("data-page-number", "4");
  Object.defineProperty(page4, "offsetHeight", {
    configurable: true,
    get() {
      return 1000;
    }
  });
  viewerContainer.appendChild(page4);

  document.body.appendChild(viewerContainer);
  return viewerContainer;
}

describe("NavigationService 同页位移行为", () => {
  let eventBus;
  let navigationService;

  beforeEach(() => {
    eventBus = new EventBus({ moduleName: "pdf-viewer-test", enableValidation: true, logger: console });
    createViewerDom();
    navigationService = new NavigationService(eventBus, { navigationTimeout: 1000, scrollDuration: 0 });
    eventBus.emit(
      PDF_VIEWER_EVENTS.NAVIGATION.TOTAL_PAGES_UPDATED,
      { totalPages: 10 },
      { actorId: "tester" }
    );
  });

  afterEach(() => {
    const viewerContainer = document.getElementById("viewerContainer");
    if (viewerContainer) {
      viewerContainer.remove();
    }
    jest.clearAllMocks();
  });

  it("在当前页导航时应只滚动位置，不再发 NAVIGATION.GOTO", async () => {
    eventBus.emit(
      PDF_VIEWER_EVENTS.PAGE.CHANGING,
      { pageNumber: 3 },
      { actorId: "tester" }
    );

    const gotoEvents = [];
    eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.GOTO,
      (payload) => {
        gotoEvents.push(payload);
      },
      { subscriberId: "test-listener" }
    );

    const scrollSpy = jest
      .spyOn(navigationService, "scrollToPosition")
      .mockResolvedValue(75);

    const result = await navigationService.navigateTo({ pageAt: 3, position: 75 });

    expect(scrollSpy).toHaveBeenCalledWith(75, 3);
    expect(gotoEvents).toHaveLength(0);
    expect(result.success).toBe(true);
    expect(result.actualPage).toBe(3);
    expect(result.actualPosition).toBe(75);
  });

  it("跨页导航仍应发送 NAVIGATION.GOTO 并执行滚动", async () => {
    eventBus.emit(
      PDF_VIEWER_EVENTS.PAGE.CHANGING,
      { pageNumber: 3 },
      { actorId: "tester" }
    );

    const gotoEvents = [];
    eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.GOTO,
      (payload) => {
        gotoEvents.push(payload);
      },
      { subscriberId: "test-listener" }
    );

    const scrollSpy = jest
      .spyOn(navigationService, "scrollToPosition")
      .mockResolvedValue(50);

    const result = await navigationService.navigateTo({ pageAt: 4, position: 50 });

    expect(gotoEvents).toHaveLength(1);
    expect(gotoEvents[0]).toMatchObject({ pageNumber: 4, positionPercent: 50 });
    expect(scrollSpy).toHaveBeenCalledWith(50, 4);
    expect(result.success).toBe(true);
    expect(result.actualPage).toBe(4);
    expect(result.actualPosition).toBe(50);
  });
});
