import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";
import { AnnotationType } from "../../../../../common/models/annotation.js";
import { confirmDialogAsync } from "./ui-utils.js";

export class ScreenshotMarkerRenderer {
  #pdfViewerManager;
  #eventBus;
  #logger;
  #logStep;
  #markerColorPresets;
  #defaultMarkerColor;
  #onJumpToAnnotation;
  #renderedMarkers = new Map(); // annotationId -> markerElement

  constructor({
    pdfViewerManager,
    eventBus,
    logger,
    logStep,
    markerColorPresets,
    defaultMarkerColor,
    onJumpToAnnotation
  }) {
    if (!pdfViewerManager) {
      throw new Error("[ScreenshotMarkerRenderer] pdfViewerManager is required");
    }
    if (!eventBus) {
      throw new Error("[ScreenshotMarkerRenderer] eventBus is required");
    }
    if (!logger) {
      throw new Error("[ScreenshotMarkerRenderer] logger is required");
    }
    if (typeof logStep !== "function") {
      throw new Error("[ScreenshotMarkerRenderer] logStep must be a function");
    }
    if (!Array.isArray(markerColorPresets) || markerColorPresets.length === 0) {
      throw new Error("[ScreenshotMarkerRenderer] markerColorPresets must be a non-empty array");
    }
    if (typeof defaultMarkerColor !== "string" || !defaultMarkerColor.trim()) {
      throw new Error("[ScreenshotMarkerRenderer] defaultMarkerColor must be a non-empty string");
    }
    if (typeof onJumpToAnnotation !== "function") {
      throw new Error("[ScreenshotMarkerRenderer] onJumpToAnnotation must be a function");
    }

    this.#pdfViewerManager = pdfViewerManager;
    this.#eventBus = eventBus;
    this.#logger = logger;
    this.#logStep = logStep;
    this.#markerColorPresets = markerColorPresets;
    this.#defaultMarkerColor = defaultMarkerColor;
    this.#onJumpToAnnotation = onJumpToAnnotation;
  }

  render(annotation) {
    try {
      this.#logStep("05", "Render marker begin", { id: annotation?.id, page: annotation?.pageNumber }, "info", 1800);

      if (!annotation || annotation.type !== AnnotationType.SCREENSHOT) {
        return;
      }

      const existing = this.#renderedMarkers.get(annotation.id) || null;
      const { pageNumber, data } = annotation;
      let rectPercent = data?.rectPercent;

      const pageView = this.#pdfViewerManager.getPageView(pageNumber);
      if (!pageView || !pageView.div) {
        this.#logStep("05.1", "PageView not found", { page: pageNumber }, "warn", 2500);
        return;
      }
      const pageDiv = pageView.div;

      const pageBounds = pageDiv.getBoundingClientRect();
      const canvas = pageDiv.querySelector("canvas");
      const canvasBounds = canvas ? canvas.getBoundingClientRect() : pageBounds;
      const offsetLeft = canvasBounds.left - pageBounds.left;
      const offsetTop = canvasBounds.top - pageBounds.top;
      this.#logStep("06.1", "Bounds computed", {
        page: annotation.pageNumber,
        pageBounds: { w: pageBounds.width, h: pageBounds.height },
        canvasBounds: { w: canvasBounds.width, h: canvasBounds.height },
        offsetLeft, offsetTop
      });

      if (!rectPercent || typeof rectPercent !== "object") {
        const legacyRect = data?.rect;
        const isNum = (v) => typeof v === "number" && !Number.isNaN(v);
        const clamp01 = (v) => Math.max(0, Math.min(100, v));
        const toPercent = (v, total) => (total > 0 ? (v / total) * 100 : 0);

        if (legacyRect && typeof legacyRect === "object" &&
          isNum(legacyRect.left) && isNum(legacyRect.top) && isNum(legacyRect.width) && isNum(legacyRect.height)) {

          const fitsCanvas = legacyRect.left >= 0 && legacyRect.top >= 0 &&
            (legacyRect.left + legacyRect.width) <= (canvasBounds.width + 1) &&
            (legacyRect.top + legacyRect.height) <= (canvasBounds.height + 1);

          const x = fitsCanvas ? legacyRect.left : (legacyRect.left - offsetLeft);
          const y = fitsCanvas ? legacyRect.top : (legacyRect.top - offsetTop);

          rectPercent = {
            xPercent: clamp01(toPercent(x, canvasBounds.width)),
            yPercent: clamp01(toPercent(y, canvasBounds.height)),
            widthPercent: clamp01(toPercent(legacyRect.width, canvasBounds.width)),
            heightPercent: clamp01(toPercent(legacyRect.height, canvasBounds.height)),
          };
          data.rectPercent = rectPercent;
          this.#logStep("05.legacy", "Computed rectPercent from legacy rect", {
            id: annotation.id,
            fitsCanvas,
            rectPercent
          }, "info", 2200);
        }
      }

      if (!rectPercent || typeof rectPercent !== "object") {
        this.#logStep("05.x", "No rectPercent (and no usable rect) → give up render for this item", {
          id: annotation.id,
          keys: Object.keys(data || {})
        }, "warn", 3000);
        return;
      }

      const markerRect = {
        left: offsetLeft + (rectPercent.xPercent / 100) * canvasBounds.width,
        top: offsetTop + (rectPercent.yPercent / 100) * canvasBounds.height,
        width: (rectPercent.widthPercent / 100) * canvasBounds.width,
        height: (rectPercent.heightPercent / 100) * canvasBounds.height
      };
      this.#logStep("06.2", "MarkerRect computed", markerRect);

      const applyRectToMarker = (el) => {
        el.style.left = `${markerRect.left}px`;
        el.style.top = `${markerRect.top}px`;
        el.style.width = `${markerRect.width}px`;
        el.style.height = `${markerRect.height}px`;
      };

      if (existing) {
        const connected = !!existing.isConnected;
        const inSamePage = !!existing.closest && (existing.closest(".page") === pageDiv);
        if (connected && inSamePage) {
          this.#logStep("05.0u", "Already rendered → update in-place", { id: annotation.id, page: pageNumber });
          applyRectToMarker(existing);
          const initialColor = data.markerColor || this.#defaultMarkerColor;
          data.markerColor = initialColor;
          this.#applyMarkerColor(existing, initialColor);
          return;
        }
        try { existing.remove(); } catch (e) { void e; /* logger-guard */ }
        this.#renderedMarkers.delete(annotation.id);
        this.#logStep("05.0r", "Existing marker detached or wrong page → rebuild", { id: annotation.id, page: pageNumber });
      }

      const marker = document.createElement("div");
      marker.className = "screenshot-marker";
      marker.dataset.annotationId = annotation.id;
      marker.style.cssText = [
        "position: absolute",
        `left: ${markerRect.left}px`,
        `top: ${markerRect.top}px`,
        `width: ${markerRect.width}px`,
        `height: ${markerRect.height}px`,
        "pointer-events: none",
        "box-sizing: border-box",
        "z-index: 100",
        "transition: border-color 0.2s ease, background-color 0.2s ease"
      ].join(";");

      const initialColor = data.markerColor || this.#defaultMarkerColor;
      data.markerColor = initialColor;
      this.#applyMarkerColor(marker, initialColor);

      const baseCircleStyle = [
        "position: absolute",
        "top: -10px",
        "right: -10px",
        "width: 24px",
        "height: 24px",
        "border: 2px solid white",
        "border-radius: 50%",
        "cursor: pointer",
        "pointer-events: auto",
        "display: flex",
        "align-items: center",
        "justify-content: center",
        "font-size: 14px",
        "font-weight: bold",
        "transition: all 0.2s",
        "z-index: 12",
        "box-shadow: 0 2px 6px rgba(0,0,0,0.2)"
      ];

      const deleteBtn = document.createElement("div");
      deleteBtn.className = "screenshot-marker-delete";
      deleteBtn.style.cssText = baseCircleStyle.concat([
        "background: #f44336",
        "color: white"
      ]).join(";");
      deleteBtn.innerHTML = "×";
      deleteBtn.title = "删除此截图标注";

      const controlsContainer = document.createElement("div");
      controlsContainer.className = "screenshot-marker-controls";
      controlsContainer.style.cssText = [
        "position: absolute",
        "top: -10px",
        "right: 18px",
        "display: flex",
        "gap: 6px",
        "pointer-events: none",
        "opacity: 0",
        "transform: translateX(8px)",
        "transition: opacity 0.2s ease, transform 0.2s ease",
        "z-index: 11"
      ].join(";");

      const colorButtons = [];
      const updateActiveColorButton = (color) => {
        colorButtons.forEach((btn) => {
          if (btn.dataset.color === color) {
            btn.style.transform = "scale(1.1)";
            btn.style.boxShadow = "0 0 0 2px white, 0 2px 6px rgba(0,0,0,0.3)";
          } else {
            btn.style.transform = "scale(1)";
            btn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
          }
        });
      };

      const applyColor = (color) => {
        this.#applyMarkerColor(marker, color);
        data.markerColor = color;
        updateActiveColorButton(color);
      };

      this.#markerColorPresets.forEach((preset) => {
        const colorBtn = document.createElement("button");
        colorBtn.type = "button";
        colorBtn.dataset.color = preset.value;
        colorBtn.title = `切换为${preset.label}`;
        colorBtn.style.cssText = [
          "width: 24px",
          "height: 24px",
          "border-radius: 50%",
          "border: 2px solid white",
          `background: ${preset.value}`,
          "cursor: pointer",
          "pointer-events: auto",
          "display: flex",
          "align-items: center",
          "justify-content: center",
          "transition: transform 0.2s ease, box-shadow 0.2s ease"
        ].join(";");
        colorBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          applyColor(preset.value);
        });
        controlsContainer.appendChild(colorBtn);
        colorButtons.push(colorBtn);
      });

      updateActiveColorButton(initialColor);

      const jumpBtn = document.createElement("button");
      jumpBtn.type = "button";
      jumpBtn.title = "查看标注卡片";
      jumpBtn.innerHTML = "↗";
      jumpBtn.style.cssText = [
        "width: 24px",
        "height: 24px",
        "border-radius: 50%",
        "border: 2px solid white",
        "background: #2196f3",
        "color: white",
        "cursor: pointer",
        "pointer-events: auto",
        "display: flex",
        "align-items: center",
        "justify-content: center",
        "font-size: 14px",
        "transition: transform 0.2s ease, box-shadow 0.2s ease"
      ].join(";");
      jumpBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        this.#onJumpToAnnotation(annotation.id);
        this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPEN_REQUESTED, { sidebarId: "annotation" });
        setTimeout(() => {
          this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SELECT, { id: annotation.id });
        }, 150);
      });
      controlsContainer.appendChild(jumpBtn);

      let hideTimer = null;
      const showControls = () => {
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
        controlsContainer.style.opacity = "1";
        controlsContainer.style.pointerEvents = "auto";
        controlsContainer.style.transform = "translateX(0)";
        deleteBtn.style.transform = "scale(1.1)";
        deleteBtn.style.background = "#d32f2f";
      };
      const scheduleHide = () => {
        if (hideTimer) {
          clearTimeout(hideTimer);
        }
        hideTimer = setTimeout(() => {
          controlsContainer.style.opacity = "0";
          controlsContainer.style.pointerEvents = "none";
          controlsContainer.style.transform = "translateX(8px)";
          deleteBtn.style.transform = "scale(1)";
          deleteBtn.style.background = "#f44336";
        }, 120);
      };

      deleteBtn.addEventListener("mouseenter", showControls);
      deleteBtn.addEventListener("mouseleave", scheduleHide);
      controlsContainer.addEventListener("mouseenter", showControls);
      controlsContainer.addEventListener("mouseleave", scheduleHide);

      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (await confirmDialogAsync({ message: "确定要删除此截图标注吗？" })) {
          this.#logger.info(`[ScreenshotTool] Requesting deletion of annotation ${annotation.id}`);
          this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DELETE, { id: annotation.id });
        }
      });

      marker.appendChild(deleteBtn);
      marker.appendChild(controlsContainer);
      pageDiv.appendChild(marker);

      this.#renderedMarkers.set(annotation.id, marker);

      this.#logStep("06.done", "Marker rendered", { id: annotation.id, page: pageNumber }, "success", 1600);
    } catch (error) {
      this.#logger.error("[ScreenshotTool] Failed to render marker:", error, { toast: { type: "error", ms: 4500 } });
    }
  }

  remove(annotationId) {
    const marker = this.#renderedMarkers.get(annotationId);
    if (!marker) {
      this.#logStep("07", "Remove marker requested but not found", { id: annotationId });
      return;
    }

    if (marker.parentNode) {
      marker.remove();
    }

    this.#renderedMarkers.delete(annotationId);
    this.#logStep("07.done", "Marker removed", { id: annotationId }, "info", 1400);
  }

  clearAll() {
    this.#renderedMarkers.forEach((marker) => {
      if (marker.parentNode) {
        marker.remove();
      }
    });
    this.#renderedMarkers.clear();
    this.#logStep("08", "All markers cleared", null, "info", 1400);
  }

  getRenderedIds() {
    return Array.from(this.#renderedMarkers.keys());
  }

  #applyMarkerColor(marker, color) {
    const rgb = this.#hexToRgb(color);
    if (!rgb) {
      return;
    }
    marker.style.border = `2px solid ${color}`;
    marker.style.background = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`;
    marker.dataset.markerColor = color;
  }

  #hexToRgb(hex) {
    if (typeof hex !== "string") {
      return null;
    }
    let normalized = hex.trim().replace("#", "");
    if (normalized.length === 3) {
      normalized = normalized.split("").map((ch) => ch + ch).join("");
    }
    if (normalized.length !== 6) {
      return null;
    }
    const intValue = Number.parseInt(normalized, 16);
    if (Number.isNaN(intValue)) {
      return null;
    }
    return {
      r: (intValue >> 16) & 255,
      g: (intValue >> 8) & 255,
      b: intValue & 255
    };
  }
}
