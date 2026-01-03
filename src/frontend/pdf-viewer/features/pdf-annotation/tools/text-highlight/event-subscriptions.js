import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";

/**
 * Install TextHighlightTool subscriptions and return uninstall().
 * @param {{
 *  eventBus: any,
 *  pdfjsEventBus: any,
 *  pdfViewerManager: any,
 *  logger: any,
 *  handlers: {
 *    onTextSelectionCompleted: Function,
 *    onAnnotationCreated: Function,
 *    onAnnotationUpdated: Function,
 *    onAnnotationDeleted: Function,
 *    onAnnotationDataLoaded: Function,
 *  },
 *  overlayController: any,
 * }} ctx
 */
export function installTextHighlightSubscriptions(ctx) {
  const {
    eventBus,
    pdfjsEventBus,
    pdfViewerManager,
    logger,
    handlers,
    overlayController,
    highlightRenderer,
  } = ctx;

  const unsubs = [];
  const safeUnsubPush = (maybeUnsub) => {
    if (typeof maybeUnsub === "function") {
      unsubs.push(maybeUnsub);
    }
  };

  safeUnsubPush(eventBus.on(
    PDF_VIEWER_EVENTS.ANNOTATION.TEXT_HIGHLIGHT.TEXT_SELECTED,
    handlers.onTextSelectionCompleted,
    { subscriberId: "TextHighlightTool::TEXT_SELECTED" }
  ));
  safeUnsubPush(eventBus.on(
    PDF_VIEWER_EVENTS.ANNOTATION.CREATED,
    handlers.onAnnotationCreated,
    { subscriberId: "TextHighlightTool::ANNOTATION_CREATED" }
  ));
  safeUnsubPush(eventBus.on(
    PDF_VIEWER_EVENTS.ANNOTATION.UPDATED,
    handlers.onAnnotationUpdated,
    { subscriberId: "TextHighlightTool::ANNOTATION_UPDATED" }
  ));
  safeUnsubPush(eventBus.on(
    PDF_VIEWER_EVENTS.ANNOTATION.DELETED,
    handlers.onAnnotationDeleted,
    { subscriberId: "TextHighlightTool::ANNOTATION_DELETED" }
  ));
  safeUnsubPush(eventBus.on(
    PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED,
    handlers.onAnnotationDataLoaded,
    { subscriberId: "TextHighlightTool::ANNOTATION_DATA_LOADED" }
  ));

  // 统一事件信号：应用级 RENDER.PAGE_COMPLETED（由 PDFViewerManager 桥接）
  try {
    safeUnsubPush(eventBus.onGlobal(
      PDF_VIEWER_EVENTS.RENDER.PAGE_COMPLETED,
      (data) => {
        const pn = Number(data?.pageNumber || 0);
        if (!pn) {
          return;
        }
        overlayController.restoreHighlightsForPage(pn);
        overlayController.flushPendingHighlightsForPage(pn);
      },
      { subscriberId: "TextHighlightTool::APP_PAGE_COMPLETED" }
    ));
  } catch (e) {
    logger?.warn?.("[TextHighlightTool] install onGlobal(PAGE_COMPLETED) failed", e);
  }

  // 跳转成功后，若为高亮标注则确保渲染
  safeUnsubPush(eventBus.on(
    PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_SUCCESS,
    ({ annotation }) => {
      try {
        if (!annotation || annotation.type !== "text-highlight") {
          return;
        }
        setTimeout(() => overlayController.renderHighlightForAnnotation(annotation), 120);
      } catch (e) {
        logger?.warn?.("[TextHighlightTool] ensure render on jump failed", e);
      }
    },
    { subscriberId: "TextHighlightTool::JUMP_SUCCESS" }
  ));

  // 页面渲染完成后恢复该页的高亮（确保跳转或翻页后可见）
  if (pdfjsEventBus && typeof pdfjsEventBus.on === "function") {
    const onPageRendered = (evt) => {
      try {
        const pn = evt?.pageNumber;
        if (!pn) {
          return;
        }
        overlayController.restoreHighlightsForPage(pn);
        overlayController.flushPendingHighlightsForPage(pn);
      } catch (e) {
        logger?.warn?.("[TextHighlightTool] restore on pagerendered failed", e);
      }
    };

    const onTextLayerRendered = (evt) => {
      try {
        const pn = evt?.pageNumber;
        if (!pn) {
          return;
        }
        overlayController.restoreHighlightsForPage(pn);
        overlayController.flushPendingHighlightsForPage(pn);
      } catch (e) {
        logger?.warn?.("[TextHighlightTool] restore on textlayerrendered failed", e);
      }
    };

    const onScaleChanging = () => {
      try {
        // 只清DOM，高亮记录保留；重建时会检测容器有效性并重画
        highlightRenderer?.clearAllHighlights?.();
      } catch (e) {
        logger?.debug?.("[TextHighlightTool] scalechanging clear failed", e);
      }
    };

    const onScaleChanged = () => {
      try {
        const pn = Number(pdfViewerManager?.currentPageNumber || 0);
        if (pn) {
          overlayController.restoreHighlightsForPage(pn);
          overlayController.flushPendingHighlightsForPage(pn);
        }
      } catch (e) {
        logger?.debug?.("[TextHighlightTool] scalechanged restore failed", e);
      }
    };

    let needOffPageRendered = false;
    let needOffTextLayerRendered = false;
    let needOffScaleChanging = false;
    let needOffScaleChanged = false;

    try {
      const maybeUnsub = pdfjsEventBus.on(PDF_VIEWER_EVENTS.PDFJS_EVENTS.PAGE.RENDERED, onPageRendered);
      safeUnsubPush(maybeUnsub);
      if (typeof maybeUnsub !== "function" && typeof pdfjsEventBus.off === "function") {
        needOffPageRendered = true;
      }
    } catch (e) {
      logger?.warn?.("[TextHighlightTool] pdfjsEventBus.on(pagerendered) failed", e);
    }

    try {
      const maybeUnsub = pdfjsEventBus.on(PDF_VIEWER_EVENTS.PDFJS_EVENTS.PAGE.TEXT_LAYER_RENDERED, onTextLayerRendered);
      safeUnsubPush(maybeUnsub);
      if (typeof maybeUnsub !== "function" && typeof pdfjsEventBus.off === "function") {
        needOffTextLayerRendered = true;
      }
    } catch (e) {
      logger?.warn?.("[TextHighlightTool] pdfjsEventBus.on(textlayerrendered) failed", e);
    }

    try {
      const maybeUnsub = pdfjsEventBus.on(PDF_VIEWER_EVENTS.PDFJS_EVENTS.SCALE.CHANGING, onScaleChanging);
      safeUnsubPush(maybeUnsub);
      if (typeof maybeUnsub !== "function" && typeof pdfjsEventBus.off === "function") {
        needOffScaleChanging = true;
      }
    } catch (e) {
      logger?.debug?.("[TextHighlightTool] pdfjsEventBus.on(scalechanging) failed", e);
    }

    try {
      const maybeUnsub = pdfjsEventBus.on(PDF_VIEWER_EVENTS.PDFJS_EVENTS.SCALE.CHANGED, onScaleChanged);
      safeUnsubPush(maybeUnsub);
      if (typeof maybeUnsub !== "function" && typeof pdfjsEventBus.off === "function") {
        needOffScaleChanged = true;
      }
    } catch (e) {
      logger?.debug?.("[TextHighlightTool] pdfjsEventBus.on(scalechanged) failed", e);
    }

    unsubs.push(() => {
      if (typeof pdfjsEventBus.off !== "function") {
        return;
      }
      if (needOffPageRendered) {
        try { pdfjsEventBus.off(PDF_VIEWER_EVENTS.PDFJS_EVENTS.PAGE.RENDERED, onPageRendered); } catch (e) { logger?.debug?.("[TextHighlightTool] pdfjsEventBus.off(pagerendered) failed", e); }
      }
      if (needOffTextLayerRendered) {
        try { pdfjsEventBus.off(PDF_VIEWER_EVENTS.PDFJS_EVENTS.PAGE.TEXT_LAYER_RENDERED, onTextLayerRendered); } catch (e) { logger?.debug?.("[TextHighlightTool] pdfjsEventBus.off(textlayerrendered) failed", e); }
      }
      if (needOffScaleChanging) {
        try { pdfjsEventBus.off(PDF_VIEWER_EVENTS.PDFJS_EVENTS.SCALE.CHANGING, onScaleChanging); } catch (e) { logger?.debug?.("[TextHighlightTool] pdfjsEventBus.off(scalechanging) failed", e); }
      }
      if (needOffScaleChanged) {
        try { pdfjsEventBus.off(PDF_VIEWER_EVENTS.PDFJS_EVENTS.SCALE.CHANGED, onScaleChanged); } catch (e) { logger?.debug?.("[TextHighlightTool] pdfjsEventBus.off(scalechanged) failed", e); }
      }
    });
  }

  return {
    uninstall() {
      unsubs.splice(0).forEach((fn) => {
        try { fn(); } catch (e) { logger?.debug?.("[TextHighlightTool] unsubscribe failed", e); }
      });
    }
  };
}
