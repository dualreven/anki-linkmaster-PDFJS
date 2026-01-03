import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";

export function activateCommentTool({ logger, eventBus, toolName, onPdfClick }) {
  const pdfContainer = document.querySelector(".pdf-container");

  let originalCursor = "";
  let clickHandler = null;

  if (pdfContainer) {
    originalCursor = pdfContainer.style.cursor || "default";
    pdfContainer.style.cursor = "crosshair";

    clickHandler = (e) => onPdfClick(e);
    pdfContainer.addEventListener("click", clickHandler);
  }

  try {
    eventBus.emitGlobal(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPEN_REQUESTED, { sidebarId: "annotation" });
    logger.info("Requested opening annotation sidebar on comment tool activation");
  } catch (e) {
    logger.warn("Failed to request sidebar open on activation", e);
  }

  eventBus.emit(
    PDF_VIEWER_EVENTS.ANNOTATION.TOOL.ACTIVATED,
    { tool: toolName },
    { actorId: "CommentTool" }
  );

  return { originalCursor, clickHandler };
}

export function deactivateCommentTool({ logger, eventBus, toolName, commentInput, originalCursor, clickHandler }) {
  const pdfContainer = document.querySelector(".pdf-container");

  if (pdfContainer) {
    pdfContainer.style.cursor = originalCursor;
  }

  if (clickHandler && pdfContainer) {
    pdfContainer.removeEventListener("click", clickHandler);
  }

  if (commentInput && commentInput.isVisible()) {
    commentInput.hide();
  }

  eventBus.emit(
    PDF_VIEWER_EVENTS.ANNOTATION.TOOL.DEACTIVATED,
    { tool: toolName },
    { actorId: "CommentTool" }
  );

  logger.info("CommentTool deactivated");
}

export function handleCommentToolPdfClick({
  e,
  logger,
  commentInput,
  getCurrentPageNumber,
  onCreateComment
}) {
  if (commentInput.isVisible()) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  const pageElement = e.target.closest(".page");
  if (!pageElement) {
    logger.warn("Click target is not within a .page element, ignoring");
    return;
  }

  const pageNumber = parseInt(pageElement.dataset.pageNumber) || getCurrentPageNumber();

  const pageRect = pageElement.getBoundingClientRect();
  const x = e.clientX - pageRect.left;
  const y = e.clientY - pageRect.top;

  const displayX = e.clientX;
  const displayY = e.clientY;

  logger.info(`PDF clicked at (${x}, ${y}) on page ${pageNumber}`);

  commentInput.show({
    x: displayX,
    y: displayY,
    pageNumber,
    onConfirm: (content) => onCreateComment(x, y, pageNumber, pageRect.width, pageRect.height, content),
    onCancel: () => {
      logger.info("Comment creation cancelled");
    }
  });
}

export function handleCommentToolMarkerClick({ annotationId, logger, eventBus, commentMarker }) {
  logger.info(`Comment marker clicked: ${annotationId}`);

  commentMarker.highlightMarker(annotationId);

  try {
    eventBus.emitGlobal(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPEN_REQUESTED, { sidebarId: "annotation" });
    logger.info("Requested opening annotation sidebar on marker click");
  } catch (e) {
    logger.warn("Failed to request sidebar open on marker click", e);
  }

  eventBus.emit(
    PDF_VIEWER_EVENTS.ANNOTATION.SELECT,
    { id: annotationId },
    { actorId: "CommentTool" }
  );
}

