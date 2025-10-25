/**
 * @file PDF Bookmark 功能域入口
 * @module features/pdf-bookmark
 * @description
 * PDF 大纲管理功能域，提供用户自定义大纲的添加、编辑、删除功能
 */

import { getLogger } from '../../../common/utils/logger.js';
import { setModuleLogLevel, LogLevel as __LogLevelForFeature } from '../../../common/utils/logger.js';
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

    // 开启与大纲相关模块的 DEBUG 日志，便于排查（可被 localStorage 覆盖）
    try {
      setModuleLogLevel('Feature.pdf-bookmark', __LogLevelForFeature.DEBUG);
      setModuleLogLevel('BookmarkManager', __LogLevelForFeature.DEBUG);
      setModuleLogLevel('BookmarkDataProvider', __LogLevelForFeature.DEBUG);
      // 按需求：关闭 outline 相关模块级日志，仅保留 error
      setModuleLogLevel('BookmarkSidebarUI', __LogLevelForFeature.ERROR);
      setModuleLogLevel('OutlineSidebarUI', __LogLevelForFeature.ERROR);
      setModuleLogLevel('Feature.pdf-outline', __LogLevelForFeature.ERROR);
      setModuleLogLevel('PdfDestUtils', __LogLevelForFeature.DEBUG);
    } catch (_) {}

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

  /**
   * 处理“按ID导航”请求
   * @param {Object} data
   * @param {string} [data.id] - 目标大纲ID（兼容字段）
   * @param {string} [data.bookmarkId] - 目标大纲ID（推荐字段）
   * @param {string} [data.outlineItemId] - 目标大纲ID（URL参数命名，亦兼容）
   * @private
   */
  async #handleNavigateByIdRequest(data) {
    try {
      // 首选规范字段 outlineItemId；兼容历史 bookmarkId/id
      const raw = data?.outlineItemId || data?.bookmarkId || data?.id;
      const id = typeof raw === 'string' ? raw.trim() : '';
      if (!id) {
        this.#logger.warn('[Bookmark] NAVIGATE_BY_ID 缺少有效 outlineItemId');
        return;
      }

      // 允许新旧ID并存：仅提示规范推荐前缀 outlineItem-
      if (!/^outlineItem-[A-Za-z0-9\-_]{8}$/.test(id)) {
        this.#logger.warn(`[Bookmark] 非规范ID（推荐 outlineItem-<8位Base64URL>）: ${id}`);
      }

      if (!this.#bookmarkManager) {
        this.#logger.error('[Bookmark] BookmarkManager 不可用，无法按ID导航');
        return;
      }

      const bookmark = this.#bookmarkManager.getBookmark(id);
      if (!bookmark) {
        this.#logger.warn(`[Bookmark] 未找到指定ID的大纲: ${id}`);
        this.#eventBus.emitGlobal(
          PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.FAILED,
          { error: `Outline not found: ${id}` },
          { actorId: 'PDFBookmarkFeature' }
        );
        return;
      }

      // 复用点击导航流程
      await this.#handleNavigateRequest({ bookmark });
    } catch (e) {
      this.#logger.error('[Bookmark] 按ID导航失败', e);
      this.#eventBus.emitGlobal(
        PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.FAILED,
        { error: e?.message || 'navigate by id failed' },
        { actorId: 'PDFBookmarkFeature' }
      );
    }
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

    // 监听“按ID导航”请求（全局事件，使用onGlobal）
    this.#unsubs.push(
      this.#eventBus.onGlobal(
        PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE_BY_ID.REQUESTED,
        (data) => this.#handleNavigateByIdRequest(data),
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

    // 监听“请求刷新书签列表”，用于晚于首次发射的UI订阅方主动拉取
    this.#unsubs.push(
      this.#eventBus.onGlobal(
        PDF_VIEWER_EVENTS.BOOKMARK.LOAD.REQUESTED,
        () => {
          try { this.#refreshBookmarkList(); } catch (_) {}
        },
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

        const result = await this.#bookmarkManager.addBookmark({
          name: bookmarkData.name,
          pageAt: bookmarkData.pageAt,
          position: (typeof bookmarkData.position === 'number') ? bookmarkData.position : null,
          parentId: bookmarkData.parentId,
          order: bookmarkData.order
        });

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
      // 追加：从数据库读出的拍平样本，便于与UI侧核对pageAt
      try {
        const sample = (current || []).slice(0, 12).map(b => ({ id: b.id, name: b.name, pageAt: b.pageAt, pos: b.position, childrenLen: (b.children||[]).length }));
        try { this.#logger.info(`[DB] Outlines sample after load ${JSON.stringify(sample)}`); } catch { this.#logger.info('[DB] Outlines sample after load'); }
      } catch (_) {}

      // 如数据库无记录，导入PDF原生书签 → 远端保存 → 再从后端加载
      if (current.length === 0) {
        this.#logger.info('📚 No DB outlines, importing native PDF outlines then persisting to backend...');
        try {
          const nativeBookmarks = await this.#bookmarkDataProvider.getBookmarks(data.pdfDocument);
          this.#logger.info(`✅ Fetched ${nativeBookmarks.length} native outlines from PDF`);
          if (nativeBookmarks.length > 0) {
            const result = await this.#bookmarkManager.importNativeBookmarks(
              nativeBookmarks,
              (native) => this.#parseBookmarkNormalizedDest(native, data.pdfDocument)
            );
            if (result.success) {
              this.#logger.info(`✅ Imported ${result.count} native outlines; refreshing UI from memory, then reloading from backend...`);
              // 先直接用内存状态刷新一次，避免后端写入/读取失败导致 UI 空白
              try { this.#refreshBookmarkList(); } catch (_) {}
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
    // 打印样本（便于与 UI 侧对齐）
    try {
      const sample = (bookmarks || []).slice(0, 8).map(b => ({ id: b.id, name: b.name, pageAt: b.pageAt, pos: b.position, childrenLen: (b.children||[]).length }));
      try { this.#logger.info(`[DEBUG] Outline sample before emit ${JSON.stringify(sample)}`); } catch { this.#logger.info('[DEBUG] Outline sample before emit'); }
    } catch (_) {}

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

      // 解析标准化页码/位置
      const pageAt = await this.#parseBookmarkPageAt(bookmark);
      if (!pageAt) {
        this.#logger.warn(`无法解析书签dest: ${bookmark.name}`);
        this.#eventBus.emitGlobal(
          PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.FAILED,
          { error: '无法解析书签目标页码' },
          { actorId: 'PDFBookmarkFeature' }
        );
        return;
      }

      const position = (typeof bookmark.position === 'number') ? bookmark.position : null;
      this.#logger.info(`书签目标: page=${pageAt}, position=${position ?? '(null)'}%`);

      // 调用导航服务
      const result = await this.#navigationService.navigateTo({
        pageAt,
        position
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
  async #parseBookmarkPageAt(bookmark) {
    try {
      // 严格模式：仅接受标准字段 pageAt
      if (typeof bookmark?.pageAt === 'number' && bookmark.pageAt > 0) {
        return bookmark.pageAt;
      }
      this.#logger.warn('书签缺少标准字段 pageAt，无法解析页码');
      return null;
    } catch (error) {
      this.#logger.error('解析书签dest时出错:', error);
      return null;
    }
  }

  /**
   * 解析原生书签目的地为统一的 { pageAt, position }
   * @param {Object} nativeBookmark - 来自 BookmarkDataProvider 的原生书签节点
   * @returns {Promise<{pageAt:number|null, position:number|null}>}
   * @private
   */
  async #parseBookmarkNormalizedDest(nativeBookmark, pdfDocumentArg = null) {
    try {
      const dest = nativeBookmark?.dest;
      if (dest === null || dest === undefined) {
        this.#logger.info('[IMPORT] dest missing; skip', { title: nativeBookmark?.title });
        return { pageAt: null, position: null };
      }
      // 打印目的地类型，便于排查
      try {
        const kind = Array.isArray(dest) ? 'array' : (typeof dest);
        const detail = (() => {
          try {
            if (Array.isArray(dest)) {
              const first = dest[0];
              const firstKind = (first && typeof first === 'object')
                ? (('num' in first || 'gen' in first) ? 'ref-object' : 'object')
                : typeof first;
              return { length: dest.length, firstKind };
            } else if (typeof dest === 'string') {
              return { length: dest.length, preview: dest.slice(0, 80) };
            } else if (dest && typeof dest === 'object') {
              return { keys: Object.keys(dest).slice(0, 6) };
            }
          } catch (_) { /* ignore */ }
          return {};
        })();
        this.#logger.info('[IMPORT] dest detected', { title: nativeBookmark?.title, kind, detail });
      } catch (_) {}
      // 优先使用从 FILE.LOAD.SUCCESS 传入的 pdfDocument，避免并发切换导致的“Transport destroyed”
      const pdfDocument = pdfDocumentArg || getCurrentPDFDocument();
      if (!pdfDocument) {
        this.#logger.info('[IMPORT] pdfDocument missing during parse; skip', { title: nativeBookmark?.title });
        return { pageAt: null, position: null };
      }
      // 优先通过 BookmarkDataProvider（已持有同一 pdfDocument）解析
      try {
        if (this.#bookmarkDataProvider && typeof this.#bookmarkDataProvider.parseDestination === 'function') {
          const parsed = await this.#bookmarkDataProvider.parseDestination(dest);
          const pageAt = parsed?.pageNumber || null;
          let position = null;
          // 仅在明确为 'XYZ' 并且提供了 y 时，计算 position；否则保持 null
          if (pageAt && parsed?.type === 'XYZ' && typeof parsed?.y === 'number') {
            const { yToPositionPercent } = await import('../../pdf/pdf-dest-utils.js');
            position = await yToPositionPercent(pdfDocument, pageAt, parsed.y);
          }
          // 统一串到字符串，避免后端日志把对象打印为 [object Object]
          try { this.#logger.info(`[IMPORT] parsed via provider ${JSON.stringify({ title: nativeBookmark?.title, type: parsed?.type ?? null, pageAt, position })}`); } catch { this.#logger.info('[IMPORT] parsed via provider'); }
          return { pageAt, position };
        }
      } catch (e) {
        // 回退到通用解析
        try { this.#logger.info(`[IMPORT] provider.parseDestination failed, fallback to resolvePdfDest ${JSON.stringify({ title: nativeBookmark?.title, error: e?.message })}`); } catch { this.#logger.info('[IMPORT] provider.parseDestination failed, fallback to resolvePdfDest'); }
      }
      const { resolvePdfDest, yToPositionPercent } = await import('../../pdf/pdf-dest-utils.js');
      const resolved = await resolvePdfDest(pdfDocument, dest);
      const pageAt = resolved?.pageNumber || null;
      let position = null;
      if (pageAt && resolved?.type === 'XYZ' && typeof resolved?.y === 'number') {
        position = await yToPositionPercent(pdfDocument, pageAt, resolved.y);
      }
      try { this.#logger.info(`[IMPORT] parsed via resolvePdfDest ${JSON.stringify({ title: nativeBookmark?.title, type: resolved?.type ?? null, pageAt, position })}`); } catch { this.#logger.info('[IMPORT] parsed via resolvePdfDest'); }
      return { pageAt, position };
    } catch (e) {
      try { this.#logger.warn(`[IMPORT] parse normalized dest failed ${JSON.stringify({ title: nativeBookmark?.title, error: e?.message })}`); } catch { this.#logger.warn('[IMPORT] parse normalized dest failed'); }
      return { pageAt: null, position: null };
    }
  }
}
