import { ObservableState } from "../../../../common/utils/observable.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";

/**
 * Manages Zoom State logic.
 * Bridges new Observable state with legacy EventBus events.
 */
export class ZoomManager {
  constructor(eventBus, logger) {
    this.eventBus = eventBus;
    this.logger = logger;

    // Define State
    this.store = new ObservableState({
      scale: 1.0,
      minScale: 0.5,
      maxScale: 3.0,
      step: 0.1
    }, {
      name: "ZoomStore",
      logger: this.logger
    });
  }

  /**
     * Set explicit scale value (clamped to bounds)
     * @param {number} newScale
     */
  setScale(newScale) {
    const { minScale, maxScale } = this.store.get();
    const clamped = Math.max(minScale, Math.min(maxScale, newScale));

    // Round to 2 decimal places to avoid float precision issues
    const rounded = Math.round(clamped * 100) / 100;

    if (rounded !== this.store.get().scale) {
      this.store.set({ scale: rounded });
      this.logger.debug(`[ZoomManager] Scale updated to ${rounded}`);
    }
  }

  /**
     * Increase zoom level
     */
  zoomIn() {
    const { scale, step, maxScale } = this.store.get();
    if (scale >= maxScale) {return;}

    const next = scale + step;
    this.setScale(next);

    // Interop: Emit legacy event so PDF Renderer knows to update
    if (this.store.get().scale > scale) {
      this.eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.IN, null, {
        actorId: "ZoomManager"
      });
    }
  }

  /**
     * Decrease zoom level
     */
  zoomOut() {
    const { scale, step, minScale } = this.store.get();
    if (scale <= minScale) {return;}

    const next = scale - step;
    this.setScale(next);

    // Interop: Emit legacy event
    if (this.store.get().scale < scale) {
      this.eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.OUT, null, {
        actorId: "ZoomManager"
      });
    }
  }

  destroy() {
    // No internal subscriptions to clean up yet
  }
}
