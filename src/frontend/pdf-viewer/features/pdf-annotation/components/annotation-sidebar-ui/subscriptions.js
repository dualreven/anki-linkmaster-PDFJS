import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";

export function createToolDeactivatedHandler({
  logger,
  getActiveTool,
  setActiveTool,
  updateToolbarState,
}) {
  return (data) => {
    const deactivatedTool = data?.tool;
    const activeTool = getActiveTool();

    if (!deactivatedTool) {
      logger.debug("All tools deactivated (no specific tool specified)");
      setActiveTool(null);
      updateToolbarState();
      return;
    }

    if (deactivatedTool === activeTool) {
      logger.debug(`Tool deactivated: ${deactivatedTool} (matches active tool)`);
      setActiveTool(null);
      updateToolbarState();
      return;
    }

    logger.debug(
      `Tool deactivated: ${deactivatedTool}, but active tool is ${activeTool}, ignoring`
    );
  };
}

export function createSidebarClosedHandler({
  logger,
  eventBus,
  setActiveTool,
  updateToolbarState,
}) {
  return (data) => {
    if (data?.sidebarId !== "annotation") {
      return;
    }

    logger.info("Annotation sidebar closed, deactivating all tools");
    eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.DEACTIVATE, {});
    logger.info("Tool deactivate requested due to sidebar close");

    setActiveTool(null);
    updateToolbarState();
    logger.info("Annotation sidebar closed (silent, no toast)");
  };
}

export function createCommentAddedHandler({
  logger,
  getAnnotationById,
  updateAnnotationCard,
}) {
  return (data) => {
    const { annotationId, skipUpdate } = data || {};
    if (!annotationId) {
      return;
    }

    if (skipUpdate) {
      logger.debug("Comment already added locally, skipping update");
      return;
    }

    const annotation = getAnnotationById(String(annotationId));
    if (!annotation) {
      logger.warn(`Annotation not found: ${annotationId}`);
      return;
    }

    logger.debug(`External comment added to annotation ${annotationId}`);
    updateAnnotationCard(annotation);
  };
}

export function installAnnotationSidebarSubscriptions({
  eventBus,
  subscriptions,
  subscriberId,
  onSelected,
  onSidebarClosed,
  onCommentAdded,
  onToolDeactivated,
}) {
  const sid = subscriberId || "AnnotationSidebarUI";

  // 非 CRUD：交互与跨模块协作事件
  if (typeof onToolDeactivated === "function") {
    subscriptions.add(eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.DEACTIVATED, onToolDeactivated, { subscriberId: sid }));
  }
  if (typeof onSelected === "function") {
    subscriptions.add(eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.SELECT, onSelected, { subscriberId: sid }));
  }
  if (typeof onSidebarClosed === "function") {
    subscriptions.add(eventBus.onGlobal(
      PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.CLOSED_COMPLETED,
      onSidebarClosed,
      { subscriberId: sid }
    ));
  }
  if (typeof onCommentAdded === "function") {
    subscriptions.add(eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.COMMENT.ADDED, onCommentAdded, { subscriberId: sid }));
  }
}
