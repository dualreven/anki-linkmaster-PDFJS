/**
 * @file PageZoomGuardFeature
 * @description Prevent browser-level page zoom (Ctrl/Meta + Wheel/Keys) and translate Ctrl+Wheel to PDF zoom events.
 *
 * NOTE:
 * - Must be uninstallable to avoid leaking global listeners (P0).
 * - Emits domain events via global EventBus (no direct DOM side effects beyond preventing default).
 */

import { getLogger } from "../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";

export class PageZoomGuardFeature {
  /** @type {import("../../common/utils/logger.js").Logger} */
  #logger = getLogger("Feature.page-zoom-guard");

  /** @type {import("../../common/event/event-bus.js").EventBus|null} */
  #eventBus = null;

  /** @type {((e: WheelEvent)=>void)|null} */
  #wheelHandler = null;

  /** @type {((e: KeyboardEvent)=>void)|null} */
  #keydownHandler = null;

  /** @type {boolean} */
  #installed = false;

  get name() { return "page-zoom-guard"; }
  get version() { return "1.0.0"; }
  get dependencies() { return []; }

  async install(context) {
    if (this.#installed) { return; }

    const { globalEventBus, logger } = context || {};
    if (!globalEventBus) {
      throw new Error("[Feature.page-zoom-guard] globalEventBus is required");
    }

    this.#eventBus = globalEventBus;
    if (logger) {
      this.#logger = logger;
    }

    const wheelHandler = (e) => {
      if (!e) { return; }

      const ctrlOrMeta = !!(e.ctrlKey || e.metaKey);
      if (!ctrlOrMeta) { return; }

      e.preventDefault();
      e.stopPropagation();

      const direction = (e.deltaY || 0) < 0 ? "in" : "out";
      if (direction === "in") {
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.IN, { delta: 0.15 }, { actorId: "PageZoomGuardFeature" });
      } else {
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.OUT, { delta: 0.15 }, { actorId: "PageZoomGuardFeature" });
      }
    };

    const keydownHandler = (e) => {
      if (!e) { return; }

      const ctrlOrMeta = !!(e.ctrlKey || e.metaKey);
      if (!ctrlOrMeta) { return; }

      const k = e.key || "";
      const code = e.code || "";
      const isZoomKey =
        k === "+" || k === "-" || k === "0" ||
        code === "Equal" || code === "Minus" || code === "Digit0" ||
        code === "NumpadAdd" || code === "NumpadSubtract" || code === "Numpad0";

      if (!isZoomKey) { return; }

      e.preventDefault();
      e.stopPropagation();
    };

    this.#wheelHandler = wheelHandler;
    this.#keydownHandler = keydownHandler;

    window.addEventListener("wheel", wheelHandler, { passive: false, capture: true });
    window.addEventListener("keydown", keydownHandler, { capture: true });

    this.#installed = true;
    this.#logger.info("[PageZoomGuard] installed");
  }

  async uninstall() {
    if (!this.#installed) { return; }

    if (this.#wheelHandler) {
      window.removeEventListener("wheel", this.#wheelHandler, { passive: false, capture: true });
    }
    if (this.#keydownHandler) {
      window.removeEventListener("keydown", this.#keydownHandler, { capture: true });
    }

    this.#wheelHandler = null;
    this.#keydownHandler = null;
    this.#eventBus = null;
    this.#installed = false;

    this.#logger.info("[PageZoomGuard] uninstalled");
  }
}

export default PageZoomGuardFeature;

