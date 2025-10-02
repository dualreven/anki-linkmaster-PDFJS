/**
 * @file 事件处理器基类
 * @module BaseEventHandler
 * @description 所有功能模块的事件处理器都应继承此类，提供统一的事件监听和清理机制
 */

import { getLogger } from '../../common/utils/logger.js';

/**
 * 事件处理器基类
 *
 * @abstract
 * @class BaseEventHandler
 *
 * @description
 * 提供统一的事件处理模式：
 * - 自动错误捕获
 * - 自动监听器清理
 * - 日志记录
 * - 抽象setup()方法强制子类实现
 *
 * @example
 * class PDFEventHandler extends BaseEventHandler {
 *   constructor(pdfManager, eventBus) {
 *     super(pdfManager, eventBus, 'PDFEventHandler');
 *   }
 *
 *   setup() {
 *     this._on(PDF_EVENTS.FILE.LOAD.REQUESTED, this.handleLoadRequest);
 *   }
 *
 *   handleLoadRequest = async (data) => {
 *     // 处理逻辑
 *   }
 * }
 */
export class BaseEventHandler {
  /** @type {import('../../common/utils/logger.js').Logger} */
  #logger;

  /** @type {import('../../common/event/event-bus.js').EventBus} */
  #eventBus;

  /** @type {Array<{event: string, unsubscribe: Function}>} */
  #listeners = [];

  /** @type {Object} 上下文对象（通常是功能模块的manager） */
  context;

  /**
   * 创建事件处理器实例
   *
   * @param {Object} context - 上下文对象（通常是功能模块的 manager）
   * @param {import('../../common/event/event-bus.js').EventBus} eventBus - 事件总线实例
   * @param {string} [name] - Handler 名称（用于日志，默认使用类名）
   *
   * @throws {Error} 如果尝试直接实例化抽象类
   */
  constructor(context, eventBus, name) {
    // 防止直接实例化抽象类
    if (new.target === BaseEventHandler) {
      throw new Error('BaseEventHandler is abstract and cannot be instantiated directly');
    }

    if (!eventBus) {
      throw new Error('EventBus is required');
    }

    this.context = context;
    this.#eventBus = eventBus;
    this.#logger = getLogger(name || this.constructor.name);

    this.#logger.debug(`${name || this.constructor.name} created`);
  }

  /**
   * 设置事件监听
   * 子类必须实现此方法
   *
   * @abstract
   * @throws {Error} 如果子类未实现
   *
   * @example
   * setup() {
   *   this._on(PDF_EVENTS.FILE.LOAD.REQUESTED, this.handleLoadRequest);
   *   this._on(PDF_EVENTS.PAGE.NAVIGATE, this.handlePageNavigate);
   * }
   */
  setup() {
    throw new Error(`${this.constructor.name} must implement setup() method`);
  }

  /**
   * 注册事件监听（带自动清理和错误捕获）
   *
   * @protected
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   * @param {Object} [options={}] - 选项
   * @param {boolean} [options.once=false] - 是否只监听一次
   * @param {number} [options.priority=0] - 优先级
   * @param {string} [options.subscriberId] - 订阅者ID
   * @returns {Function} 取消订阅函数
   *
   * @example
   * this._on(PDF_EVENTS.FILE.LOADED, this.handleFileLoaded, { once: true });
   */
  _on(event, callback, options = {}) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }

    // 包装回调函数以捕获异常
    const wrappedCallback = (...args) => {
      try {
        const result = callback.apply(this, args);

        // 如果返回 Promise，捕获 rejection
        if (result instanceof Promise) {
          result.catch((error) => {
            this.#logger.error(`Async error in ${event} handler:`, error);
          });
        }

        return result;
      } catch (error) {
        this.#logger.error(`Error in ${event} handler:`, error);
        // 不重新抛出错误，避免中断其他监听器
      }
    };

    // 注册监听
    const unsubscribe = this.#eventBus.on(event, wrappedCallback, {
      ...options,
      subscriberId: options.subscriberId || this.constructor.name
    });

    // 记录以便清理
    this.#listeners.push({ event, unsubscribe });

    this.#logger.debug(`Registered listener for: ${event}`);

    return unsubscribe;
  }

  /**
   * 发射事件
   *
   * @protected
   * @param {string} event - 事件名称
   * @param {*} data - 事件数据
   * @param {Object} [metadata] - 事件元数据
   *
   * @example
   * this._emit(PDF_EVENTS.FILE.LOADED, { document, totalPages });
   */
  _emit(event, data, metadata = {}) {
    this.#logger.debug(`Emitting event: ${event}`, data);
    this.#eventBus.emit(event, data, {
      ...metadata,
      actorId: metadata.actorId || this.constructor.name
    });
  }

  /**
   * 清理所有监听器
   *
   * @public
   *
   * @example
   * pdfHandler.destroy();
   */
  destroy() {
    this.#logger.debug(`Destroying ${this.constructor.name}, cleaning up ${this.#listeners.length} listeners`);

    this.#listeners.forEach(({ event, unsubscribe }) => {
      try {
        unsubscribe();
        this.#logger.debug(`Unsubscribed from: ${event}`);
      } catch (error) {
        this.#logger.error(`Error unsubscribing from ${event}:`, error);
      }
    });

    this.#listeners = [];
    this.#logger.debug(`${this.constructor.name} destroyed`);
  }

  /**
   * 获取已注册的监听器数量
   *
   * @public
   * @returns {number} 监听器数量
   */
  getListenerCount() {
    return this.#listeners.length;
  }

  /**
   * 获取已注册的事件列表
   *
   * @public
   * @returns {string[]} 事件名称数组
   */
  getRegisteredEvents() {
    return this.#listeners.map(({ event }) => event);
  }
}
