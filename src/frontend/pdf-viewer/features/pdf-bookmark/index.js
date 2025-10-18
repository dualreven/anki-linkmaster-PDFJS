/**
 * @file PDF Bookmark 功能域入口
 * @module features/pdf-bookmark
 * @description
 * PDF 大纲管理功能域，提供用户自定义大纲的添加、编辑、删除功能
 */

import { getLogger } from '../../../common/utils/logger.js';
import { success as toastSuccess, error as toastError } from '../../../common/utils/thirdparty-toast.js';
import { PDF_VIEWER_EVENTS } from '../../../common/event/pdf-viewer-constants.js';
import { WEBSOCKET_EVENTS } from '../../../common/event/event-constants.js';
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
   * 大纲管理器
   * @type {BookmarkManager}
   * @private
   */
  #bookmarkManager;

  /**
   * PDF原生大纲提供者
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
   * 大纲对话框组件
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
  #toastTimer = null;

  /**
   * 当前选中的书签ID和书签对象
   * @type {{id: string|null, bookmark: Object|null}}
   * @private
   */
  #selectedBookmark = { id: null, bookmark: null };

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
      this.#logger.warn('NavigationService not found in container, outline navigation will not work');
    }

    // 初始化书签管理器
    let wsClient = null;
    if (this.#container) {
      if (typeof this.#container.getWSClient === 'function') {
        wsClient = this.#container.getWSClient();
      } else if (typeof this.#container.getDependencies === 'function') {
        const deps = this.#container.getDependencies() || {};
        wsClient = deps.wsClient || null;
      } else if (typeof this.#container.get === 'function') {
        try {
          wsClient = this.#container.get('wsClient');
        } catch (error) {
          this.#logger.debug('wsClient not available in container', error);
        }
      }
    }

    this.#bookmarkManager = new BookmarkManager({
      eventBus: this.#eventBus,
      pdfId: pdfId || 'default',
      storageOptions: { wsClient }
    });
    await this.#bookmarkManager.initialize();

    // 当 WebSocket 建立后，尝试从后端重新拉取一次，避免首次加载时连接尚未就绪导致只读本地
    try {
      const unsubWsReady = this.#eventBus.onGlobal(
        WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED,
        async () => {
          try {
            await this.#bookmarkManager.loadFromStorage();
            this.#refreshBookmarkList();
            toastSuccess('✓ 已连接服务器，书签已同步');
          } catch (_) {}
        },
        { subscriberId: 'PDFBookmarkFeature' }
      );
      this.#unsubs.push(unsubWsReady);
    } catch (_) {}

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

  // 已移除自定义 toast 方法，改用 frontend/common 下的公共 toast 工具

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
      // 优先从URL参数获取pdf-id（最可靠）
      const urlParams = new URLSearchParams(window.location.search);
      const pdfId = urlParams.get('pdf-id');
      if (pdfId) {
        return pdfId;
      }

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
      this.#logger.info('✅ PDF already loaded, checking if native outlines need to be imported...');
        await this.#handlePdfLoaded({ pdfDocument });
      } else {
        this.#logger.info('⏳ PDF not yet loaded, waiting for load event');
        // PDF未加载时，显示本地存储的大纲（如果有的话）
        this.#refreshBookmarkList();
      }
    } catch (error) {
      this.#logger.error('❌ Failed to try load native bookmarks:', error);
      // 出错时也刷新列表
      this.#refreshBookmarkList();
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

    // 监听创建大纲请求（全局事件，使用onGlobal）
    // 注意：BookmarkToolbar 使用全局EventBus发出，必须用onGlobal监听
    this.#unsubs.push(
      this.#eventBus.onGlobal(
        PDF_VIEWER_EVENTS.BOOKMARK.CREATE.REQUESTED,
        (data) => this.#handleCreateRequest(data),
        { subscriberId: 'PDFBookmarkFeature' }
      )
    );

    // 监听更新大纲请求（全局事件，使用onGlobal）
    this.#unsubs.push(
      this.#eventBus.onGlobal(
        PDF_VIEWER_EVENTS.BOOKMARK.UPDATE.REQUESTED,
        (data) => this.#handleUpdateRequest(data),
        { subscriberId: 'PDFBookmarkFeature' }
      )
    );

    // 监听删除大纲请求（全局事件，使用onGlobal）
    this.#unsubs.push(
      this.#eventBus.onGlobal(
        PDF_VIEWER_EVENTS.BOOKMARK.DELETE.REQUESTED,
        (data) => this.#handleDeleteRequest(data),
        { subscriberId: 'PDFBookmarkFeature' }
      )
    );

    // 监听排序大纲请求（全局事件，使用onGlobal）
    this.#unsubs.push(
      this.#eventBus.onGlobal(
        PDF_VIEWER_EVENTS.BOOKMARK.REORDER.REQUESTED,
        (data) => this.#handleReorderRequest(data),
        { subscriberId: 'PDFBookmarkFeature' }
      )
    );

    // 监听大纲导航请求（全局事件，使用onGlobal）
    this.#unsubs.push(
      this.#eventBus.onGlobal(
        PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.REQUESTED,
        (data) => this.#handleNavigateRequest(data),
        { subscriberId: 'PDFBookmarkFeature' }
      )
    );

    // 监听大纲选中变化（全局事件，使用onGlobal）
    this.#unsubs.push(
      this.#eventBus.onGlobal(
        PDF_VIEWER_EVENTS.BOOKMARK.SELECT.CHANGED,
        (data) => this.#handleSelectionChanged(data),
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

    // 计算新书签的父级和排序位置
    let parentId = null;
    let order = 0;

    if (this.#selectedBookmark.id && this.#selectedBookmark.bookmark) {
      // 如果有选中的书签，添加到选中书签的同级下面
      const selected = this.#selectedBookmark.bookmark;
      parentId = selected.parentId || null;

      // 获取同级列表
      let siblings = [];
      if (parentId) {
        const parent = this.#bookmarkManager.getBookmark(parentId);
        siblings = parent ? parent.children : [];
      } else {
        siblings = this.#bookmarkManager.getAllBookmarks();
      }

      // 找到选中书签的索引
      const selectedIndex = siblings.findIndex(b => b.id === selected.id);
      // 新书签插入到选中书签后面
      order = selectedIndex !== -1 ? selectedIndex + 1 : siblings.length;

      this.#logger.info(`Adding outline after selected: parent=${parentId || 'root'}, order=${order}`);
    }

    this.#dialog.showAdd({
      currentPage,
      onConfirm: async (bookmarkData) => {
        // 设置父级和排序
        bookmarkData.parentId = parentId;
        bookmarkData.order = order;

        const result = await this.#bookmarkManager.addBookmark(bookmarkData);

        if (result.success) {
          this.#logger.info(`Outline created: ${result.bookmarkId}`);
          toastSuccess('✓ 大纲已添加');
          this.#eventBus.emitGlobal(
            PDF_VIEWER_EVENTS.BOOKMARK.CREATE.SUCCESS,
            { bookmarkId: result.bookmarkId, bookmark: bookmarkData },
            { actorId: 'PDFBookmarkFeature' }
          );

          // 远端保存并从后端刷新
          await this.#bookmarkManager.saveToStorage();
          await this.#bookmarkManager.loadFromStorage();
          this.#refreshBookmarkList();

          // 自动选中新添加的书签（延迟执行，等待DOM渲染完成）
          const newBookmark = this.#bookmarkManager.getBookmark(result.bookmarkId);
          if (newBookmark) {
            setTimeout(() => {
              this.#eventBus.emitGlobal(
                PDF_VIEWER_EVENTS.BOOKMARK.SELECT.CHANGED,
                { bookmarkId: result.bookmarkId, bookmark: newBookmark },
                { actorId: 'PDFBookmarkFeature' }
              );
            }, 50); // 延迟50ms，确保DOM已渲染
          }
        } else {
          this.#logger.error(`Failed to create outline: ${result.error}`);
          toastError(`添加大纲失败: ${result.error}`);
          this.#eventBus.emitGlobal(
            PDF_VIEWER_EVENTS.BOOKMARK.CREATE.FAILED,
            { error: result.error },
            { actorId: 'PDFBookmarkFeature' }
          );
          alert(`添加大纲失败: ${result.error}`);
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
      this.#logger.warn(`Outline not found: ${bookmarkId}`);
      alert('大纲不存在');
      return;
    }

    this.#dialog.showEdit({
      bookmark,
      onConfirm: async (updates) => {
        const result = await this.#bookmarkManager.updateBookmark(bookmarkId, updates);

        if (result.success) {
          this.#logger.info(`Outline updated: ${bookmarkId}`);
          toastSuccess('✓ 大纲已更新');
          // 先用本地内存状态立即刷新一次，避免远端回读延迟造成“看起来没更新”
          this.#refreshBookmarkList();
          this.#eventBus.emitGlobal(
            PDF_VIEWER_EVENTS.BOOKMARK.UPDATE.SUCCESS,
            { bookmarkId, updates },
            { actorId: 'PDFBookmarkFeature' }
          );

          // 后台持久化 + 回读（若远端可用），完成后再刷新以保证一致性
          try {
            await this.#bookmarkManager.saveToStorage();
            await this.#bookmarkManager.loadFromStorage();
            this.#refreshBookmarkList();
          } catch (_) {
            // 忽略暂时的远端失败，保留已更新的本地视图
          }
        } else {
          this.#logger.error(`Failed to update outline: ${result.error}`);
          toastError(`更新大纲失败: ${result.error}`);
          this.#eventBus.emitGlobal(
            PDF_VIEWER_EVENTS.BOOKMARK.UPDATE.FAILED,
            { bookmarkId, error: result.error },
            { actorId: 'PDFBookmarkFeature' }
          );
          alert(`更新大纲失败: ${result.error}`);
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
      this.#logger.warn(`Outline not found: ${bookmarkId}`);
      alert('大纲不存在');
      return;
    }

    const childCount = bookmark.children ? bookmark.children.length : 0;

    this.#dialog.showDelete({
      bookmark,
      childCount,
      onConfirm: async (cascadeDelete) => {
        const result = await this.#bookmarkManager.deleteBookmark(bookmarkId, cascadeDelete);

        if (result.success) {
      this.#logger.info(`Outline deleted: ${bookmarkId}, count: ${result.deletedIds.length}`);
      toastSuccess('✓ 大纲已删除');
          this.#eventBus.emitGlobal(
            PDF_VIEWER_EVENTS.BOOKMARK.DELETE.SUCCESS,
            { bookmarkId, deletedIds: result.deletedIds },
            { actorId: 'PDFBookmarkFeature' }
          );

          await this.#bookmarkManager.saveToStorage();
          await this.#bookmarkManager.loadFromStorage();
          this.#refreshBookmarkList();
        } else {
          this.#logger.error(`Failed to delete bookmark: ${result.error}`);
          toastError(`删除书签失败: ${result.error}`);
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
  async #handleReorderRequest(data) {
    let { bookmarkId, newParentId, newIndex } = data;

    // 若携带 position/referenceId，则以 BookmarkManager 当前状态重新计算索引，更稳妥
    try {
      if (data && typeof data.position === 'string' && data.referenceId) {
        const target = this.#bookmarkManager.getBookmark(data.referenceId);
        if (target) {
          const targetParentId = target.parentId || null;
          newParentId = (data.position === 'child') ? target.id : targetParentId;
          if (data.position === 'child') {
            newIndex = 0;
          } else {
            // 取同级 siblings（来源于 Manager 内存状态）
            let siblings = [];
            if (targetParentId) {
              const parent = this.#bookmarkManager.getBookmark(targetParentId);
              siblings = parent ? (parent.children || []) : [];
            } else {
              siblings = this.#bookmarkManager.getAllBookmarks();
            }
            const tIdx = siblings.findIndex(b => b && b.id === target.id);
            const base = tIdx < 0 ? 0 : tIdx;
            newIndex = (data.position === 'before') ? base : base + 1;
          }
        }
      }
    } catch (e) {
      this.#logger.warn('Failed to recalc reorder index from reference/position, fallback to payload', e);
    }

    const result = await this.#bookmarkManager.reorderBookmarks(bookmarkId, newParentId, newIndex);

    if (result.success) {
      this.#logger.info(`Bookmark reordered: ${bookmarkId}`);
      toastSuccess('✓ 书签排序已更新');
      // 立即用本地内存刷新一次，避免用户感知“无变化/消失”
      try {
        this.#refreshBookmarkList();
        // 高亮并滚动到被移动的书签
        const moved = this.#bookmarkManager.getBookmark(bookmarkId);
        if (moved) {
          this.#eventBus.emitGlobal(
            PDF_VIEWER_EVENTS.BOOKMARK.SELECT.CHANGED,
            { bookmarkId, bookmark: moved },
            { actorId: 'PDFBookmarkFeature' }
          );
        }
      } catch (_) {}
      this.#eventBus.emitGlobal(
        PDF_VIEWER_EVENTS.BOOKMARK.REORDER.SUCCESS,
        { bookmarkId, newParentId, newIndex },
        { actorId: 'PDFBookmarkFeature' }
      );

      // 后台持久化与回读，完成后再刷新一次以对齐远端
      try {
        await this.#bookmarkManager.saveToStorage();
        await this.#bookmarkManager.loadFromStorage();
        this.#refreshBookmarkList();
      } catch (_) {}
    } else {
      this.#logger.error(`Failed to reorder outline: ${result.error}`);
      toastError(`大纲排序失败: ${result.error}`);
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

      // DB-first：先从后端加载
      this.#logger.info('🔄 Loading outlines from backend/storage (DB-first)...');
      await this.#bookmarkManager.loadFromStorage();
      let current = this.#bookmarkManager.getAllBookmarks();
      this.#logger.info(`📦 Outlines from storage: ${current.length}`);

      // 如数据库无记录，导入PDF原生书签 → 远端保存 → 再从后端加载
      if (current.length === 0) {
        this.#logger.info('📚 No DB outlines, importing native PDF outlines then persisting to backend...');
        try {
          const nativeBookmarks = await this.#bookmarkDataProvider.getBookmarks(data.pdfDocument);
          this.#logger.info(`✅ Fetched ${nativeBookmarks.length} native outlines from PDF`);
          if (nativeBookmarks.length > 0) {
            const result = await this.#bookmarkManager.importNativeBookmarks(
              nativeBookmarks,
              (bookmark) => this.#parseBookmarkDest(bookmark)
            );
            if (result.success) {
              this.#logger.info(`✅ Imported ${result.count} native outlines; reloading from backend...`);
              await this.#bookmarkManager.loadFromStorage();
              current = this.#bookmarkManager.getAllBookmarks();
              this.#logger.info(`📦 Outlines after backend reload: ${current.length}`);
            } else {
              this.#logger.error(`❌ Failed to import native bookmarks: ${result.error}`);
            }
          } else {
            this.#logger.info('ℹ️ No native bookmarks found in PDF');
          }
        } catch (error) {
          this.#logger.error('❌ Failed to fetch/import native bookmarks:', error);
        }
      }

      // 刷新大纲列表（从BookmarkManager读取）
      this.#refreshBookmarkList();
    } catch (error) {
      this.#logger.error('❌ Failed to handle PDF loaded event:', error);
      // 即使失败也要刷新列表
      this.#refreshBookmarkList();
    }
  }

  /**
   * 刷新大纲列表显示（从BookmarkManager读取所有大纲）
   * @private
   */
  #refreshBookmarkList() {
    const bookmarks = this.#bookmarkManager.getAllBookmarks();
    this.#logger.info('🔍 [DEBUG] #refreshBookmarkList called, outlines from manager:', bookmarks.length);

    // 直接发送 Bookmark 模型数据（不再转换）
    this.#logger.info('🔍 [DEBUG] Total outlines to emit:', bookmarks.length, 'Event:', PDF_VIEWER_EVENTS.BOOKMARK.LOAD.SUCCESS);

    // 发出全局事件（跨Feature通信，不使用命名空间）
    // 注意：BookmarkSidebarUI 使用全局EventBus监听，所以这里必须用 emitGlobal()
    this.#eventBus.emitGlobal(
      PDF_VIEWER_EVENTS.BOOKMARK.LOAD.SUCCESS,
      {
        bookmarks: bookmarks,  // 直接使用 Bookmark 模型（展示为“大纲”）
        count: this.#countBookmarks(bookmarks),
        source: 'local'
      },
      { actorId: 'PDFBookmarkFeature' }
    );

    this.#logger.info(`✅ Outline list refreshed: ${bookmarks.length} items, event emitted`);
  }

  /**
   * 计算大纲总数（包括子大纲）
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
   * 处理大纲选中变化
   * @param {Object} data - 选中数据
   * @param {string|null} data.bookmarkId - 书签ID
   * @param {Object|null} data.bookmark - 书签对象
   * @private
   */
  #handleSelectionChanged(data) {
    this.#selectedBookmark = {
      id: data?.bookmarkId || null,
      bookmark: data?.bookmark || null
    };
    this.#logger.debug(`Selection changed: ${this.#selectedBookmark.id}`);
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

      this.#logger.info(`开始导航到书签: ${bookmark.name}`);

      // 解析书签dest获取页码
      const pageNumber = await this.#parseBookmarkDest(bookmark);
      if (!pageNumber) {
        this.#logger.warn(`无法解析书签dest: ${bookmark.name}`);
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
   * @param {Object} bookmark - 书签对象（Bookmark 模型）
   * @returns {Promise<number|null>} 页码（从1开始），失败返回null
   * @private
   */
  async #parseBookmarkDest(bookmark) {
    try {
      // 优先使用 Bookmark 模型的 pageNumber 字段（1-based）
      if (bookmark.pageNumber && typeof bookmark.pageNumber === 'number') {
        return bookmark.pageNumber;
      }

      // 兼容旧格式：存在 dest 时使用通用解析
      const dest = bookmark.dest;
      if (dest === null || dest === undefined) {
        this.#logger.warn('书签缺少 dest 与 pageNumber，无法解析');
        return null;
      }

      const pdfDocument = getCurrentPDFDocument();
      if (!pdfDocument) {
        this.#logger.warn('PDF文档对象不可用，无法解析书签目的地');
        return null;
      }

      const { resolvePdfDest } = await import('../../pdf/pdf-dest-utils.js');
      const resolved = await resolvePdfDest(pdfDocument, dest);
      return resolved?.pageNumber || null;
    } catch (error) {
      this.#logger.error('解析书签dest时出错:', error);
      return null;
    }
  }
}
