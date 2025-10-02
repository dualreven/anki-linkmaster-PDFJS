/**
 * @file 模态框管理器
 * @module ModalManager
 * @description 管理模态框的创建、显示和隐藏，提供统一的模态框接口
 */

import { getLogger } from '../../../../common/utils/logger.js';

const logger = getLogger('PDFList.ModalManager');

/**
 * 模态框管理器类
 * @class ModalManager
 */
export class ModalManager {
  #currentModal = null;
  #overlay = null;
  #isOpen = false;
  #eventBus = null;

  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {Object} [options.eventBus] - 事件总线实例（可选）
   */
  constructor({ eventBus } = {}) {
    this.#eventBus = eventBus;
    logger.debug('ModalManager initialized');
  }

  /**
   * 显示模态框
   * @param {Object} config - 模态框配置
   * @param {string} config.title - 模态框标题
   * @param {HTMLElement|string} config.content - 模态框内容（DOM元素或HTML字符串）
   * @param {Function} [config.onConfirm] - 确认回调函数
   * @param {Function} [config.onCancel] - 取消回调函数
   * @param {boolean} [config.showFooter=true] - 是否显示底部按钮
   * @param {string} [config.confirmText='确定'] - 确认按钮文本
   * @param {string} [config.cancelText='取消'] - 取消按钮文本
   * @returns {Promise<void>}
   */
  async show(config) {
    if (this.#isOpen) {
      logger.warn('Modal is already open, closing previous modal');
      await this.hide();
    }

    try {
      // 创建遮罩层
      this.#overlay = this.#createOverlay();
      document.body.appendChild(this.#overlay);

      // 创建模态框
      this.#currentModal = this.#createModal(config);
      document.body.appendChild(this.#currentModal);

      // 绑定事件
      this.#bindEvents(config);

      // 标记为打开状态
      this.#isOpen = true;

      // 添加显示动画
      await this.#animateShow();

      logger.info('Modal shown:', config.title);

    } catch (error) {
      logger.error('Error showing modal:', error);
      throw error;
    }
  }

  /**
   * 隐藏模态框
   * @returns {Promise<void>}
   */
  async hide() {
    if (!this.#isOpen) {
      return;
    }

    try {
      // 添加隐藏动画
      await this.#animateHide();

      // 清理DOM
      if (this.#currentModal && this.#currentModal.parentElement) {
        this.#currentModal.parentElement.removeChild(this.#currentModal);
      }

      if (this.#overlay && this.#overlay.parentElement) {
        this.#overlay.parentElement.removeChild(this.#overlay);
      }

      // 重置状态
      this.#currentModal = null;
      this.#overlay = null;
      this.#isOpen = false;

      logger.info('Modal hidden');

    } catch (error) {
      logger.error('Error hiding modal:', error);
      throw error;
    }
  }

  /**
   * 创建遮罩层
   * @returns {HTMLElement} 遮罩层元素
   * @private
   */
  #createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'pdf-modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 9998;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    return overlay;
  }

  /**
   * 创建模态框元素
   * @param {Object} config - 模态框配置
   * @returns {HTMLElement} 模态框元素
   * @private
   */
  #createModal(config) {
    const modal = document.createElement('div');
    modal.className = 'pdf-modal';
    modal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.9);
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      z-index: 9999;
      min-width: 400px;
      max-width: 90%;
      max-height: 90%;
      overflow: auto;
      opacity: 0;
      transition: opacity 0.3s ease, transform 0.3s ease;
    `;

    // 创建头部
    const header = this.#createModalHeader(config.title);
    modal.appendChild(header);

    // 创建内容区域
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'pdf-modal-content';
    contentWrapper.style.cssText = `
      padding: 20px;
      max-height: 60vh;
      overflow-y: auto;
    `;

    if (typeof config.content === 'string') {
      contentWrapper.innerHTML = config.content;
    } else if (config.content instanceof HTMLElement) {
      contentWrapper.appendChild(config.content);
    }

    modal.appendChild(contentWrapper);

    // 创建底部（如果需要）
    if (config.showFooter !== false) {
      const footer = this.#createModalFooter(config);
      modal.appendChild(footer);
    }

    return modal;
  }

  /**
   * 创建模态框头部
   * @param {string} title - 标题文本
   * @returns {HTMLElement} 头部元素
   * @private
   */
  #createModalHeader(title) {
    const header = document.createElement('div');
    header.className = 'pdf-modal-header';
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #e0e0e0;
    `;

    const titleElement = document.createElement('h3');
    titleElement.textContent = title;
    titleElement.style.cssText = `
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    `;

    const closeButton = document.createElement('button');
    closeButton.className = 'pdf-modal-close';
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
      background: none;
      border: none;
      font-size: 28px;
      line-height: 1;
      color: #999;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    header.appendChild(titleElement);
    header.appendChild(closeButton);

    return header;
  }

  /**
   * 创建模态框底部
   * @param {Object} config - 模态框配置
   * @returns {HTMLElement} 底部元素
   * @private
   */
  #createModalFooter(config) {
    const footer = document.createElement('div');
    footer.className = 'pdf-modal-footer';
    footer.style.cssText = `
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 20px;
      border-top: 1px solid #e0e0e0;
    `;

    const cancelButton = document.createElement('button');
    cancelButton.className = 'pdf-modal-btn-cancel';
    cancelButton.textContent = config.cancelText || '取消';
    cancelButton.style.cssText = `
      padding: 8px 16px;
      border: 1px solid #ddd;
      background: white;
      color: #666;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    `;

    const confirmButton = document.createElement('button');
    confirmButton.className = 'pdf-modal-btn-confirm';
    confirmButton.textContent = config.confirmText || '确定';
    confirmButton.style.cssText = `
      padding: 8px 16px;
      border: none;
      background: #4CAF50;
      color: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    `;

    footer.appendChild(cancelButton);
    footer.appendChild(confirmButton);

    return footer;
  }

  /**
   * 绑定事件监听器
   * @param {Object} config - 模态框配置
   * @private
   */
  #bindEvents(config) {
    // 关闭按钮事件
    const closeButton = this.#currentModal.querySelector('.pdf-modal-close');
    if (closeButton) {
      closeButton.addEventListener('click', async () => {
        if (config.onCancel) {
          await config.onCancel();
        }
        await this.hide();
      });
    }

    // 取消按钮事件
    const cancelButton = this.#currentModal.querySelector('.pdf-modal-btn-cancel');
    if (cancelButton) {
      cancelButton.addEventListener('click', async () => {
        if (config.onCancel) {
          await config.onCancel();
        }
        await this.hide();
      });
    }

    // 确认按钮事件
    const confirmButton = this.#currentModal.querySelector('.pdf-modal-btn-confirm');
    if (confirmButton) {
      confirmButton.addEventListener('click', async () => {
        if (config.onConfirm) {
          const result = await config.onConfirm();
          // 如果回调返回false，不关闭模态框（用于表单验证失败的情况）
          if (result === false) {
            return;
          }
        }
        await this.hide();
      });
    }

    // 遮罩层点击事件（点击遮罩层关闭）
    if (this.#overlay) {
      this.#overlay.addEventListener('click', async () => {
        if (config.onCancel) {
          await config.onCancel();
        }
        await this.hide();
      });
    }

    // ESC键事件
    const handleEscape = async (e) => {
      if (e.key === 'Escape' && this.#isOpen) {
        if (config.onCancel) {
          await config.onCancel();
        }
        await this.hide();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  /**
   * 显示动画
   * @returns {Promise<void>}
   * @private
   */
  async #animateShow() {
    return new Promise(resolve => {
      // 使用requestAnimationFrame确保样式已应用
      requestAnimationFrame(() => {
        if (this.#overlay) {
          this.#overlay.style.opacity = '1';
        }
        if (this.#currentModal) {
          this.#currentModal.style.opacity = '1';
          this.#currentModal.style.transform = 'translate(-50%, -50%) scale(1)';
        }
        setTimeout(resolve, 300);
      });
    });
  }

  /**
   * 隐藏动画
   * @returns {Promise<void>}
   * @private
   */
  async #animateHide() {
    return new Promise(resolve => {
      if (this.#overlay) {
        this.#overlay.style.opacity = '0';
      }
      if (this.#currentModal) {
        this.#currentModal.style.opacity = '0';
        this.#currentModal.style.transform = 'translate(-50%, -50%) scale(0.9)';
      }
      setTimeout(resolve, 300);
    });
  }

  /**
   * 检查模态框是否打开
   * @returns {boolean} 是否打开
   */
  isOpen() {
    return this.#isOpen;
  }

  /**
   * 获取当前模态框元素
   * @returns {HTMLElement|null} 当前模态框元素
   */
  getCurrentModal() {
    return this.#currentModal;
  }
}
