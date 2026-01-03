import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";

export function createAnnotationToggleButton({ eventBus, logger }) {
  let buttonContainer = document.getElementById("pdf-viewer-button-container");

  if (!buttonContainer) {
    logger.warn("Button container #pdf-viewer-button-container not found, cannot create annotation button");
    return null;
  }

  const inHeader = buttonContainer.classList.contains("sidebar-buttons")
    || buttonContainer.closest(".header-right") !== null;

  const button = document.createElement("button");
  button.id = "annotation-toggle-btn";
  button.type = "button";
  button.textContent = "✎ 标注";
  button.title = "打开标注（Ctrl+Shift+A）";
  button.className = "btn";

  if (!inHeader) {
    button.style.cssText = [
      "padding:4px 8px",
      "border:1px solid #ddd",
      "border-radius:4px",
      "background:#fff",
      "cursor:pointer",
      "box-shadow:0 1px 2px rgba(0,0,0,0.06)",
      "font-size:13px",
      "white-space:nowrap",
    ].join(";");
  }

  button.addEventListener("click", () => {
    logger.debug("Annotation button clicked");
    eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.TOGGLE, {});
  });

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "A") {
      e.preventDefault();
      logger.debug("Annotation keyboard shortcut triggered");
      eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.TOGGLE, {});
    }
  });

  const outlineBtn = buttonContainer.querySelector("button");
  if (outlineBtn && outlineBtn.nextSibling) {
    buttonContainer.insertBefore(button, outlineBtn.nextSibling);
  } else {
    buttonContainer.appendChild(button);
  }

  logger.info("Annotation button created and inserted");

  eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.OPENED, () => {
    button.style.background = "#e3f2fd";
    button.style.borderColor = "#2196f3";
  }, { subscriberId: "AnnotationFeature" });

  eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.CLOSED, () => {
    button.style.background = "#fff";
    button.style.borderColor = "#ddd";
  }, { subscriberId: "AnnotationFeature" });

  return button;
}

