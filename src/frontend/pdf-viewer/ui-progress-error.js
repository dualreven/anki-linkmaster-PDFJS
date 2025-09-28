/**
 * @file UI进度和错误显示模块
 * @module UIProgressError
 * @description 处理PDF查看器的进度显示和错误处理功能
 */

import { getLogger } from "../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../common/event/pdf-viewer-constants.js";

/**
 * @class UIProgressError
 * @description 进度和错误显示类，处理加载进度和错误信息显示
 */
export class UIProgressError {
  #eventBus;
  #logger;
  #container = null;
  #progressBar = null;
  #progressText = null;
  #errorContainer = null;

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("PDFViewer");
  }

  /**
   * 设置进度和错误UI
   * @param {HTMLElement} container - 容器元素
   */
  setupProgressAndErrorUI(container) {
    this.#container = container;
    
    // 创建进度条容器
    const progressContainer = document.createElement('div');
    progressContainer.className = 'pdf-progress-container';
    progressContainer.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 300px;
      background: rgba(255, 255, 255, 0.9);
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      text-align: center;
      z-index: 1000;
      display: none;
    `;
    
    // 创建进度条
    this.#progressBar = document.createElement('div');
    this.#progressBar.className = 'pdf-progress-bar';
    this.#progressBar.style.cssText = `
      width: 100%;
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
      margin: 10px 0;
    `;
    
    const progressFill = document.createElement('div');
    progressFill.className = 'pdf-progress-fill';
    progressFill.style.cssText = `
      width: 0%;
      height: 100%;
      background: #007bff;
      border-radius: 4px;
      transition: width 0.3s ease;
    `;
    this.#progressBar.appendChild(progressFill);
    
    // 创建进度文本
    this.#progressText = document.createElement('div');
    this.#progressText.className = 'pdf-progress-text';
    this.#progressText.style.cssText = `
      font-size: 14px;
      color: #666;
      margin-bottom: 10px;
    `;
    this.#progressText.textContent = '加载中... 0%';
    
    progressContainer.appendChild(this.#progressText);
    progressContainer.appendChild(this.#progressBar);
    
    // 创建错误容器
    this.#errorContainer = document.createElement('div');
    this.#errorContainer.className = 'pdf-error-container';
    this.#errorContainer.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 400px;
      background: rgba(255, 255, 255, 0.95);
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      text-align: center;
      z-index: 1001;
      display: none;
    `;
    
    this.#container.appendChild(progressContainer);
    this.#container.appendChild(this.#errorContainer);
    
    this.#logger.debug("Progress and error UI setup completed");
  }

  /**
   * 更新加载进度
   * @param {number} percent - 进度百分比
   * @param {string} [statusText] - 状态文本
   */
  updateProgress(percent, statusText = '加载中...') {
    if (this.#progressBar && this.#progressText) {
      const progressFill = this.#progressBar.querySelector('.pdf-progress-fill');
      if (progressFill) {
        progressFill.style.width = `${percent}%`;
      }
      this.#progressText.textContent = `${statusText} ${percent}%`;
      
      // 显示进度条
      const progressContainer = this.#progressBar.parentElement;
      if (progressContainer) {
        progressContainer.style.display = 'block';
      }
    }
  }

  /**
   * 隐藏进度条
   */
  hideProgress() {
    const progressContainer = this.#container.querySelector('.pdf-progress-container');
    if (progressContainer) {
      progressContainer.style.display = 'none';
    }
  }

  /**
   * 显示错误信息
   * @param {Object} errorData - 错误数据
   */
  showError(errorData) {
    this.#logger.error("UI Error:", errorData);
    
    // 隐藏进度条
    this.hideProgress();
    
    // 清空容器并显示错误信息
    this.#errorContainer.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h3 style="color: #dc3545; margin: 0 0 8px 0; font-size: 18px;">加载失败</h3>
        <p style="color: #6c757d; margin: 0 0 16px 0; font-size: 14px; line-height: 1.4;">
          ${errorData.userMessage || errorData.error}
        </p>
        ${errorData.retryable ? `
          <button id="pdf-retry-btn" style="
            background: #007bff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 8px;
          ">重试</button>
        ` : ''}
        <button id="pdf-close-btn" style="
          background: #6c757d;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">关闭</button>
      </div>
    `;
    
    this.#errorContainer.style.display = 'block';
    
    // 设置重试按钮事件
    const retryBtn = document.getElementById('pdf-retry-btn');
    if (retryBtn) {
      retryBtn.onclick = () => {
        this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.RETRY, errorData.file, {
          actorId: 'UIProgressError'
        });
        this.hideError();
      };
    }
    
    // 设置关闭按钮事件
    const closeBtn = document.getElementById('pdf-close-btn');
    if (closeBtn) {
      closeBtn.onclick = () => {
        this.hideError();
        this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.CLOSE, null, {
          actorId: 'UIProgressError'
        });
      };
    }
  }

  /**
   * 隐藏错误信息
   */
  hideError() {
    this.#errorContainer.style.display = 'none';
    this.#errorContainer.innerHTML = '';
  }

  /**
   * 显示简单错误信息
   * @param {string} message - 错误消息
   */
  showSimpleError(message) {
    this.#logger.error("UI Error:", message);
    
    if (this.#container) {
      // 清空容器并显示错误信息
      this.#container.innerHTML = `
        <div class="pdf-error">
          <h3>加载失败</h3>
          <p>${message}</p>
          <button onclick="window.location.reload()">重新加载</button>
        </div>
      `;
    }
  }

  /**
   * 销毁进度和错误UI
   */
  destroy() {
    this.#logger.info("Destroying Progress and Error UI");
    
    if (this.#container) {
      const progressContainer = this.#container.querySelector('.pdf-progress-container');
      if (progressContainer) {
        this.#container.removeChild(progressContainer);
      }
      
      if (this.#errorContainer && this.#errorContainer.parentNode) {
        this.#container.removeChild(this.#errorContainer);
      }
    }
    
    this.#progressBar = null;
    this.#progressText = null;
    this.#errorContainer = null;
  }
}