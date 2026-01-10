import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";

let keydownRefCount = 0;
let keydownHandler = null;
let keydownEventBus = null;
let keydownLogger = null;

function installAnnotationToggleKeydown({ eventBus, logger }) {
  if (!eventBus || typeof eventBus.emit !== "function") {
    throw new Error("[AnnotationToggleButton] eventBus.emit is required");
  }
  if (!logger) {
    throw new Error("[AnnotationToggleButton] logger is required");
  }

  if (keydownRefCount > 0) {
    if (keydownEventBus !== eventBus) {
      throw new Error("[AnnotationToggleButton] keydown listener already installed with a different eventBus");
    }
    keydownRefCount += 1;
    return () => uninstallAnnotationToggleKeydown();
  }

  keydownEventBus = eventBus;
  keydownLogger = logger;
  keydownHandler = (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "A") {
      e.preventDefault();
      keydownLogger.debug("Annotation keyboard shortcut triggered");
      keydownEventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.TOGGLE, {});
    }
  };

  document.addEventListener("keydown", keydownHandler);
  keydownRefCount = 1;

  return () => uninstallAnnotationToggleKeydown();
}

function uninstallAnnotationToggleKeydown() {
  if (keydownRefCount <= 0) {
    return;
  }

  keydownRefCount -= 1;
  if (keydownRefCount > 0) {
    return;
  }

  if (!keydownHandler) {
    throw new Error("[AnnotationToggleButton] keydownHandler missing during uninstall");
  }
  document.removeEventListener("keydown", keydownHandler);

  keydownHandler = null;
  keydownEventBus = null;
  keydownLogger = null;
}

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

  const onClick = () => {
    logger.debug("Annotation button clicked");
    eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.TOGGLE, {});
  };
  button.addEventListener("click", onClick);

  const unsubs = [];

  const unsubKeydown = installAnnotationToggleKeydown({ eventBus, logger });
  if (typeof unsubKeydown !== "function") {
    throw new Error("[AnnotationToggleButton] installAnnotationToggleKeydown must return an unsubscribe function");
  }
  unsubs.push(unsubKeydown);

  const outlineBtn = buttonContainer.querySelector("button");
  if (outlineBtn && outlineBtn.nextSibling) {
    buttonContainer.insertBefore(button, outlineBtn.nextSibling);
  } else {
    buttonContainer.appendChild(button);
  }

  logger.info("Annotation button created and inserted");

  const unsubOpened = eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.OPENED, () => {
    button.style.background = "#e3f2fd";
    button.style.borderColor = "#2196f3";
  }, { subscriberId: "AnnotationFeature" });
  if (typeof unsubOpened !== "function") {
    throw new Error("[AnnotationToggleButton] eventBus.on must return an unsubscribe function (OPENED)");
  }
  unsubs.push(unsubOpened);

  const unsubClosed = eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.CLOSED, () => {
    button.style.background = "#fff";
    button.style.borderColor = "#ddd";
  }, { subscriberId: "AnnotationFeature" });
  if (typeof unsubClosed !== "function") {
    throw new Error("[AnnotationToggleButton] eventBus.on must return an unsubscribe function (CLOSED)");
  }
  unsubs.push(unsubClosed);

  let uninstalled = false;
  button.uninstall = () => {
    if (uninstalled) {
      return;
    }
    uninstalled = true;

    try {
      button.removeEventListener("click", onClick);
    } catch (e) {
      void e; /* logger-guard */
    }

    unsubs.splice(0).forEach((fn) => {
      try { fn(); } catch (e) { void e; /* logger-guard */ }
    });
  };

  return button;
}
