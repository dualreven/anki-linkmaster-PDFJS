/**
 * 文本选择监听服务
 * @file 监听用户在PDF中选择文本，并触发翻译请求
 * @module SelectionMonitor
 */

import { getLogger } from '../../../../common/utils/logger.js';
import { PDF_TRANSLATOR_EVENTS } from '../events.js';

/**
 * 文本选择监听服务
 * @class SelectionMonitor
 * @description 监听文本选择事件，实现防抖和过滤，自动触发翻译
 */
export class SelectionMonitor {
  #eventBus;
  #logger;
  #lastSelection = null;     // 上一次选择的文本
  #debounceTimer = null;     // 防抖定时器
  #config = {
    enabled: true,           // 是否启用自动翻译
    minLength: 3,            // 最少选中字符数
    maxLength: 500,          // 最大选中字符数
    debounceDelay: 300       // 防抖延迟（毫秒）
  };
  #mouseUpHandler = null;    // mouseup 事件处理器引用

  /**
   * 构造函数
   * @param {EventBus} eventBus - 事件总线
   * @param {Object} [options] - 配置选项
   * @param {boolean} [options.enabled=true] - 是否启用
   * @param {number} [options.minLength=3] - 最小字符数
   * @param {number} [options.maxLength=500] - 最大字符数
   * @param {number} [options.debounceDelay=300] - 防抖延迟
   */
  constructor(eventBus, options = {}) {
    this.#eventBus = eventBus;
    this.#logger = getLogger('SelectionMonitor');

    // 应用配置
    if (options) {
      this.#config = { ...this.#config, ...options };
    }

    this.#logger.info('SelectionMonitor initialized', this.#config);
  }

  /**
   * 开始监听文本选择
   */
  startMonitoring() {
    if (!this.#config.enabled) {
      this.#logger.info('Monitoring is disabled');
      return;
    }

    // 创建事件处理器
    this.#mouseUpHandler = this.#handleMouseUp.bind(this);

    // 监听 mouseup 事件（鼠标释放时检测选择）
    document.addEventListener('mouseup', this.#mouseUpHandler);

    this.#logger.info('Started monitoring text selection');
  }

  /**
   * 停止监听
   */
  stopMonitoring() {
    if (this.#mouseUpHandler) {
      document.removeEventListener('mouseup', this.#mouseUpHandler);
      this.#mouseUpHandler = null;
    }

    // 清除定时器
    if (this.#debounceTimer) {
      clearTimeout(this.#debounceTimer);
      this.#debounceTimer = null;
    }

    this.#logger.info('Stopped monitoring text selection');
  }

  /**
   * 处理鼠标释放事件
   * @private
   * @param {MouseEvent} event - 鼠标事件
   */
  #handleMouseUp(event) {
    // 清除之前的定时器
    if (this.#debounceTimer) {
      clearTimeout(this.#debounceTimer);
    }

    // 防抖处理
    this.#debounceTimer = setTimeout(() => {
      this.#processSelection(event);
    }, this.#config.debounceDelay);
  }

  /**
   * 处理文本选择
   * @private
   * @param {MouseEvent} event - 鼠标事件
   */
  #processSelection(event) {
    const selection = window.getSelection();
    const text = selection?.toString().trim();

    // 验证选择的文本
    if (!this.#isValidSelection(text)) {
      return;
    }

    // 检查是否与上次选择相同（避免重复触发）
    if (text === this.#lastSelection) {
      this.#logger.debug('Same selection as before, skipping');
      return;
    }

    // 更新上次选择
    this.#lastSelection = text;

    // 获取选择位置
    const position = this.#getSelectionPosition(selection);

    // 获取当前页码（从PDF.js获取，如果可用）
    const pageNumber = this.#getCurrentPage();

    // 发送文本选择事件
    this.#eventBus.emit(
      PDF_TRANSLATOR_EVENTS.TEXT.SELECTED,
      {
        text,
        pageNumber,
        position,
        timestamp: Date.now()
      },
      { actorId: 'SelectionMonitor' }
    );

    this.#logger.info(`Text selected: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`, {
      length: text.length,
      pageNumber,
      position
    });
  }

  /**
   * 验证选择的文本是否有效
   * @private
   * @param {string} text - 选择的文本
   * @returns {boolean}
   */
  #isValidSelection(text) {
    // 检查是否为空
    if (!text || text.length === 0) {
      return false;
    }

    // 检查最小长度
    if (text.length < this.#config.minLength) {
      this.#logger.debug(`Selection too short: ${text.length} < ${this.#config.minLength}`);
      return false;
    }

    // 检查最大长度
    if (text.length > this.#config.maxLength) {
      this.#logger.warn(`Selection too long: ${text.length} > ${this.#config.maxLength}`);
      return false;
    }

    return true;
  }

  /**
   * 获取选择位置
   * @private
   * @param {Selection} selection - 选择对象
   * @returns {Object} 位置信息
   */
  #getSelectionPosition(selection) {
    try {
      if (!selection || selection.rangeCount === 0) {
        return { x: 0, y: 0 };
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      };
    } catch (error) {
      this.#logger.warn('Failed to get selection position:', error);
      return { x: 0, y: 0 };
    }
  }

  /**
   * 获取当前页码
   * @private
   * @returns {number} 页码（从1开始）
   */
  #getCurrentPage() {
    try {
      // 尝试从 PDF.js 获取当前页码
      // 方法1: 从 PDFViewerApplication（如果可用）
      if (window.PDFViewerApplication?.pdfViewer?.currentPageNumber) {
        return window.PDFViewerApplication.pdfViewer.currentPageNumber;
      }

      // 方法2: 从自定义全局对象
      if (window.pdfViewerApp?.container?.get('pdfViewerManager')) {
        const manager = window.pdfViewerApp.container.get('pdfViewerManager');
        if (manager && manager.getCurrentPage) {
          return manager.getCurrentPage();
        }
      }

      // 默认返回 1
      return 1;
    } catch (error) {
      this.#logger.warn('Failed to get current page number:', error);
      return 1;
    }
  }

  /**
   * 启用/禁用自动翻译
   * @param {boolean} enabled - 是否启用
   */
  setEnabled(enabled) {
    const wasEnabled = this.#config.enabled;
    this.#config.enabled = enabled;

    if (enabled && !wasEnabled) {
      this.startMonitoring();
    } else if (!enabled && wasEnabled) {
      this.stopMonitoring();
    }

    this.#logger.info(`Auto-translation ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * 是否已启用
   * @returns {boolean}
   */
  isEnabled() {
    return this.#config.enabled;
  }

  /**
   * 更新配置
   * @param {Object} config - 新配置
   */
  updateConfig(config) {
    this.#config = { ...this.#config, ...config };
    this.#logger.info('Config updated', this.#config);
  }

  /**
   * 获取当前配置
   * @returns {Object}
   */
  getConfig() {
    return { ...this.#config };
  }

  /**
   * 清除上次选择
   */
  clearLastSelection() {
    this.#lastSelection = null;
    this.#logger.debug('Last selection cleared');
  }

  /**
   * 销毁监听器
   */
  destroy() {
    this.#logger.info('Destroying SelectionMonitor...');
    this.stopMonitoring();
    this.clearLastSelection();
  }
}
