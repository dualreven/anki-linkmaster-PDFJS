import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { getCenterPercentFromRect } from "./utils/position-utils.js";
import { centerTextHighlightViaDom } from "./utils/text-highlight-dom-centering.js";

export async function handleNavigateToAnnotation({
  data,
  annotationManager,
  eventBus,
  navigationService,
  logger,
  highlightAnnotationMarker,
}) {
  try {
    let annotation = null;

    if (data.annotation) {
      if (typeof data.annotation === "object") {
        annotation = data.annotation;
      } else if (typeof data.annotation === "string") {
        annotation = annotationManager.getAnnotation(data.annotation);
      }
    } else if (data.id) {
      annotation = annotationManager.getAnnotation(data.id);
    }

    if (!annotation) {
      logger.warn("[AnnotationFeature] Annotation not found for navigation", data, { toast: { type: "warn", ms: 4000 } });
      logger.error("标注不存在或未加载，无法跳转", { toast: { type: "error", ms: 5000 } });
      eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_FAILED, {
        error: "not_found",
        id: data?.annotation || data?.id,
      }, { actorId: "AnnotationFeature" });
      return;
    }

    try {
      eventBus.emitGlobal(
        PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPEN_REQUESTED,
        { sidebarId: "annotation" },
        { actorId: "AnnotationFeature" },
      );
    } catch (e) {
      logger.warn("[AnnotationFeature] 无法发出标注侧边栏打开请求（非致命）", e);
    }

    let pageNumber = annotation.pageNumber;
    try {
      if (annotation.type === "text-highlight" && annotation.id) {
        const el = document.querySelector(`.text-highlight-container[data-annotation-id="${annotation.id}"]`);
        const pageEl = el?.closest?.(".page");
        const numAttr = pageEl?.getAttribute?.("data-page-number");
        const pn = numAttr ? parseInt(numAttr, 10) : NaN;
        if (Number.isInteger(pn) && pn > 0) {
          pageNumber = pn;
          logger.info(`[AnnotationFeature] Page resolved from DOM for ${annotation.id}: ${pageNumber}`);
        }
      }
    } catch (e) { void e; }

    if (!pageNumber) {
      logger.warn("[AnnotationFeature] Annotation has no page number", annotation, { toast: { type: "warn", ms: 4000 } });
      logger.error("标注缺少页码信息，无法跳转", { toast: { type: "error", ms: 5000 } });
      eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_FAILED, {
        error: "missing_page_number",
        id: annotation?.id,
      }, { actorId: "AnnotationFeature" });
      return;
    }

    logger.info(`[AnnotationFeature] Navigating to annotation on page ${pageNumber}`, annotation.id);

    let position = null;
    if (annotation.type === "screenshot" && annotation.data?.rectPercent) {
      const centerPercent = getCenterPercentFromRect(annotation.data.rectPercent);
      if (centerPercent !== null) {
        position = centerPercent;
        logger.info(`[AnnotationFeature] Calculated position from rectPercent: ${centerPercent.toFixed(2)}%`);
      }
    }

    if (
      position === null
      && annotation.type === "text-highlight"
      && Array.isArray(annotation.data?.lineRects)
      && annotation.data.lineRects.length > 0
    ) {
      try {
        const r0 = annotation.data.lineRects[0];
        if (typeof r0?.yPercent === "number" && typeof r0?.heightPercent === "number") {
          const center = Number((r0.yPercent + (r0.heightPercent / 2)).toFixed(6));
          if (Number.isFinite(center)) {
            position = Math.max(0, Math.min(100, center));
            logger.info(`[AnnotationFeature] Calculated position from lineRects: ${position.toFixed(2)}%`);
          }
        }
      } catch (e) { void e; }
    }

    if (position === null && annotation.type === "comment" && annotation.data && annotation.data.positionPercent) {
      const yp = Number(annotation.data.positionPercent.yPercent);
      if (Number.isFinite(yp)) {
        position = Math.max(0, Math.min(100, yp));
        logger.info(`[AnnotationFeature] Using comment positionPercent: ${position.toFixed(2)}%`);
      }
    }

    if (position === null && annotation.data && annotation.data.position) {
      const annotationPosition = annotation.data.position;

      await navigationService.navigateTo({
        pageAt: pageNumber,
        position: null,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const viewerContainer = document.getElementById("viewerContainer");
      if (viewerContainer) {
        const pageElement = viewerContainer.querySelector(`.page[data-page-number="${pageNumber}"]`);
        if (pageElement) {
          const pageHeight = pageElement.offsetHeight;
          position = (annotationPosition.y / pageHeight) * 100;
          logger.info(`[AnnotationFeature] Calculated position: ${position.toFixed(2)}% (y=${annotationPosition.y}, pageHeight=${pageHeight})`);
        } else {
          logger.warn(`[AnnotationFeature] Page element not found for page ${pageNumber}`);
        }
      }
    }

    if (position === null && annotation.data && annotation.data.boundingBox) {
      const boundingBox = annotation.data.boundingBox;

      await navigationService.navigateTo({
        pageAt: pageNumber,
        position: null,
      });

      const viewerContainer = document.getElementById("viewerContainer");
      if (viewerContainer) {
        const pageElement = viewerContainer.querySelector(`.page[data-page-number="${pageNumber}"]`);
        if (pageElement) {
          const pageHeight = pageElement.offsetHeight;
          const topPx = (typeof boundingBox.top === "number") ? boundingBox.top : (boundingBox.y || 0);
          const hPx = (typeof boundingBox.height === "number") ? boundingBox.height : 0;
          position = ((topPx + (hPx / 2)) / pageHeight) * 100;
          logger.info(`[AnnotationFeature] Calculated position from boundingBox: ${position.toFixed(2)}%`);
        }
      }
    }

    try {
      if (!navigationService) {
        throw new Error("navigationService not available");
      }
      const needDomCentering =
        annotation?.type === "text-highlight"
        && !(position !== null && Number.isFinite(position));

      await navigationService.navigateTo({
        pageAt: pageNumber,
        position: (position !== null && Number.isFinite(position)) ? position : null,
        scroll: !needDomCentering,
      });

      try {
        if (typeof highlightAnnotationMarker === "function") {
          highlightAnnotationMarker(annotation?.id);
        }
      } catch (e) {
        logger?.warn?.("highlight marker failed", e);
      }

      if (needDomCentering) {
        try {
          await centerTextHighlightViaDom({
            annotationId: annotation.id,
            pageNumber,
            navigationService,
            timeoutMs: 1200,
          });
        } catch (e) {
          logger?.warn?.("[AnnotationFeature] text-highlight dom centering failed", e);
        }
      }
    } catch (emitErr) {
      logger.warn("[AnnotationFeature] Failed to navigate via NavigationService for annotation jump", emitErr);
      throw emitErr;
    }
  } catch (error) {
    logger.error("[AnnotationFeature] Error navigating to annotation:", error);
    eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_FAILED, {
      error: error.message,
    });
  }
}

