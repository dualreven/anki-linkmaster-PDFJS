import { installEventListenersSubscriptions } from "./subscriptions/event-listeners.subscriptions.js";
import { installUIControlsSubscriptions } from "./subscriptions/ui-controls.subscriptions.js";
import { installUILayoutSubscriptions } from "./subscriptions/ui-layout.subscriptions.js";

export function createInfraUICoordinator(
  eventBus,
  logger,
  uiControls,
  eventListeners,
  uiLayoutControls
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

  const on = eventBus.on.bind(eventBus);

  const unsubs = [
    ...installUIControlsSubscriptions({ on, uiControls }),
    ...installUILayoutSubscriptions({ on, uiLayoutControls }),
    ...installEventListenersSubscriptions({ on, eventListeners }),
  ];

  logger.info("InfraUICoordinator created and subscriptions are set up.");

  return {
    destroy: () => {
      unsubs.forEach((unsub) => unsub());
      logger.info("InfraUICoordinator destroyed.");
    },
  };
}
