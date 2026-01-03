import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";
import { AnnotationType } from "../../../../../common/models/annotation.js";

/**
 * 安装 ScreenshotTool 相关的标注事件订阅（从 screenshot/index.js 抽离）
 * @param {Object} deps
 * @param {Object} deps.eventBus
 * @param {Object} deps.logger
 * @param {(annotation:Object)=>void} deps.renderMarker
 * @param {(annotationId:string)=>void} deps.removeMarker
 * @returns {{ uninstall: ()=>void }}
 */
export function installScreenshotAnnotationEventHandlers({ eventBus, logger, renderMarker, removeMarker }) {
  if (!eventBus) {
    throw new Error("[ScreenshotToolEvents] eventBus is required");
  }
  if (typeof eventBus.on !== "function") {
    throw new Error("[ScreenshotToolEvents] eventBus.on must be a function");
  }
  if (!logger) {
    throw new Error("[ScreenshotToolEvents] logger is required");
  }
  if (typeof renderMarker !== "function") {
    throw new Error("[ScreenshotToolEvents] renderMarker must be a function");
  }
  if (typeof removeMarker !== "function") {
    throw new Error("[ScreenshotToolEvents] removeMarker must be a function");
  }

  const unsubscribers = [];
  const track = (maybeUnsub) => {
    if (typeof maybeUnsub === "function") {
      unsubscribers.push(maybeUnsub);
    }
  };

  // 监听标注跳转成功事件
  track(eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_SUCCESS, ({ annotation }) => {
    logger.info("[ScreenshotTool] ===== Jump success event received =====");
    logger.info("[ScreenshotTool] Annotation type:", annotation?.type);

    if (annotation && annotation.type === AnnotationType.SCREENSHOT) {
      logger.info("[ScreenshotTool] This is a screenshot annotation, rendering marker...");
      setTimeout(() => {
        renderMarker(annotation);
      }, 300);
    }
  }));

  // 监听标注创建成功事件（初次截图完成后立即显示标记框）
  track(eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.CREATED, ({ annotation }) => {
    if (annotation && annotation.type === AnnotationType.SCREENSHOT) {
      logger.info("[ScreenshotTool] Screenshot annotation created, rendering marker immediately");
      setTimeout(() => {
        renderMarker(annotation);
      }, 100);
    }
  }));

  // 监听标注删除成功事件（自动移除标记框）
  track(eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.DELETED, ({ id }) => {
    logger.info(`[ScreenshotTool] Annotation deleted, removing marker: ${id}`);
    removeMarker(id);
  }));

  logger.info("[ScreenshotTool] Annotation event listeners registered");

  return {
    uninstall: () => {
      unsubscribers.forEach((fn) => {
        try { fn(); } catch (e) { void e; /* logger-guard */ }
      });
      unsubscribers.length = 0;
    }
  };
}
