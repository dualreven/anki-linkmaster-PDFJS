/**
 * @file PDF查看器事件总线模块
 * @module PDFViewerEventBus
 * @description 基于通用EventBus的PDF查看器专用事件总线封装
 */

import { EventBus } from "../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../common/event/pdf-viewer-constants.js";
import { getLogger } from "../common/utils/logger.js";

/**
 * @class PDFViewerEventBus
 * @description PDF查看器专用事件总线，提供类型安全的事件发布/订阅接口
 */
export class PDFViewerEventBus {
  #eventBus;
  #logger;

  constructor(options = {}) {
    this.#eventBus = new EventBus({
      enableValidation: true,
      logLevel: options.logLevel || Logger.LogLevel.INFO,
      ...options
    });
    this.#logger = getLogger("PDFViewer");
  }

  /**
   * 订阅PDF查看器事件
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   * @param {Object} [options] - 选项
   * @returns {Function} 取消订阅函数
   */
  on(event, callback, options = {}) {
    this.#validateEventName(event);
    return this.#eventBus.on(event, callback, options);
  }

  /**
   * 取消订阅事件
   * @param {string} event - 事件名称
   * @param {Function|string} callbackOrId - 回调函数或订阅者ID
   */
  off(event, callbackOrId) {
    this.#eventBus.off(event, callbackOrId);
  }

  /**
   * 发布PDF查看器事件
   * @param {string} event - 事件名称
   * @param {*} data - 事件数据
   * @param {Object} [options] - 选项
   */
  emit(event, data, options = {}) {
    this.#validateEventName(event);
    this.#eventBus.emit(event, data, options);
  }

  /**
   * 订阅一次事件
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   * @param {Object} [options] - 选项
   * @returns {Function} 取消订阅函数
   */
  once(event, callback, options = {}) {
    this.#validateEventName(event);
    return this.#eventBus.once(event, callback, options);
  }

  /**
   * 验证事件名称是否符合PDF查看器规范
   * @param {string} event - 事件名称
   * @private
   */
  #validateEventName(event) {
    if (!event.startsWith('pdf_viewer:')) {
      this.#logger.warn(`事件名称 '${event}' 不符合PDF查看器命名规范，应以 'pdf_viewer:' 开头`);
    }
  }

  /**
   * 销毁事件总线
   */
  destroy() {
    this.#eventBus.destroy();
  }

  /**
   * 获取底层EventBus实例（用于高级集成）
   * @returns {EventBus} 底层EventBus实例
   */
  getEventBus() {
    return this.#eventBus;
  }

  // ===== PDF查看器特定事件快捷方法 =====

  /**
   * 订阅文件加载事件
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消订阅函数
   */
  onFileLoadRequested(callback) {
    return this.on(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, callback);
  }

  /**
   * 订阅文件加载成功事件
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消订阅函数
   */
  onFileLoadSuccess(callback) {
    return this.on(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, callback);
  }

  /**
   * 订阅文件加载失败事件
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消订阅函数
   */
  onFileLoadFailed(callback) {
    return this.on(PDF_VIEWER_EVENTS.FILE.LOAD.FAILED, callback);
  }

  /**
   * 发布文件加载请求事件
   * @param {Object} fileData - 文件数据
   */
  emitFileLoadRequested(fileData) {
    this.emit(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, fileData, {
      actorId: 'PDFViewerEventBus'
    });
  }

  /**
   * 发布文件加载成功事件
   * @param {Object} result - 加载结果
   */
  emitFileLoadSuccess(result) {
    this.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, result, {
      actorId: 'PDFViewerEventBus'
    });
  }

  /**
   * 发布文件加载失败事件
   * @param {Object} error - 错误信息
   */
  emitFileLoadFailed(error) {
    this.emit(PDF_VIEWER_EVENTS.FILE.LOAD.FAILED, error, {
      actorId: 'PDFViewerEventBus'
    });
  }

  /**
   * 订阅页面导航事件
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消订阅函数
   */
  onNavigationChanged(callback) {
    return this.on(PDF_VIEWER_EVENTS.NAVIGATION.CHANGED, callback);
  }

  /**
   * 发布页面导航改变事件
   * @param {Object} navigationData - 导航数据
   */
  emitNavigationChanged(navigationData) {
    this.emit(PDF_VIEWER_EVENTS.NAVIGATION.CHANGED, navigationData, {
      actorId: 'PDFViewerEventBus'
    });
  }

  /**
   * 订阅缩放改变事件
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消订阅函数
   */
  onZoomChanged(callback) {
    return this.on(PDF_VIEWER_EVENTS.ZOOM.CHANGED, callback);
  }

  /**
   * 发布缩放改变事件
   * @param {Object} zoomData - 缩放数据
   */
  emitZoomChanged(zoomData) {
    this.emit(PDF_VIEWER_EVENTS.ZOOM.CHANGED, zoomData, {
      actorId: 'PDFViewerEventBus'
    });
  }

  /**
   * 订阅页面渲染完成事件
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消订阅函数
   */
  onPageRenderCompleted(callback) {
    return this.on(PDF_VIEWER_EVENTS.RENDER.PAGE_COMPLETED, callback);
  }

  /**
   * 发布页面渲染完成事件
   * @param {Object} renderData - 渲染数据
   */
  emitPageRenderCompleted(renderData) {
    this.emit(PDF_VIEWER_EVENTS.RENDER.PAGE_COMPLETED, renderData, {
      actorId: 'PDFViewerEventBus'
    });
  }

  /**
   * 订阅应用状态事件
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消订阅函数
   */
  onStateChanged(callback) {
    return this.on(PDF_VIEWER_EVENTS.STATE.LOADING, callback);
  }

  /**
   * 发布应用状态事件
   * @param {boolean} isLoading - 是否正在加载
   */
  emitStateLoading(isLoading) {
    this.emit(PDF_VIEWER_EVENTS.STATE.LOADING, isLoading, {
      actorId: 'PDFViewerEventBus'
    });
  }

  /**
   * 发布错误状态事件
   * @param {Object} error - 错误信息
   */
  emitStateError(error) {
    this.emit(PDF_VIEWER_EVENTS.STATE.ERROR, error, {
      actorId: 'PDFViewerEventBus'
    });
  }
}

/**
 * 默认导出的PDF查看器事件总线实例
 */
export default new PDFViewerEventBus();