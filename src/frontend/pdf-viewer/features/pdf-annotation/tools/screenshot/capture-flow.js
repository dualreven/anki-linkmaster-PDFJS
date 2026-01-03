import { Annotation, AnnotationType } from "../../../../../common/models/annotation.js";
import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";

/**
 * ScreenshotTool 截图捕获与保存流程（从 screenshot/index.js 抽离）
 */
export class ScreenshotCaptureFlow {
  #pdfViewerManager;
  #capturer;
  #qwebChannelBridge;
  #eventBus;
  #logger;
  #defaultMarkerColor;
  #showPreviewDialog;

  constructor({
    pdfViewerManager,
    capturer,
    qwebChannelBridge,
    eventBus,
    logger,
    defaultMarkerColor,
    showPreviewDialog
  }) {
    if (!pdfViewerManager) {
      throw new Error("[ScreenshotCaptureFlow] pdfViewerManager is required");
    }
    if (!capturer) {
      throw new Error("[ScreenshotCaptureFlow] capturer is required");
    }
    if (!qwebChannelBridge) {
      throw new Error("[ScreenshotCaptureFlow] qwebChannelBridge is required");
    }
    if (!eventBus) {
      throw new Error("[ScreenshotCaptureFlow] eventBus is required");
    }
    if (!logger) {
      throw new Error("[ScreenshotCaptureFlow] logger is required");
    }
    if (typeof defaultMarkerColor !== "string" || !defaultMarkerColor.trim()) {
      throw new Error("[ScreenshotCaptureFlow] defaultMarkerColor must be a non-empty string");
    }
    if (typeof showPreviewDialog !== "function") {
      throw new Error("[ScreenshotCaptureFlow] showPreviewDialog must be a function");
    }

    this.#pdfViewerManager = pdfViewerManager;
    this.#capturer = capturer;
    this.#qwebChannelBridge = qwebChannelBridge;
    this.#eventBus = eventBus;
    this.#logger = logger;
    this.#defaultMarkerColor = defaultMarkerColor;
    this.#showPreviewDialog = showPreviewDialog;
  }

  async captureAndSave(viewportRect) {
    try {
      const pageNumber = this.#getCurrentPageNumber();

      this.#logger.info(`[ScreenshotTool] Capturing screenshot at page ${pageNumber}`, viewportRect);

      const canvasRect = this.#convertViewportToCanvasRect(pageNumber, viewportRect);
      if (!canvasRect) {
        throw new Error("Failed to convert viewport coordinates to canvas coordinates");
      }

      this.#logger.info("[ScreenshotTool] Converted to canvas coordinates", canvasRect);

      const base64Image = await this.#capturer.capture(pageNumber, canvasRect);
      this.#logger.info("[ScreenshotTool] base64Image captured, length:", base64Image?.length);

      this.#logger.info("[ScreenshotTool] Showing preview dialog...");
      const description = await this.#showPreviewDialog(base64Image);
      this.#logger.info("[ScreenshotTool] Preview dialog closed, description:", description);

      if (description === null) {
        this.#logger.info("[ScreenshotTool] User cancelled");
        return;
      }

      this.#logger.info("[ScreenshotTool] Calling saveImageToPyQt...");
      const saveResult = await this.#qwebChannelBridge.saveScreenshot(base64Image);
      this.#logger.info("[ScreenshotTool] saveImageToPyQt returned:", saveResult);

      if (!saveResult.success) {
        throw new Error(saveResult.error || "Failed to save image");
      }

      this.#logger.info("[ScreenshotTool] Image saved", saveResult);

      const percentRect = this.#convertCanvasToPercent(pageNumber, canvasRect);
      if (!percentRect) {
        throw new Error("Failed to convert canvas coordinates to percentage");
      }

      const annotation = new Annotation({
        type: AnnotationType.SCREENSHOT,
        pageNumber,
        data: {
          rectPercent: percentRect,
          markerColor: this.#defaultMarkerColor,
          imagePath: saveResult.path,
          imageHash: saveResult.hash,
          imageData: base64Image,
          description
        }
      });

      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.CREATED, { annotation });
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.CREATE, {
        annotation: annotation.toJSON()
      });

      this.#logger.info("[ScreenshotTool] Annotation created (optimistic UI + persistence requested)", annotation);
    } catch (error) {
      this.#logger.error("[ScreenshotTool] Capture failed:", error);
      this.#logger.error("[ScreenshotTool] Error details:", {
        message: error.message,
        stack: error.stack
      });

      this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.NOTIFICATION.ERROR.TRIGGERED, {
        message: "截图失败: " + error.message
      });
    }
  }

  #getCurrentPageNumber() {
    return this.#pdfViewerManager?.currentPageNumber || 1;
  }

  #convertCanvasToPercent(pageNumber, canvasRect) {
    try {
      const pageView = this.#pdfViewerManager.getPageView(pageNumber);
      if (!pageView) {
        this.#logger.error(`[ScreenshotTool] Cannot find PageView for page ${pageNumber}`);
        return null;
      }

      const canvas = pageView.div?.querySelector("canvas");
      if (!canvas) {
        this.#logger.error(`[ScreenshotTool] Cannot find canvas for page ${pageNumber}`);
        return null;
      }

      const percentRect = {
        xPercent: (canvasRect.x / canvas.width) * 100,
        yPercent: (canvasRect.y / canvas.height) * 100,
        widthPercent: (canvasRect.width / canvas.width) * 100,
        heightPercent: (canvasRect.height / canvas.height) * 100
      };

      this.#logger.info("[ScreenshotTool] Canvas to Percent conversion:", {
        canvas: canvasRect,
        canvasSize: { width: canvas.width, height: canvas.height },
        percent: percentRect
      });

      return percentRect;
    } catch (error) {
      this.#logger.error("[ScreenshotTool] Canvas to Percent conversion failed:", error);
      return null;
    }
  }

  #convertViewportToCanvasRect(pageNumber, viewportRect) {
    try {
      const pageView = this.#pdfViewerManager.getPageView(pageNumber);
      if (!pageView) {
        this.#logger.error(`[ScreenshotTool] Cannot find PageView for page ${pageNumber}`);
        return null;
      }

      const pageDiv = pageView.div;
      if (!pageDiv) {
        this.#logger.error(`[ScreenshotTool] Cannot find page div for page ${pageNumber}`);
        return null;
      }

      const pageBounds = pageDiv.getBoundingClientRect();
      const relativeX = viewportRect.x - pageBounds.left;
      const relativeY = viewportRect.y - pageBounds.top;

      const canvas = pageDiv.querySelector("canvas");
      if (!canvas) {
        this.#logger.error(`[ScreenshotTool] Cannot find canvas for page ${pageNumber}`);
        return null;
      }

      const scaleX = canvas.width / pageBounds.width;
      const scaleY = canvas.height / pageBounds.height;

      const canvasRect = {
        x: Math.round(relativeX * scaleX),
        y: Math.round(relativeY * scaleY),
        width: Math.round(viewportRect.width * scaleX),
        height: Math.round(viewportRect.height * scaleY)
      };

      this.#logger.info("[ScreenshotTool] Coordinate conversion:", {
        viewport: viewportRect,
        pageBounds: { left: pageBounds.left, top: pageBounds.top, width: pageBounds.width, height: pageBounds.height },
        canvasSize: { width: canvas.width, height: canvas.height },
        scale: { x: scaleX, y: scaleY },
        canvas: canvasRect
      });

      return canvasRect;
    } catch (error) {
      this.#logger.error("[ScreenshotTool] Coordinate conversion failed:", error);
      return null;
    }
  }
}

