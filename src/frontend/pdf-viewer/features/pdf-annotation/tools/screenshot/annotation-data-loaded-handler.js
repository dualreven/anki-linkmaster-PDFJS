import { AnnotationType } from "../../../../../common/models/annotation.js";

/**
 * 构建 ScreenshotTool 的 ANNOTATION.DATA.LOADED 处理器（从 screenshot/index.js 抽离）
 * @param {Object} deps
 * @param {Object} deps.markerRenderer
 * @param {import('./marker-queue.js').ScreenshotMarkerQueue} deps.markerQueue
 * @param {(annotationId:string)=>void} deps.removeMarker
 * @param {(step:string,message:string,data?:Object,toastType?:any,toastMs?:number)=>void} deps.logStep
 * @param {Object} deps.logger
 * @returns {(data:{annotations?:Object[]})=>void}
 */
export function createScreenshotAnnotationsLoadedHandler({ markerRenderer, markerQueue, removeMarker, logStep, logger }) {
  if (!markerQueue) {
    throw new Error("[ScreenshotToolLoadedHandler] markerQueue is required");
  }
  if (typeof removeMarker !== "function") {
    throw new Error("[ScreenshotToolLoadedHandler] removeMarker must be a function");
  }
  if (typeof logStep !== "function") {
    throw new Error("[ScreenshotToolLoadedHandler] logStep must be a function");
  }
  if (!logger) {
    throw new Error("[ScreenshotToolLoadedHandler] logger is required");
  }

  return (data) => {
    try {
      const annotations = Array.isArray(data?.annotations) ? data.annotations : [];
      const screenshotAnnotations = annotations.filter((ann) => ann?.type === AnnotationType.SCREENSHOT);
      const validIds = new Set(screenshotAnnotations.map((ann) => ann.id));
      logStep("02", "ANNOTATION.DATA.LOADED received", {
        total: annotations.length,
        screenshots: screenshotAnnotations.length
      }, "info", 1800);

      const renderedIds = markerRenderer?.getRenderedIds?.() || [];
      renderedIds.forEach((annotationId) => {
        if (!validIds.has(annotationId)) {
          logStep("02.1", "Removing stale marker (not in loaded list)", { annotationId });
          removeMarker(annotationId);
        }
      });

      screenshotAnnotations.forEach((annotation) => {
        logStep("02.2", "Schedule render (enqueue or immediate)", {
          id: annotation.id,
          page: annotation.pageNumber
        });
        markerQueue.enqueueOrRender(annotation);
      });
    } catch (error) {
      logger.error("[ScreenshotTool] Failed to hydrate screenshot markers from annotation list", error);
    }
  };
}

