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

export function installAnnotationSidebarSubscriptions({
  eventBus,
  subscriptions,
  subscriberId,
  onSelected,
  onSidebarClosed,
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
}
