/**
 * @file 作用域事件总线
 * @module ScopedEventBus
 * @description 为事件总线提供命名空间隔离，解决多人协同开发时的事件命名冲突问题
 */

import { getLogger } from '../utils/logger.js';

/**
 * @typedef {import('../../pdf-viewer/types/events').EventBus} EventBus
 * @typedef {import('../../pdf-viewer/types/events').EventMetadata} EventMetadata
 * @typedef {import('../../pdf-viewer/types/events').EventOptions} EventOptions
 */

/**
 * 作用域事件总线类
 *
 * @class ScopedEventBus
 * @description
 * 为每个功能模块提供独立的事件命名空间，防止事件名冲突。
 *
 * 核心特性：
 * - 自动命名空间：模块内事件自动添加 @scope/ 前缀
 * - 模块内通信：on/emit 用于模块内部事件
 * - 跨模块通信：onGlobal/emitGlobal 用于全局事件
 * - 调试友好：事件名包含模块信息，便于追踪
 *
 * @example
 * const eventBus = createScopedEventBus(globalEventBus, 'pdf-manager');
 *
 * // 模块内事件（自动添加命名空间）
 * eventBus.on('file:loaded', handler);      // 实际监听: @pdf-manager/file:loaded
 * eventBus.emit('file:loading', data);      // 实际发射: @pdf-manager/file:loading
 *
 * // 全局事件（不添加命名空间）
 * eventBus.onGlobal('pdf:page:changed', handler);  // 实际监听: pdf:page:changed
 * eventBus.emitGlobal('pdf:file:loaded', data);    // 实际发射: pdf:file:loaded
 */
export class ScopedEventBus {
  /** @type {EventBus} */
  #globalEventBus;

  /** @type {string} */
  #scope;

  /** @type {import('../utils/logger.js').Logger} */
  #logger;

  /** @type {Array<{event: string, unsubscribe: Function}>} */
  #listeners = [];

  /**
   * 创建作用域事件总线实例
   *
   * @param {EventBus} globalEventBus - 全局事件总线实例
   * @param {string} scope - 作用域名称（通常是模块名）
   */
  constructor(globalEventBus, scope) {
    if (!globalEventBus) {
      throw new Error('ScopedEventBus: globalEventBus is required');
    }
    if (!scope || typeof scope !== 'string') {
      throw new Error('ScopedEventBus: scope must be a non-empty string');
    }

    this.#globalEventBus = globalEventBus;
    this.#scope = scope;
    this.#logger = getLogger(`ScopedEventBus:${scope}`);

    this.#logger.debug(`Created scoped event bus for: ${scope}`);
  }

  /**
   * 为事件名添加命名空间前缀
   *
   * @private
   * @param {string} event - 原始事件名
   * @returns {string} 带命名空间的事件名
   */
  #scopedEvent(event) {
    return `@${this.#scope}/${event}`;
  }

  /**
   * 注册模块内事件监听器（自动添加命名空间）
   *
   * @param {string} event - 事件名
   * @param {Function} callback - 回调函数
   * @param {EventOptions} [options={}] - 事件选项
   * @returns {Function} 取消订阅函数
   *
   * @example
   * eventBus.on('file:loaded', (data) => {
   *   console.log('File loaded:', data);
   * });
   * // 实际监听的事件名：@pdf-manager/file:loaded
   */
  on(event, callback, options = {}) {
    const scopedEvent = this.#scopedEvent(event);
    this.#logger.debug(`Listening: ${event} → ${scopedEvent}`);

    // 不强制传递 subscriberId，让 EventBus 从调用栈自动推断
    // EventBus 会跳过 scoped-event-bus.js，推断到真正的调用者
    const unsubscribe = this.#globalEventBus.on(scopedEvent, callback, options);

    // 记录监听器以便后续清理
    this.#listeners.push({ event: scopedEvent, unsubscribe });

    return unsubscribe;
  }

  /**
   * 发射模块内事件（自动添加命名空间）
   *
   * @param {string} event - 事件名
   * @param {*} data - 事件数据
   * @param {EventMetadata} [metadata={}] - 事件元数据
   *
   * @example
   * eventBus.emit('file:loading', { url: '/path/to/file.pdf' });
   * // 实际发射的事件名：@pdf-manager/file:loading
   */
  emit(event, data, metadata = {}) {
    const scopedEvent = this.#scopedEvent(event);
    this.#logger.debug(`Emitting: ${event} → ${scopedEvent}`);

    return this.#globalEventBus.emit(scopedEvent, data, {
      ...metadata,
      actorId: metadata.actorId || this.#scope
    });
  }

  /**
   * 注册全局事件监听器（不添加命名空间，用于跨模块通信）
   *
   * @param {string} event - 全局事件名
   * @param {Function} callback - 回调函数
   * @param {EventOptions} [options={}] - 事件选项
   * @returns {Function} 取消订阅函数
   *
   * @example
   * eventBus.onGlobal('pdf:page:changed', (data) => {
   *   console.log('Page changed:', data.pageNumber);
   * });
   * // 实际监听的事件名：pdf:page:changed（无命名空间前缀）
   */
  onGlobal(event, callback, options = {}) {
    this.#logger.debug(`Listening global: ${event}`);

    // 不强制传递 subscriberId，让 EventBus 从调用栈自动推断
    const unsubscribe = this.#globalEventBus.on(event, callback, options);

    // 记录监听器以便后续清理
    this.#listeners.push({ event, unsubscribe });

    return unsubscribe;
  }

  /**
   * 发射全局事件（不添加命名空间，用于跨模块通信）
   *
   * @param {string} event - 全局事件名
   * @param {*} data - 事件数据
   * @param {EventMetadata} [metadata={}] - 事件元数据
   *
   * @example
   * eventBus.emitGlobal('pdf:file:loaded', { url: '/file.pdf', pages: 10 });
   * // 实际发射的事件名：pdf:file:loaded（无命名空间前缀）
   */
  emitGlobal(event, data, metadata = {}) {
    this.#logger.debug(`Emitting global: ${event}`);

    return this.#globalEventBus.emit(event, data, {
      ...metadata,
      actorId: metadata.actorId || this.#scope
    });
  }

  /**
   * 移除事件监听器
   *
   * @param {string} event - 事件名（会自动添加命名空间）
   * @param {Function} [callback] - 回调函数（可选）
   *
   * @example
   * eventBus.off('file:loaded', handler);
   * // 实际移除的事件名：@pdf-manager/file:loaded
   */
  off(event, callback) {
    const scopedEvent = this.#scopedEvent(event);
    this.#logger.debug(`Removing listener: ${event} → ${scopedEvent}`);

    return this.#globalEventBus.off(scopedEvent, callback);
  }

  /**
   * 移除全局事件监听器
   *
   * @param {string} event - 全局事件名
   * @param {Function} [callback] - 回调函数（可选）
   *
   * @example
   * eventBus.offGlobal('pdf:page:changed', handler);
   */
  offGlobal(event, callback) {
    this.#logger.debug(`Removing global listener: ${event}`);

    return this.#globalEventBus.off(event, callback);
  }

  /**
   * 销毁作用域事件总线，清理所有监听器
   *
   * @example
   * eventBus.destroy();
   */
  destroy() {
    this.#logger.info(`Destroying scoped event bus: ${this.#scope}`);

    // 清理所有记录的监听器
    this.#listeners.forEach(({ event, unsubscribe }) => {
      try {
        unsubscribe();
        this.#logger.debug(`Unsubscribed from: ${event}`);
      } catch (error) {
        this.#logger.warn(`Failed to unsubscribe from ${event}:`, error);
      }
    });

    this.#listeners = [];
    this.#logger.debug(`Destroyed scoped event bus: ${this.#scope}`);
  }

  /**
   * 获取作用域名称
   *
   * @returns {string} 作用域名称
   */
  getScope() {
    return this.#scope;
  }

  /**
   * 获取监听器数量（用于调试）
   *
   * @returns {number} 监听器数量
   */
  getListenerCount() {
    return this.#listeners.length;
  }
}

/**
 * 创建作用域事件总线实例（工厂函数）
 *
 * @param {EventBus} globalEventBus - 全局事件总线实例
 * @param {string} scope - 作用域名称（模块名）
 * @returns {ScopedEventBus} 作用域事件总线实例
 *
 * @example
 * import { createScopedEventBus } from './common/event/scoped-event-bus.js';
 * import globalEventBus from './common/event/event-bus.js';
 *
 * const eventBus = createScopedEventBus(globalEventBus, 'pdf-manager');
 */
export function createScopedEventBus(globalEventBus, scope) {
  return new ScopedEventBus(globalEventBus, scope);
}
