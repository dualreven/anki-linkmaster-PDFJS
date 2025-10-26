/**
 * @file PDF Outline 功能域（新大纲，基于第三方树形库展示）
 * @module features/pdf-outline
 */

import { getLogger } from "../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_EVENTS } from "../../../common/event/event-constants.js";
import { BookmarkManager } from "../pdf-bookmark/services/bookmark-manager.js";
import { BookmarkDialog } from "../pdf-bookmark/components/bookmark-dialog.js";
import { BookmarkDataProvider } from "../../bookmark/bookmark-data-provider.js";
import { getCurrentPDFDocument } from "../../pdf/current-document-registry.js";

export class PDFOutlineFeature {
  #logger;
  #eventBus;
  #container;
  #bookmarkManager;
  #dialog;
  #bookmarkDataProvider;
  #navigationService = null;
  #unsubs = [];
  #enabled = false;

  get name() { return "pdf-outline"; }
  get version() { return "1.0.0"; }
  // 与实际已注册的基础Feature对齐：pdf-manager、ui-manager、core-navigation
  get dependencies() { return ["pdf-manager", "ui-manager", "core-navigation"]; }

  async install(context) {
    this.#logger = context.logger || getLogger("Feature.pdf-outline");
    this.#eventBus = context.scopedEventBus || context.globalEventBus;
    this.#container = context.container;

    // 导航服务（由 CoreNavigationFeature 注册）
    try {
      this.#navigationService = this.#container.get('navigationService');
      if (!this.#navigationService) {
        this.#logger.warn('NavigationService not found in container, outline navigation will not work');
      }
    } catch (e) {
      this.#logger.warn('Failed to resolve navigationService from container', e);
    }

    // 初始化存储管理器（沿用 BookmarkManager，保证后端契约与数据结构一致）
    const wsClient = (typeof this.#container.getWSClient === "function")
      ? this.#container.getWSClient()
      : (this.#container.get?.("wsClient") || null);

    const pdfId = this.#getPdfId();
    this.#bookmarkManager = new BookmarkManager({
      eventBus: this.#eventBus,
      pdfId: pdfId || "default",
      storageOptions: { wsClient }
    });
    await this.#bookmarkManager.initialize();

    // 原生大纲提供者
    this.#bookmarkDataProvider = new BookmarkDataProvider();

    // 暴露给其他组件（如侧边栏 UI）
    try { this.#container.register("outlineManager", this.#bookmarkManager); } catch { /* ignore */ }

    // 对话框（复用现有组件）
    this.#dialog = new BookmarkDialog();

    // 事件监听
    this.#setupEventListeners();

    // 尝试加载（DB-first），PDF未就绪则等 FILE.LOAD.SUCCESS
    await this.#tryInitialLoad();

    this.#enabled = true;
    this.#logger.info("pdf-outline installed");
  }

  async uninstall() {
    this.#unsubs.forEach(u => { try { u(); } catch { /* ignore */ } });
    this.#unsubs = [];
    if (this.#bookmarkManager) { this.#bookmarkManager.destroy(); }
    this.#bookmarkManager = null;
    if (this.#dialog) { try { this.#dialog.close(); } catch { /* ignore */ } this.#dialog = null; }
    this.#enabled = false;
  }

  isEnabled() { return this.#enabled; }

  #getPdfId() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const pdfId = urlParams.get("pdf-id");
      if (pdfId) { return pdfId; }
      const pdfManager = this.#container?.resolve?.("pdfManager");
      if (pdfManager?.currentPdfId) { return pdfManager.currentPdfId; }
      if (window.PDF_PATH) {
        const filename = window.PDF_PATH.split("/").pop().split(".")[0];
        return filename;
      }
      return null;
    } catch (e) {
      this.#logger.warn("getPdfId failed", e);
      return null;
    }
  }

  async #tryInitialLoad() {
    try {
      const pdfDocument = getCurrentPDFDocument();
      // 先尝试读取存储
      await this.#bookmarkManager.loadFromStorage();
      try { this.#logger.info(`[Outline] 存储加载完成: ${(this.#bookmarkManager.getAllBookmarks()||[]).length} 条`, { toast: true }); } catch {}
      // 若当前无大纲且已拿到 pdfDocument，则尝试从 PDF 原生大纲导入
      try {
        const hasAny = (this.#bookmarkManager.getAllBookmarks() || []).length > 0;
        if (!hasAny && pdfDocument) {
          try { this.#logger.info("[Outline] 尝试从PDF导入原生大纲…", { toast: true }); } catch {}
          await this.#importNativeBookmarksIfEmpty(pdfDocument);
        }
      } catch { /* ignore auto-import errors to keep viewer usable */ }
      // 最终刷新一次列表（无论是否导入）
      this.#refreshList();
      try { this.#logger.info(`[Outline] 列表已刷新: ${(this.#bookmarkManager.getAllBookmarks()||[]).length} 条`, { toast: true }); } catch {}
    } catch (e) {
      this.#logger.warn("initial load failed", e);
      this.#refreshList();
    }
  }

  #setupEventListeners() {
    // PDF 加载完成后刷新/同步
    this.#unsubs.push(this.#eventBus.onGlobal(
      PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
      async (data) => {
        // 1) 先从存储加载，避免空白
        try { await this.#bookmarkManager.loadFromStorage(); } catch { /* ignore */ }
        try { this.#logger.info(`[Outline] FILE.LOAD.SUCCESS → 存储加载完成: ${(this.#bookmarkManager.getAllBookmarks()||[]).length} 条`, { toast: true }); } catch {}
        // 2) 若存储为空，执行一次“原生大纲导入”
        try {
          const hasAny = (this.#bookmarkManager.getAllBookmarks() || []).length > 0;
          const pdfDocument = data?.pdfDocument || getCurrentPDFDocument();
          if (!hasAny && pdfDocument) {
            try { this.#logger.info("[Outline] FILE.LOAD.SUCCESS → 自动导入原生大纲…", { toast: true }); } catch {}
            await this.#importNativeBookmarksIfEmpty(pdfDocument);
          }
        } catch { /* ignore auto-import errors */ }
        // 3) 刷新列表
        this.#refreshList();
        try { this.#logger.info(`[Outline] FILE.LOAD.SUCCESS → 列表已刷新: ${(this.#bookmarkManager.getAllBookmarks()||[]).length} 条`, { toast: true }); } catch {}
      },
      { subscriberId: "PDFOutlineFeature" }
    ));

    // WS 建立后再拉取一次
    this.#unsubs.push(this.#eventBus.onGlobal(
      WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED,
      async () => {
        try { await this.#bookmarkManager.loadFromStorage(); this.#refreshList(); } catch { /* ignore */ }
      },
      { subscriberId: "PDFOutlineFeature" }
    ));

    // 创建/更新/删除/拖拽（沿用 BOOKMARK 事件名以复用已有 Toolbar）
    this.#unsubs.push(this.#eventBus.onGlobal(
      PDF_VIEWER_EVENTS.BOOKMARK.CREATE.REQUESTED,
      (data) => this.#handleCreate(data),
      { subscriberId: "PDFOutlineFeature" }
    ));

    this.#unsubs.push(this.#eventBus.onGlobal(
      PDF_VIEWER_EVENTS.BOOKMARK.UPDATE.REQUESTED,
      (data) => this.#handleUpdate(data),
      { subscriberId: "PDFOutlineFeature" }
    ));

    this.#unsubs.push(this.#eventBus.onGlobal(
      PDF_VIEWER_EVENTS.BOOKMARK.DELETE.REQUESTED,
      (data) => this.#handleDelete(data),
      { subscriberId: "PDFOutlineFeature" }
    ));

    this.#unsubs.push(this.#eventBus.onGlobal(
      PDF_VIEWER_EVENTS.BOOKMARK.REORDER.REQUESTED,
      (data) => this.#handleReorder(data),
      { subscriberId: "PDFOutlineFeature" }
    ));

    // 导航请求（保持与 BookmarkFeature 一致的事件契约）
    this.#unsubs.push(this.#eventBus.onGlobal(
      PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.REQUESTED,
      (data) => this.#handleNavigate(data),
      { subscriberId: "PDFOutlineFeature" }
    ));
    this.#unsubs.push(this.#eventBus.onGlobal(
      PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE_BY_ID.REQUESTED,
      (data) => this.#handleNavigateById(data),
      { subscriberId: "PDFOutlineFeature" }
    ));

    // UI 晚到时的主动拉取
    this.#unsubs.push(this.#eventBus.onGlobal(
      PDF_VIEWER_EVENTS.BOOKMARK.LOAD.REQUESTED,
      () => { try { this.#refreshList(); } catch { /* ignore */ } },
      { subscriberId: "PDFOutlineFeature" }
    ));
  }

  /**
   * 当存储为空时，从 PDF 原生大纲导入并持久化
   * @param {any} pdfDocument - PDF.js 文档对象
   * @returns {Promise<void>}
   * @private
   */
  async #importNativeBookmarksIfEmpty(pdfDocument) {
    try {
      const current = this.#bookmarkManager.getAllBookmarks() || [];
      if (current.length > 0) {
        return; // 已有大纲，跳过导入
      }
      // 提取 PDF 原生大纲
      const nativeBookmarks = await this.#bookmarkDataProvider.getBookmarks(pdfDocument);
      if (!Array.isArray(nativeBookmarks) || nativeBookmarks.length === 0) {
        this.#logger.info("[Outline] No native PDF outlines found; skip import");
        return;
      }
      // 导入并标准化 dest → { pageAt, position }
      const result = await this.#bookmarkManager.importNativeBookmarks(
        nativeBookmarks,
        (native) => this.#parseBookmarkNormalizedDest(native, pdfDocument)
      );
      if (result?.success) {
        this.#logger.info(`[Outline] Imported ${result.count} native outlines; reloading from storage...`);
        try { await this.#bookmarkManager.loadFromStorage(); } catch { /* ignore */ }
      } else {
        this.#logger.warn(`[Outline] Import native outlines failed: ${result?.error || "unknown"}`);
      }
    } catch (e) {
      this.#logger.warn("[Outline] Auto-import native outlines failed", e);
    }
  }

  /**
   * 解析原生书签目的地为统一的 { pageAt, position }
   * 与 BookmarkFeature 中的解析逻辑保持一致（严格字段与容错策略）。
   * @param {Object} nativeBookmark - 来自 BookmarkDataProvider 的原生书签节点
   * @param {any} pdfDocumentArg - 可选的 PDF.js 文档对象
   * @returns {Promise<{pageAt:number|null, position:number|null}>}
   * @private
   */
  async #parseBookmarkNormalizedDest(nativeBookmark, pdfDocumentArg = null) {
    try {
      const dest = nativeBookmark?.dest;
      if (dest === null || dest === undefined) {
        this.#logger.info("[Outline][IMPORT] dest missing; skip", { title: nativeBookmark?.title });
        return { pageAt: null, position: null };
      }
      // 优先使用从事件传入的 pdfDocument，避免并发导致解析失败
      const pdfDocument = pdfDocumentArg || getCurrentPDFDocument();
      if (!pdfDocument) {
        this.#logger.info("[Outline][IMPORT] pdfDocument missing during parse; skip", { title: nativeBookmark?.title });
        return { pageAt: null, position: null };
      }
      // 优先通过 BookmarkDataProvider（已持有同一 pdfDocument）解析
      try {
        if (this.#bookmarkDataProvider && typeof this.#bookmarkDataProvider.parseDestination === "function") {
          const parsed = await this.#bookmarkDataProvider.parseDestination(dest);
          const pageAt = parsed?.pageNumber || null;
          let position = null;
          if (pageAt && parsed?.type === "XYZ" && typeof parsed?.y === "number") {
            const { yToPositionPercent } = await import("../../pdf/pdf-dest-utils.js");
            position = await yToPositionPercent(pdfDocument, pageAt, parsed.y);
          }
          try { this.#logger.info(`[Outline][IMPORT] parsed via provider ${JSON.stringify({ title: nativeBookmark?.title, type: parsed?.type ?? null, pageAt, position })}`); } catch {}
          return { pageAt, position };
        }
      } catch (e) {
        try { this.#logger.info(`[Outline][IMPORT] provider.parseDestination failed; fallback`, { title: nativeBookmark?.title, err: e?.message }); } catch {}
      }
      const { resolvePdfDest, yToPositionPercent } = await import("../../pdf/pdf-dest-utils.js");
      const resolved = await resolvePdfDest(pdfDocument, dest);
      const pageAt = resolved?.pageNumber || null;
      let position = null;
      if (pageAt && resolved?.type === "XYZ" && typeof resolved?.y === "number") {
        position = await yToPositionPercent(pdfDocument, pageAt, resolved.y);
      }
      try { this.#logger.info(`[Outline][IMPORT] parsed via resolvePdfDest ${JSON.stringify({ title: nativeBookmark?.title, type: resolved?.type ?? null, pageAt, position })}`); } catch {}
      return { pageAt, position };
    } catch (e) {
      try { this.#logger.warn(`[Outline][IMPORT] parse normalized dest failed ${JSON.stringify({ title: nativeBookmark?.title, error: e?.message })}`); } catch {}
      return { pageAt: null, position: null };
    }
  }

  #refreshList() {
    const bookmarks = this.#bookmarkManager.getAllBookmarks();
    this.#eventBus.emitGlobal(
      PDF_VIEWER_EVENTS.BOOKMARK.LOAD.SUCCESS,
      { bookmarks, count: this.#count(bookmarks), source: "pdf-outline" },
      { actorId: "PDFOutlineFeature" }
    );
  }

  async #handleNavigate({ bookmark }) {
    try {
      if (!bookmark) {
        this.#logger.warn('Outline navigate request missing bookmark');
        return;
      }
      if (!this.#navigationService) {
        this.#logger.error('NavigationService not available for outline');
        this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.FAILED, { error: 'nav-unavailable' }, { actorId: 'PDFOutlineFeature' });
        return;
      }
      const pageAt = (typeof bookmark?.pageAt === 'number' && bookmark.pageAt > 0) ? bookmark.pageAt : null;
      if (!pageAt) {
        this.#logger.warn('Outline bookmark missing pageAt');
        this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.FAILED, { error: 'invalid-destination' }, { actorId: 'PDFOutlineFeature' });
        return;
      }
      const position = (typeof bookmark?.position === 'number') ? bookmark.position : null;
      const result = await this.#navigationService.navigateTo({ pageAt, position });
      if (result?.success) {
        this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.SUCCESS, { pageNumber: result.actualPage, position: result.actualPosition }, { actorId: 'PDFOutlineFeature' });
      } else {
        this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.FAILED, { error: result?.error || 'unknown' }, { actorId: 'PDFOutlineFeature' });
      }
    } catch (e) {
      this.#logger.warn('Outline navigate failed', e);
      this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.FAILED, { error: e?.message || 'exception' }, { actorId: 'PDFOutlineFeature' });
    }
  }

  async #handleNavigateById({ outlineItemId, bookmarkId, id }) {
    try {
      const targetId = (outlineItemId || bookmarkId || id || '').trim();
      if (!targetId) {
        this.#logger.warn('Outline navigate-by-id missing id');
        return;
      }
      const bm = this.#bookmarkManager.getBookmark(targetId);
      if (!bm) {
        this.#logger.warn(`Outline bookmark not found by id: ${targetId}`);
        this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.FAILED, { error: 'not-found' }, { actorId: 'PDFOutlineFeature' });
        return;
      }
      await this.#handleNavigate({ bookmark: bm });
    } catch (e) {
      this.#logger.warn('Outline navigate-by-id failed', e);
      this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.FAILED, { error: e?.message || 'exception' }, { actorId: 'PDFOutlineFeature' });
    }
  }

  #count(nodes) {
    if (!Array.isArray(nodes)) { return 0; }
    let total = 0;
    const walk = (arr) => { arr.forEach(n => { total += 1; if (n.children?.length) { walk(n.children); } }); };
    walk(nodes);
    return total;
  }

  #getCurrentPage() {
    try {
      const pdfViewerManager = this.#container?.resolve?.("pdfViewerManager");
      if (pdfViewerManager?.currentPageNumber) { return pdfViewerManager.currentPageNumber; }
      return 1;
    } catch { /* ignore */ return 1; }
  }

  #getCurrentScrollPercent() {
    try {
      const viewer = document.getElementById("viewerContainer");
      if (!viewer) { return 0; }
      if (viewer.scrollHeight <= viewer.clientHeight) { return 0; }
      const percent = (viewer.scrollTop / (viewer.scrollHeight - viewer.clientHeight)) * 100;
      return Math.max(0, Math.min(100, Math.round(percent)));
    } catch { /* ignore */ return 0; }
  }

  #handleCreate() {
    const currentPage = this.#getCurrentPage();
    this.#dialog.showAdd({
      currentPage,
      onConfirm: async (data) => {
        // 统一模型：pageAt + position（百分比或 null）
        const payload = {
          name: data.name,
          pageAt: (Number.isInteger(data.pageAt) && data.pageAt > 0) ? data.pageAt : currentPage,
          position: (typeof data.position === "number" && isFinite(data.position))
            ? Math.max(0, Math.min(100, Math.round(data.position)))
            : null,
        };
        const result = await this.#bookmarkManager.addBookmark(payload);
        if (result.success) {
          try { await this.#bookmarkManager.saveToStorage(); await this.#bookmarkManager.loadFromStorage(); } catch { /* ignore */ }
          this.#refreshList();
        }
      },
      onCancel: () => {}
    });
  }

  #handleUpdate({ bookmarkId }) {
    const bm = this.#bookmarkManager.getBookmark(bookmarkId);
    if (!bm) { return; }
    this.#dialog.showEdit({
      bookmark: bm,
      onConfirm: async (updates) => {
        const result = await this.#bookmarkManager.updateBookmark(bookmarkId, updates);
        if (result.success) {
          try { await this.#bookmarkManager.saveToStorage(); await this.#bookmarkManager.loadFromStorage(); } catch { /* ignore */ }
          this.#refreshList();
          this.#logger.info(`✅ 书签已更新: ${updates.name || bm.name}`, { toast: true });
        }
      }
    });
  }

  async #handleDelete({ bookmarkId }) {
    const bm = this.#bookmarkManager.getBookmark(bookmarkId);
    const childCount = bm?.children?.length || 0;
    this.#dialog.showDelete({
      bookmark: bm,
      childCount,
      onConfirm: async (cascade) => {
        const result = await this.#bookmarkManager.deleteBookmark(bookmarkId, cascade !== false);
        if (result.success) {
          try { await this.#bookmarkManager.saveToStorage(); await this.#bookmarkManager.loadFromStorage(); } catch { /* ignore */ }
          this.#refreshList();
        }
      }
    });
  }

  async #handleReorder(data) {
    const { bookmarkId, newParentId, newIndex } = data;
    const result = await this.#bookmarkManager.reorderBookmarks(bookmarkId, newParentId, newIndex);
    if (result.success) {
      try { await this.#bookmarkManager.saveToStorage(); await this.#bookmarkManager.loadFromStorage(); } catch { /* ignore */ }
      this.#refreshList();
    }
  }
}

export default PDFOutlineFeature;
