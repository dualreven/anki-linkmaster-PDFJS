/**
 * @file UI管理器核心（重构版）
 * @module UIManagerCore
 * @description 协调DOM元素、键盘事件和UI状态的主管理器
 */

import { getLogger } from "../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { DOMElementManager } from "./dom-element-manager.js";
import { KeyboardHandler } from "./keyboard-handler.js";
import { UIStateManager } from "./ui-state-manager.js";

/**
 * UI管理器核心类
 * 整合所有UI相关的子模块
 */
export class UIManagerCore {
  #eventBus;
  #logger;
  #domManager;
  #keyboardHandler;
  #stateManager;
  #resizeObserver;
  #unsubscribeFunctions = [];

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("UIManagerCore");

    // 初始化子模块
    this.#domManager = new DOMElementManager();
    this.#keyboardHandler = new KeyboardHandler(eventBus);
    this.#stateManager = new UIStateManager();
  }

  /**
   * 初始化UI管理器
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.#logger.info("Initializing UI Manager Core...");

      // 初始化DOM元素
      const elements = this.#domManager.initializeElements();

      // 设置键盘事件
      this.#keyboardHandler.setupEventListener();

      // 设置事件监听
      this.#setupEventListeners();

      // 设置尺寸观察器
      this.#setupResizeObserver();

      // 设置滚轮事件
      this.#setupWheelListener();

      this.#logger.info("UI Manager Core initialized successfully");
    } catch (error) {
      this.#logger.error("Failed to initialize UI Manager Core:", error);
      throw error;
    }
  }

  /**
   * 设置事件监听
   * @private
   */
  #setupEventListeners() {
    // 页面变更事件
    const pageChangeUnsub = this.#eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.PAGE_CHANGED,
      (data) => {
        this.#stateManager.updatePageInfo(data.pageNumber, data.totalPages);
      },
      { subscriberId: 'UIManagerCore' }
    );
    this.#unsubscribeFunctions.push(pageChangeUnsub);

    // 缩放变更事件
    const zoomChangeUnsub = this.#eventBus.on(
      PDF_VIEWER_EVENTS.ZOOM.CHANGED,
      (data) => {
        this.#stateManager.updateScale(data.scale, data.mode);
      },
      { subscriberId: 'UIManagerCore' }
    );
    this.#unsubscribeFunctions.push(zoomChangeUnsub);

    // 加载状态事件
    const loadStartUnsub = this.#eventBus.on(
      PDF_VIEWER_EVENTS.FILE.LOAD.START,
      () => {
        this.#stateManager.updateLoadingState(true, false);
        this.#domManager.setLoadingState(true);
      },
      { subscriberId: 'UIManagerCore' }
    );
    this.#unsubscribeFunctions.push(loadStartUnsub);

    const loadSuccessUnsub = this.#eventBus.on(
      PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
      () => {
        this.#stateManager.updateLoadingState(false, true);
        this.#domManager.setLoadingState(false);
      },
      { subscriberId: 'UIManagerCore' }
    );
    this.#unsubscribeFunctions.push(loadSuccessUnsub);

    const loadErrorUnsub = this.#eventBus.on(
      PDF_VIEWER_EVENTS.FILE.LOAD.ERROR,
      (data) => {
        this.#stateManager.updateErrorState(true, data.error);
        this.#domManager.setLoadingState(false);
      },
      { subscriberId: 'UIManagerCore' }
    );
    this.#unsubscribeFunctions.push(loadErrorUnsub);

    this.#logger.info("Event listeners setup complete");
  }

  /**
   * 设置尺寸观察器
   * @private
   */
  #setupResizeObserver() {
    if (typeof ResizeObserver === 'function') {
      const container = this.#domManager.getElement('container');
      if (container) {
        this.#resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            if (entry.target === container) {
              this.#handleResize();
            }
          }
        });

        this.#resizeObserver.observe(container);
        this.#logger.info("Resize observer setup");
      }
    } else {
      // 降级到window resize事件
      window.addEventListener('resize', this.#handleResize.bind(this));
      this.#logger.warn("ResizeObserver not available, using window resize");
    }
  }

  /**
   * 设置滚轮事件监听
   * @private
   */
  #setupWheelListener() {
    const container = this.#domManager.getElement('container');
    if (container) {
      container.addEventListener('wheel', this.#handleWheel.bind(this), { passive: false });
      this.#logger.info("Wheel event listener setup");
    }
  }

  /**
   * 处理尺寸变化
   * @private
   */
  #handleResize() {
    const dimensions = this.#domManager.getContainerDimensions();

    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.VIEW.RESIZE,
      dimensions,
      { actorId: 'UIManagerCore' }
    );

    this.#logger.debug(`Container resized: ${dimensions.width}x${dimensions.height}`);
  }

  /**
   * 处理滚轮事件
   * @param {WheelEvent} event - 滚轮事件
   * @private
   */
  #handleWheel(event) {
    // Ctrl/Cmd + 滚轮进行缩放
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();

      const direction = event.deltaY < 0 ? 'in' : 'out';
      const zoomEvent = direction === 'in'
        ? PDF_VIEWER_EVENTS.ZOOM.IN
        : PDF_VIEWER_EVENTS.ZOOM.OUT;

      this.#eventBus.emit(zoomEvent, {
        delta: Math.abs(event.deltaY)
      }, { actorId: 'UIManagerCore.Wheel' });

      this.#logger.debug(`Wheel zoom ${direction}`);
    }
  }

  /**
   * 获取容器宽度
   * @returns {number} 容器宽度
   */
  getContainerWidth() {
    return this.#domManager.getContainerDimensions().width;
  }

  /**
   * 获取容器高度
   * @returns {number} 容器高度
   */
  getContainerHeight() {
    return this.#domManager.getContainerDimensions().height;
  }

  /**
   * 显示加载状态
   * @param {boolean} isLoading - 是否加载中
   */
  showLoading(isLoading) {
    this.#domManager.setLoadingState(isLoading);
    this.#stateManager.updateLoadingState(isLoading);
  }

  /**
   * 获取UI状态
   * @returns {Object} UI状态
   */
  getState() {
    return this.#stateManager.getState();
  }

  /**
   * 获取DOM元素
   * @param {string} elementName - 元素名称
   * @returns {HTMLElement|null} DOM元素
   */
  getElement(elementName) {
    return this.#domManager.getElement(elementName);
  }

  /**
   * 获取所有DOM元素
   * @returns {Object} 元素集合
   */
  getElements() {
    return this.#domManager.getElements();
  }

  /**
   * 启用/禁用键盘快捷键
   * @param {boolean} enabled - 是否启用
   */
  setKeyboardEnabled(enabled) {
    this.#keyboardHandler.setEnabled(enabled);
  }

  /**
   * 添加自定义键盘绑定
   * @param {string} keyCombo - 键组合
   * @param {Function} handler - 处理函数
   */
  addKeyBinding(keyCombo, handler) {
    this.#keyboardHandler.addKeyBinding(keyCombo, handler);
  }

  /**
   * 清理UI
   */
  cleanup() {
    this.#domManager.cleanup();
    this.#stateManager.clearRenderQueue();
    this.#logger.info("UI cleaned up");
  }

  /**
   * 销毁UI管理器
   */
  destroy() {
    this.#logger.info("Destroying UIManagerCore...");

    // 取消事件订阅
    this.#unsubscribeFunctions.forEach((unsub) => unsub());
    this.#unsubscribeFunctions = [];

    // 断开尺寸观察器
    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect();
      this.#resizeObserver = null;
    }

    // 移除滚轮事件
    const container = this.#domManager.getElement('container');
    if (container) {
      container.removeEventListener('wheel', this.#handleWheel.bind(this));
    }

    // 销毁子模块
    this.#keyboardHandler.destroy();
    this.#stateManager.destroy();
    this.#domManager.destroy();

    this.#logger.info("UIManagerCore destroyed");
  }

  /**
   * 获取性能统计
   * @returns {Object} 性能统计数据
   */
  getPerformanceStats() {
    return this.#stateManager.getPerformanceStats();
  }
}