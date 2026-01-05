import { ObservableState } from "../../../../common/utils/observable.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";

/**
 * Manages Layout State (Scroll, Spread, Rotation, Mouse Mode).
 */
export class LayoutManager {
  constructor(eventBus, logger) {
    this.eventBus = eventBus;
    this.logger = logger;

    this.store = new ObservableState({
      scrollMode: 0, // 0=Vert, 1=Horiz, 2=Wrapped, 3=Page
      spreadMode: 0, // 0=None, 1=Odd, 2=Even
      rotation: 0,   // 0-360
      mouseMode: "text" // "text" | "drag"
    }, {
      name: "LayoutStore",
      logger: this.logger
    });
  }

  setScrollMode(mode) {
    const current = this.store.get().scrollMode;
    if (current !== mode) {
      this.store.set({ scrollMode: mode });
      this.logger.info(`[LayoutManager] Scroll mode changed to: ${mode}`);
    }
  }

  setSpreadMode(mode) {
    const current = this.store.get().spreadMode;
    if (current !== mode) {
      this.store.set({ spreadMode: mode });
      this.logger.info(`[LayoutManager] Spread mode changed to: ${mode}`);
    }
  }

  rotate(degrees) {
    const current = this.store.get().rotation;
    let newRotation = (current + degrees) % 360;
    if (newRotation < 0) {newRotation += 360;}

    if (current !== newRotation) {
      this.store.set({ rotation: newRotation });
      this.logger.info(`[LayoutManager] Rotation changed: ${current} -> ${newRotation}`);
    }
  }

  setMouseMode(mode) {
    const current = this.store.get().mouseMode;
    if (current !== mode) {
      this.store.set({ mouseMode: mode });
      this.logger.info(`[LayoutManager] Mouse mode changed to: ${mode}`);

      // Interop: Emit event for others who might need it (e.g. Annotation tool disabling)
      this.eventBus.emit(PDF_VIEWER_EVENTS.MOUSE.MODE_CHANGED, {
        mode: mode
      }, { actorId: "LayoutManager" });
    }
  }

  toggleMouseMode() {
    const current = this.store.get().mouseMode;
    const next = current === "text" ? "drag" : "text";
    this.setMouseMode(next);
  }

  destroy() {
    // No internal subs yet
  }
}
