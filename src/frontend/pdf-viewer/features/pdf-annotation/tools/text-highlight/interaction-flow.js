import { Annotation } from "../../../../../common/models/annotation.js";
import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";

/**
 * @param {{
 *  isActive: boolean,
 *  selectionHandler: any,
 *  eventBus: any,
 *  logger: any,
 *  toolName: string,
 * }} ctx
 * @returns {boolean}
 */
export function activateTextHighlightTool(ctx) {
  const { isActive, selectionHandler, eventBus, logger, toolName } = ctx;
  if (isActive) {
    logger?.warn?.("[TextHighlightTool] Already active");
    return true;
  }

  selectionHandler.startListening();

  const viewerContainer = document.getElementById("viewerContainer");
  if (viewerContainer) {
    viewerContainer.style.cursor = "text";
  }

  logger?.info?.("[TextHighlightTool] Activated");
  eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.ACTIVATED, { tool: toolName });
  return true;
}

/**
 * @param {{
 *  isActive: boolean,
 *  selectionHandler: any,
 *  eventBus: any,
 *  logger: any,
 *  toolName: string,
 * }} ctx
 * @returns {boolean}
 */
export function deactivateTextHighlightTool(ctx) {
  const { isActive, selectionHandler, eventBus, logger, toolName } = ctx;
  if (!isActive) {
    return false;
  }

  selectionHandler.stopListening();

  const viewerContainer = document.getElementById("viewerContainer");
  if (viewerContainer) {
    viewerContainer.style.cursor = "default";
  }

  window.getSelection()?.removeAllRanges();

  logger?.info?.("[TextHighlightTool] Deactivated");
  eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.DEACTIVATED, { tool: toolName });
  return false;
}

/**
 * @param {{
 *  isActive: boolean,
 *  logger: any,
 *  floatingToolbar: any,
 *  data: any,
 * }} ctx
 * @returns {any|null}
 */
export function handleTextSelectionCompleted(ctx) {
  const { isActive, logger, floatingToolbar, data } = ctx;
  if (!isActive) {
    return null;
  }

  const { text, pageNumber, ranges, rect, range, lineRects } = data;

  logger?.info?.("[TextHighlightTool] Text selected", {
    text: text.substring(0, 50) + "...",
    pageNumber,
    rangesCount: ranges.length
  });

  const pendingSelection = { text, pageNumber, ranges, rect, lineRects };

  const viewportRect = range.getBoundingClientRect();
  floatingToolbar.show(viewportRect);

  logger?.debug?.("[TextHighlightTool] Floating toolbar shown at", viewportRect);
  return pendingSelection;
}

/**
 * @param {{
 *  pendingSelection: any|null,
 *  color: string,
 *  eventBus: any,
 *  logger: any,
 * }} ctx
 * @returns {null}
 */
export function handleColorSelected(ctx) {
  const { pendingSelection, color, eventBus, logger } = ctx;
  if (!pendingSelection) {
    logger?.warn?.("[TextHighlightTool] No pending selection");
    return null;
  }

  const { text, pageNumber, ranges, rect, lineRects } = pendingSelection;
  logger?.info?.("[TextHighlightTool] Color selected", { color });

  try {
    const annotationData = {
      selectedText: text,
      highlightColor: color,
      textRanges: ranges,
      boundingBox: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      }
    };

    if (Array.isArray(lineRects) && lineRects.length > 0) {
      annotationData.lineRects = lineRects;
    }

    const annotation = new Annotation({
      type: "text-highlight",
      pageNumber,
      data: annotationData
    });

    eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.CREATE, { annotation });

    logger?.info?.("[TextHighlightTool] Annotation created", {
      id: annotation.id,
      type: annotation.type,
      pageNumber: annotation.pageNumber
    });
  } catch (error) {
    logger?.error?.("[TextHighlightTool] Error creating annotation", error);
  } finally {
    window.getSelection()?.removeAllRanges();
  }

  return null;
}

/**
 * @param {{ logger: any }} ctx
 * @returns {null}
 */
export function handleColorSelectionCancelled(ctx) {
  const { logger } = ctx;
  logger?.info?.("[TextHighlightTool] Color selection cancelled");
  window.getSelection()?.removeAllRanges();
  return null;
}

