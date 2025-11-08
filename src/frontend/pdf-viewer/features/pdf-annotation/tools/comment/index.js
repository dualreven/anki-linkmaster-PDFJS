/**
 * CommentTool - 批注工具插件
 * @module features/annotation/tools/comment
 * @description 实现PDF批注功能的工具插件
 */

import { getLogger } from "../../../../../common/utils/logger.js";
import { IAnnotationTool } from "../../interfaces/IAnnotationTool.js";
import { CommentInput } from "./comment-input.js";
import { CommentMarker } from "./comment-marker.js";
import { Annotation } from "../../models/annotation.js";
import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";

/**
 * 批注工具类
 * @class CommentTool
 * @implements {IAnnotationTool}
 */
export class CommentTool extends IAnnotationTool {
  // ==================== 元数据属性 ====================

  get name() {
    return "comment";
  }

  get displayName() {
    return "批注";
  }

  get icon() {
    return "📝";
  }

  get version() {
    return "1.0.0";
  }

  get dependencies() {
    return [];
  }

  // ==================== 私有属性 ====================

  /** @type {import('../../../../../common/utils/logger.js').Logger} */
  #logger = null;

  /** @type {import('../../../../../common/event/event-bus.js').EventBus} */
  #eventBus = null;

  /** @type {Object} PDF查看器管理器 */
  #pdfViewerManager = null;

  /** @type {Object} 依赖容器 */
  #container = null;

  /** @type {Object} PDF.js EventBus (用于监听页面渲染事件) */
  #pdfjsEventBus = null;

  /** @type {Function|null} PDF.js 缩放开始回调 */
  #pdfjsScaleChangingHandler = null;

  /** @type {Function|null} PDF.js 缩放完成回调 */
  #pdfjsScaleChangedHandler = null;

  /** @type {Object} 标注管理器 (用于获取标注数据) */
  #annotationManager = null;

  /** @type {boolean} 是否激活 */
  #isActive = false;

  /** @type {CommentInput} 输入组件 */
  #commentInput = null;

  /** @type {CommentMarker} 标记渲染器 */
  #commentMarker = null;

  /** @type {Function} 点击处理器 */
  #clickHandler = null;

  /** @type {string} 原始鼠标样式 */
  #originalCursor = "";

  /** @type {Map<number, Map<string, any>>} 待渲染队列（按页） */
  #pendingMarkersByPage = new Map();

  /** @type {Function|null} 数据加载后的处理器 */
  #onAnnotationDataLoadedHandler = null;

  // ==================== 生命周期方法 ====================

  /**
   * 初始化工具
   * @param {Object} context - 上下文对象
   * @returns {Promise<void>}
   */
  async initialize(context) {
    const { eventBus, logger, pdfViewerManager, container } = context;

    this.#logger = logger || getLogger("CommentTool");
    this.#eventBus = eventBus;
    this.#pdfViewerManager = pdfViewerManager;
    this.#container = container;

    this.#logger.info("========================================");
    this.#logger.info("🚀 CommentTool Initialization Started");
    this.#logger.info("========================================");

    // 获取PDF.js EventBus（用于监听页面渲染事件）
    this.#logger.info("Step 1: Getting PDF.js EventBus...");
    if (pdfViewerManager && pdfViewerManager.eventBus) {
      this.#pdfjsEventBus = pdfViewerManager.eventBus;
      this.#logger.info("  ✅ Got PDF.js EventBus reference for page rendering events");
    } else {
      this.#logger.error("  ❌ PDF.js EventBus not available, marker restoration will NOT work!");
      this.#logger.warn("  PDFViewerManager:", pdfViewerManager);
    }

    // 获取AnnotationManager（用于获取标注数据）
    this.#logger.info("Step 2: Getting AnnotationManager...");
    if (container) {
      this.#annotationManager = container.get("annotationManager");
      if (this.#annotationManager) {
        this.#logger.info("  ✅ Got AnnotationManager reference");
      } else {
        this.#logger.error("  ❌ AnnotationManager not found in container!");
      }
    } else {
      this.#logger.error("  ❌ No container provided!");
    }

    // 创建辅助组件
    this.#logger.info("Step 3: Creating helper components...");
    this.#commentInput = new CommentInput();
    this.#commentMarker = new CommentMarker();
    this.#logger.info("  ✅ CommentInput and CommentMarker created");

    // 设置页面渲染事件监听
    this.#logger.info("Step 4: Setting up page rendering listener...");
    this.#setupPageRenderingListener();

    // 监听标注数据加载完成（用于补画/入队）
    this.#onAnnotationDataLoadedHandler = (data) => {
      try {
        const anns = Array.isArray(data?.annotations) ? data.annotations : [];
        const comments = anns.filter(a => a?.type === "comment");
        this.#logger.info(`📥 [DataLoaded] total=${anns.length}, comments=${comments.length}`);
        comments.forEach((ann) => this.ensureOverlayFor(ann));
      } catch (e) {
        this.#logger?.warn?.("[CommentTool] handleAnnotationsLoaded failed", e);
      }
    };
    try {
      this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED, this.#onAnnotationDataLoadedHandler, { subscriberId: "CommentTool" });
    } catch (e) { void e; }

    // 设置标注事件监听
    this.#logger.info("Step 5: Setting up annotation event listeners...");
    this.#setupAnnotationEventListeners();

    this.#logger.info("========================================");
    this.#logger.info(`✅ CommentTool initialized (v${this.version})`);
    this.#logger.info("========================================");
  }

  /**
   * 激活工具
   */
  activate() {
    if (this.#isActive) {
      this.#logger.warn("CommentTool already active");
      return;
    }

    this.#isActive = true;

    // 保存原始鼠标样式
    const pdfContainer = document.querySelector(".pdf-container");
    if (pdfContainer) {
      this.#originalCursor = pdfContainer.style.cursor || "default";
      pdfContainer.style.cursor = "crosshair";
    }

    // 添加点击事件监听
    this.#clickHandler = (e) => this.#handlePdfClick(e);
    if (pdfContainer) {
      pdfContainer.addEventListener("click", this.#clickHandler);
    }

    this.#logger.info("CommentTool activated");

    // 打开标注侧边栏（保持与历史行为一致：激活批注工具时自动弹出侧边栏）
    try {
      this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPEN_REQUESTED, { sidebarId: "annotation" });
      this.#logger.info("Requested opening annotation sidebar on comment tool activation");
    } catch (e) {
      this.#logger.warn("Failed to request sidebar open on activation", e);
    }

    // 发布激活事件
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.ANNOTATION.TOOL.ACTIVATED,
      { tool: this.name },
      { actorId: "CommentTool" }
    );
  }

  /**
   * 停用工具
   */
  deactivate() {
    if (!this.#isActive) {
      return;
    }

    this.#isActive = false;

    // 恢复鼠标样式
    const pdfContainer = document.querySelector(".pdf-container");
    if (pdfContainer) {
      pdfContainer.style.cursor = this.#originalCursor;
    }

    // 移除点击事件监听
    if (this.#clickHandler && pdfContainer) {
      pdfContainer.removeEventListener("click", this.#clickHandler);
      this.#clickHandler = null;
    }

    // 隐藏输入框（如果显示中）
    if (this.#commentInput && this.#commentInput.isVisible()) {
      this.#commentInput.hide();
    }

    this.#logger.info("CommentTool deactivated");

    // 发布停用事件
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.ANNOTATION.TOOL.DEACTIVATED,
      { tool: this.name },
      { actorId: "CommentTool" }
    );
  }

  /**
   * 检查工具是否激活
   * @returns {boolean}
   */
  isActive() {
    return this.#isActive;
  }

  // ==================== 事件处理 ====================

  /**
   * 处理PDF点击
   * @private
   * @param {MouseEvent} e - 鼠标事件
   */
  #handlePdfClick(e) {
    // 如果输入框正在显示，忽略点击
    if (this.#commentInput.isVisible()) {
      return;
    }

    // 阻止事件默认行为和冒泡，避免触发其他导航逻辑
    e.preventDefault();
    e.stopPropagation();

    // 查找实际点击的页面元素
    let pageElement = e.target.closest(".page");
    if (!pageElement) {
      this.#logger.warn("Click target is not within a .page element, ignoring");
      return;
    }

    // 从页面元素获取页码
    const pageNumber = parseInt(pageElement.dataset.pageNumber) || this.#getCurrentPageNumber();

    // 获取点击位置（相对于页面元素）
    const pageRect = pageElement.getBoundingClientRect();
    const x = e.clientX - pageRect.left;
    const y = e.clientY - pageRect.top;

    // 获取显示输入框的位置（相对于视口）
    const displayX = e.clientX;
    const displayY = e.clientY;

    this.#logger.info(`PDF clicked at (${x}, ${y}) on page ${pageNumber}`);

    // 显示输入框（使用视口坐标）
    this.#commentInput.show({
      x: displayX,
      y: displayY,
      pageNumber,
      onConfirm: (content) => this.#createComment(x, y, pageNumber, pageRect.width, pageRect.height, content),
      onCancel: () => {
        this.#logger.info("Comment creation cancelled");
      },
    });
  }

  /**
   * 创建批注
   * @private
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {number} pageNumber - 页码
   * @param {number} pageWidth - 页面宽度(px)
   * @param {number} pageHeight - 页面高度(px)
   * @param {string} content - 批注内容
   */
  #createComment(x, y, pageNumber, pageWidth, pageHeight, content) {
    this.#logger.info(`Creating comment at (${x}, ${y}) on page ${pageNumber}: "${content}"`);

    // 将像素坐标换算为百分比存储
    const xPercent = Math.max(0, Math.min(100, (x / (pageWidth || 1)) * 100));
    const yPercent = Math.max(0, Math.min(100, (y / (pageHeight || 1)) * 100));

    // 创建标注对象（使用静态工厂方法，传入百分比坐标）
    const annotation = Annotation.createComment(pageNumber, { xPercent, yPercent }, content);

    // 发布创建事件（标记渲染会在annotation:create:success事件中统一处理）
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.ANNOTATION.CREATE,
      { annotation },
      { actorId: "CommentTool" }
    );

    this.#logger.info(`Comment annotation creation requested: ${annotation.id}`);
  }

  /**
   * 处理标记点击
   * @private
   * @param {string} annotationId - 标注ID
   */
  #handleMarkerClick(annotationId) {
    this.#logger.info(`Comment marker clicked: ${annotationId}`);

    // 高亮标记
    this.#commentMarker.highlightMarker(annotationId);

    // 打开标注侧边栏（与历史行为一致：点击批注对象时弹出侧边栏）
    try {
      this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPEN_REQUESTED, { sidebarId: "annotation" });
      this.#logger.info("Requested opening annotation sidebar on marker click");
    } catch (e) {
      this.#logger.warn("Failed to request sidebar open on marker click", e);
    }

    // 发布选择事件
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.ANNOTATION.SELECT,
      { id: annotationId },
      { actorId: "CommentTool" }
    );
  }

  // ==================== 标记恢复机制 ====================

  /**
   * 设置页面渲染事件监听
   * @private
   */
  #setupPageRenderingListener() {
    if (!this.#pdfjsEventBus) {
      this.#logger.warn("❌ Cannot setup page rendering listener: pdfjsEventBus not available");
      this.#logger.warn("PDFViewerManager status:", this.#pdfViewerManager);
      return;
    }

    this.#logger.info("✅ PDF.js EventBus available, setting up pagerendered listener...");

    // 监听PDF.js的pagerendered事件（使用常量命名）
    this.#pdfjsEventBus.on(PDF_VIEWER_EVENTS.PDFJS_EVENTS.PAGE.RENDERED, (evt) => {
      const pageNumber = evt.pageNumber;
      // 先刷队列再恢复
      this.#flushPendingForPage(pageNumber);
      this.#logger.info(`📄 [PageRendered Event] Page ${pageNumber} rendered, restoring markers...`);
      // 恢复该页面的所有标记
      this.#restoreMarkersForPage(pageNumber);
    });

    // 监听缩放：缩放开始清空标记，缩放结束恢复当前页
    this.#pdfjsScaleChangingHandler = () => {
      try { this.#commentMarker?.clear?.(); } catch { }
    };
    try { this.#pdfjsEventBus.on(PDF_VIEWER_EVENTS.PDFJS_EVENTS.SCALE.CHANGING, this.#pdfjsScaleChangingHandler); } catch {}

    this.#pdfjsScaleChangedHandler = () => {
      try {
        const pn = Number(this.#pdfViewerManager?.currentPageNumber || 0);
        if (pn) {
          this.#restoreMarkersForPage(pn);
        }
      } catch { }
    };
    try { this.#pdfjsEventBus.on(PDF_VIEWER_EVENTS.PDFJS_EVENTS.SCALE.CHANGED, this.#pdfjsScaleChangedHandler); } catch {}

    // 统一事件信号：应用级 RENDER.PAGE_COMPLETED（由 PDFViewerManager 桥接）
    try {
      this.#eventBus.onGlobal(PDF_VIEWER_EVENTS.RENDER.PAGE_COMPLETED, (data) => {
        const pn = Number(data?.pageNumber || 0);
        if (!pn) { return; }
        this.#flushPendingForPage(pn);
        this.#logger.info(`📄 [PageRendered Event - bridged] Page ${pn} rendered, restoring markers...`);
        this.#restoreMarkersForPage(pn);
      }, { subscriberId: "CommentTool" });
    } catch (e) { void e; }

    this.#logger.info("✅ Page rendering listener setup complete");
  }

  /**
   * 设置标注事件监听
   * @private
   */
  #setupAnnotationEventListeners() {
    if (!this.#eventBus) {
      this.#logger.error("❌ Cannot setup annotation event listeners: eventBus not available");
      return;
    }

    // 监听标注创建成功事件
    this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.CREATED, (data) => {
      const { annotation } = data;

      this.#logger.info(`📢 [Event] annotation:create:success received for ${annotation.id} (type: ${annotation.type})`);

      // 只处理comment类型的标注
      if (annotation.type !== "comment") {
        this.#logger.debug("  ⏭️ Skipping non-comment annotation");
        return;
      }

      this.#logger.info("  ✅ Comment annotation created successfully, rendering marker...");

      // 渲染标记（若页面未就绪则入队）
      this.ensureOverlayFor(annotation);
    }, { subscriberId: "CommentTool" });

    // 监听标注删除成功事件
    this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.DELETED, (data) => {
      const { id } = data;

      this.#logger.info(`📢 [Event] annotation:delete:success received for ${id}`);

      // 移除标记
      if (this.#commentMarker) {
        this.#commentMarker.removeMarker(id);
        this.#logger.info(`  ✅ Marker removed for deleted annotation: ${id}`);
      }

      // 从待渲染队列移除
      try {
        this.#pendingMarkersByPage.forEach((bucket, page) => {
          if (bucket?.has?.(id)) {
            bucket.delete(id);
            if (bucket.size === 0) {this.#pendingMarkersByPage.delete(page);}
          }
        });
      } catch { }
    }, { subscriberId: "CommentTool" });

    this.#logger.info("✅ Annotation event listeners setup complete");
  }

  /**
   * 若页面就绪则立即渲染，否则加入待渲染队列
   * @param {Annotation} annotation
   */
  ensureOverlayFor(annotation) {
    try {
      if (!annotation || annotation.type !== "comment") {return;}
      const page = Number(annotation.pageNumber || 0);
      if (this.#isPageReady(page)) {
        this.#logger.debug("[CommentTool] Page ready → render now", { id: annotation.id, page });
        this.#renderMarkerForAnnotation(annotation);
        return;
      }
      let bucket = this.#pendingMarkersByPage.get(page);
      if (!bucket) {
        bucket = new Map();
        this.#pendingMarkersByPage.set(page, bucket);
      }
      bucket.set(annotation.id, annotation);
      this.#logger.debug("[CommentTool] Page not ready → queued", { id: annotation.id, page });
    } catch (e) {
      this.#logger?.warn?.("[CommentTool] ensureOverlayFor failed", e);
    }
  }

  /**
   * 刷新某页的待渲染批注标记
   * @param {number} pageNumber
   * @private
   */
  #flushPendingForPage(pageNumber) {
    try {
      const bucket = this.#pendingMarkersByPage.get(pageNumber);
      if (!bucket || bucket.size === 0) {return;}
      const items = Array.from(bucket.values());
      this.#pendingMarkersByPage.delete(pageNumber);
      this.#logger.info(`🔁 [FlushPending] page=${pageNumber} count=${items.length}`);
      items.forEach((ann) => { try { this.#renderMarkerForAnnotation(ann); } catch { } });
    } catch (e) {
      this.#logger?.warn?.("[CommentTool] flushPendingForPage failed", e);
    }
  }

  /**
   * 判断页面是否就绪（存在 pageView.div）
   * @param {number} pageNumber
   * @returns {boolean}
   * @private
   */
  #isPageReady(pageNumber) {
    try {
      const pageView = (pageNumber > 0) ? this.#pdfViewerManager?.getPageView?.(pageNumber) : null;
      return !!(pageView && pageView.div);
    } catch {
      return false;
    }
  }

  /**
   * 恢复指定页面的所有标记
   * @private
   * @param {number} pageNumber - 页码
   */
  #restoreMarkersForPage(pageNumber) {
    this.#logger.info(`🔄 [RestoreMarkers] Starting restoration for page ${pageNumber}`);

    if (!this.#annotationManager) {
      this.#logger.error("❌ Cannot restore markers: AnnotationManager not available");
      this.#logger.warn("Container status:", this.#container);
      return;
    }

    // 获取该页面的所有comment类型标注
    const annotations = this.#annotationManager.getAnnotationsByPage(pageNumber);
    this.#logger.info(`📋 Found ${annotations.length} total annotations on page ${pageNumber}`);

    const commentAnnotations = annotations.filter(ann => ann.type === "comment");
    this.#logger.info(`📝 Found ${commentAnnotations.length} comment annotations on page ${pageNumber}`);

    if (commentAnnotations.length === 0) {
      this.#logger.debug(`ℹ️ No comment annotations to restore on page ${pageNumber}`);
      return;
    }

    this.#logger.info(`✨ Restoring ${commentAnnotations.length} markers for page ${pageNumber}`);

    // 为每个标注渲染标记
    commentAnnotations.forEach((annotation, index) => {
      this.#logger.debug(`  [${index + 1}/${commentAnnotations.length}] Restoring marker for annotation ${annotation.id}`);
      this.#renderMarkerForAnnotation(annotation);
    });

    this.#logger.info(`✅ Marker restoration complete for page ${pageNumber}`);
  }

  /**
   * 为标注渲染标记
   * @private
   * @param {Annotation} annotation - 标注对象
   */
  #renderMarkerForAnnotation(annotation) {
    this.#logger.debug(`🎨 [RenderMarker] Rendering marker for annotation ${annotation.id}`);

    // 检查标记是否已存在
    const existingMarker = this.#commentMarker.getMarker(annotation.id);
    if (existingMarker) {
      const hasParent = existingMarker.parentElement !== null;
      this.#logger.debug(`  Existing marker found: hasParent=${hasParent}`);

      if (hasParent) {
        this.#logger.debug("  ✅ Marker already attached to DOM, skipping");
        return;
      } else {
        this.#logger.debug("  ⚠️ Marker exists but detached from DOM, will recreate");
      }
    } else {
      this.#logger.debug("  ℹ️ No existing marker, creating new one");
    }

    // 创建标记
    this.#logger.debug("  Creating marker...");
    const marker = this.#commentMarker.createMarker(annotation);

    // 获取页面元素
    this.#logger.debug(`  Finding page element for page ${annotation.pageNumber}...`);
    const pageElement = this.#getPageElement(annotation.pageNumber);
    if (!pageElement) {
      this.#logger.error(`  ❌ Page element not found for annotation ${annotation.id} (page ${annotation.pageNumber})`);
      return;
    }
    this.#logger.debug("  ✅ Page element found");

    // 若仅有像素坐标，则换算百分比以便后续缩放/跳转一致
    try {
      const data = annotation?.data || {};
      const hasPercent = data?.positionPercent && typeof data.positionPercent.xPercent === "number" && typeof data.positionPercent.yPercent === "number";
      const hasPixel = data?.position && typeof data.position.x === "number" && typeof data.position.y === "number";
      if (!hasPercent && hasPixel) {
        const w = pageElement.clientWidth || pageElement.offsetWidth || 1;
        const h = pageElement.clientHeight || pageElement.offsetHeight || 1;
        const xp = Math.max(0, Math.min(100, (data.position.x / Math.max(1, w)) * 100));
        const yp = Math.max(0, Math.min(100, (data.position.y / Math.max(1, h)) * 100));
        annotation.data.positionPercent = { xPercent: xp, yPercent: yp };
        this.#logger.debug(`  ↻ position→percent: (${data.position.x},${data.position.y}) → (${xp.toFixed(2)}%,${yp.toFixed(2)}%)`);
      }
    } catch {  /* ignore */ }

    // 渲染标记到页面
    this.#logger.debug("  Appending marker to page...");
    const success = this.#commentMarker.renderToPage(annotation.id, pageElement);
    if (!success) {
      this.#logger.error("  ❌ Failed to render marker to page");
      return;
    }

    // 添加点击事件
    marker.addEventListener("click", (e) => {
      e.stopPropagation();
      this.#handleMarkerClick(annotation.id);
    });

    this.#logger.info(`  ✅ Marker successfully rendered for annotation ${annotation.id} on page ${annotation.pageNumber}`);
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取当前页码
   * @private
   * @returns {number}
   */
  #getCurrentPageNumber() {
    // 简化版：返回1，实际应该从PDFViewerManager获取
    if (this.#pdfViewerManager && this.#pdfViewerManager.currentPageNumber) {
      return this.#pdfViewerManager.currentPageNumber;
    }
    return 1;
  }

  /**
   * 获取页面元素
   * @private
   * @param {number} pageNumber - 页码
   * @returns {HTMLElement|null}
   */
  #getPageElement(pageNumber) {
    // 查找对应页码的页面元素
    const pageElement = document.querySelector(`.page[data-page-number="${pageNumber}"]`);
    if (pageElement) {
      return pageElement;
    }

    // 备用方案：使用PDF容器
    const pdfContainer = document.querySelector(".pdf-container");
    return pdfContainer;
  }

  // ==================== UI方法 ====================

  /**
   * 创建工具按钮
   * @returns {HTMLElement}
   */
  createToolButton() {
    const button = document.createElement("button");
    button.id = `${this.name}-tool-btn`;
    button.className = "annotation-tool-button";
    button.textContent = `${this.icon} ${this.displayName}`;
    button.title = `${this.displayName}工具`;

    button.style.cssText = `
      padding: 8px 16px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s, border-color 0.2s;
      display: flex;
      align-items: center;
      gap: 6px;
    `;

    // 点击事件
    button.addEventListener("click", () => {
      if (this.isActive()) {
        this.deactivate();
        button.style.background = "white";
        button.style.borderColor = "#ddd";
      } else {
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.ANNOTATION.TOOL.ACTIVATE,
          { tool: this.name },
          { actorId: "CommentTool" }
        );
        button.style.background = "#E3F2FD";
        button.style.borderColor = "#2196F3";
      }
    });

    return button;
  }

  /**
   * 创建标注卡片
   * @param {Annotation} annotation - 标注对象
   * @returns {HTMLElement}
   */
  createAnnotationCard(annotation) {
    const card = document.createElement("div");
    card.className = "annotation-card comment-card";
    card.dataset.annotationId = annotation.id;

    card.style.cssText = `
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      margin-bottom: 12px;
      background: white;
      cursor: pointer;
      transition: box-shadow 0.2s;
    `;

    card.innerHTML = `
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">${this.icon}</span>
          <span style="font-weight: bold; color: #333;">批注</span>
        </div>
        <span style="font-size: 12px; color: #999;">第${annotation.pageNumber}页</span>
      </div>
      <div class="card-content" style="color: #555; font-size: 14px; line-height: 1.5; margin-bottom: 8px;">
        ${annotation.data.content || "无内容"}
      </div>
      <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 12px; color: #999;">${annotation.getFormattedDate()}</span>
        <div class="card-actions" style="display: flex; gap: 8px;">
          <button class="jump-btn" style="padding: 4px 12px; border: 1px solid #2196F3; border-radius: 4px; background: white; color: #2196F3; cursor: pointer; font-size: 12px;">
            跳转
          </button>
          <button class="delete-btn" style="padding: 4px 12px; border: 1px solid #f44336; border-radius: 4px; background: white; color: #f44336; cursor: pointer; font-size: 12px;">
            删除
          </button>
        </div>
      </div>
    `;

    // 卡片点击高亮
    card.addEventListener("click", (e) => {
      if (!e.target.classList.contains("jump-btn") && !e.target.classList.contains("delete-btn")) {
        this.#commentMarker.highlightMarker(annotation.id);
      }
    });

    // 悬停效果
    card.addEventListener("mouseenter", () => {
      card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
    });

    card.addEventListener("mouseleave", () => {
      card.style.boxShadow = "none";
    });

    // 跳转按钮
    const jumpBtn = card.querySelector(".jump-btn");
    jumpBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.#eventBus.emitGlobal(
        PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED,
        { id: annotation.id },
        { actorId: "CommentTool" }
      );
    });

    // 删除按钮
    const deleteBtn = card.querySelector(".delete-btn");
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (await this.#confirmAsync("确定要删除这条批注吗？")) {
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.ANNOTATION.DELETE,
          { id: annotation.id },
          { actorId: "CommentTool" }
        );
      }
    });

    return card;
  }

  // ==================== 清理方法 ====================

  /**
   * 销毁工具
   */
  destroy() {
    this.#logger.info("Destroying CommentTool");

    // 停用工具
    if (this.isActive()) {
      this.deactivate();
    }

    // 销毁组件
    if (this.#commentInput) {
      this.#commentInput.destroy();
      this.#commentInput = null;
    }

    if (this.#commentMarker) {
      this.#commentMarker.destroy();
      this.#commentMarker = null;
    }

    // 解绑 PDF.js 缩放事件
    if (this.#pdfjsEventBus && typeof this.#pdfjsEventBus.off === "function") {
      try {
        if (this.#pdfjsScaleChangingHandler) {
          this.#pdfjsEventBus.off(PDF_VIEWER_EVENTS.PDFJS_EVENTS.SCALE.CHANGING, this.#pdfjsScaleChangingHandler);
        }
      } catch { }
      try {
        if (this.#pdfjsScaleChangedHandler) {
          this.#pdfjsEventBus.off(PDF_VIEWER_EVENTS.PDFJS_EVENTS.SCALE.CHANGED, this.#pdfjsScaleChangedHandler);
        }
      } catch { }
    }

    // 清空引用
    this.#eventBus = null;
    this.#logger = null;
    this.#pdfViewerManager = null;
    this.#container = null;
    this.#pendingMarkersByPage.clear();
    this.#onAnnotationDataLoadedHandler = null;

    this.#logger.info("CommentTool destroyed");
  }

  /**
   * 简易确认弹窗（替代 window.confirm 以通过 lint）
   * @param {string} message
   * @returns {Promise<boolean>}
   * @private
   */
  #confirmAsync(message) {
    return new Promise((resolve) => {
      try {
        const overlay = document.createElement("div");
        overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999;";
        const dlg = document.createElement("div");
        dlg.style.cssText = "width:360px;background:#fff;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.25);overflow:hidden;";
        const body = document.createElement("div");
        body.style.cssText = "padding:16px;font-size:14px;";
        body.textContent = message;
        const footer = document.createElement("div");
        footer.style.cssText = "display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid #eee;";
        const btnCancel = document.createElement("button");
        btnCancel.textContent = "取消";
        btnCancel.style.cssText = "padding:6px 12px;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer;";
        const btnOk = document.createElement("button");
        btnOk.textContent = "删除";
        btnOk.style.cssText = "padding:6px 12px;border:1px solid #c62828;background:#c62828;color:#fff;border-radius:4px;cursor:pointer;";
        btnCancel.addEventListener("click", () => { try { overlay.remove(); } catch {} resolve(false); });
        btnOk.addEventListener("click", () => { try { overlay.remove(); } catch {} resolve(true); });
        footer.appendChild(btnCancel); footer.appendChild(btnOk);
        dlg.appendChild(body); dlg.appendChild(footer); overlay.appendChild(dlg);
        document.body.appendChild(overlay);
      } catch {
        resolve(true);
      }
    });
  }
}

export default CommentTool;

