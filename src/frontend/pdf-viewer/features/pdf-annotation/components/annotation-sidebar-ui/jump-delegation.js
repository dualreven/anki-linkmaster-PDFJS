import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";

/**
 * 统一为侧边栏中的卡片绑定跳转点击（事件委托）
 * @param {Object} params
 * @param {HTMLElement} params.root
 * @param {Object} params.logger
 * @param {Object} params.eventBus
 * @param {(annotationId:string)=>any|null} params.getAnnotationById
 * @param {(annotationId:string)=>void} params.highlightAndScrollToCard
 * @returns {()=>void} cleanup
 */
export function installAnnotationJumpDelegation({
  root,
  logger,
  eventBus,
  getAnnotationById,
  highlightAndScrollToCard,
}) {
  const onClick = (evt) => {
    try {
      const target = /** @type {HTMLElement} */ (evt.target);
      const jumpBtn = target?.closest ? target.closest(".jump-btn") : null;
      if (!jumpBtn) {
        return;
      }

      const annId = jumpBtn.getAttribute("data-annotation-id") || jumpBtn.dataset.annotationId;
      if (!annId) {
        logger.error(
          "[AnnotationSidebarUI] 跳转按钮缺少 data-annotation-id",
          { btn: jumpBtn },
          { toast: { type: "error", ms: 4000 } }
        );
        return;
      }

      const annotationId = String(annId);
      const ann = getAnnotationById(annotationId);
      if (!ann) {
        logger.error(`[AnnotationSidebarUI] 未找到标注，无法跳转 id=${annotationId}`, null, {
          toast: { type: "error", ms: 4000 },
        });
        return;
      }

      eventBus.emitGlobal(
        PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED,
        { annotation: ann },
        { actorId: "AnnotationSidebarUI" }
      );

      try {
        eventBus.emitGlobal(
          PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_SUCCESS,
          { annotation: ann },
          { actorId: "AnnotationSidebarUI" }
        );
      } catch (e) {
        void e; /* logger-guard */
      }

      try {
        highlightAndScrollToCard(ann.id);
      } catch (e) {
        void e; /* logger-guard */
      }

      logger.info(
        `[AnnotationSidebarUI] Jump requested (strict): id=${ann.id} page=${ann.pageNumber}`
      );
    } catch (e) {
      try {
        logger.error("Card jump handler failed", e, { toast: { type: "error", ms: 4000 } });
      } catch (e2) {
        void e2;
      }
    }
  };

  root.addEventListener("click", onClick);
  return () => {
    root.removeEventListener("click", onClick);
  };
}

