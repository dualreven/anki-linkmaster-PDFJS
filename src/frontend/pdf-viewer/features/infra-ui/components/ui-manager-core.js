/**
 * @file UI管理器核心（重构版）
 * @module UIManagerCore
 * @description 协调DOM元素、键盘事件和UI状态的主管理器
 *
 * 详细拆分说明：`docs/standards/ui-manager-core.md`
 */

import { getLogger } from "../../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { DOMElementManager } from "../../../ui/dom-element-manager.js";
import { KeyboardHandler } from "../../../ui/keyboard-handler.js";
import { TextLayerManager } from "../../../ui/text-layer-manager.js";
import { DomEventHub } from "../../../shared/dom-event-hub.js";
import { PDFViewerManager } from "./pdf-viewer-manager.js";
import { installUIManagerCoreEventListeners } from "./ui-manager-core-event-listeners.js";
import { initializeUIManagerControls } from "./ui-manager-core-ui-controls.js";
import { installUIManagerCoreInteractions } from "./ui-manager-core-interactions.js";
import { installCopyPdfIdButton } from "./ui-manager-core-copy-pdf-id.js";
import { updateUIManagerHeaderTitle } from "./ui-manager-core-header-title.js";
import { ViewerManager } from "./viewer.manager.js";
import { ZoomManager } from "./zoom.manager.js";
import { LayoutManager } from "./layout.manager.js";
import { createInfraUICoordinator } from "../infra-ui-coordinator.js";
import { requestPdfTitleFromDB } from "./pdf-title-requester.js";

/**
 * UI管理器核心类
 * 整合所有UI相关的子模块
 */
export class UIManagerCore {
  #eventBus;
  #logger;
  #domManager;
  #keyboardHandler;
  #viewerManager; // Replaces UIStateManager
  #zoomManager;
  #layoutManager;
  #textLayerManager;
  #pdfViewerManager;
  #uiZoomControls;
  #uiLayoutControls;
  #uiControls;
  #eventListeners;
  #coordinator;
  #unsubscribeFunctions = [];
  #currentPdfId = null; // 当前 PDF 的ID
  #pendingDetailRequestId = null; // 等待中的详情请求ID（用于严格匹配回执）
  #domEventHub;
  #updateCopyButtonVisibilityFn = () => {};

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("UIManagerCore");

    // 初始化子模块
    this.#domManager = new DOMElementManager();
    this.#keyboardHandler = new KeyboardHandler(eventBus);

    // Core State Managers
    this.#viewerManager = new ViewerManager(eventBus, this.#logger);
    this.#zoomManager = new ZoomManager(eventBus, this.#logger);
    this.#layoutManager = new LayoutManager(eventBus, this.#logger);

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

      // 初始化DOM元素（不需要使用返回值，避免未使用变量报警）
      void this.#domManager.initializeElements();

      // 初始化文字层管理器
      const textLayerContainer = this.#domManager.getElement("textLayer");
      if (textLayerContainer) {
        this.#textLayerManager = new TextLayerManager({
          container: textLayerContainer,
        });
        this.#logger.info("TextLayerManager initialized");
      } else {
        this.#logger.info("TextLayer container not found, text layer disabled");
      }

      // 初始化PDFViewerManager
      const viewerContainer = document.getElementById("viewerContainer");
      if (viewerContainer) {
        this.#pdfViewerManager = new PDFViewerManager(this.#eventBus);
        this.#pdfViewerManager.initialize(viewerContainer);
        this.#logger.info("PDFViewerManager initialized");

        // 初始化 DOM 事件集线器，集中管理 viewerContainer / document 的 DOM 事件
        this.#domEventHub = new DomEventHub({
          viewerContainer,
          documentRef: document,
          windowRef: window,
        });
        this.#logger.info("DomEventHub initialized");
      } else {
        this.#logger.error(
          "viewerContainer not found, PDF rendering disabled"
        );
      }

      // 设置键盘事件
      this.#keyboardHandler.setupEventListener(this.#domEventHub);

      // View Subscriptions (Connect Managers to DOM)
      this.#setupViewSubscriptions();

      this.#unsubscribeFunctions.push(
        ...installUIManagerCoreInteractions({
          eventBus: this.#eventBus,
          logger: this.#logger,
          domManager: this.#domManager,
          documentRef: document,
          windowRef: window,
        })
      );

      // 初始化UI控件
      await this.#initializeUIControls();

      // Setup event listeners handler
      const { eventListeners, unsubs: eventListenersUnsubs } =
        installUIManagerCoreEventListeners({
          eventBus: this.#eventBus,
          logger: this.#logger,
          viewerManager: this.#viewerManager,
          zoomManager: this.#zoomManager,
          layoutManager: this.#layoutManager,
          domManager: this.#domManager,
          getPdfViewerManager: () => this.#pdfViewerManager,
          getUIZoomControls: () => this.#uiZoomControls,
          getCurrentPdfId: () => this.#currentPdfId,
          setCurrentPdfId: (pdfId) => {
            this.#currentPdfId = pdfId;
          },
          getPendingDetailRequestId: () => this.#pendingDetailRequestId,
          setPendingDetailRequestId: (rid) => {
            this.#pendingDetailRequestId = rid;
          },
          updateCopyButtonVisibility: () => this.#updateCopyButtonVisibilityFn(),
          requestPdfTitleFromDB: (pdfId) =>
            requestPdfTitleFromDB({
              eventBus: this.#eventBus,
              logger: this.#logger,
              pdfId,
              setPendingDetailRequestId: (rid) => { this.#pendingDetailRequestId = rid; },
            }),
          updateHeaderTitle: (title) => updateUIManagerHeaderTitle({ logger: this.#logger, documentRef: document }, title),
        });
      this.#eventListeners = eventListeners;
      this.#unsubscribeFunctions.push(...eventListenersUnsubs);

      // Create coordinator
      this.#coordinator = createInfraUICoordinator(this.#eventBus, this.#logger, this.#uiControls, this.#eventListeners, this.#uiLayoutControls);
      this.#unsubscribeFunctions.push(this.#coordinator.destroy);

      const { updateCopyButtonVisibility, unsubs: copyUnsubs } =
        installCopyPdfIdButton({
          logger: this.#logger,
          documentRef: document,
          windowRef: window,
          getCurrentPdfId: () => this.#currentPdfId,
          setCurrentPdfId: (pdfId) => {
            this.#currentPdfId = pdfId;
          },
        });
      this.#updateCopyButtonVisibilityFn = updateCopyButtonVisibility;
      this.#unsubscribeFunctions.push(...copyUnsubs);

      this.#logger.info("UI Manager Core initialized successfully");

      // 广播“UI初始化完成”，便于其它特性作为就绪门闸（零轮询/零延迟）
      try {
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.STATE.INITIALIZED,
          { module: "UIManagerCore" },
          { actorId: "UIManagerCore" }
        );
      } catch (e) {
        this.#logger.warn("[UIManagerCore] Failed to emit STATE.INITIALIZED", e);
      }
    } catch (error) {
      this.#logger.error("Failed to initialize UI Manager Core:", error);
      throw error;
    }
  }

  /**
   * Subscribe Managers to DOM/View logic
   */
  #setupViewSubscriptions() {
    // Viewer Loading -> DOM Loading
    this.#unsubscribeFunctions.push(
      this.#viewerManager.store.subscribe(
        (state) => state.isLoading,
        (isLoading) => {
          this.#domManager.setLoadingState(isLoading);
        }
      )
    );

    // Viewer Error -> DOM Error
    this.#unsubscribeFunctions.push(
      this.#viewerManager.store.subscribe(
        (state) => state.hasError,
        (hasError) => {
          const state = this.#viewerManager.store.get();
          if (hasError) {
            this.showError({ message: state.errorMessage });
          } else {
            this.hideError();
          }
        }
      )
    );
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
    // Delegate to Manager (Single Source of Truth)
    // The subscription in #setupViewSubscriptions will update DOM
    this.#viewerManager.setLoading(isLoading);
  }

  /**
   * 更新页面信息
   * @param {number} currentPage - 当前页码
   * @param {number} totalPages - 总页数
   */
  updatePageInfo(currentPage, totalPages) {
    this.#viewerManager.setPageInfo(currentPage, totalPages);
    // Note: UIZoomControls update is currently handled via event listener in ui-manager-core-event-listeners.js
    // or ui-manager-core-ui-controls.js PAGE.CHANGING listener.
  }

  /**
   * 更新进度
   * @param {number} percent - 进度百分比
   * @param {string} statusText - 状态文本
   */
  updateProgress(percent, statusText = "加载中...") {
    const progressBar = this.#domManager.getElement("progressBar");
    if (progressBar) {
      progressBar.style.width = `${percent}%`;
    }
    this.#logger.debug(`Progress: ${percent}% - ${statusText}`);
  }

  /**
   * 隐藏进度条
   */
  hideProgress() {
    const progressBar = this.#domManager.getElement("progressBar");
    if (progressBar && progressBar.parentElement) {
      progressBar.parentElement.style.display = "none";
    }
  }

  /**
   * 显示错误
   * @param {Error|Object} errorData - 错误数据
   */
  showError(errorData) {
    const errorMessage = this.#domManager.getElement("errorMessage");
    if (errorMessage) {
      errorMessage.textContent = errorData.message || "加载失败";
      errorMessage.style.display = "block";
    }
    this.#logger.error("Error displayed:", errorData);
  }

  /**
   * 隐藏错误
   */
  hideError() {
    const errorMessage = this.#domManager.getElement("errorMessage");
    if (errorMessage) {
      errorMessage.style.display = "none";
    }
  }

  /**
   * 设置缩放比例
   * @param {number} scale - 缩放比例
   */
  setScale(scale) {
    // Delegate to ZoomManager
    this.#zoomManager.setScale(scale);
  }

  /**
   * 获取当前缩放比例
   * @returns {number} 缩放比例
   */
  getScale() {
    return this.#zoomManager.store.get().scale;
  }

  /**
   * 获取容器元素
   * @returns {HTMLElement} 容器元素
   */
  getContainer() {
    return this.#domManager.getElement("container");
  }

  /**
   * 获取UI状态
   * @returns {Object} UI状态
   */
  getState() {
    // Combine states or return Viewer state
    return {
      ...this.#viewerManager.store.get(),
      scale: this.#zoomManager.store.get().scale,
      ...this.#layoutManager.store.get(),
    };
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
      const { uiZoomControls, uiLayoutControls, unsubs, uiControls } =
        await initializeUIManagerControls({
          eventBus: this.#eventBus,
          logger: this.#logger,
          pdfViewerManager: this.#pdfViewerManager,
          zoomManager: this.#zoomManager, // Pass Injected Managers
          layoutManager: this.#layoutManager,
        });
      this.#uiZoomControls = uiZoomControls;
      this.#uiLayoutControls = uiLayoutControls;
      this.#uiControls = uiControls;
      this.#unsubscribeFunctions.push(...unsubs);
    } catch (error) {
      this.#logger.error("Failed to initialize UI controls:", error);
      throw error;
    }
  }

  /**
   * 销毁UI管理器
   */
  destroy() {
    this.#logger.info("Destroying UIManagerCore...");

    // 取消事件订阅
    this.#unsubscribeFunctions.forEach((unsub) => unsub());
    this.#unsubscribeFunctions = [];

    // 销毁子模块
    this.#keyboardHandler.destroy();
    this.#viewerManager.destroy(); // Destroy Managers
    this.#zoomManager.destroy();
    this.#layoutManager.destroy();

    this.#domManager.destroy();

    // 销毁 DOM 事件集线器
    if (this.#domEventHub) {
      this.#domEventHub.destroy();
      this.#domEventHub = null;
    }

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
      this.#uiZoomControls.destroy();
      this.#uiZoomControls = null;
    }
    if (this.#uiLayoutControls) {
      this.#uiLayoutControls.destroy();
      this.#uiLayoutControls = null;
    }

    this.#logger.info("UIManagerCore destroyed");
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

  /**
   * 获取 DomEventHub 实例
   * @returns {DomEventHub|null}
   */
  get domEventHub() {
    return this.#domEventHub || null;
  }
}
