/**
 * @file PDF Outline 功能域（新大纲，基于第三方树形库展示）
 * @module features/pdf-outline
 */

import { getLogger } from "../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_EVENTS } from "../../../common/event/event-constants.js";
import { BookmarkManager } from "../pdf-bookmark/services/bookmark-manager.js";
import { BookmarkDialog } from "../pdf-bookmark/components/bookmark-dialog.js";
import { getCurrentPDFDocument } from "../../pdf/current-document-registry.js";

export class PDFOutlineFeature {
  #logger;
  #eventBus;
  #container;
  #bookmarkManager;
  #dialog;
  #unsubs = [];
  #enabled = false;

  get name() { return "pdf-outline"; }
  get version() { return "1.0.0"; }
  get dependencies() { return ["pdf-reader", "ui", "core-navigation"]; }

  async install(context) {
    this.#logger = context.logger || getLogger("Feature.pdf-outline");
    this.#eventBus = context.scopedEventBus || context.globalEventBus;
    this.#container = context.container;

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
      if (pdfDocument) {
        await this.#bookmarkManager.loadFromStorage();
        this.#refreshList();
      } else {
        this.#refreshList();
      }
    } catch (e) {
      this.#logger.warn("initial load failed", e);
      this.#refreshList();
    }
  }

  #setupEventListeners() {
    // PDF 加载完成后刷新/同步
    this.#unsubs.push(this.#eventBus.onGlobal(
      PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
      async () => {
        try { await this.#bookmarkManager.loadFromStorage(); } catch { /* ignore */ }
        this.#refreshList();
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
  }

  #refreshList() {
    const bookmarks = this.#bookmarkManager.getAllBookmarks();
    this.#eventBus.emitGlobal(
      PDF_VIEWER_EVENTS.BOOKMARK.LOAD.SUCCESS,
      { bookmarks, count: this.#count(bookmarks), source: "pdf-outline" },
      { actorId: "PDFOutlineFeature" }
    );
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
    const defaultRegion = { scrollX: 0, scrollY: this.#getCurrentScrollPercent(), zoom: 1 };
    this.#dialog.showAdd({
      currentPage,
      onConfirm: async (data) => {
        const payload = {
          name: data.name,
          type: data.precise ? "region" : "page",
          pageNumber: data.pageNumber || currentPage,
          region: data.precise ? defaultRegion : null,
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
