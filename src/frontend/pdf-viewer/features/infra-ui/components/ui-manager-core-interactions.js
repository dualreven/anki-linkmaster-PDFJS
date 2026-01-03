import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";

export function installUIManagerCoreInteractions(ctx) {
  const {
    eventBus,
    logger,
    domManager,
    documentRef = document,
    windowRef = window
  } = ctx;

  const unsubs = [];

  const handleResize = () => {
    const dimensions = domManager.getContainerDimensions();
    logger.debug(`Container resized: ${dimensions.width}x${dimensions.height}`);
  };

  const container = domManager.getElement("container");
  if (typeof ResizeObserver === "function" && container) {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === container) {
          handleResize();
        }
      }
    });
    resizeObserver.observe(container);
    logger.info("Resize observer setup");
    unsubs.push(() => {
      try {
        resizeObserver.disconnect();
      } catch (e) {
        logger.warn("[UIManagerCore] ResizeObserver disconnect failed", e);
      }
    });
  } else {
    windowRef.addEventListener("resize", handleResize);
    logger.warn("ResizeObserver not available, using window resize");
    unsubs.push(() => {
      try {
        windowRef.removeEventListener("resize", handleResize);
      } catch (e) {
        logger.warn("[UIManagerCore] window resize detach failed", e);
      }
    });
  }

  const viewerContainer = documentRef.getElementById("viewerContainer");
  if (!viewerContainer) {
    logger.error("viewerContainer not found for wheel listener");
    return unsubs;
  }

  const handleWheel = (event) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const smoothStep = 0.1;
      if (event.deltaY < 0) {
        eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.IN, { delta: smoothStep }, { actorId: "UIManagerCore.Wheel" });
        logger.debug(`Wheel zoom in (step: ${smoothStep})`);
      } else {
        eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.OUT, { delta: smoothStep }, { actorId: "UIManagerCore.Wheel" });
        logger.debug(`Wheel zoom out (step: ${smoothStep})`);
      }
    }
  };

  viewerContainer.addEventListener("wheel", handleWheel, { passive: false });
  logger.info("Wheel event listener setup on viewerContainer");
  unsubs.push(() => {
    try {
      viewerContainer.removeEventListener("wheel", handleWheel);
    } catch (e) {
      logger.warn("[UIManagerCore] wheel detach failed", e);
    }
  });

  return unsubs;
}

