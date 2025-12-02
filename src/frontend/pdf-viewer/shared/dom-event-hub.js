/**
 * @file DOM 事件集中管理器
 * @module DomEventHub
 * @description
 * 为 pdf-viewer 提供统一的 DOM 事件包装层：
 * - 只在这里与 DOM 发生 addEventListener/removeEventListener 交互；
 * - 暴露简洁的订阅接口，供 PositionTracker / KeyboardHandler 等上层模块复用；
 * - 不做业务节流和状态推导，仅负责安全转发原始事件。
 */

import { getLogger } from "../../common/utils/logger.js";

/**
 * @typedef {Object} DomEventHubOptions
 * @property {HTMLElement} viewerContainer - PDF viewer 的滚动容器元素（通常为 #viewerContainer）
 * @property {Document} [documentRef] - document 引用，默认为全局 document
 * @property {Window} [windowRef] - window 引用，默认为全局 window
 * @property {import("../../common/utils/logger.js").Logger} [logger] - 可选 logger
 */

/**
 * DOM 事件集中管理器
 */
export class DomEventHub {
  /** @type {HTMLElement} */
  #viewerContainer;

  /** @type {Document} */
  #documentRef;

  /** @type {Window} */
  #windowRef;

  /** @type {Function[]} */
  #detachFns = [];

  /** @type {import("../../common/utils/logger.js").Logger} */
  #logger;

  /**
   * @param {DomEventHubOptions} options
   */
  constructor(options) {
    if (!options || !options.viewerContainer || !(options.viewerContainer instanceof HTMLElement)) {
      throw new Error("[DomEventHub] viewerContainer is required and must be a valid HTMLElement");
    }

    this.#viewerContainer = options.viewerContainer;
    this.#documentRef = options.documentRef || document;
    this.#windowRef = options.windowRef || window;
    this.#logger = options.logger || getLogger("DomEventHub");

    this.#logger.info("[DomEventHub] created", {
      hasDocument: !!this.#documentRef,
      hasWindow: !!this.#windowRef
    });
  }

  /**
   * 获取绑定的 viewerContainer
   * @returns {HTMLElement}
   */
  get viewerContainer() {
    return this.#viewerContainer;
  }

  /**
   * 订阅 viewerContainer 的 scroll 事件
   * @param {(evt: Event) => void} listener
   * @returns {() => void} 取消订阅函数
   */
  onViewerScroll(listener) {
    if (typeof listener !== "function") {
      throw new Error("[DomEventHub] onViewerScroll requires a function listener");
    }
    const container = this.#viewerContainer;
    const handler = (evt) => {
      try {
        listener(evt);
      } catch (e) {
        this.#logger.error("[DomEventHub] onViewerScroll listener failed", e);
        throw e;
      }
    };
    container.addEventListener("scroll", handler, { passive: true });
    const detach = () => {
      try {
        container.removeEventListener("scroll", handler);
      } catch (e) {
        this.#logger.warn("[DomEventHub] failed to remove scroll listener", e);
      }
    };
    this.#detachFns.push(detach);
    return detach;
  }

  /**
   * 订阅 viewerContainer 的 wheel 事件
   * @param {(evt: WheelEvent) => void} listener
   * @returns {() => void} 取消订阅函数
   */
  onViewerWheel(listener) {
    if (typeof listener !== "function") {
      throw new Error("[DomEventHub] onViewerWheel requires a function listener");
    }
    const container = this.#viewerContainer;
    const handler = (evt) => {
      try {
        listener(evt);
      } catch (e) {
        this.#logger.error("[DomEventHub] onViewerWheel listener failed", e);
        throw e;
      }
    };
    container.addEventListener("wheel", handler, { passive: true });
    const detach = () => {
      try {
        container.removeEventListener("wheel", handler);
      } catch (e) {
        this.#logger.warn("[DomEventHub] failed to remove wheel listener", e);
      }
    };
    this.#detachFns.push(detach);
    return detach;
  }

  /**
   * 订阅 viewerContainer 的 click 事件
   * @param {(evt: MouseEvent) => void} listener
   * @returns {() => void} 取消订阅函数
   */
  onViewerClick(listener) {
    if (typeof listener !== "function") {
      throw new Error("[DomEventHub] onViewerClick requires a function listener");
    }
    const container = this.#viewerContainer;
    const handler = (evt) => {
      try {
        listener(evt);
      } catch (e) {
        this.#logger.error("[DomEventHub] onViewerClick listener failed", e);
        throw e;
      }
    };
    container.addEventListener("click", handler, { passive: true });
    const detach = () => {
      try {
        container.removeEventListener("click", handler);
      } catch (e) {
        this.#logger.warn("[DomEventHub] failed to remove click listener", e);
      }
    };
    this.#detachFns.push(detach);
    return detach;
  }

  /**
   * 订阅 document 的 keydown 事件
   * @param {(evt: KeyboardEvent) => void} listener
   * @returns {() => void} 取消订阅函数
   */
  onDocumentKeydown(listener) {
    if (typeof listener !== "function") {
      throw new Error("[DomEventHub] onDocumentKeydown requires a function listener");
    }
    const doc = this.#documentRef;
    const handler = (evt) => {
      try {
        listener(evt);
      } catch (e) {
        this.#logger.error("[DomEventHub] onDocumentKeydown listener failed", e);
        throw e;
      }
    };
    doc.addEventListener("keydown", handler);
    const detach = () => {
      try {
        doc.removeEventListener("keydown", handler);
      } catch (e) {
        this.#logger.warn("[DomEventHub] failed to remove keydown listener", e);
      }
    };
    this.#detachFns.push(detach);
    return detach;
  }

  /**
   * 销毁所有监听器
   */
  destroy() {
    for (const detach of this.#detachFns) {
      try {
        detach();
      } catch (e) {
        this.#logger.warn("[DomEventHub] detach failed during destroy", e);
      }
    }
    this.#detachFns = [];
    this.#logger.info("[DomEventHub] destroyed");
  }
}

export default DomEventHub;
