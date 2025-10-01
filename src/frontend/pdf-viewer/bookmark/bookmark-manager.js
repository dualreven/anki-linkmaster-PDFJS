/**
 * 书签管理器
 * @file 协调书签数据加载、侧边栏UI与页面导航
 * @module BookmarkManager
 */

import { getLogger } from "../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { getCurrentPDFDocument } from "../pdf/current-document-registry.js";
import { BookmarkDataProvider } from "./bookmark-data-provider.js";
import { BookmarkSidebarUI } from "../ui/bookmark-sidebar-ui.js";

export class BookmarkManager {
  #eventBus;
  #logger;
  #dataProvider;
  #ui;
  #unsubs = [];
  #initialized = false;

  constructor(eventBus, options = {}) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("BookmarkManager");
    this.#dataProvider = options.dataProvider || new BookmarkDataProvider();
    this.#ui = null; // 初始化时创建
  }

  /**
   * 初始化书签管理器
   */
  initialize() {
    if (this.#initialized) return;
    this.#logger.info("Initializing BookmarkManager...");

    // 初始化侧边栏UI（挂载到容器）
    try {
      const container = document.getElementById('viewerContainer');
      this.#ui = new BookmarkSidebarUI(this.#eventBus, { container });
      this.#ui.initialize();
    } catch (e) {
      const reason = e && typeof e === 'object' ? (e.stack || e.message || JSON.stringify(e)) : e;
      this.#logger.warn("BookmarkSidebarUI init failed", reason);
    }

    // 监听：PDF加载成功后自动加载书签
    this.#unsubs.push(
      this.#eventBus.on(
        PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
        () => this.loadBookmarks(),
        { subscriberId: 'BookmarkManager' }
      )
    );

    // 监听：手动请求加载书签
    this.#unsubs.push(
      this.#eventBus.on(
        PDF_VIEWER_EVENTS.BOOKMARK.LOAD.REQUESTED,
        () => this.loadBookmarks(),
        { subscriberId: 'BookmarkManager' }
      )
    );

    // 监听：导航请求
    this.#unsubs.push(
      this.#eventBus.on(
        PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.REQUESTED,
        (data) => this.#handleNavigateRequested(data),
        { subscriberId: 'BookmarkManager' }
      )
    );

    this.#initialized = true;
    this.#logger.info("BookmarkManager initialized");
  }

  /**
   * 加载书签数据
   */
  async loadBookmarks() {
    try {
      const pdfDocument = getCurrentPDFDocument();
      if (!pdfDocument) {
        this.#logger.info("No current PDF document, skip bookmark loading");
        this.#eventBus.emit(PDF_VIEWER_EVENTS.BOOKMARK.LOAD.EMPTY, {}, { actorId: 'BookmarkManager' });
        return;
      }

      const bookmarks = await this.#dataProvider.getBookmarks(pdfDocument);
      if (!bookmarks || bookmarks.length === 0) {
        this.#eventBus.emit(PDF_VIEWER_EVENTS.BOOKMARK.LOAD.EMPTY, {}, { actorId: 'BookmarkManager' });
        return;
      }

      const count = this.#count(bookmarks);
      this.#eventBus.emit(
        PDF_VIEWER_EVENTS.BOOKMARK.LOAD.SUCCESS,
        { bookmarks, count, source: 'pdf' },
        { actorId: 'BookmarkManager' }
      );
    } catch (error) {
      this.#logger.error('Failed to load bookmarks:', error);
      this.#eventBus.emit(
        PDF_VIEWER_EVENTS.BOOKMARK.LOAD.FAILED,
        { error, message: error.message },
        { actorId: 'BookmarkManager' }
      );
    }
  }

  async #handleNavigateRequested(data) {
    try {
      const bookmark = data?.bookmark;
      if (!bookmark) throw new Error('bookmark is required');

      const result = await this.#dataProvider.parseDestination(bookmark.dest);

      // 触发页面跳转（由导航模块处理）
      this.#eventBus.emit(
        PDF_VIEWER_EVENTS.NAVIGATION.GOTO,
        { pageNumber: result.pageNumber, position: { x: result.x, y: result.y }, zoom: result.zoom },
        { actorId: 'BookmarkManager' }
      );

      // 回告导航成功
      this.#eventBus.emit(
        PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.SUCCESS,
        { pageNumber: result.pageNumber, position: { x: result.x, y: result.y } },
        { actorId: 'BookmarkManager' }
      );
    } catch (error) {
      this.#logger.error('Bookmark navigate failed:', error);
      this.#eventBus.emit(
        PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.FAILED,
        { error, message: error.message },
        { actorId: 'BookmarkManager' }
      );
    }
  }

  #count(nodes) {
    if (!Array.isArray(nodes)) return 0;
    return nodes.reduce((acc, n) => acc + 1 + this.#count(n.items || []), 0);
  }

  /**
   * 销毁
   */
  destroy() {
    this.#unsubs.forEach(u => { try { u(); } catch(_){} });
    this.#unsubs = [];
    if (this.#ui) { try { this.#ui.destroy(); } catch(_){} }
    this.#logger.info("BookmarkManager destroyed");
  }
}

export default BookmarkManager;
