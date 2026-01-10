import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { createInfraUICoordinator } from "../infra-ui-coordinator.js";
import { installUIManagerCoreEventListeners } from "./ui-manager-core-event-listeners.js";
import { installCopyPdfIdButton } from "./ui-manager-core-copy-pdf-id.js";
import { requestPdfTitleFromDB } from "./pdf-title-requester.js";
import { updateUIManagerHeaderTitle } from "./ui-manager-core-header-title.js";

export function installUIManagerCoreInfraAssembly({
  eventBus,
  logger,
  viewerManager,
  zoomManager,
  layoutManager,
  domManager,
  getPdfViewerManager,
  getUIZoomControls,
  uiControls,
  uiLayoutControls,
  getCurrentPdfId,
  setCurrentPdfId,
  getPendingDetailRequestId,
  setPendingDetailRequestId,
  documentRef,
  windowRef,
}) {
  if (!eventBus) {
    throw new Error("[UIManagerCoreInfraAssembly] eventBus is required");
  }
  if (typeof eventBus.on !== "function") {
    throw new Error("[UIManagerCoreInfraAssembly] eventBus.on must be a function");
  }
  if (typeof eventBus.emit !== "function") {
    throw new Error("[UIManagerCoreInfraAssembly] eventBus.emit must be a function");
  }
  if (!logger) {
    throw new Error("[UIManagerCoreInfraAssembly] logger is required");
  }
  if (!viewerManager) {
    throw new Error("[UIManagerCoreInfraAssembly] viewerManager is required");
  }
  if (!domManager) {
    throw new Error("[UIManagerCoreInfraAssembly] domManager is required");
  }
  if (typeof getPdfViewerManager !== "function") {
    throw new Error("[UIManagerCoreInfraAssembly] getPdfViewerManager is required");
  }
  if (typeof getUIZoomControls !== "function") {
    throw new Error("[UIManagerCoreInfraAssembly] getUIZoomControls is required");
  }
  if (!uiControls) {
    throw new Error("[UIManagerCoreInfraAssembly] uiControls is required");
  }
  if (!uiLayoutControls) {
    throw new Error("[UIManagerCoreInfraAssembly] uiLayoutControls is required");
  }
  if (typeof getCurrentPdfId !== "function") {
    throw new Error("[UIManagerCoreInfraAssembly] getCurrentPdfId is required");
  }
  if (typeof setCurrentPdfId !== "function") {
    throw new Error("[UIManagerCoreInfraAssembly] setCurrentPdfId is required");
  }
  if (typeof getPendingDetailRequestId !== "function") {
    throw new Error("[UIManagerCoreInfraAssembly] getPendingDetailRequestId is required");
  }
  if (typeof setPendingDetailRequestId !== "function") {
    throw new Error("[UIManagerCoreInfraAssembly] setPendingDetailRequestId is required");
  }
  if (!documentRef) {
    throw new Error("[UIManagerCoreInfraAssembly] documentRef is required");
  }
  if (!windowRef) {
    throw new Error("[UIManagerCoreInfraAssembly] windowRef is required");
  }

  let updateCopyButtonVisibilityFn = () => {};

  const { eventListeners, unsubs: eventListenersUnsubs } =
    installUIManagerCoreEventListeners({
      eventBus,
      logger,
      viewerManager,
      zoomManager,
      layoutManager,
      domManager,
      getPdfViewerManager,
      getUIZoomControls,
      getCurrentPdfId,
      setCurrentPdfId,
      getPendingDetailRequestId,
      setPendingDetailRequestId,
      updateCopyButtonVisibility: () => updateCopyButtonVisibilityFn(),
      requestPdfTitleFromDB: (pdfId) =>
        requestPdfTitleFromDB({
          eventBus,
          logger,
          pdfId,
          setPendingDetailRequestId,
        }),
      updateHeaderTitle: (title) =>
        updateUIManagerHeaderTitle({ logger, documentRef }, title),
    });

  const coordinator = createInfraUICoordinator(
    eventBus,
    logger,
    uiControls,
    eventListeners,
    uiLayoutControls,
    {
      viewerManager,
      getPdfViewerManager,
      getUIZoomControls,
    }
  );

  const { updateCopyButtonVisibility, unsubs: copyUnsubs } =
    installCopyPdfIdButton({
      logger,
      documentRef,
      windowRef,
      getCurrentPdfId,
      setCurrentPdfId,
    });
  updateCopyButtonVisibilityFn = updateCopyButtonVisibility;

  // 广播“UI初始化完成”，便于其它特性作为就绪门闸（零轮询/零延迟）
  try {
    eventBus.emit(
      PDF_VIEWER_EVENTS.STATE.INITIALIZED,
      { module: "UIManagerCore" },
      { actorId: "UIManagerCore" }
    );
  } catch (e) {
    logger.warn("[UIManagerCoreInfraAssembly] Failed to emit STATE.INITIALIZED", e);
  }

  return {
    eventListeners,
    updateCopyButtonVisibility,
    unsubs: [
      ...eventListenersUnsubs,
      coordinator.destroy,
      ...copyUnsubs,
    ],
  };
}

