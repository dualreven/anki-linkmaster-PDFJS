/**
 * @file 窗口控制组件
 * @module WindowControlsComponent
 * @description 提供跨模块复用的窗口控制按钮组件（最小化、最大化、关闭）
 */

import { getLogger } from '../../utils/logger.js';

const logger = getLogger('WindowControlsComponent');

/**
 * 窗口控制组件配置
 * @typedef {Object} WindowControlsOptions
 * @property {string} bridgeName - PyQt Bridge对象名称（如 'pdfViewerBridge' 或 'pyqtBridge'）
 * @property {Object} [wsClient=null] - WebSocket客户端实例（可选，用于关闭前注销）
 * @property {boolean} [autoLoad=true] - 是否自动加载CSS样式
 */

/**
 * 窗口控制组件类
 * @class WindowControlsComponent
 * @description 管理自定义窗口控制按钮,通过QWebChannel调用PyQt窗口方法
 */
export class WindowControlsComponent {
  #bridgeName = '';
  #wsClient = null;
  #container = null;
  #minimizeBtn = null;
  #maximizeBtn = null;
  #closeBtn = null;
  #boundHandlers = {
    minimize: null,
    maximize: null,
    close: null
  };
  #mounted = false;

  /**
   * 构造函数
   * @param {WindowControlsOptions} options - 组件配置
   */
  constructor(options) {
    this.#bridgeName = options.bridgeName || 'pdfViewerBridge';
    this.#wsClient = options.wsClient || null;

    logger.info(`WindowControlsComponent created with bridgeName="${this.#bridgeName}"`);

    // 自动加载CSS样式（如果启用）
    if (options.autoLoad !== false) {
      this.#loadCSS();
    }
  }

  /**
   * 加载CSS样式文件
   * @private
   */
  #loadCSS() {
    const cssId = 'window-controls-styles';
    if (document.getElementById(cssId)) {
      return; // 样式已加载
    }

    const link = document.createElement('link');
    link.id = cssId;
    link.rel = 'stylesheet';
    link.href = new URL('./window-controls.css', import.meta.url).href;
    document.head.appendChild(link);

    logger.debug('CSS loaded');
  }

  /**
   * 挂载组件到DOM
   * @param {HTMLElement|string} containerOrSelector - 容器元素或选择器
   * @returns {Promise<void>}
   */
  async mount(containerOrSelector) {
    if (this.#mounted) {
      logger.warn('Component already mounted');
      return;
    }

    // 等待 DOM 加载完成
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      });
    }

    // 获取容器元素
    if (typeof containerOrSelector === 'string') {
      this.#container = document.querySelector(containerOrSelector);
    } else if (containerOrSelector instanceof HTMLElement) {
      this.#container = containerOrSelector;
    } else {
      throw new Error('Invalid container: must be HTMLElement or selector string');
    }

    if (!this.#container) {
      throw new Error('Container element not found');
    }

    // 加载HTML模板
    const html = await this.#loadHTML();
    // 修复：使用 insertAdjacentHTML 追加内容，而不是覆盖整个容器
    // 原因：innerHTML 会删除容器内原有的搜索按钮和侧边栏按钮容器
    this.#container.insertAdjacentHTML('beforeend', html);

    // 获取按钮元素
    this.#minimizeBtn = this.#container.querySelector('#window-minimize-btn');
    this.#maximizeBtn = this.#container.querySelector('#window-maximize-btn');
    this.#closeBtn = this.#container.querySelector('#window-close-btn');

    if (!this.#minimizeBtn || !this.#maximizeBtn || !this.#closeBtn) {
      throw new Error('Window control buttons not found after mounting');
    }

    // 绑定事件处理器
    this.#boundHandlers.minimize = this.#handleMinimize.bind(this);
    this.#boundHandlers.maximize = this.#handleMaximize.bind(this);
    this.#boundHandlers.close = this.#handleClose.bind(this);

    this.#minimizeBtn.addEventListener('click', this.#boundHandlers.minimize);
    this.#maximizeBtn.addEventListener('click', this.#boundHandlers.maximize);
    this.#closeBtn.addEventListener('click', this.#boundHandlers.close);

    this.#mounted = true;
    logger.info('Component mounted successfully');
  }

  /**
   * 加载HTML模板
   * @private
   * @returns {Promise<string>}
   */
  async #loadHTML() {
    const url = new URL('./window-controls.html', import.meta.url).href;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load template: ${response.statusText}`);
    }
    return await response.text();
  }

  /**
   * 处理最小化按钮点击
   * @private
   */
  #handleMinimize() {
    logger.info('Minimize button clicked');
    this.#callBridgeMethod('minimizeWindow');
  }

  /**
   * 处理最大化按钮点击
   * @private
   */
  #handleMaximize() {
    logger.info('Maximize button clicked');
    this.#callBridgeMethod('maximizeWindow');
  }

  /**
   * 处理关闭按钮点击
   * @private
   * 流程: 1. 发送 app-window:close:requested 消息到 msgCenter
   *       2. 后端统一处理窗口关闭和 WebSocket 断开
   *       3. 如果 WebSocket 不可用，回退到 PyQt Bridge
   */
  async #handleClose() {
    logger.info('Close button clicked, starting close sequence...');

    try {
      // Step 1: 通过 WebSocket 发送窗口关闭请求到 msgCenter
      if (this.#wsClient) {
        logger.info('Sending window close request via WebSocket...');

        // 发送 app-window:close:requested 消息
        await this.#wsClient.send({
          type: 'app-window:close:requested',
          data: {
            client_id: 'pdf-home',  // pdf-home 的固定 client_id
            reason: 'user_close'
          }
        });

        logger.info('Window close request sent, backend will close window and disconnect WebSocket');
        // 注意：后端会统一处理窗口关闭和 WebSocket 断开，不需要手动操作

      } else {
        logger.warn('wsClient not available, falling back to PyQt Bridge');
        // 兜底方案：直接调用 PyQt Bridge
        await this.#callBridgeMethod('requestCloseWindow');
        logger.info('Fallback: Window close request sent via PyQt Bridge');
      }

    } catch (error) {
      logger.error('Failed to send close request:', error);
      // 兜底方案：直接调用 PyQt Bridge
      try {
        logger.warn('Attempting fallback: closing window via PyQt Bridge');
        await this.#callBridgeMethod('requestCloseWindow');
        logger.info('Fallback close succeeded via PyQt Bridge');
      } catch (fallbackError) {
        logger.error('Fallback close also failed:', fallbackError);
      }
    }
  }

  /**
   * 通过 QWebChannel 调用 Bridge 方法
   * @private
   * @param {string} methodName - 方法名称
   * @returns {Promise<boolean>}
   */
  #callBridgeMethod(methodName) {
    return new Promise((resolve, reject) => {
      // 检查 QWebChannel 是否可用
      if (typeof window.qt === "undefined" || !window.qt.webChannelTransport) {
        const error = new Error("QWebChannel not available");
        logger.error(
          "窗口控制失败：QWebChannel 未就绪，无法访问原生窗口",
          { methodName, reason: "qt_webchannel_missing" },
          { toast: { type: "error", ms: 5000 } }
        );
        reject(error);
        return;
      }

      // 创建 QWebChannel 连接
      const QWebChannel = window.QWebChannel;
      new QWebChannel(window.qt.webChannelTransport, (channel) => {
        try {
          const bridge = channel?.objects?.[this.#bridgeName];
          if (!bridge || typeof bridge[methodName] !== "function") {
            const error = new Error(`${this.#bridgeName}.${methodName}() not available`);
            logger.error(
              "窗口控制失败：PyQt 桥接对象上未找到指定方法",
              { bridgeName: this.#bridgeName, methodName, reason: "bridge_method_missing" },
              { toast: { type: "error", ms: 5000 } }
            );
            reject(error);
            return;
          }

          // 调用 PyQt 方法
          Promise.resolve(bridge[methodName]())
            .then((result) => {
              if (result) {
                logger.info(`${methodName} request accepted by PyQt`);
                resolve(true);
              } else {
                const error = new Error(`${methodName} request rejected by PyQt`);
                logger.warn(error.message);
                reject(error);
              }
            })
            .catch((error) => {
              logger.error(`Error calling ${methodName}:`, error);
              reject(error);
            });

        } catch (error) {
          logger.error(`Error accessing ${this.#bridgeName}:`, error);
          reject(error);
        }
      });
    });
  }

  /**
   * 销毁组件,清理资源
   */
  destroy() {
    if (!this.#mounted) {
      logger.warn('Component not mounted, nothing to destroy');
      return;
    }

    logger.info('Destroying component...');

    // 移除事件监听器
    if (this.#minimizeBtn && this.#boundHandlers.minimize) {
      this.#minimizeBtn.removeEventListener('click', this.#boundHandlers.minimize);
    }
    if (this.#maximizeBtn && this.#boundHandlers.maximize) {
      this.#maximizeBtn.removeEventListener('click', this.#boundHandlers.maximize);
    }
    if (this.#closeBtn && this.#boundHandlers.close) {
      this.#closeBtn.removeEventListener('click', this.#boundHandlers.close);
    }

    // 清理DOM - 只删除我们添加的 .window-controls 容器
    // 不要使用 innerHTML = ''，那会删除容器内所有内容（包括搜索按钮等）
    if (this.#container) {
      const windowControlsDiv = this.#container.querySelector('.window-controls');
      if (windowControlsDiv) {
        windowControlsDiv.remove();
      }
    }

    // 清理引用
    this.#container = null;
    this.#minimizeBtn = null;
    this.#maximizeBtn = null;
    this.#closeBtn = null;
    this.#boundHandlers = { minimize: null, maximize: null, close: null };
    this.#wsClient = null;
    this.#mounted = false;

    logger.info('Component destroyed');
  }

  /**
   * 检查组件是否已挂载
   * @returns {boolean}
   */
  get mounted() {
    return this.#mounted;
  }
}
