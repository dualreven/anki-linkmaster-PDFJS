import { createInfraUICoordinator } from "../infra-ui-coordinator.js";

describe("InfraUICoordinator cleanup (regression)", () => {
  test("destroy should unsubscribe all subscriptions", () => {
    const unsubs = [];
    const eventBus = {
      on: jest.fn(() => {
        const unsub = jest.fn();
        unsubs.push(unsub);
        return unsub;
      }),
    };
    const logger = { info: jest.fn() };

    const uiControls = {
      zoomIn: jest.fn(),
      zoomOut: jest.fn(),
      actualSize: jest.fn(),
      fitWidth: jest.fn(),
      fitHeight: jest.fn(),
      previousPage: jest.fn(),
      nextPage: jest.fn(),
      goToPage: jest.fn(),
      syncZoomState: jest.fn(),
      updatePageInfo: jest.fn(),
    };

    const eventListeners = {
      onZoomChanged: jest.fn(),
      onFileLoadRequested: jest.fn(),
      onFileLoadSuccess: jest.fn(),
      onFileLoadFailed: jest.fn(),
      onUrlParamsParsed: jest.fn(),
      onWebSocketResponse: jest.fn(),
      onWebSocketError: jest.fn(),
    };

    const uiLayoutControls = { onRenderModeChanged: jest.fn() };

    const coordinator = createInfraUICoordinator(
      eventBus,
      logger,
      uiControls,
      eventListeners,
      uiLayoutControls
    );

    expect(unsubs.length).toBeGreaterThan(0);
    coordinator.destroy();

    unsubs.forEach((fn) => expect(fn).toHaveBeenCalledTimes(1));
  });
});

