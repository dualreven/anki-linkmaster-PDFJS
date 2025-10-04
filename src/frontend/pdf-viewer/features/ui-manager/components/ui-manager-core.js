/**
 * @file UI管理器核心（重构版）
 * @module UIManagerCore
 * @description 协调DOM元素、键盘事件和UI状态的主管理器
 */

import { getLogger } from "../../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { DOMElementManager } from "../../../ui/dom-element-manager.js";
import { KeyboardHandler } from "../../../ui/keyboard-handler.js";
import { UIStateManager } from "../../../ui/ui-state-manager.js";
import { TextLayerManager } from "../../../ui/text-layer-manager.js";
import { PDFViewerManager } from "./pdf-viewer-manager.js";
import { UIZoomControls } from "./ui-zoom-controls.js";
import { UILayoutControls } from "./ui-layout-controls.js";

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
  #textLayerManager;
  #pdfViewerManager;
  #uiZoomControls;
  #uiLayoutControls;
  #resizeObserver;
  #unsubscribeFunctions = [];

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("UIManagerCore");

    // 初始化子模块
    this.#domManager = new DOMElementManager();
    this.#keyboardHandler = new KeyboardHandler(eventBus);
    this.#stateManager = new UIStateManager();
    // TextLayerManager and PDFViewerManager will be initialized after DOM elements are ready
    this.#textLayerManager = null;
    this.#pdfViewerManager = null;
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

      // 初始化文字层管理器
      const textLayerContainer = this.#domManager.getElement('textLayer');
      if (textLayerContainer) {
        this.#textLayerManager = new TextLayerManager({
          container: textLayerContainer
        });
        this.#logger.info("TextLayerManager initialized");
      } else {
        this.#logger.warn("TextLayer container not found, text layer disabled");
      }

      // 初始化PDFViewerManager
      const viewerContainer = document.getElementById('viewerContainer');
      if (viewerContainer) {
        this.#pdfViewerManager = new PDFViewerManager(this.#eventBus);
        this.#pdfViewerManager.initialize(viewerContainer);
        this.#logger.info("PDFViewerManager initialized");
      } else {
        this.#logger.error("viewerContainer not found, PDF rendering disabled");
      }

      // 设置键盘事件
      this.#keyboardHandler.setupEventListener();

      // 设置事件监听
      this.#setupEventListeners();

      // 设置尺寸观察器
      this.#setupResizeObserver();

      // 设置滚轮事件
      this.#setupWheelListener();

      // 初始化UI控件
      await this.#initializeUIControls();

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
    // 注意: PAGE_CHANGED 事件在当前版本中未定义
    // 页面信息更新通过直接调用 updatePageInfo 方法实现

    // 缩放变更事件
    const zoomChangeUnsub = this.#eventBus.on(
      PDF_VIEWER_EVENTS.ZOOM.CHANGED,
      (data) => {
        this.#stateManager.updateScale(data.scale, data.mode);
      },
      { subscriberId: 'UIManagerCore' }
    );
    this.#unsubscribeFunctions.push(zoomChangeUnsub);

    // 加载请求事件
    const loadRequestedUnsub = this.#eventBus.on(
      PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED,
      () => {
        this.#stateManager.updateLoadingState(true, false);
        this.#domManager.setLoadingState(true);
      },
      { subscriberId: 'UIManagerCore' }
    );
    this.#unsubscribeFunctions.push(loadRequestedUnsub);

    const loadSuccessUnsub = this.#eventBus.on(
      PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
      ({ pdfDocument }) => {
        this.#stateManager.updateLoadingState(false, true);
        this.#domManager.setLoadingState(false);

        // 加载PDF到PDFViewerManager
        if (this.#pdfViewerManager && pdfDocument) {
          this.#logger.info("Loading PDF document into PDFViewerManager");
          this.#pdfViewerManager.load(pdfDocument);

          // 初始化页码显示 - 延迟一小段时间等待pagesCount更新
          setTimeout(() => {
            if (this.#uiZoomControls && this.#pdfViewerManager) {
              const totalPages = this.#pdfViewerManager.pagesCount || pdfDocument.numPages;
              const currentPage = this.#pdfViewerManager.currentPageNumber || 1;
              this.#uiZoomControls.updatePageInfo(currentPage, totalPages);
              this.#logger.info(`Page info initialized: ${currentPage}/${totalPages}`);
            }
          }, 100); // 延迟100ms，等待PDFViewer完成初始化
        } else {
          this.#logger.warn("Cannot load PDF: pdfViewerManager or pdfDocument is missing");
        }
      },
      { subscriberId: 'UIManagerCore' }
    );
    this.#unsubscribeFunctions.push(loadSuccessUnsub);

    const loadFailedUnsub = this.#eventBus.on(
      PDF_VIEWER_EVENTS.FILE.LOAD.FAILED,
      (data) => {
        this.#stateManager.updateErrorState(true, data.error);
        this.#domManager.setLoadingState(false);
      },
      { subscriberId: 'UIManagerCore' }
    );
    this.#unsubscribeFunctions.push(loadFailedUnsub);

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
    // 使用viewerContainer而不是旧的container（已隐藏）
    const container = document.getElementById('viewerContainer');
    if (container) {
      container.addEventListener('wheel', this.#handleWheel.bind(this), { passive: false });
      this.#logger.info("Wheel event listener setup on viewerContainer");
    } else {
      this.#logger.error("viewerContainer not found for wheel listener");
    }
  }

  /**
   * 处理尺寸变化
   * @private
   */
  #handleResize() {
    const dimensions = this.#domManager.getContainerDimensions();

    // 注意: VIEW.RESIZE 事件在当前版本中未定义
    // 直接记录尺寸变化
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

      // 固定使用10%的缩放步进，使Ctrl+滚轮缩放更平滑
      // 不使用event.deltaY，因为不同鼠标/触控板的deltaY值差异很大
      const smoothStep = 0.1; // 10% per scroll

      this.#eventBus.emit(zoomEvent, {
        delta: smoothStep
      }, { actorId: 'UIManagerCore.Wheel' });

      this.#logger.debug(`Wheel zoom ${direction} (step: ${smoothStep})`);
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
   * 更新页面信息
   * @param {number} currentPage - 当前页码
   * @param {number} totalPages - 总页数
   */
  updatePageInfo(currentPage, totalPages) {
    this.#stateManager.updatePageInfo(currentPage, totalPages);
    this.#logger.debug(`Page info updated: ${currentPage}/${totalPages}`);
  }

  /**
   * [已废弃] 渲染页面 - Canvas模式专用
   * @deprecated 现在使用PDFViewer组件自动渲染，不再需要手动Canvas渲染
   * @param {Object} page - PDF页面对象
   * @param {Object} viewport - 视口对象
   */
  async renderPage(page, viewport) {
    this.#logger.warn('renderPage() is deprecated. PDFViewer component handles rendering automatically.');
    throw new Error('Canvas rendering mode is no longer supported. Use PDFViewer mode instead.');

    /* Canvas rendering code (deprecated) - 保留以备将来参考
    const canvas = this.#domManager.getElement('canvas');
    if (!canvas) {
      throw new Error('Canvas element not found');
    }

    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };

    // 渲染Canvas层
    await page.render(renderContext).promise;
    this.#logger.debug('Page canvas rendered successfully');

    // 设置text-layer尺寸与canvas一致
    const textLayerContainer = this.#domManager.getElement('textLayer');
    if (textLayerContainer) {
      textLayerContainer.style.width = `${viewport.width}px`;
      textLayerContainer.style.height = `${viewport.height}px`;
    }

    // 渲染文字层
    if (this.#textLayerManager && this.#textLayerManager.isEnabled()) {
      try {
        if (textLayerContainer) {
          await this.#textLayerManager.loadTextLayer(textLayerContainer, page, viewport);
          this.#logger.debug('Page text layer rendered successfully');
        }
      } catch (error) {
        this.#logger.warn('Failed to render text layer:', error);
        // 不抛出错误，允许Canvas正常显示
      }
    }

    this.#logger.debug('Page rendered successfully');
    */
  }

  /**
   * 更新进度
   * @param {number} percent - 进度百分比
   * @param {string} statusText - 状态文本
   */
  updateProgress(percent, statusText = '加载中...') {
    const progressBar = this.#domManager.getElement('progressBar');
    if (progressBar) {
      progressBar.style.width = `${percent}%`;
    }
    this.#logger.debug(`Progress: ${percent}% - ${statusText}`);
  }

  /**
   * 隐藏进度条
   */
  hideProgress() {
    const progressBar = this.#domManager.getElement('progressBar');
    if (progressBar && progressBar.parentElement) {
      progressBar.parentElement.style.display = 'none';
    }
  }

  /**
   * 显示错误
   * @param {Error|Object} errorData - 错误数据
   */
  showError(errorData) {
    const errorMessage = this.#domManager.getElement('errorMessage');
    if (errorMessage) {
      errorMessage.textContent = errorData.message || '加载失败';
      errorMessage.style.display = 'block';
    }
    this.#logger.error('Error displayed:', errorData);
  }

  /**
   * 隐藏错误
   */
  hideError() {
    const errorMessage = this.#domManager.getElement('errorMessage');
    if (errorMessage) {
      errorMessage.style.display = 'none';
    }
  }

  /**
   * 设置缩放比例
   * @param {number} scale - 缩放比例
   */
  setScale(scale) {
    this.#stateManager.updateScale(scale, 'custom');
    this.#logger.debug(`Scale set to: ${scale}`);
  }

  /**
   * 获取当前缩放比例
   * @returns {number} 缩放比例
   */
  getScale() {
    return this.#stateManager.get('currentScale');
  }

  /**
   * [已废弃] 获取Canvas元素
   * @deprecated Canvas模式已移除,此方法仅为向后兼容保留
   * @returns {HTMLCanvasElement} Canvas元素
   */
  getCanvas() {
    this.#logger.warn('getCanvas() is deprecated. Canvas rendering mode is no longer supported.');
    return this.#domManager.getElement('canvas');
  }

  /**
   * [已废弃] 获取Canvas上下文
   * @deprecated Canvas模式已移除,此方法仅为向后兼容保留
   * @returns {CanvasRenderingContext2D} 2D上下文
   */
  getContext() {
    this.#logger.warn('getContext() is deprecated. Canvas rendering mode is no longer supported.');
    const canvas = this.getCanvas();
    return canvas ? canvas.getContext('2d') : null;
  }

  /**
   * 获取容器元素
   * @returns {HTMLElement} 容器元素
   */
  getContainer() {
    return this.#domManager.getElement('container');
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

    // 清理文字层
    if (this.#textLayerManager) {
      this.#textLayerManager.cleanup();
    }

    this.#logger.info("UI cleaned up");
  }


  /**
   * 初始化UI控件（缩放控件和布局控件）
   * @private
   * @returns {Promise<void>}
   */
  async #initializeUIControls() {
    try {
      this.#logger.info("Initializing UI controls...");

      // 初始化缩放控件
      this.#uiZoomControls = new UIZoomControls(this.#eventBus);
      await this.#uiZoomControls.setupZoomControls();
      this.#logger.info("UIZoomControls initialized");

      // 初始化布局控件（需要PDFViewerManager）
      if (this.#pdfViewerManager) {
        this.#uiLayoutControls = new UILayoutControls(this.#eventBus);
        this.#uiLayoutControls.setup(this.#pdfViewerManager);
        this.#logger.info("UILayoutControls initialized");
      } else {
        this.#logger.warn("PDFViewerManager not available, layout controls disabled");
      }

      // 连接缩放事件到PDFViewerManager
      this.#setupZoomIntegration();

      // 监听PDFViewerManager的缩放变化事件，更新UI显示
      this.#eventBus.on(PDF_VIEWER_EVENTS.ZOOM.CHANGING, ({ scale }) => {
        if (this.#uiZoomControls) {
          this.#uiZoomControls.setScale(scale);
        }
      }, { subscriberId: 'UIManagerCore' });

      // 监听页面变化事件，更新页码显示
      this.#eventBus.on(PDF_VIEWER_EVENTS.PAGE.CHANGING, ({ pageNumber }) => {
        if (this.#uiZoomControls && this.#pdfViewerManager) {
          const totalPages = this.#pdfViewerManager.pagesCount || 0;
          this.#uiZoomControls.updatePageInfo(pageNumber, totalPages);
          this.#logger.debug(`Page info updated: ${pageNumber}/${totalPages}`);
        }
      }, { subscriberId: 'UIManagerCore.PageSync' });

    } catch (error) {
      this.#logger.error("Failed to initialize UI controls:", error);
      throw error;
    }
  }

  /**
   * 设置缩放事件集成
   * @private
   */
  #setupZoomIntegration() {
    if (!this.#pdfViewerManager) {
      this.#logger.warn("PDFViewerManager not available, zoom integration disabled");
      return;
    }

    // 放大
    this.#eventBus.on(PDF_VIEWER_EVENTS.ZOOM.IN, (data) => {
      const delta = data?.delta || 0.25;
      const newScale = Math.min((this.#pdfViewerManager.currentScale || 1.0) + delta, 5.0);
      this.#pdfViewerManager.currentScale = newScale;
      this.#logger.info(`Zoom in: ${newScale.toFixed(2)}`);
    }, { subscriberId: 'UIManagerCore.ZoomIn' });

    // 缩小
    this.#eventBus.on(PDF_VIEWER_EVENTS.ZOOM.OUT, (data) => {
      const delta = data?.delta || 0.25;
      const newScale = Math.max((this.#pdfViewerManager.currentScale || 1.0) - delta, 0.25);
      this.#pdfViewerManager.currentScale = newScale;
      this.#logger.info(`Zoom out: ${newScale.toFixed(2)}`);
    }, { subscriberId: 'UIManagerCore.ZoomOut' });

    // 实际大小（重置缩放到100%）
    this.#eventBus.on(PDF_VIEWER_EVENTS.ZOOM.ACTUAL_SIZE, () => {
      this.#pdfViewerManager.currentScale = 1.0;
      this.#logger.info('Zoom reset to actual size (100%)');
    }, { subscriberId: 'UIManagerCore.ZoomActualSize' });

    // 适应宽度
    this.#eventBus.on(PDF_VIEWER_EVENTS.ZOOM.FIT_WIDTH, () => {
      this.#pdfViewerManager.currentScaleValue = 'page-width';
      this.#logger.info('Zoom to fit width');
    }, { subscriberId: 'UIManagerCore.ZoomFitWidth' });

    // 适应高度
    this.#eventBus.on(PDF_VIEWER_EVENTS.ZOOM.FIT_HEIGHT, () => {
      this.#pdfViewerManager.currentScaleValue = 'page-height';
      this.#logger.info('Zoom to fit height');
    }, { subscriberId: 'UIManagerCore.ZoomFitHeight' });

    // 上一页
    this.#eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.PREVIOUS, () => {
      const currentPage = this.#pdfViewerManager.currentPageNumber;
      if (currentPage > 1) {
        this.#pdfViewerManager.currentPageNumber = currentPage - 1;
        this.#logger.info(`Navigate to previous page: ${currentPage - 1}`);
      }
    }, { subscriberId: 'UIManagerCore.NavPrev' });

    // 下一页
    this.#eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.NEXT, () => {
      const currentPage = this.#pdfViewerManager.currentPageNumber;
      const totalPages = this.#pdfViewerManager.pagesCount;
      if (currentPage < totalPages) {
        this.#pdfViewerManager.currentPageNumber = currentPage + 1;
        this.#logger.info(`Navigate to next page: ${currentPage + 1}`);
      }
    }, { subscriberId: 'UIManagerCore.NavNext' });

    // 跳转到指定页
    this.#eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.GOTO, (data) => {
      const targetPage = data?.pageNumber;
      const totalPages = this.#pdfViewerManager.pagesCount;

      if (targetPage && targetPage >= 1 && targetPage <= totalPages) {
        this.#pdfViewerManager.currentPageNumber = targetPage;
        this.#logger.info(`Navigate to page: ${targetPage}`);
      } else {
        this.#logger.warn(`Invalid page number for GOTO: ${targetPage} (total: ${totalPages})`);
      }
    }, { subscriberId: 'UIManagerCore.NavGoto' });
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
    const container = document.getElementById('viewerContainer');
    if (container) {
      container.removeEventListener('wheel', this.#handleWheel.bind(this));
    }

    // 销毁子模块
    this.#keyboardHandler.destroy();
    this.#stateManager.destroy();
    this.#domManager.destroy();

    // 销毁文字层管理器
    if (this.#textLayerManager) {
      this.#textLayerManager.destroy();
      this.#textLayerManager = null;
    }

    // 销毁PDFViewer管理器
    if (this.#pdfViewerManager) {
      // PDFViewerManager没有destroy方法，只需清空引用
      this.#pdfViewerManager = null;
    }

    // 销毁UI控件
    if (this.#uiZoomControls) {
      // UIZoomControls可能没有destroy方法，只需清空引用
      this.#uiZoomControls = null;
    }
    if (this.#uiLayoutControls) {
      // UILayoutControls可能没有destroy方法，只需清空引用
      this.#uiLayoutControls = null;
    }

    this.#logger.info("UIManagerCore destroyed");
  }

  /**
   * 获取性能统计
   * @returns {Object} 性能统计数据
   */
  getPerformanceStats() {
    return this.#stateManager.getPerformanceStats();
  }

  /**
   * 获取文字层管理器
   * @returns {TextLayerManager|null} 文字层管理器实例
   */
  getTextLayerManager() {
    return this.#textLayerManager;
  }

  /**
   * 获取PDFViewer管理器
   * @returns {PDFViewerManager|null} PDFViewer管理器实例
   */
  get pdfViewerManager() {
    return this.#pdfViewerManager;
  }
}