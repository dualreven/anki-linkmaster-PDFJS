import { UIManagerCore } from "../components/ui-manager-core.js";
import { EventBus } from "../../../../common/event/event-bus.js";
import { getLogger } from "../../../../common/utils/logger.js";
import { UIControls } from "../components/ui-manager-core-ui-controls.js";
import { EventListeners } from "../components/ui-manager-core-event-listeners.js";
import { createInfraUICoordinator } from "../infra-ui-coordinator.js";

jest.mock("../../../../common/utils/logger.js");
jest.mock("../components/ui-manager-core-ui-controls.js");
jest.mock("../components/ui-manager-core-event-listeners.js");
jest.mock("../infra-ui-coordinator.js");

describe("UIManagerCore", () => {
  let eventBus;
  let logger;

  beforeEach(() => {
    eventBus = new EventBus();
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    getLogger.mockReturnValue(logger);
    createInfraUICoordinator.mockReturnValue({
      destroy: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize the coordinator with UIControls and EventListeners", async () => {
    const uiManager = new UIManagerCore(eventBus);

    // Mock initialize function to avoid DOM access
    uiManager.initialize = jest.fn().mockImplementation(async function () {
      this._UIManagerCore__uiControls = new UIControls();
      this._UIManagerCore__uiLayoutControls = { onRenderModeChanged: jest.fn() };
      this._UIManagerCore__eventListeners = new EventListeners();
      this._UIManagerCore__coordinator = createInfraUICoordinator(
        eventBus,
        logger,
        this._UIManagerCore__uiControls,
        this._UIManagerCore__eventListeners,
        this._UIManagerCore__uiLayoutControls,
        {
          viewerManager: { setPageInfo: jest.fn() },
          getPdfViewerManager: () => ({ pagesCount: 1, currentPageNumber: 1 }),
          getUIZoomControls: () => ({ updatePageInfo: jest.fn() }),
        }
      );
    });

    await uiManager.initialize();

    expect(createInfraUICoordinator).toHaveBeenCalled();
    expect(createInfraUICoordinator).toHaveBeenCalledWith(
      expect.any(Object), // eventBus
      expect.any(Object), // logger
      expect.any(UIControls),
      expect.any(EventListeners),
      expect.any(Object),
      expect.objectContaining({
        viewerManager: expect.any(Object),
        getPdfViewerManager: expect.any(Function),
        getUIZoomControls: expect.any(Function),
      })
    );
  });
});
