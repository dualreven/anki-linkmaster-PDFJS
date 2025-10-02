/**
 * @file 作用域事件总线 - 支持命名空间隔离的事件系统
 * @module ScopedEventBus
 * @description
 * 为功能域（Feature Domain）提供独立的事件命名空间，避免事件名称冲突。
 *
 * 核心功能：
 * 1. 自动命名空间：功能域内部事件自动添加 @{namespace}/ 前缀
 * 2. 事件隔离：不同功能域的事件互不干扰
 * 3. 全局通信：通过 emitGlobal/onGlobal 实现跨功能域通信
 * 4. 向后兼容：兼容现有的全局 EventBus
 *
 * @example
 * // 创建 pdf-list 功能域的事件总线
 * const listEventBus = new ScopedEventBus('pdf-list', globalEventBus);
 *
 * // 功能域内部事件（自动添加命名空间）
 * listEventBus.emit('table:row:selected', rowData);
 * // 实际事件名：@pdf-list/table:row:selected
 *
 * listEventBus.on('table:row:selected', (data) => {
 *   console.log('只有 pdf-list 功能域会收到');
 * });
 *
 * // 跨功能域通信（全局事件，无命名空间）
 * listEventBus.emitGlobal('pdf:list:updated', { records });
 * // 实际事件名：pdf:list:updated（无 @ 前缀）
 */

import { getLogger } from '../utils/logger.js';

/**
 * 作用域事件总线类
 * @class ScopedEventBus
 */
export class ScopedEventBus {
  #namespace = '';                     // 命名空间（如 'pdf-list'）
  #globalEventBus = null;             // 全局事件总线
  #localListeners = new Map();        // 本地监听器缓存（事件名 -> Set<callback>）
  #callbackMap = new Map();           // 回调映射（原始callback -> 包装callback）
  #logger = null;                     // 日志记录器
  #namespacePrefix = '';              // 命名空间前缀（如 '@pdf-list/'）

  /**
   * 创建作用域事件总线
   * @param {string} namespace - 命名空间（功能域名称）
   * @param {EventBus} globalEventBus - 全局事件总线实例
   */
  constructor(namespace, globalEventBus) {
    if (!namespace || typeof namespace !== 'string') {
      throw new Error('ScopedEventBus requires a valid namespace string');
    }

    if (!globalEventBus) {
      throw new Error('ScopedEventBus requires a global EventBus instance');
    }

    this.#namespace = namespace;
    this.#globalEventBus = globalEventBus;
    this.#namespacePrefix = `@${namespace}/`;
    this.#logger = getLogger(`ScopedEventBus.${namespace}`);

    this.#logger.debug(`ScopedEventBus created with namespace: ${namespace}`);
  }

  /**
   * 触发本地事件（自动添加命名空间）
   * @param {string} event - 事件名称（会自动添加命名空间前缀）
   * @param {any} data - 事件数据
   * @param {Object} metadata - 元数据（可选）
   *
   * @example
   * eventBus.emit('table:row:selected', rowData);
   * // 实际触发：@pdf-list/table:row:selected
   */
  emit(event, data, metadata = {}) {
    const namespacedEvent = this.#addNamespace(event);
    this.#logger.debug(`Emitting scoped event: ${namespacedEvent}`);

    return this.#globalEventBus.emit(namespacedEvent, data, {
      ...metadata,
      namespace: this.#namespace,
      scopedEvent: event
    });
  }

  /**
   * 监听本地事件（自动添加命名空间）
   * @param {string} event - 事件名称（会自动添加命名空间前缀）
   * @param {Function} callback - 回调函数
   * @param {Object} options - 选项
   * @returns {Function} 取消监听函数
   *
   * @example
   * const unsubscribe = eventBus.on('table:row:selected', (data) => {
   *   console.log(data);
   * });
   * unsubscribe(); // 取消监听
   */
  on(event, callback, options = {}) {
    const namespacedEvent = this.#addNamespace(event);

    // 包装回调函数，记录本地监听器
    const wrappedCallback = (data, metadata) => {
      this.#logger.debug(`Scoped event received: ${event}`);
      return callback(data, metadata);
    };

    // 保存原始回调到包装回调的映射
    this.#callbackMap.set(callback, wrappedCallback);

    // 注册到全局事件总线
    const unsubscribe = this.#globalEventBus.on(namespacedEvent, wrappedCallback, {
      ...options,
      subscriberId: options.subscriberId || `${this.#namespace}.${event}`
    });

    // 缓存本地监听器（用于管理）
    if (!this.#localListeners.has(event)) {
      this.#localListeners.set(event, new Set());
    }
    this.#localListeners.get(event).add(wrappedCallback);

    // 返回取消监听函数
    return () => {
      this.#localListeners.get(event)?.delete(wrappedCallback);
      this.#callbackMap.delete(callback);
      unsubscribe();
    };
  }

  /**
   * 取消监听本地事件
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数（原始回调）
   */
  off(event, callback) {
    const namespacedEvent = this.#addNamespace(event);

    // 获取包装后的回调
    const wrappedCallback = this.#callbackMap.get(callback);

    if (wrappedCallback) {
      this.#localListeners.get(event)?.delete(wrappedCallback);
      this.#callbackMap.delete(callback);
      return this.#globalEventBus.off(namespacedEvent, wrappedCallback);
    }

    // 如果找不到映射，尝试直接取消（兼容性）
    return this.#globalEventBus.off(namespacedEvent, callback);
  }

  /**
   * 监听一次本地事件（自动添加命名空间）
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   * @param {Object} options - 选项
   * @returns {Function} 取消监听函数
   */
  once(event, callback, options = {}) {
    const namespacedEvent = this.#addNamespace(event);

    return this.#globalEventBus.once(namespacedEvent, callback, {
      ...options,
      subscriberId: options.subscriberId || `${this.#namespace}.${event}.once`
    });
  }

  // ==================== 全局事件 API ====================

  /**
   * 触发全局事件（无命名空间，用于跨功能域通信）
   * @param {string} event - 事件名称（不会添加命名空间前缀）
   * @param {any} data - 事件数据
   * @param {Object} metadata - 元数据（可选）
   *
   * @example
   * eventBus.emitGlobal('pdf:list:updated', { records });
   * // 实际触发：pdf:list:updated（无 @ 前缀）
   */
  emitGlobal(event, data, metadata = {}) {
    this.#logger.debug(`Emitting global event: ${event} from namespace: ${this.#namespace}`);

    return this.#globalEventBus.emit(event, data, {
      ...metadata,
      source: this.#namespace
    });
  }

  /**
   * 监听全局事件（无命名空间）
   * @param {string} event - 事件名称（不会添加命名空间前缀）
   * @param {Function} callback - 回调函数
   * @param {Object} options - 选项
   * @returns {Function} 取消监听函数
   */
  onGlobal(event, callback, options = {}) {
    this.#logger.debug(`Listening to global event: ${event} in namespace: ${this.#namespace}`);

    return this.#globalEventBus.on(event, callback, {
      ...options,
      subscriberId: options.subscriberId || `${this.#namespace}.global.${event}`
    });
  }

  /**
   * 取消监听全局事件
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  offGlobal(event, callback) {
    return this.#globalEventBus.off(event, callback);
  }

  /**
   * 监听一次全局事件
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   * @param {Object} options - 选项
   * @returns {Function} 取消监听函数
   */
  onceGlobal(event, callback, options = {}) {
    return this.#globalEventBus.once(event, callback, {
      ...options,
      subscriberId: options.subscriberId || `${this.#namespace}.global.${event}.once`
    });
  }

  // ==================== 工具方法 ====================

  /**
   * 获取命名空间
   * @returns {string} 命名空间
   */
  getNamespace() {
    return this.#namespace;
  }

  /**
   * 获取全局事件总线
   * @returns {EventBus} 全局事件总线实例
   */
  getGlobalEventBus() {
    return this.#globalEventBus;
  }

  /**
   * 获取所有本地监听器的事件名称
   * @returns {string[]} 事件名称列表
   */
  getLocalEvents() {
    return Array.from(this.#localListeners.keys());
  }

  /**
   * 清除所有本地监听器
   */
  clearLocalListeners() {
    this.#localListeners.forEach((listeners, event) => {
      const namespacedEvent = this.#addNamespace(event);
      listeners.forEach(callback => {
        this.#globalEventBus.off(namespacedEvent, callback);
      });
    });

    this.#localListeners.clear();
    this.#logger.debug(`All local listeners cleared for namespace: ${this.#namespace}`);
  }

  /**
   * 销毁作用域事件总线
   */
  destroy() {
    this.clearLocalListeners();
    this.#logger.debug(`ScopedEventBus destroyed: ${this.#namespace}`);
  }

  // ==================== 私有方法 ====================

  /**
   * 添加命名空间前缀
   * @param {string} event - 原始事件名
   * @returns {string} 带命名空间的事件名
   * @private
   *
   * @example
   * addNamespace('table:row:selected')
   * // 返回：'@pdf-list/table:row:selected'
   */
  #addNamespace(event) {
    // 如果事件名已经有命名空间，不重复添加
    if (event.startsWith('@')) {
      return event;
    }

    return `${this.#namespacePrefix}${event}`;
  }

  /**
   * 移除命名空间前缀
   * @param {string} event - 带命名空间的事件名
   * @returns {string} 原始事件名
   * @private
   *
   * @example
   * removeNamespace('@pdf-list/table:row:selected')
   * // 返回：'table:row:selected'
   */
  #removeNamespace(event) {
    if (event.startsWith(this.#namespacePrefix)) {
      return event.substring(this.#namespacePrefix.length);
    }

    return event;
  }
}

/**
 * 创建作用域事件总线的工厂函数
 * @param {string} namespace - 命名空间
 * @param {EventBus} globalEventBus - 全局事件总线
 * @returns {ScopedEventBus} 作用域事件总线实例
 */
export function createScopedEventBus(namespace, globalEventBus) {
  return new ScopedEventBus(namespace, globalEventBus);
}

export default ScopedEventBus;
