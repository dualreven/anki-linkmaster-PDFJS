/**
 * @file UI管理器核心（重构版）
 * @module UIManagerCore
 * @description 协调DOM元素、键盘事件和UI状态的主管理器
 */

import { getLogger } from "../../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { success as toastSuccess, error as toastError } from "../../../../common/utils/thirdparty-toast.js";
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
  #currentPdfId = null; // 当前 PDF 的ID
  #preferredTitle = null; // 若URL传入title，则优先使用它作为header标题

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

      // 初始化复制 PDF ID 按钮
      this.#setupCopyPdfIdButton();

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
      (payload) => {
        const pdfDocument = payload?.pdfDocument;
        let filename = payload?.filename;
        if (!filename && payload?.file) {
          const file = payload.file || {};
          try {
            filename = file.filename || (()=>{ const s = (file.url||file.file_path)||''; const parts = s.split(/[\\\\\\/]/); const name = parts.pop() || ''; return decodeURIComponent(name.split('?')[0]); })();
          } catch (_) { filename = file.filename || null; }
        }
        this.#stateManager.updateLoadingState(false, true);
        this.#domManager.setLoadingState(false);

        // 更新 header 标题与 pdfId：优先使用 #preferredTitle，其次回退到文件名
        const preferred = (this.#preferredTitle && String(this.#preferredTitle).trim()) ? String(this.#preferredTitle).trim() : null;
        const displayTitle = preferred || filename || null;
        if (displayTitle) {
          this.#updateHeaderTitle(displayTitle);
          if (!this.#currentPdfId) {
            const base = displayTitle.toLowerCase().endsWith('.pdf') ? displayTitle.slice(0, -4) : displayTitle;
            this.#currentPdfId = base;
            this.#updateCopyButtonVisibility();
            this.#logger.info(`Header title set to: ${displayTitle}; derived pdfId: ${base}`);
          }
        }

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

    // 监听 URL 参数解析事件，获取 pdf-id
    const urlParamsParsedUnsub = this.#eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.PARSED,
      (data) => {
        this.#logger.info('[UIManagerCore] URL_PARAMS.PARSED event received:', data);
        if (data?.pdfId) {
          this.#currentPdfId = data.pdfId;
          this.#updateCopyButtonVisibility();
          this.#logger.info(`✅ PDF ID captured and button shown: ${this.#currentPdfId}`);
        } else {
          this.#logger.warn('[UIManagerCore] URL_PARAMS.PARSED event has no pdfId');
        }
        // 若 URL 中包含 title，则优先更新 header 标题并记录首选标题，避免后续被文件名覆盖
        if (data?.title && String(data.title).trim()) {
          this.#preferredTitle = String(data.title).trim();
          this.#updateHeaderTitle(this.#preferredTitle);
        }
      },
      { subscriberId: 'UIManagerCore' }
    );
    this.#unsubscribeFunctions.push(urlParamsParsedUnsub);

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
   * 更新 header 标题为 PDF 书名
   * @param {string} filename - PDF 文件名
   * @private
   */
  #updateHeaderTitle(filename) {
    const titleElement = document.getElementById('pdf-title');
    if (!titleElement) {
      this.#logger.warn('Header title element not found');
      return;
    }

    // 移除 .pdf 扩展名（如果存在）
    const displayName = filename.endsWith('.pdf')
      ? filename.slice(0, -4)
      : filename;

    titleElement.textContent = displayName;
    // 设置原生 tooltip，用于显示完整书名
    try { titleElement.title = displayName; } catch (_) {}
    this.#logger.info(`Header title updated: ${displayName}`);
  }

  /**
   * 设置复制 PDF ID 按钮
   * @private
   */
  #setupCopyPdfIdButton() {
    const copyBtn = document.getElementById('copy-pdf-id-btn');
    if (!copyBtn) {
      this.#logger.warn('Copy PDF ID button not found');
      return;
    }

    // 尝试从 URL 直接获取 pdf-id 作为备选
    const urlParams = new URLSearchParams(window.location.search);
    const pdfIdFromUrl = urlParams.get('pdf-id');
    if (pdfIdFromUrl && !this.#currentPdfId) {
      this.#currentPdfId = pdfIdFromUrl;
      this.#updateCopyButtonVisibility();
      this.#logger.info(`PDF ID obtained directly from URL: ${pdfIdFromUrl}`);
    }

    copyBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      this.#logger.info(`Copy button clicked, currentPdfId: ${this.#currentPdfId}`);

      if (!this.#currentPdfId) {
        this.#logger.warn('No PDF ID available to copy');
        alert('无法复制：PDF ID 不可用\n请确保 URL 中包含 pdf-id 参数');
        return;
      }

      try {
        // 复制到剪贴板（带超时保护）
        await this.#copyWithTimeout(this.#currentPdfId, 800);

        // 视觉反馈：添加"已复制"状态
        copyBtn.classList.add('copied');
        copyBtn.title = `已复制: ${this.#currentPdfId}`;
        toastSuccess('✓ PDF ID 已复制');

          this.#logger.info(`✅ PDF ID copied to clipboard: ${this.#currentPdfId}`);

        // 2秒后恢复原状态
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.title = '复制 PDF ID';
          this.#logger.debug('Copy button state reset');
        }, 2000);
      } catch (error) {
        this.#logger.error('Failed to copy PDF ID to clipboard:', error);
        // 如果剪贴板 API 不可用或超时，尝试使用旧方法
        try {
          this.#fallbackCopyToClipboard(this.#currentPdfId);

          // 备用方法成功，也显示视觉反馈
          copyBtn.classList.add('copied');
          copyBtn.title = `已复制: ${this.#currentPdfId}`;
          toastSuccess('✓ PDF ID 已复制');

          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.title = '复制 PDF ID';
          }, 2000);
        } catch (fallbackError) {
          this.#logger.error('Fallback copy also failed:', fallbackError);
          toastError('✗ 复制失败，已提供手动复制');
          // 最终兜底：显示手动复制对话框
          this.#showManualCopyDialog(this.#currentPdfId);
        }
      }
    });

    this.#logger.info('Copy PDF ID button initialized');
  }

  /**
   * 尝试使用 Clipboard API 复制，超时则抛出错误以触发降级
   * @param {string} text - 要复制的文本
   * @param {number} timeoutMs - 超时时间（毫秒）
   * @private
   */
  async #copyWithTimeout(text, timeoutMs = 800) {
    if (!(navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function')) {
      throw new Error('clipboard-api-not-available');
    }

    const writePromise = navigator.clipboard.writeText(text);
    const timeoutPromise = new Promise((_, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error('clipboard-timeout'));
      }, timeoutMs);
    });

    return Promise.race([writePromise, timeoutPromise]);
  }

  /**
   * 显示Toast提示
   * @param {string} message - 提示文本
   * @param {'success'|'error'|'info'} [type='success'] - 提示类型
   * @private
   */
  // 已移除自定义 toast 方法，改用 frontend/common 下的公共 toast 工具

  /**
   * 显示手动复制对话框（最终兜底）
   * @param {string} text - 待复制文本
   * @private
   */
  #showManualCopyDialog(text) {
    // 避免重复创建
    if (document.getElementById('manual-copy-overlay')) {
      const input = document.getElementById('manual-copy-input');
      if (input) {
        input.value = text || '';
        input.focus();
        input.select();
      }
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'manual-copy-overlay';
    overlay.style.cssText = [
      'position: fixed',
      'inset: 0',
      'background: rgba(0,0,0,0.35)',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'z-index: 10001'
    ].join(';');

    const dialog = document.createElement('div');
    dialog.style.cssText = [
      'background: #fff',
      'padding: 16px',
      'border-radius: 8px',
      'min-width: 320px',
      'max-width: 80vw',
      'box-shadow: 0 8px 24px rgba(0,0,0,0.2)',
      'font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif'
    ].join(';');

    const title = document.createElement('div');
    title.textContent = '手动复制 PDF ID';
    title.style.cssText = 'font-size:16px;font-weight:600;margin-bottom:8px;color:#333;';

    const tip = document.createElement('div');
    tip.textContent = '内容已选中，按 Ctrl+C 复制（或右键复制）';
    tip.style.cssText = 'font-size:12px;color:#666;margin-bottom:8px;';

    const input = document.createElement('input');
    input.id = 'manual-copy-input';
    input.type = 'text';
    input.value = text || '';
    input.readOnly = true;
    input.style.cssText = [
      'width: 100%',
      'padding: 8px 10px',
      'border: 1px solid #ddd',
      'border-radius: 4px',
      'font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, \'Liberation Mono\', monospace',
      'font-size: 13px',
      'color: #333'
    ].join(';');

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:12px;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '关闭';
    closeBtn.className = 'btn';
    closeBtn.style.cssText = 'padding:6px 12px;border:1px solid #ccc;background:#f8f9fa;border-radius:4px;cursor:pointer;';
    closeBtn.addEventListener('click', () => overlay.remove());

    const tryCopyBtn = document.createElement('button');
    tryCopyBtn.textContent = '复制';
    tryCopyBtn.className = 'btn';
    tryCopyBtn.style.cssText = 'padding:6px 12px;border:1px solid #1976d2;background:#1976d2;color:#fff;border-radius:4px;cursor:pointer;';
    tryCopyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(input.value);
        toastSuccess('✓ 已复制');
        overlay.remove();
      } catch (e) {
        // 尝试降级
        try {
          this.#fallbackCopyToClipboard(input.value);
          toastSuccess('✓ 已复制');
          overlay.remove();
        } catch (e2) {
          toastError('✗ 复制失败，请手动 Ctrl+C');
          input.focus();
          input.select();
        }
      }
    });

    actions.appendChild(closeBtn);
    actions.appendChild(tryCopyBtn);

    dialog.appendChild(title);
    dialog.appendChild(tip);
    dialog.appendChild(input);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // 自动选中文本
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);

    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  /**
   * 备用复制方法（兼容旧浏览器）
   * @param {string} text - 要复制的文本
   * @private
   */
  #fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        this.#logger.info(`✅ PDF ID copied using fallback method: ${text}`);
      } else {
        throw new Error('execCommand returned false');
      }
    } catch (error) {
      this.#logger.error('Fallback copy method failed:', error);
      throw error;
    } finally {
      document.body.removeChild(textArea);
    }
  }

  /**
   * 更新复制按钮的可见性
   * @private
   */
  #updateCopyButtonVisibility() {
    const copyBtn = document.getElementById('copy-pdf-id-btn');
    if (!copyBtn) {
      this.#logger.warn('Cannot update button visibility: button not found');
      return;
    }

    if (this.#currentPdfId) {
      copyBtn.style.display = 'flex';
      this.#logger.info(`✅ Copy button shown (PDF ID: ${this.#currentPdfId})`);
    } else {
      copyBtn.style.display = 'none';
      this.#logger.debug('Copy button hidden (no PDF ID)');
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

