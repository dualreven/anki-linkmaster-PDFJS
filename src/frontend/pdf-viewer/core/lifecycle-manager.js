/**
 * @file 生命周期管理器
 * @module LifecycleManager
 * @description 负责管理应用的生命周期，包括全局错误处理
 */

import { getLogger } from '../../common/utils/logger.js';
import { PDF_VIEWER_EVENTS } from '../../common/event/pdf-viewer-constants.js';

/**
 * 生命周期管理器类
 * 负责管理应用的生命周期，包括全局错误处理
 *
 * @class LifecycleManager
 */
export class LifecycleManager {
  /** @type {import('../../common/utils/logger.js').Logger} */
  #logger;

  /** @type {import('../../common/event/event-bus.js').EventBus} */
  #eventBus;

  /** @type {import('../../common/error/error-handler.js').ErrorHandler} */
  #errorHandler;

  /** @type {boolean} */
  #errorHandlersSetup = false;

  /**
   * 创建生命周期管理器实例
   *
   * @param {import('../../common/event/event-bus.js').EventBus} eventBus - 事件总线
   * @param {import('../../common/error/error-handler.js').ErrorHandler} errorHandler - 错误处理器
   */
  constructor(eventBus, errorHandler) {
    if (!eventBus) {
      throw new Error('LifecycleManager: eventBus is required');
    }
    if (!errorHandler) {
      throw new Error('LifecycleManager: errorHandler is required');
    }

    this.#logger = getLogger('LifecycleManager');
    this.#eventBus = eventBus;
    this.#errorHandler = errorHandler;
  }

  /**
   * 设置全局错误处理
   */
  setupGlobalErrorHandling() {
    if (this.#errorHandlersSetup) {
      this.#logger.warn('Global error handlers already setup');
      return;
    }

    this.#logger.info('Setting up global error handling');

    // 捕获未处理的 Promise rejection
    window.addEventListener('unhandledrejection', this.#handleUnhandledRejection);

    // 捕获全局错误
    window.addEventListener('error', this.#handleGlobalError);

    this.#errorHandlersSetup = true;
    this.#logger.debug('Global error handlers registered');
  }

  /**
   * 处理未捕获的 Promise rejection
   *
   * @private
   * @param {PromiseRejectionEvent} event - Promise rejection 事件
   */
  #handleUnhandledRejection = (event) => {
    this.#logger.error('Unhandled Promise Rejection:', event.reason);

    // 使用ErrorHandler处理错误
    this.#errorHandler.handleError(event.reason, 'UnhandledPromiseRejection');

    // 发射错误事件
    this.#eventBus.emit('app:error:unhandled-rejection', {
      reason: event.reason,
      message: event.reason?.message || 'Unhandled promise rejection'
    }, {
      actorId: 'LifecycleManager'
    });
  }

  /**
   * 处理全局错误
   *
   * @private
   * @param {ErrorEvent} event - 错误事件
   */
  #handleGlobalError = (event) => {
    this.#logger.error('Global Error:', event.error);

    // 使用ErrorHandler处理错误
    this.#errorHandler.handleError(event.error, 'GlobalError');

    // 发射错误事件
    this.#eventBus.emit('app:error:global', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    }, {
      actorId: 'LifecycleManager'
    });
  }

  /**
   * 清理全局错误处理
   */
  cleanup() {
    if (!this.#errorHandlersSetup) {
      return;
    }

    this.#logger.info('Cleaning up global error handlers');

    window.removeEventListener('unhandledrejection', this.#handleUnhandledRejection);
    window.removeEventListener('error', this.#handleGlobalError);

    this.#errorHandlersSetup = false;
    this.#logger.debug('Global error handlers removed');
  }

  /**
   * 检查错误处理器是否已设置
   *
   * @returns {boolean}
   */
  isSetup() {
    return this.#errorHandlersSetup;
  }
}
