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
  static #ALLOWED_FIELDS = new Set(["initialized", "currentFile", "currentPage", "totalPages", "zoomLevel"]);

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

  /** @type {Map<string, Set<(payload: { field: string, oldValue: any, newValue: any, state: any }) => void>>} */
  #fieldSubscribers = new Map();

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
   * 订阅单字段变化（更细粒度回调，避免依赖全量 STATE.CHANGED 自行 diff）。
   *
   * @param {"initialized"|"currentFile"|"currentPage"|"totalPages"|"zoomLevel"} field
   * @param {(payload: { field: string, oldValue: any, newValue: any, state: any }) => void} handler
   * @returns {() => void}
   */
  onFieldChanged(field, handler) {
    if (typeof field !== "string" || !field) {
      throw new Error("[StateManager] onFieldChanged(field, handler) requires a non-empty string field");
    }
    if (!StateManager.#ALLOWED_FIELDS.has(field)) {
      throw new Error(`[StateManager] onFieldChanged does not support field: ${field}`);
    }
    if (typeof handler !== "function") {
      throw new Error("[StateManager] onFieldChanged(field, handler) requires a function handler");
    }

    const set = this.#fieldSubscribers.get(field) || new Set();
    set.add(handler);
    this.#fieldSubscribers.set(field, set);

    return () => {
      const current = this.#fieldSubscribers.get(field);
      if (!current) { return; }
      current.delete(handler);
      if (current.size === 0) {
        this.#fieldSubscribers.delete(field);
      } else {
        this.#fieldSubscribers.set(field, current);
      }
    };
  }

  /**
   * 批量设置多个字段（更直观的批量更新入口）。
   *
   * 规则：
   * - `setMany({ ... })` 会尽量合并为一次 STATE.CHANGED（通过 `batchUpdate`）；
   * - 若当前已处于 batchUpdate，则不会再次嵌套 batchUpdate（避免抛错），而是直接逐个调用 set*；
   * - updates 只能包含支持的字段，未知字段会 Fail‑Fast throw。
   *
   * @param {Record<string, any>} updates
   */
  setMany(updates) {
    if (updates === null || typeof updates !== "object" || Array.isArray(updates)) {
      throw new Error("[StateManager] setMany(updates) requires a plain object");
    }

    const proto = Object.getPrototypeOf(updates);
    if (proto !== Object.prototype && proto !== null) {
      throw new Error("[StateManager] setMany(updates) requires a plain object");
    }

    const fields = Object.keys(updates);
    if (fields.length === 0) {
      return;
    }

    for (const field of fields) {
      if (!StateManager.#ALLOWED_FIELDS.has(field)) {
        throw new Error(`[StateManager] setMany does not support field: ${field}`);
      }
    }

    const applyUpdates = () => {
      for (const field of fields) {
        switch (field) {
        case "initialized":
          this.setInitialized(updates[field]);
          break;
        case "currentFile":
          this.setCurrentFile(updates[field]);
          break;
        case "currentPage":
          this.setCurrentPage(updates[field]);
          break;
        case "totalPages":
          this.setTotalPages(updates[field]);
          break;
        case "zoomLevel":
          this.setZoomLevel(updates[field]);
          break;
        default:
          throw new Error(`[StateManager] setMany does not support field: ${field}`);
        }
      }
    };

    if (this.#isBatching) {
      applyUpdates();
      return;
    }

    this.batchUpdate(() => {
      applyUpdates();
    });
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
      // 支持 batchUpdate({ ...updates }) 的便捷入口（复用 setMany 的字段验证与 batching 合并语义）。
      if (fn === null || typeof fn !== "object" || Array.isArray(fn)) {
        throw new Error("[StateManager] batchUpdate(fn|updates) requires a function or a plain object");
      }
      const proto = Object.getPrototypeOf(fn);
      if (proto !== Object.prototype && proto !== null) {
        throw new Error("[StateManager] batchUpdate(fn|updates) requires a function or a plain object");
      }
      return this.batchUpdate((sm) => {
        sm.setMany(fn);
      });
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
      const state = this.getState();
      this.#emitFieldChanged({ field, oldValue, newValue, state });
      this.#eventBus.emit(PDF_VIEWER_EVENTS.STATE.CHANGED, {
        field,
        oldValue,
        newValue,
        state
      }, {
        actorId: "StateManager"
      });
    } else {
      this.#emitFieldChanged({ field, oldValue, newValue, state: this.getState() });
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

    const state = this.getState();

    // 先发细粒度回调（每字段一次），避免订阅者自行 diff。
    for (const change of changes) {
      this.#emitFieldChanged({ field: change.field, oldValue: change.oldValue, newValue: change.newValue, state });
    }

    if (!this.#eventBus) { return; }

    this.#eventBus.emit(PDF_VIEWER_EVENTS.STATE.CHANGED, {
      field: "batchUpdate",
      oldValue: null,
      newValue: null,
      changes,
      state
    }, {
      actorId: "StateManager"
    });
  }

  #emitFieldChanged(payload) {
    const { field } = payload;
    const subs = this.#fieldSubscribers.get(field) || null;
    if (!subs || subs.size === 0) { return; }

    for (const fn of subs) {
      fn(payload);
    }
  }
}
