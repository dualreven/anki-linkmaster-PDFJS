/**
 * @file 应用协调器
 * @module AppCoordinator
 * @description 负责协调各功能模块的初始化和生命周期，不处理事件监听
 */

import { getLogger } from '../../common/utils/logger.js';
import { PDF_VIEWER_EVENTS } from '../../common/event/pdf-viewer-constants.js';
import { PDFManager } from '../pdf/pdf-manager-refactored.js';
import { UIManagerCore as UIManager } from '../ui/ui-manager-core-refactored.js';
import { createConsoleWebSocketBridge } from '../../common/utils/console-websocket-bridge.js';

/**
 * 应用协调器类
 * 负责协调各功能模块的初始化和销毁
 *
 * @class AppCoordinator
 */
export class AppCoordinator {
  /** @type {import('../../common/utils/logger.js').Logger} */
  #logger;

  /** @type {import('../../common/event/event-bus.js').EventBus} */
  #eventBus;

  /** @type {import('../container/app-container.js').PDFViewerContainer} */
  #appContainer;

  /** @type {import('../pdf/pdf-manager-refactored.js').PDFManager} */
  #pdfManager;

  /** @type {import('../ui/ui-manager-core-refactored.js').UIManager} */
  #uiManager;

  /** @type {import('../bookmark/bookmark-manager.js').BookmarkManager|null} */
  #bookmarkManager = null;

  /** @type {import('../../common/utils/console-websocket-bridge.js').ConsoleBridge} */
  #consoleBridge;

  /** @type {Object} WebSocket客户端 */
  #wsClient;

  /** @type {boolean} 是否已初始化 */
  #initialized = false;

  /**
   * 创建应用协调器实例
   *
   * @param {import('../container/app-container.js').PDFViewerContainer} appContainer - 应用容器
   */
  constructor(appContainer) {
    if (!appContainer) {
      throw new Error('AppCoordinator: appContainer is required');
    }

    this.#appContainer = appContainer;
    this.#logger = getLogger('AppCoordinator');

    // 从容器获取依赖
    const { eventBus, wsClient } = appContainer.getDependencies();
    this.#eventBus = eventBus;
    this.#wsClient = wsClient;

    // 创建模块实例
    this.#pdfManager = new PDFManager(this.#eventBus);
    this.#uiManager = new UIManager(this.#eventBus);

    // 创建console桥接器，但暂时不启用
    this.#consoleBridge = createConsoleWebSocketBridge('pdf_viewer', (message) => {
      if (this.#wsClient && this.#wsClient.isConnected()) {
        this.#wsClient.send({ type: 'console_log', data: message });
      }
    });

    // 监听WebSocket连接建立事件，然后启用console桥接器
    this.#eventBus.on('websocket:connection:established', () => {
      this.#logger.info('WebSocket connected, enabling console bridge');
      this.#consoleBridge.enable();
    }, { subscriberId: 'AppCoordinator' });

    this.#logger.debug('AppCoordinator created');
  }

  /**
   * 初始化所有模块
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.#initialized) {
      this.#logger.warn('AppCoordinator already initialized');
      return;
    }

    this.#logger.info('Initializing all modules...');

    try {
      // 1. 先初始化容器（创建WSClient但不连接）
      if (!this.#appContainer.isInitialized()) {
        this.#logger.info('Initializing container...');
        await this.#appContainer.initialize();

        // 重新获取依赖，特别是wsClient
        const { wsClient } = this.#appContainer.getDependencies();
        this.#wsClient = wsClient;
        this.#logger.debug('Container initialized, WSClient ready');
      }

      // 2. 然后连接WebSocket
      this.#logger.info('Attempting to connect WebSocket via container...');
      this.#appContainer.connect();
      this.#logger.debug('WebSocket connection initiated');

      // 3. 初始化各管理器
      this.#logger.info('Initializing PDFManager...');
      await this.#pdfManager.initialize();
      this.#logger.debug('PDFManager initialized');

      this.#logger.info('Initializing UIManager...');
      await this.#uiManager.initialize();
      this.#logger.debug('UIManager initialized');

      // 4. 初始化书签管理器（依赖UI容器已就绪）；默认启用，可通过 ?bookmark=0 显式关闭
      await this.#initializeBookmarkManager();

      // 5. 监听PDF加载成功事件
      this.#eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, ({ pdfDocument }) => {
        this.#uiManager.loadPdfDocument(pdfDocument);
      }, { subscriberId: 'AppCoordinator' });

      this.#initialized = true;
      this.#logger.info('All modules initialized successfully');

      // 发射初始化完成事件
      this.#eventBus.emit(PDF_VIEWER_EVENTS.STATE.INITIALIZED, undefined, {
        actorId: 'AppCoordinator'
      });

    } catch (error) {
      this.#logger.error('Module initialization failed:', error);
      throw error;
    }
  }

  /**
   * 初始化书签管理器
   *
   * @private
   * @returns {Promise<void>}
   */
  async #initializeBookmarkManager() {
    try {
      const params = new URLSearchParams(window.location.search);
      const bookmarkParam = (params.get('bookmark') || '').toLowerCase();
      const enableBookmarks = (
        bookmarkParam === '' ||
        bookmarkParam === '1' ||
        bookmarkParam === 'true' ||
        bookmarkParam === 'on'
      );

      if (enableBookmarks) {
        const { BookmarkManager } = await import('../bookmark/bookmark-manager.js');
        this.#bookmarkManager = new BookmarkManager(this.#eventBus);
        this.#bookmarkManager.initialize();
        this.#logger.info('BookmarkManager initialized (enabled by default; disable with ?bookmark=0)');
      } else {
        this.#logger.info('BookmarkManager disabled by URL param bookmark=0');
      }
    } catch (bmErr) {
      const reason = bmErr && typeof bmErr === 'object'
        ? (bmErr.stack || bmErr.message || JSON.stringify(bmErr))
        : bmErr;
      this.#logger.warn('BookmarkManager init failed, continue without bookmarks', reason);
    }
  }

  /**
   * 销毁所有模块
   */
  destroy() {
    this.#logger.info('Destroying all modules...');

    try {
      // 按相反顺序销毁模块
      if (this.#bookmarkManager) {
        this.#bookmarkManager.destroy();
        this.#bookmarkManager = null;
      }

      this.#uiManager.destroy();
      this.#pdfManager.destroy();

      // 通过容器断开连接和清理资源
      if (this.#appContainer) {
        this.#appContainer.dispose();
      }

      this.#initialized = false;
      this.#logger.info('All modules destroyed');

      // 发射销毁完成事件
      this.#eventBus.emit(PDF_VIEWER_EVENTS.STATE.DESTROYED, undefined, {
        actorId: 'AppCoordinator'
      });

    } catch (error) {
      this.#logger.error('Module destruction failed:', error);
      throw error;
    }
  }

  /**
   * 获取是否已初始化
   *
   * @returns {boolean}
   */
  isInitialized() {
    return this.#initialized;
  }

  /**
   * 获取事件总线
   *
   * @returns {import('../../common/event/event-bus.js').EventBus}
   */
  getEventBus() {
    return this.#eventBus;
  }

  /**
   * 获取 PDF 管理器
   *
   * @returns {import('../pdf/pdf-manager-refactored.js').PDFManager}
   */
  getPDFManager() {
    return this.#pdfManager;
  }

  /**
   * 获取 UI 管理器
   *
   * @returns {import('../ui/ui-manager-core-refactored.js').UIManager}
   */
  getUIManager() {
    return this.#uiManager;
  }

  /**
   * 获取书签管理器
   *
   * @returns {import('../bookmark/bookmark-manager.js').BookmarkManager|null}
   */
  getBookmarkManager() {
    return this.#bookmarkManager;
  }

  /**
   * 获取应用容器
   *
   * @returns {import('../container/app-container.js').PDFViewerContainer}
   */
  getAppContainer() {
    return this.#appContainer;
  }

  /**
   * 获取 WebSocket 客户端
   *
   * @returns {Object}
   */
  getWSClient() {
    return this.#wsClient;
  }
}
