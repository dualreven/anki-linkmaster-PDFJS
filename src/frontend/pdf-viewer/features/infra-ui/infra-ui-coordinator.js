import { installEventListenersSubscriptions } from "./subscriptions/event-listeners.subscriptions.js";
import { installPageInfoInitSubscriptions } from "./subscriptions/page-info-init.subscriptions.js";
import { installUIControlsSubscriptions } from "./subscriptions/ui-controls.subscriptions.js";
import { installUILayoutSubscriptions } from "./subscriptions/ui-layout.subscriptions.js";

export function createInfraUICoordinator(
  eventBus,
  logger,
  uiControls,
  eventListeners,
  uiLayoutControls,
  deps = {}
) {
  if (!eventBus) {
    throw new Error("[InfraUICoordinator] eventBus is required");
  }
  if (typeof eventBus.on !== "function") {
    throw new Error("[InfraUICoordinator] eventBus.on must be a function");
  }
  if (!logger) {
    throw new Error("[InfraUICoordinator] logger is required");
  }
  if (!deps || typeof deps !== "object") {
    throw new Error("[InfraUICoordinator] deps is required");
  }
  if (!deps.viewerManager || typeof deps.viewerManager.setPageInfo !== "function") {
    throw new Error("[InfraUICoordinator] deps.viewerManager.setPageInfo is required");
  }
  if (typeof deps.getPdfViewerManager !== "function") {
    throw new Error("[InfraUICoordinator] deps.getPdfViewerManager is required");
  }
  if (typeof deps.getUIZoomControls !== "function") {
    throw new Error("[InfraUICoordinator] deps.getUIZoomControls is required");
  }

  const on = eventBus.on.bind(eventBus);

  const unsubs = [
    ...installUIControlsSubscriptions({ on, uiControls }),
    ...installUILayoutSubscriptions({ on, uiLayoutControls }),
    ...installEventListenersSubscriptions({ on, eventListeners }),
    ...installPageInfoInitSubscriptions({
      on,
      logger,
      viewerManager: deps.viewerManager,
      getPdfViewerManager: deps.getPdfViewerManager,
      getUIZoomControls: deps.getUIZoomControls,
    }),
  ];

  logger.info("InfraUICoordinator created and subscriptions are set up.");

  return {
    destroy: () => {
      unsubs.forEach((unsub) => unsub());
      logger.info("InfraUICoordinator destroyed.");
    },
  };
}
