/**
 * @file PDF Bookmark 功能域入口
 * @module features/pdf-bookmark
 * @description
 * PDF 书签管理功能域，提供用户自定义书签的添加、编辑、删除功能
 */

import { getLogger } from '../../../common/utils/logger.js';
import { PDF_VIEWER_EVENTS } from '../../../common/event/pdf-viewer-constants.js';
import { PDFBookmarkFeatureConfig } from './feature.config.js';
import { BookmarkManager } from './services/bookmark-manager.js';
import { BookmarkDialog } from './components/bookmark-dialog.js';
import { BookmarkDataProvider } from '../../bookmark/bookmark-data-provider.js';
import { getCurrentPDFDocument } from '../../pdf/current-document-registry.js';

/**
 * PDF Bookmark 功能域类
 * @class PDFBookmarkFeature
 * @implements {IFeature}
 */
export class PDFBookmarkFeature {
  /**
   * 日志记录器
   * @type {import('../../../common/utils/logger.js').Logger}
   * @private
   */
  #logger;

  /**
   * 事件总线
   * @type {Object}
   * @private
   */
  #eventBus;

  /**
   * 依赖容器
   * @type {Object}
   * @private
   */
  #container;

  /**
   * 书签管理器
   * @type {BookmarkManager}
   * @private
   */
  #bookmarkManager;

  /**
   * PDF原生书签提供者
   * @type {BookmarkDataProvider}
   * @private
   */
  #bookmarkDataProvider;

  /**
   * 导航服务
   * @type {NavigationService|null}
   * @private
   */
  #navigationService = null;

  /**
   * 对话框组件
   * @type {BookmarkDialog}
   * @private
   */
  #dialog;

  /**
   * 事件取消订阅函数列表
   * @type {Function[]}
   * @private
   */
  #unsubs = [];

  /**
   * 功能是否已启用
   * @type {boolean}
   * @private
   */
  #enabled = false;

  // ==================== IFeature 接口实现 ====================

  get name() { return PDFBookmarkFeatureConfig.name; }
  get version() { return PDFBookmarkFeatureConfig.version; }
  get dependencies() { return PDFBookmarkFeatureConfig.dependencies; }

  /**
   * 安装功能（初始化逻辑）
   * @param {Object} context - 功能上下文
   * @returns {Promise<void>}
   */
  async install(context) {
    this.#logger = context.logger || getLogger(`Feature.${this.name}`);
    this.#eventBus = context.scopedEventBus || context.globalEventBus;
    this.#container = context.container;

    this.#logger.info(`🚀 [DEBUG] Installing ${this.name}...`);
    this.#logger.info('🔍 [DEBUG] EventBus type:', {
      hasScopedEventBus: !!context.scopedEventBus,
      hasGlobalEventBus: !!context.globalEventBus,
      usingScoped: !!context.scopedEventBus
    });

    // 获取PDF ID
    const pdfId = this.#getPdfId();
    if (!pdfId) {
      this.#logger.warn('PDF ID not available, using default');
    }

    // 获取导航服务
    this.#navigationService = this.#container.get('navigationService');
    if (!this.#navigationService) {
      this.#logger.warn('NavigationService not found in container, bookmark navigation will not work');
    }

    // 初始化书签管理器
    this.#bookmarkManager = new BookmarkManager({
      eventBus: this.#eventBus,
      pdfId: pdfId || 'default'
    });
    await this.#bookmarkManager.initialize();

    // 初始化PDF原生书签提供者
    this.#bookmarkDataProvider = new BookmarkDataProvider();

    // 初始化对话框
    this.#dialog = new BookmarkDialog();

    // 注册事件监听器
    this.#setupEventListeners();

    // 尝试主动加载PDF原生书签（如果PDF已经加载）
    // 注意：#tryLoadNativeBookmarks() 内部会调用 #refreshBookmarkList()
    // 如果PDF未加载，则等待 FILE.LOAD.SUCCESS 事件触发
    await this.#tryLoadNativeBookmarks();

    this.#enabled = true;
    this.#logger.info(`${this.name} installed successfully`);
  }

  /**
   * 卸载功能（清理逻辑）
   * @param {Object} context - 功能上下文
   * @returns {Promise<void>}
   */
  async uninstall(context) {
    this.#logger.info(`Uninstalling ${this.name}...`);

    // 取消所有事件监听
    this.#unsubs.forEach(unsub => {
      try { unsub(); } catch (e) { /* ignore */ }
    });
    this.#unsubs = [];

    // 销毁管理器
    if (this.#bookmarkManager) {
      this.#bookmarkManager.destroy();
      this.#bookmarkManager = null;
    }

    // 销毁PDF原生书签提供者
    if (this.#bookmarkDataProvider) {
      this.#bookmarkDataProvider.destroy();
      this.#bookmarkDataProvider = null;
    }

    // 关闭对话框
    if (this.#dialog) {
      this.#dialog.close();
      this.#dialog = null;
    }

    this.#enabled = false;
    this.#logger.info(`${this.name} uninstalled`);
  }

  /**
   * 检查功能是否已启用
   * @returns {boolean}
   */
  isEnabled() {
    return this.#enabled;
  }

  // ==================== 私有方法 ====================

  /**
   * 获取PDF ID
   * @returns {string|null}
   * @private
   */
  #getPdfId() {
    try {
      // 尝试从container获取pdfManager
      const pdfManager = this.#container?.resolve('pdfManager');
      if (pdfManager && pdfManager.currentPdfId) {
        return pdfManager.currentPdfId;
      }

      // 尝试从window.PDF_PATH获取
      if (window.PDF_PATH) {
        // 从路径提取文件名作为ID
        const filename = window.PDF_PATH.split('/').pop().split('.')[0];
        return filename;
      }

      return null;
    } catch (error) {
      this.#logger.warn('Failed to get PDF ID:', error);
      return null;
    }
  }

  /**
   * 获取当前页码
   * @returns {number}
   * @private
   */
  #getCurrentPage() {
    try {
      const pdfManager = this.#container?.resolve('pdfManager');
      if (pdfManager && pdfManager.currentPageNumber) {
        return pdfManager.currentPageNumber;
      }
      return 1;
    } catch (error) {
      this.#logger.warn('Failed to get current page:', error);
      return 1;
    }
  }

  /**
   * 尝试主动加载PDF原生书签（如果PDF已经加载）
   * @returns {Promise<void>}
   * @private
   */
  async #tryLoadNativeBookmarks() {
    try {
      this.#logger.info('🔍 [DEBUG] tryLoadNativeBookmarks called');
      const pdfDocument = getCurrentPDFDocument();
      this.#logger.info('🔍 [DEBUG] getCurrentPDFDocument result:', { hasPdfDocument: !!pdfDocument });

      if (pdfDocument) {
        this.#logger.info('✅ PDF already loaded, fetching native bookmarks...');
        await this.#handlePdfLoaded({ pdfDocument });
      } else {
        this.#logger.info('⏳ PDF not yet loaded, waiting for load event');
        // PDF未加载时，显示空的书签列表（只有自定义书签，如果有的话）
        this.#refreshBookmarkList([]);
      }
    } catch (error) {
      this.#logger.error('❌ Failed to try load native bookmarks:', error);
      // 出错时也显示空列表
      this.#refreshBookmarkList([]);
    }
  }

  /**
   * 设置事件监听器
   * @private
   */
  #setupEventListeners() {
    // 监听PDF加载完成事件（全局事件，使用onGlobal）
    // 注意：FILE.LOAD.SUCCESS 由 PDFManager 使用全局EventBus发出，必须用onGlobal监听
    this.#unsubs.push(
      this.#eventBus.onGlobal(
        PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
        (data) => {
          this.#logger.info('🎯 [DEBUG] FILE.LOAD.SUCCESS event received!', { hasData: !!data });
          this.#handlePdfLoaded(data);
        },
        { subscriberId: 'PDFBookmarkFeature' }
      )
    );

    // 监听创建书签请求（全局事件，使用onGlobal）
    // 注意：BookmarkToolbar 使用全局EventBus发出，必须用onGlobal监听
    this.#unsubs.push(
      this.#eventBus.onGlobal(
        PDF_VIEWER_EVENTS.BOOKMARK.CREATE.REQUESTED,
        (data) => this.#handleCreateRequest(data),
        { subscriberId: 'PDFBookmarkFeature' }
      )
    );

    // 监听更新书签请求（全局事件，使用onGlobal）
    this.#unsubs.push(
      this.#eventBus.onGlobal(
        PDF_VIEWER_EVENTS.BOOKMARK.UPDATE.REQUESTED,
        (data) => this.#handleUpdateRequest(data),
        { subscriberId: 'PDFBookmarkFeature' }
      )
    );

    // 监听删除书签请求（全局事件，使用onGlobal）
    this.#unsubs.push(
      this.#eventBus.onGlobal(
        PDF_VIEWER_EVENTS.BOOKMARK.DELETE.REQUESTED,
        (data) => this.#handleDeleteRequest(data),
        { subscriberId: 'PDFBookmarkFeature' }
      )
    );

    // 监听排序书签请求（全局事件，使用onGlobal）
    this.#unsubs.push(
      this.#eventBus.onGlobal(
        PDF_VIEWER_EVENTS.BOOKMARK.REORDER.REQUESTED,
        (data) => this.#handleReorderRequest(data),
        { subscriberId: 'PDFBookmarkFeature' }
      )
    );

    // 监听书签导航请求（全局事件，使用onGlobal）
    this.#unsubs.push(
      this.#eventBus.onGlobal(
        PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.REQUESTED,
        (data) => this.#handleNavigateRequest(data),
        { subscriberId: 'PDFBookmarkFeature' }
      )
    );

    this.#logger.info('Event listeners registered');
  }

  /**
   * 处理创建书签请求
   * @param {Object} data - 请求数据
   * @private
   */
  #handleCreateRequest(data) {
    const currentPage = this.#getCurrentPage();

    this.#dialog.showAdd({
      currentPage,
      onConfirm: (bookmarkData) => {
        const result = this.#bookmarkManager.addBookmark(bookmarkData);

        if (result.success) {
          this.#logger.info(`Bookmark created: ${result.bookmarkId}`);
          this.#eventBus.emitGlobal(
            PDF_VIEWER_EVENTS.BOOKMARK.CREATE.SUCCESS,
            { bookmarkId: result.bookmarkId, bookmark: bookmarkData },
            { actorId: 'PDFBookmarkFeature' }
          );

          // 刷新书签列表显示
          this.#refreshBookmarkList();
        } else {
          this.#logger.error(`Failed to create bookmark: ${result.error}`);
          this.#eventBus.emitGlobal(
            PDF_VIEWER_EVENTS.BOOKMARK.CREATE.FAILED,
            { error: result.error },
            { actorId: 'PDFBookmarkFeature' }
          );
          alert(`添加书签失败: ${result.error}`);
        }
      },
      onCancel: () => {
        this.#logger.debug('Create bookmark cancelled');
      }
    });
  }

  /**
   * 处理更新书签请求
   * @param {Object} data - 请求数据
   * @private
   */
  #handleUpdateRequest(data) {
    const { bookmarkId } = data;
    const bookmark = this.#bookmarkManager.getBookmark(bookmarkId);

    if (!bookmark) {
      this.#logger.warn(`Bookmark not found: ${bookmarkId}`);
      alert('书签不存在');
      return;
    }

    this.#dialog.showEdit({
      bookmark,
      onConfirm: (updates) => {
        const result = this.#bookmarkManager.updateBookmark(bookmarkId, updates);

        if (result.success) {
          this.#logger.info(`Bookmark updated: ${bookmarkId}`);
          this.#eventBus.emitGlobal(
            PDF_VIEWER_EVENTS.BOOKMARK.UPDATE.SUCCESS,
            { bookmarkId, updates },
            { actorId: 'PDFBookmarkFeature' }
          );

          // 刷新书签列表显示
          this.#refreshBookmarkList();
        } else {
          this.#logger.error(`Failed to update bookmark: ${result.error}`);
          this.#eventBus.emitGlobal(
            PDF_VIEWER_EVENTS.BOOKMARK.UPDATE.FAILED,
            { bookmarkId, error: result.error },
            { actorId: 'PDFBookmarkFeature' }
          );
          alert(`更新书签失败: ${result.error}`);
        }
      },
      onCancel: () => {
        this.#logger.debug('Update bookmark cancelled');
      }
    });
  }

  /**
   * 处理删除书签请求
   * @param {Object} data - 请求数据
   * @private
   */
  #handleDeleteRequest(data) {
    const { bookmarkId } = data;
    const bookmark = this.#bookmarkManager.getBookmark(bookmarkId);

    if (!bookmark) {
      this.#logger.warn(`Bookmark not found: ${bookmarkId}`);
      alert('书签不存在');
      return;
    }

    const childCount = bookmark.children ? bookmark.children.length : 0;

    this.#dialog.showDelete({
      bookmark,
      childCount,
      onConfirm: (cascadeDelete) => {
        const result = this.#bookmarkManager.deleteBookmark(bookmarkId, cascadeDelete);

        if (result.success) {
          this.#logger.info(`Bookmark deleted: ${bookmarkId}, count: ${result.deletedIds.length}`);
          this.#eventBus.emitGlobal(
            PDF_VIEWER_EVENTS.BOOKMARK.DELETE.SUCCESS,
            { bookmarkId, deletedIds: result.deletedIds },
            { actorId: 'PDFBookmarkFeature' }
          );

          // 刷新书签列表显示
          this.#refreshBookmarkList();
        } else {
          this.#logger.error(`Failed to delete bookmark: ${result.error}`);
          this.#eventBus.emitGlobal(
            PDF_VIEWER_EVENTS.BOOKMARK.DELETE.FAILED,
            { bookmarkId, error: result.error },
            { actorId: 'PDFBookmarkFeature' }
          );
          alert(`删除书签失败: ${result.error}`);
        }
      },
      onCancel: () => {
        this.#logger.debug('Delete bookmark cancelled');
      }
    });
  }

  /**
   * 处理排序书签请求
   * @param {Object} data - 请求数据
   * @private
   */
  #handleReorderRequest(data) {
    const { bookmarkId, newParentId, newIndex } = data;
    const result = this.#bookmarkManager.reorderBookmarks(bookmarkId, newParentId, newIndex);

    if (result.success) {
      this.#logger.info(`Bookmark reordered: ${bookmarkId}`);
      this.#eventBus.emitGlobal(
        PDF_VIEWER_EVENTS.BOOKMARK.REORDER.SUCCESS,
        { bookmarkId, newParentId, newIndex },
        { actorId: 'PDFBookmarkFeature' }
      );

      // 刷新书签列表显示
      this.#refreshBookmarkList();
    } else {
      this.#logger.error(`Failed to reorder bookmark: ${result.error}`);
      this.#eventBus.emitGlobal(
        PDF_VIEWER_EVENTS.BOOKMARK.REORDER.FAILED,
        { bookmarkId, error: result.error },
        { actorId: 'PDFBookmarkFeature' }
      );
    }
  }

  /**
   * 处理PDF加载完成事件
   * @param {Object} data - PDF加载数据
   * @param {Object} data.pdfDocument - PDF文档对象
   * @private
   */
  async #handlePdfLoaded(data) {
    try {
      this.#logger.info('🔍 [DEBUG] #handlePdfLoaded called with data:', { hasData: !!data, hasPdfDocument: !!(data && data.pdfDocument) });

      if (!data || !data.pdfDocument) {
        this.#logger.warn('❌ PDF document not available in load event');
        return;
      }

      this.#logger.info('📄 PDF loaded, loading native bookmarks...');

      // 获取PDF原生书签
      const nativeBookmarks = await this.#bookmarkDataProvider.getBookmarks(data.pdfDocument);

      this.#logger.info(`📚 Loaded ${nativeBookmarks.length} native bookmarks`);

      // 刷新书签列表（包含原生书签）
      this.#refreshBookmarkList(nativeBookmarks);
    } catch (error) {
      this.#logger.error('❌ Failed to load native bookmarks:', error);
      // 即使失败也要刷新，至少显示自定义书签
      this.#refreshBookmarkList([]);
    }
  }

  /**
   * 刷新书签列表显示
   * @param {Array} nativeBookmarks - PDF原生书签（可选）
   * @private
   */
  #refreshBookmarkList(nativeBookmarks = []) {
    this.#logger.info('🔍 [DEBUG] #refreshBookmarkList called with nativeBookmarks:', nativeBookmarks.length);

    const customBookmarks = this.#bookmarkManager.getAllBookmarks();
    this.#logger.info('🔍 [DEBUG] customBookmarks from manager:', customBookmarks.length);

    // 将自定义书签转换为与PDF原生书签兼容的格式
    const formattedCustomBookmarks = this.#formatBookmarksForDisplay(customBookmarks);

    // 合并原生书签和自定义书签（原生书签在前）
    const allBookmarks = [...nativeBookmarks, ...formattedCustomBookmarks];
    this.#logger.info('🔍 [DEBUG] Total bookmarks to emit:', allBookmarks.length, 'Event:', PDF_VIEWER_EVENTS.BOOKMARK.LOAD.SUCCESS);

    // 发出全局事件（跨Feature通信，不使用命名空间）
    // 注意：BookmarkSidebarUI 使用全局EventBus监听，所以这里必须用 emitGlobal()
    this.#eventBus.emitGlobal(
      PDF_VIEWER_EVENTS.BOOKMARK.LOAD.SUCCESS,
      {
        bookmarks: allBookmarks,
        count: this.#countBookmarks(allBookmarks),
        source: nativeBookmarks.length > 0 ? 'mixed' : 'local'
      },
      { actorId: 'PDFBookmarkFeature' }
    );

    this.#logger.info(`✅ Bookmark list refreshed: ${nativeBookmarks.length} native + ${customBookmarks.length} custom, event emitted`);
  }

  /**
   * 格式化书签数据用于显示
   * @param {Array} bookmarks - 书签数组
   * @returns {Array} 格式化后的书签数组
   * @private
   */
  #formatBookmarksForDisplay(bookmarks) {
    return bookmarks.map(bookmark => ({
      id: bookmark.id,
      title: bookmark.name,
      dest: bookmark.pageNumber, // 简化处理，实际应该是dest对象
      items: bookmark.children && bookmark.children.length > 0
        ? this.#formatBookmarksForDisplay(bookmark.children)
        : []
    }));
  }

  /**
   * 计算书签总数（包括子书签）
   * @param {Array} bookmarks - 书签数组
   * @returns {number} 总数
   * @private
   */
  #countBookmarks(bookmarks) {
    let count = bookmarks.length;
    bookmarks.forEach(bookmark => {
      if (bookmark.children && bookmark.children.length > 0) {
        count += this.#countBookmarks(bookmark.children);
      }
    });
    return count;
  }

  /**
   * 处理书签导航请求
   * @param {Object} data - 导航数据
   * @param {Object} data.bookmark - 书签对象
   * @private
   */
  async #handleNavigateRequest(data) {
    try {
      const bookmark = data?.bookmark;
      if (!bookmark) {
        this.#logger.warn('书签导航请求缺少bookmark对象');
        return;
      }

      // 检查导航服务是否可用
      if (!this.#navigationService) {
        this.#logger.error('NavigationService未初始化，无法导航');
        this.#eventBus.emitGlobal(
          PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.FAILED,
          { error: 'NavigationService不可用' },
          { actorId: 'PDFBookmarkFeature' }
        );
        return;
      }

      this.#logger.info(`开始导航到书签: ${bookmark.title}`);

      // 解析书签dest获取页码
      const pageNumber = await this.#parseBookmarkDest(bookmark);
      if (!pageNumber) {
        this.#logger.warn(`无法解析书签dest: ${bookmark.title}`);
        this.#eventBus.emitGlobal(
          PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.FAILED,
          { error: '无法解析书签目标页码' },
          { actorId: 'PDFBookmarkFeature' }
        );
        return;
      }

      this.#logger.info(`书签目标页码: ${pageNumber}`);

      // 调用导航服务
      const result = await this.#navigationService.navigateTo({
        pageAt: pageNumber,
        position: null  // PDF书签通常不指定具体位置百分比
      });

      if (result.success) {
        this.#logger.info(`书签导航成功: 页码=${result.actualPage}`);
        this.#eventBus.emitGlobal(
          PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.SUCCESS,
          {
            pageNumber: result.actualPage,
            position: result.actualPosition
          },
          { actorId: 'PDFBookmarkFeature' }
        );
      } else {
        this.#logger.error(`书签导航失败: ${result.error}`);
        this.#eventBus.emitGlobal(
          PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.FAILED,
          { error: result.error },
          { actorId: 'PDFBookmarkFeature' }
        );
      }
    } catch (error) {
      this.#logger.error('处理书签导航请求时出错:', error);
      this.#eventBus.emitGlobal(
        PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.FAILED,
        { error: error.message },
        { actorId: 'PDFBookmarkFeature' }
      );
    }
  }

  /**
   * 解析书签dest获取页码
   * @param {Object} bookmark - 书签对象
   * @returns {Promise<number|null>} 页码（从1开始），失败返回null
   * @private
   */
  async #parseBookmarkDest(bookmark) {
    try {
      const dest = bookmark.dest;
      if (!dest || !Array.isArray(dest) || dest.length === 0) {
        this.#logger.warn('书签dest无效或为空');
        return null;
      }

      // dest格式: [pageRef, destType, ...params]
      // pageRef可能是: {num: xx, gen: yy} 或直接是页码数字
      const pageRef = dest[0];

      // 如果pageRef直接是数字，就是页码（从0开始）
      if (typeof pageRef === 'number') {
        return pageRef + 1;  // 转换为从1开始
      }

      // 如果pageRef是对象，需要通过PDFDocument解析
      if (pageRef && typeof pageRef === 'object' && 'num' in pageRef) {
        const pdfDocument = getCurrentPDFDocument();
        if (!pdfDocument) {
          this.#logger.warn('PDF文档对象不可用，无法解析页面引用');
          return null;
        }

        try {
          // 使用PDFDocument的getPageIndex方法将引用转换为索引
          const pageIndex = await pdfDocument.getPageIndex(pageRef);
          return pageIndex + 1;  // 转换为从1开始的页码
        } catch (error) {
          this.#logger.error('解析页面引用失败:', error);
          return null;
        }
      }

      this.#logger.warn('未知的pageRef格式:', pageRef);
      return null;
    } catch (error) {
      this.#logger.error('解析书签dest时出错:', error);
      return null;
    }
  }
}
