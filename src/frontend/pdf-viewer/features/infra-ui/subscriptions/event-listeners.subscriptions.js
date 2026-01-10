import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_MESSAGE_EVENTS } from "../../../../common/event/event-constants.js";

export function installEventListenersSubscriptions({ on, eventListeners }) {
  if (typeof on !== "function") {
    throw new Error("[infra-ui] on is required");
  }
  if (!eventListeners) {
    throw new Error("[infra-ui] eventListeners is required");
  }

  const methods = [
    "onZoomChanged",
    "onFileLoadRequested",
    "onFileLoadSuccess",
    "onFileLoadFailed",
    "onUrlParamsParsed",
    "onWebSocketResponse",
    "onWebSocketError",
  ];
  for (const m of methods) {
    if (typeof eventListeners[m] !== "function") {
      throw new Error(`[infra-ui] eventListeners.${m} must be a function`);
    }
  }

  return [
    on(PDF_VIEWER_EVENTS.ZOOM.CHANGED, (data) => eventListeners.onZoomChanged(data), { subscriberId: "InfraUICoordinator.ZoomChanged" }),
    on(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, () => eventListeners.onFileLoadRequested(), { subscriberId: "InfraUICoordinator.FileLoadRequested" }),
    on(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, (payload) => eventListeners.onFileLoadSuccess(payload), { subscriberId: "InfraUICoordinator.FileLoadSuccess" }),
    on(PDF_VIEWER_EVENTS.FILE.LOAD.FAILED, (data) => eventListeners.onFileLoadFailed(data), { subscriberId: "InfraUICoordinator.FileLoadFailed" }),
    on(PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.PARSED, (data) => eventListeners.onUrlParamsParsed(data), { subscriberId: "InfraUICoordinator.UrlParamsParsed" }),
    on(WEBSOCKET_MESSAGE_EVENTS.RESPONSE, (message) => eventListeners.onWebSocketResponse(message), { subscriberId: "InfraUICoordinator.WebSocketResponse" }),
    on(WEBSOCKET_MESSAGE_EVENTS.ERROR, (message) => eventListeners.onWebSocketError(message), { subscriberId: "InfraUICoordinator.WebSocketError" }),
  ];
}
