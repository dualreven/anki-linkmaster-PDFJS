import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";

export function installUIControlsSubscriptions({ on, uiControls }) {
  if (typeof on !== "function") {
    throw new Error("[infra-ui] on is required");
  }
  if (!uiControls) {
    throw new Error("[infra-ui] uiControls is required");
  }

  const methods = [
    "zoomIn",
    "zoomOut",
    "actualSize",
    "fitWidth",
    "fitHeight",
    "previousPage",
    "nextPage",
    "goToPage",
    "syncZoomState",
    "updatePageInfo",
  ];
  for (const m of methods) {
    if (typeof uiControls[m] !== "function") {
      throw new Error(`[infra-ui] uiControls.${m} must be a function`);
    }
  }

  return [
    on(PDF_VIEWER_EVENTS.ZOOM.IN, (data) => uiControls.zoomIn(data), { subscriberId: "InfraUICoordinator.ZoomIn" }),
    on(PDF_VIEWER_EVENTS.ZOOM.OUT, (data) => uiControls.zoomOut(data), { subscriberId: "InfraUICoordinator.ZoomOut" }),
    on(PDF_VIEWER_EVENTS.ZOOM.ACTUAL_SIZE, () => uiControls.actualSize(), { subscriberId: "InfraUICoordinator.ZoomActualSize" }),
    on(PDF_VIEWER_EVENTS.ZOOM.FIT_WIDTH, () => uiControls.fitWidth(), { subscriberId: "InfraUICoordinator.ZoomFitWidth" }),
    on(PDF_VIEWER_EVENTS.ZOOM.FIT_HEIGHT, () => uiControls.fitHeight(), { subscriberId: "InfraUICoordinator.ZoomFitHeight" }),
    on(PDF_VIEWER_EVENTS.NAVIGATION.PREVIOUS, () => uiControls.previousPage(), { subscriberId: "InfraUICoordinator.NavPrev" }),
    on(PDF_VIEWER_EVENTS.NAVIGATION.NEXT, () => uiControls.nextPage(), { subscriberId: "InfraUICoordinator.NavNext" }),
    on(PDF_VIEWER_EVENTS.NAVIGATION.GOTO, (data) => uiControls.goToPage(data), { subscriberId: "InfraUICoordinator.NavGoto" }),
    on(PDF_VIEWER_EVENTS.ZOOM.CHANGING, ({ scale }) => uiControls.syncZoomState(scale), { subscriberId: "InfraUICoordinator.SyncZoomState" }),
    on(PDF_VIEWER_EVENTS.PAGE.CHANGING, ({ pageNumber }) => uiControls.updatePageInfo(pageNumber), { subscriberId: "InfraUICoordinator.PageSync" }),
  ];
}
