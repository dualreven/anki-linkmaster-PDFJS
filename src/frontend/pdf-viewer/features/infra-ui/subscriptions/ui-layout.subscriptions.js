import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";

export function installUILayoutSubscriptions({ on, uiLayoutControls }) {
  if (typeof on !== "function") {
    throw new Error("[infra-ui] on is required");
  }

  if (!uiLayoutControls) {
    return [];
  }

  if (typeof uiLayoutControls.onRenderModeChanged !== "function") {
    throw new Error("[infra-ui] uiLayoutControls.onRenderModeChanged must be a function");
  }

  return [
    on(
      PDF_VIEWER_EVENTS.VIEW_MODE.RENDER_MODE_CHANGED,
      (data) => uiLayoutControls.onRenderModeChanged(data),
      { subscriberId: "InfraUICoordinator.ViewModeRenderModeChanged" }
    ),
  ];
}
