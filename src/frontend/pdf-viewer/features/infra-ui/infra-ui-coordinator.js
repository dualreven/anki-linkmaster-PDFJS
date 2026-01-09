/**
 * @file Infra-UI Coordinator
 * @module InfraUICoordinator
 * @description Centralized event handling for the infra-ui feature.
 */

import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import {
  WEBSOCKET_MESSAGE_EVENTS,
} from "../../../../common/event/event-constants.js";

export function createInfraUICoordinator(
  eventBus,
  logger,
  uiControls,
  eventListeners
) {
  const unsubs = [];

  // From ui-manager-core-ui-controls.js
  unsubs.push(
    eventBus.on(
      PDF_VIEWER_EVENTS.ZOOM.IN,
      (data) => uiControls.zoomIn(data),
      { subscriberId: "InfraUICoordinator.ZoomIn" }
    )
  );
  unsubs.push(
    eventBus.on(
      PDF_VIEWER_EVENTS.ZOOM.OUT,
      (data) => uiControls.zoomOut(data),
      { subscriberId: "InfraUICoordinator.ZoomOut" }
    )
  );
  unsubs.push(
    eventBus.on(
      PDF_VIEWER_EVENTS.ZOOM.ACTUAL_SIZE,
      () => uiControls.actualSize(),
      { subscriberId: "InfraUICoordinator.ZoomActualSize" }
    )
  );
  unsubs.push(
    eventBus.on(
      PDF_VIEWER_EVENTS.ZOOM.FIT_WIDTH,
      () => uiControls.fitWidth(),
      { subscriberId: "InfraUICoordinator.ZoomFitWidth" }
    )
  );
  unsubs.push(
    eventBus.on(
      PDF_VIEWER_EVENTS.ZOOM.FIT_HEIGHT,
      () => uiControls.fitHeight(),
      { subscriberId: "InfraUICoordinator.ZoomFitHeight" }
    )
  );
  unsubs.push(
    eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.PREVIOUS,
      () => uiControls.previousPage(),
      { subscriberId: "InfraUICoordinator.NavPrev" }
    )
  );
  unsubs.push(
    eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.NEXT,
      () => uiControls.nextPage(),
      { subscriberId: "InfraUICoordinator.NavNext" }
    )
  );
  unsubs.push(
    eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.GOTO,
      (data) => uiControls.goToPage(data),
      { subscriberId: "InfraUICoordinator.NavGoto" }
    )
  );
  unsubs.push(
    eventBus.on(
      PDF_VIEWER_EVENTS.ZOOM.CHANGING,
      ({ scale }) => uiControls.syncZoomState(scale),
      { subscriberId: "InfraUICoordinator.SyncZoomState" }
    )
  );
  unsubs.push(
    eventBus.on(
      PDF_VIEWER_EVENTS.PAGE.CHANGING,
      ({ pageNumber }) => uiControls.updatePageInfo(pageNumber),
      { subscriberId: "InfraUICoordinator.PageSync" }
    )
  );

  // From ui-manager-core-event-listeners.js
  unsubs.push(
    eventBus.on(
      PDF_VIEWER_EVENTS.ZOOM.CHANGED,
      (data) => eventListeners.onZoomChanged(data),
      { subscriberId: "InfraUICoordinator.ZoomChanged" }
    )
  );
  unsubs.push(
    eventBus.on(
      PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED,
      () => eventListeners.onFileLoadRequested(),
      { subscriberId: "InfraUICoordinator.FileLoadRequested" }
    )
  );
  unsubs.push(
    eventBus.on(
      PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
      (payload) => eventListeners.onFileLoadSuccess(payload),
      { subscriberId: "InfraUICoordinator.FileLoadSuccess" }
    )
  );
  unsubs.push(
    eventBus.on(
      PDF_VIEWER_EVENTS.FILE.LOAD.FAILED,
      (data) => eventListeners.onFileLoadFailed(data),
      { subscriberId: "InfraUICoordinator.FileLoadFailed" }
    )
  );
  unsubs.push(
    eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.PARSED,
      (data) => eventListeners.onUrlParamsParsed(data),
      { subscriberId: "InfraUICoordinator.UrlParamsParsed" }
    )
  );
  unsubs.push(
    eventBus.on(
      WEBSOCKET_MESSAGE_EVENTS.RESPONSE,
      (message) => eventListeners.onWebSocketResponse(message),
      { subscriberId: "InfraUICoordinator.WebSocketResponse" }
    )
  );
  unsubs.push(
    eventBus.on(
      WEBSOCKET_MESSAGE_EVENTS.ERROR,
      (message) => eventListeners.onWebSocketError(message),
      { subscriberId: "InfraUICoordinator.WebSocketError" }
    )
  );

  logger.info("InfraUICoordinator created and subscriptions are set up.");

  return {
    destroy: () => {
      unsubs.forEach((unsub) => unsub());
      logger.info("InfraUICoordinator destroyed.");
    },
  };
}
