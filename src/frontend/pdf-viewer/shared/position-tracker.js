/**
 * @file 位置追踪器
 * @module PositionTracker
 * @description 抽象 pdf-resume/pdf-anchor 共享的位置追踪能力：
 *              滚动监听、去抖动、冻结机制、位置采样。
 */

import { getCurrentPageAndPosition } from "../../common/utils/pdf-page-detection-utils.js";
import { getLogger } from "../../common/utils/logger.js";

const logger = getLogger("PositionTracker");

/**
 * 位置追踪器配置
 * @typedef {Object} PositionTrackerOptions
 * @property {Function} onPositionChange - 位置变化回调 (pageAt: number, position: number) => void
 * @property {number} [debounceMs=150] - 去抖动延迟（毫秒）
 * @property {boolean} [listenWheel=true] - 是否监听 wheel 事件
 * @property {boolean} [listenClick=true] - 是否监听 click 事件
 * @property {boolean} [listenScroll=true] - 是否监听 scroll 事件
 * @property {Object} [domEventHub] - 可选 DomEventHub 实例，用于统一管理 DOM 事件订阅
 */

/**
 * 位置追踪器 - 提供统一的滚动位置追踪能力
 *
 * 使用示例：
 * ```javascript
 * const tracker = new PositionTracker({
 *   onPositionChange: (pageAt, position) => saveResume(pageAt, position)
 * });
 * tracker.activate(viewerContainer);
 * // ... 之后
 * tracker.deactivate();
 * ```
 */
export class PositionTracker {
  /** @type {HTMLElement|null} */
  #container = null;

  /** @type {Function[]} */
  #detachFns = [];

  /** @type {boolean} */
  #isActive = false;

  /** @type {number} */
  #freezeUntilMs = 0;

  /** @type {Function} */
  #onPositionChange;

  /** @type {number} */
  #debounceMs;

  /** @type {boolean} */
  #listenWheel;

  /** @type {boolean} */
  #listenClick;

  /** @type {boolean} */
  #listenScroll;

  /** @type {number|null} */
  #debounceTimer = null;

  /** @type {{ pageAt: number, position: number } | null} */
  #lastPosition = null;

  /** @type {Object|null} */
  #domEventHub = null;

  /**
   * 创建位置追踪器实例
   * @param {PositionTrackerOptions} options - 配置选项
   * @throws {Error} 当 onPositionChange 未提供时抛出
   */
  constructor(options) {
    if (!options || typeof options.onPositionChange !== "function") {
      throw new Error("[PositionTracker] onPositionChange callback is required");
    }

    this.#onPositionChange = options.onPositionChange;
    this.#debounceMs = typeof options.debounceMs === "number" ? options.debounceMs : 150;
    this.#listenWheel = options.listenWheel !== false;
    this.#listenClick = options.listenClick !== false;
    this.#listenScroll = options.listenScroll !== false;
    this.#domEventHub = options.domEventHub || null;
  }

  /**
   * 当前是否处于激活状态
   * @returns {boolean}
   */
  get isActive() {
    return this.#isActive;
  }

  /**
   * 当前是否处于冻结状态
   * @returns {boolean}
   */
  get isFrozen() {
    return Date.now() < this.#freezeUntilMs;
  }

  /**
   * 激活位置追踪（开始监听滚动事件）
   * @param {HTMLElement} container - viewerContainer 元素
   * @throws {Error} 当 container 无效时抛出
   */
  activate(container) {
    if (!container || !(container instanceof HTMLElement)) {
      throw new Error("[PositionTracker] container must be a valid HTMLElement");
    }

    if (this.#isActive) {
      logger.warn("[PositionTracker] already active, deactivating first");
      this.deactivate();
    }

    this.#container = container;
    this.#isActive = true;
    this.#attachListeners();

    logger.info("[PositionTracker] activated");
  }

  /**
   * 停用位置追踪
   */
  deactivate() {
    this.#isActive = false;
    this.#detachListeners();
    this.#cancelDebounce();
    this.#container = null;
    this.#lastPosition = null;

    logger.info("[PositionTracker] deactivated");
  }

  /**
   * 冻结一段时间（导航后不触发回调）
   * @param {number} ms - 冻结时长（毫秒）
   */
  freezeFor(ms) {
    if (!Number.isInteger(ms) || ms < 0) {
      throw new Error(`[PositionTracker] freezeFor requires non-negative integer, got: ${ms}`);
    }
    this.#freezeUntilMs = Date.now() + ms;
    logger.debug(`[PositionTracker] frozen for ${ms}ms`);
  }

  /**
   * 解除冻结
   */
  unfreeze() {
    this.#freezeUntilMs = 0;
    logger.debug("[PositionTracker] unfrozen");
  }

  /**
   * 立即采样当前位置（不触发回调）
   * @returns {{ pageAt: number, position: number } | null}
   */
  snapshot() {
    if (!this.#container) {
      return null;
    }
    return getCurrentPageAndPosition(this.#container);
  }

  /**
   * 强制触发一次位置更新（忽略冻结状态）
   */
  forceUpdate() {
    if (!this.#isActive || !this.#container) {
      return;
    }
    const pos = this.snapshot();
    if (pos) {
      this.#lastPosition = pos;
      this.#onPositionChange(pos.pageAt, pos.position);
    }
  }

  /**
   * 附加事件监听器
   */
  #attachListeners() {
    const container = this.#container;
    if (!container) {
      return;
    }

    const handlePositionChange = () => {
      this.#scheduleUpdate();
    };

    // 若提供了 DomEventHub，则优先通过 DomEventHub 订阅 DOM 事件
    if (this.#domEventHub) {
      if (this.#listenWheel && typeof this.#domEventHub.onViewerWheel === "function") {
        this.#detachFns.push(this.#domEventHub.onViewerWheel(handlePositionChange));
      }

      if (this.#listenClick && typeof this.#domEventHub.onViewerClick === "function") {
        const handleClick = (evt) => {
          const pageEl = evt?.target?.closest?.(".page[data-page-number]");
          if (pageEl) {
            const pn = Number(pageEl.getAttribute("data-page-number"));
            if (Number.isFinite(pn) && pn > 0) {
              this.#scheduleUpdateWithPage(pn);
              return;
            }
          }
          this.#scheduleUpdate();
        };
        this.#detachFns.push(this.#domEventHub.onViewerClick(handleClick));
      }

      if (this.#listenScroll && typeof this.#domEventHub.onViewerScroll === "function") {
        this.#detachFns.push(this.#domEventHub.onViewerScroll(handlePositionChange));
      }
    } else {
      // 兼容旧用法：直接在 container 上订阅 DOM 事件
      if (this.#listenWheel) {
        container.addEventListener("wheel", handlePositionChange, { passive: true });
        this.#detachFns.push(() => container.removeEventListener("wheel", handlePositionChange));
      }

      if (this.#listenClick) {
        const handleClick = (evt) => {
          // 尝试从点击的页面元素获取页码
          const pageEl = evt?.target?.closest?.(".page[data-page-number]");
          if (pageEl) {
            const pn = Number(pageEl.getAttribute("data-page-number"));
            if (Number.isFinite(pn) && pn > 0) {
              // 直接使用点击的页码，而非检测中心
              this.#scheduleUpdateWithPage(pn);
              return;
            }
          }
          this.#scheduleUpdate();
        };
        container.addEventListener("click", handleClick, { passive: true });
        this.#detachFns.push(() => container.removeEventListener("click", handleClick));
      }

      if (this.#listenScroll) {
        container.addEventListener("scroll", handlePositionChange, { passive: true });
        this.#detachFns.push(() => container.removeEventListener("scroll", handlePositionChange));
      }
    }

    logger.debug("[PositionTracker] listeners attached", {
      wheel: this.#listenWheel,
      click: this.#listenClick,
      scroll: this.#listenScroll,
      viaHub: !!this.#domEventHub
    });
  }

  /**
   * 分离所有事件监听器
   */
  #detachListeners() {
    for (const detach of this.#detachFns) {
      try {
        detach();
      } catch (e) {
        logger.warn("[PositionTracker] detach listener failed", e);
      }
    }
    this.#detachFns = [];
  }

  /**
   * 调度去抖动更新
   */
  #scheduleUpdate() {
    this.#cancelDebounce();

    if (this.isFrozen) {
      logger.debug("[PositionTracker] update skipped (frozen)");
      return;
    }

    this.#debounceTimer = setTimeout(() => {
      this.#debounceTimer = null;
      this.#doUpdate();
    }, this.#debounceMs);
  }

  /**
   * 调度去抖动更新（已知页码）
   * @param {number} pageAt - 已知页码
   */
  #scheduleUpdateWithPage(pageAt) {
    this.#cancelDebounce();

    if (this.isFrozen) {
      return;
    }

    this.#debounceTimer = setTimeout(() => {
      this.#debounceTimer = null;
      this.#doUpdateWithPage(pageAt);
    }, this.#debounceMs);
  }

  /**
   * 取消去抖动定时器
   */
  #cancelDebounce() {
    if (this.#debounceTimer !== null) {
      clearTimeout(this.#debounceTimer);
      this.#debounceTimer = null;
    }
  }

  /**
   * 执行位置更新
   */
  #doUpdate() {
    if (!this.#isActive || !this.#container) {
      return;
    }

    const pos = this.snapshot();
    if (!pos) {
      return;
    }

    // 检查位置是否有变化（避免重复回调）
    if (this.#lastPosition &&
        this.#lastPosition.pageAt === pos.pageAt &&
        Math.abs(this.#lastPosition.position - pos.position) < 0.5) {
      return;
    }

    this.#lastPosition = pos;
    this.#onPositionChange(pos.pageAt, pos.position);
  }

  /**
   * 执行位置更新（已知页码）
   * @param {number} pageAt - 已知页码
   */
  #doUpdateWithPage(pageAt) {
    if (!this.#isActive || !this.#container) {
      return;
    }

    // 使用已知页码计算位置
    const pageEl = this.#container.querySelector(`.page[data-page-number="${pageAt}"]`);
    if (!pageEl) {
      // fallback to normal detection
      this.#doUpdate();
      return;
    }

    const pageTop = pageEl.offsetTop;
    const pageHeight = pageEl.offsetHeight || 1;
    const centerY = this.#container.scrollTop + (this.#container.clientHeight / 2);
    const relativeY = centerY - pageTop;
    const position = Math.max(0, Math.min(100, (relativeY / pageHeight) * 100));

    const pos = { pageAt, position };

    if (this.#lastPosition &&
        this.#lastPosition.pageAt === pos.pageAt &&
        Math.abs(this.#lastPosition.position - pos.position) < 0.5) {
      return;
    }

    this.#lastPosition = pos;
    this.#onPositionChange(pos.pageAt, pos.position);
  }
}

export default PositionTracker;
