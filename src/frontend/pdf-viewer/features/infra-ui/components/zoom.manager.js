import { ObservableState } from "../../../../common/utils/observable.js";

/**
 * Manages Zoom State logic.
 * 单一真源：仅维护 store（命令由外层通过 EventBus 进入）。
 */
export class ZoomManager {
  constructor(_eventBus, logger) {
    this.logger = logger;

    // Define State
    this.store = new ObservableState({
      scale: 1.0,
      minScale: 0.5,
      maxScale: 3.0,
      step: 0.1,
      mode: "custom", // custom | page-width | page-height
    }, {
      name: "ZoomStore",
      logger: this.logger
    });
  }

  /**
   * Set explicit numeric scale value (clamped to bounds).
   * 语义：进入 custom 模式（不使用 fit-*）。
   * @param {number} newScale
   */
  setScale(newScale) {
    const { minScale, maxScale } = this.store.get();
    const clamped = Math.max(minScale, Math.min(maxScale, newScale));

    // Round to 2 decimal places to avoid float precision issues
    const rounded = Math.round(clamped * 100) / 100;

    const cur = this.store.get();
    if (rounded !== cur.scale || cur.mode !== "custom") {
      this.store.set({ scale: rounded, mode: "custom" });
      this.logger.debug(`[ZoomManager] Scale updated to ${rounded}`);
    }
  }

  /**
   * Sync engine scale into store (preserve mode).
   * @param {number} newScale
   */
  applyEngineScale(newScale) {
    const { minScale, maxScale } = this.store.get();
    const clamped = Math.max(minScale, Math.min(maxScale, newScale));
    const rounded = Math.round(clamped * 100) / 100;

    const cur = this.store.get();
    if (rounded !== cur.scale) {
      this.store.set({ scale: rounded });
      this.logger.debug(`[ZoomManager] Engine scale synced to ${rounded}`);
    }
  }

  /**
   * Set fit width mode (page-width).
   */
  fitWidth() {
    const cur = this.store.get();
    if (cur.mode !== "page-width") {
      this.store.set({ mode: "page-width" });
    }
  }

  /**
   * Set fit height mode (page-height).
   */
  fitHeight() {
    const cur = this.store.get();
    if (cur.mode !== "page-height") {
      this.store.set({ mode: "page-height" });
    }
  }

  /**
   * Reset to actual size.
   */
  actualSize() {
    this.setScale(1.0);
  }

  /**
   * Increase zoom level.
   * @param {number} [delta]
   */
  zoomIn(delta) {
    const { scale, step, maxScale } = this.store.get();
    if (scale >= maxScale) {return;}

    const d = typeof delta === "number" ? delta : step;
    this.setScale(scale + d);
  }

  /**
   * Decrease zoom level.
   * @param {number} [delta]
   */
  zoomOut(delta) {
    const { scale, step, minScale } = this.store.get();
    if (scale <= minScale) {return;}

    const d = typeof delta === "number" ? delta : step;
    this.setScale(scale - d);
  }

  destroy() {
    // No internal subscriptions to clean up yet
  }
}
