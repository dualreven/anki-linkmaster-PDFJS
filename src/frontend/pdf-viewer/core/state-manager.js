/**
 * @file 应用状态管理器
 * @module StateManager
 * @description 负责管理应用的全局状态，提供状态访问和变更通知
 */

import { getLogger } from "../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";

/**
 * 应用状态管理器类
 * 负责管理应用的全局状态
 *
 * @class StateManager
 */
export class StateManager {
  /** @type {import('../../common/utils/logger.js').Logger} */
  #logger;

  /** @type {import('../../common/event/event-bus.js').EventBus} */
  #eventBus;

  /** @type {boolean} */
  #isBatching = false;

  /** @type {Map<string, { field: string, oldValue: any, newValue: any }>|null} */
  #batchChangesByField = null;

  /** @type {string[]|null} */
  #batchFieldOrder = null;

  /** @type {boolean} */
  #initialized = false;

  /** @type {string|null} */
  #currentFile = null;

  /** @type {number} */
  #currentPage = 1;

  /** @type {number} */
  #totalPages = 0;

  /** @type {number} */
  #zoomLevel = 1.0;

  /**
   * 创建状态管理器实例
   *
   * @param {import('../../common/event/event-bus.js').EventBus} [eventBus] - 事件总线（可选）
   */
  constructor(eventBus = null) {
    this.#logger = getLogger("StateManager");
    this.#eventBus = eventBus;
  }

  /**
   * 获取完整状态快照
   *
   * @returns {Object} 当前状态
   */
  getState() {
    return {
      initialized: this.#initialized,
      currentFile: this.#currentFile,
      currentPage: this.#currentPage,
      totalPages: this.#totalPages,
      zoomLevel: this.#zoomLevel
    };
  }

  /**
   * 设置初始化状态
   *
   * @param {boolean} value - 初始化状态
   */
  setInitialized(value) {
    const oldValue = this.#initialized;
    this.#initialized = value;

    if (oldValue !== value) {
      this.#emitStateChange("initialized", oldValue, value);
    }
  }

  /**
   * 获取初始化状态
   *
   * @returns {boolean}
   */
  isInitialized() {
    return this.#initialized;
  }

  /**
   * 设置当前文件
   *
   * @param {string|null} filePath - 文件路径
   */
  setCurrentFile(filePath) {
    const oldValue = this.#currentFile;
    this.#currentFile = filePath;

    if (oldValue !== filePath) {
      this.#emitStateChange("currentFile", oldValue, filePath);
    }
  }

  /**
   * 获取当前文件
   *
   * @returns {string|null}
   */
  getCurrentFile() {
    return this.#currentFile;
  }

  /**
   * 设置当前页码
   *
   * @param {number} pageNumber - 页码
   */
  setCurrentPage(pageNumber) {
    const oldValue = this.#currentPage;
    this.#currentPage = pageNumber;

    if (oldValue !== pageNumber) {
      this.#emitStateChange("currentPage", oldValue, pageNumber);
    }
  }

  /**
   * 获取当前页码
   *
   * @returns {number}
   */
  getCurrentPage() {
    return this.#currentPage;
  }

  /**
   * 设置总页数
   *
   * @param {number} totalPages - 总页数
   */
  setTotalPages(totalPages) {
    const oldValue = this.#totalPages;
    this.#totalPages = totalPages;

    if (oldValue !== totalPages) {
      this.#emitStateChange("totalPages", oldValue, totalPages);
    }
  }

  /**
   * 获取总页数
   *
   * @returns {number}
   */
  getTotalPages() {
    return this.#totalPages;
  }

  /**
   * 设置缩放级别
   *
   * @param {number} level - 缩放级别
   */
  setZoomLevel(level) {
    const oldValue = this.#zoomLevel;
    this.#zoomLevel = level;

    if (oldValue !== level) {
      this.#emitStateChange("zoomLevel", oldValue, level);
    }
  }

  /**
   * 获取缩放级别
   *
   * @returns {number}
   */
  getZoomLevel() {
    return this.#zoomLevel;
  }

  /**
   * 显式批量更新：将多个 set* 合并为一次 STATE.CHANGED 事件发射。
   *
   * 规则：
   * - 仅当批量内至少有 1 个字段变化时，才会在结束时发射一次 STATE.CHANGED；
   * - 同一字段在 batch 中多次变化：oldValue 取第一次变化前的值，newValue 取最后一次变化后的值；
   * - 禁止嵌套 batch（Fail‑Fast）。
   *
   * @param {(sm: StateManager) => void} fn
   */
  batchUpdate(fn) {
    if (typeof fn !== "function") {
      throw new Error("[StateManager] batchUpdate(fn) requires a function");
    }
    if (this.#isBatching) {
      throw new Error("[StateManager] batchUpdate does not support nesting");
    }

    this.#isBatching = true;
    this.#batchChangesByField = new Map();
    this.#batchFieldOrder = [];

    /** @type {any} */
    let thrownError = null;
    try {
      fn(this);
    } catch (e) {
      thrownError = e;
    } finally {
      this.#isBatching = false;

      const changes = this.#drainBatchChanges();
      // 约定：batchUpdate(fn) 内 throw 时，不发 STATE.CHANGED（避免发出“部分成功”的聚合事件）
      if (!thrownError && changes.length > 0) {
        this.#emitBatchStateChanged(changes);
      }
    }

    if (thrownError) {
      throw thrownError;
    }
  }

  /**
   * 重置状态到初始值
   */
  reset() {
    this.#logger.info("Resetting state to initial values");

    this.#initialized = false;
    this.#currentFile = null;
    this.#currentPage = 1;
    this.#totalPages = 0;
    this.#zoomLevel = 1.0;

    if (this.#eventBus) {
      this.#eventBus.emit(PDF_VIEWER_EVENTS.STATE.RESET, undefined, {
        actorId: "StateManager"
      });
    }
  }

  /**
   * 发射状态变更事件
   *
   * @private
   * @param {string} field - 变更的字段
   * @param {*} oldValue - 旧值
   * @param {*} newValue - 新值
   */
  #emitStateChange(field, oldValue, newValue) {
    this.#logger.debug(`State changed: ${field}`, { oldValue, newValue });

    if (this.#isBatching) {
      this.#recordBatchChange(field, oldValue, newValue);
      return;
    }

    if (this.#eventBus) {
      this.#eventBus.emit(PDF_VIEWER_EVENTS.STATE.CHANGED, {
        field,
        oldValue,
        newValue,
        state: this.getState()
      }, {
        actorId: "StateManager"
      });
    }
  }

  #recordBatchChange(field, oldValue, newValue) {
    if (!this.#batchChangesByField || !this.#batchFieldOrder) {
      throw new Error("[StateManager] batch state is corrupted");
    }

    const k = String(field);
    const existed = this.#batchChangesByField.get(k) || null;
    if (!existed) {
      this.#batchFieldOrder.push(k);
      this.#batchChangesByField.set(k, { field: k, oldValue, newValue });
      return;
    }
    existed.newValue = newValue;
    this.#batchChangesByField.set(k, existed);
  }

  #drainBatchChanges() {
    const map = this.#batchChangesByField;
    const order = this.#batchFieldOrder;
    this.#batchChangesByField = null;
    this.#batchFieldOrder = null;

    if (!map || !order) { return []; }

    /** @type {Array<{ field: string, oldValue: any, newValue: any }>} */
    const out = [];
    for (const field of order) {
      const item = map.get(field);
      if (!item) { continue; }
      if (item.oldValue !== item.newValue) {
        out.push(item);
      }
    }
    return out;
  }

  #emitBatchStateChanged(changes) {
    this.#logger.debug("State batch changed", { changesCount: changes.length });

    if (!this.#eventBus) { return; }

    this.#eventBus.emit(PDF_VIEWER_EVENTS.STATE.CHANGED, {
      field: "batchUpdate",
      oldValue: null,
      newValue: null,
      changes,
      state: this.getState()
    }, {
      actorId: "StateManager"
    });
  }
}
