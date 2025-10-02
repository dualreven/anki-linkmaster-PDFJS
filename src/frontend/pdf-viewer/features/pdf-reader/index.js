/**
 * @file PDF阅读器功能域
 * @module features/pdf-reader
 * @description 实现IFeature接口的PDF阅读核心功能
 */

import { getLogger } from '../../../common/utils/logger.js';
import { PDFReaderFeatureConfig } from './feature.config.js';

// 导入服务和组件
import { PDFLoader } from './components/pdf-loader.js';
import { PageCacheManager } from './components/page-cache-manager.js';
import { PDFDocumentManager } from './services/pdf-document-service.js';
import { PDFManager } from './services/pdf-manager-service.js';
import { FileHandler } from './services/file-service.js';
import { NavigationHandler } from './services/navigation-service.js';
import { ZoomHandler } from './services/zoom-service.js';

/**
 * PDF阅读器功能类
 * 实现 IFeature 接口
 *
 * @class PDFReaderFeature
 */
export class PDFReaderFeature {
  /** @type {import('../../../common/utils/logger.js').Logger} */
  #logger;

  /** @type {import('../../../common/event/scoped-event-bus.js').ScopedEventBus} */
  #scopedEventBus;

  /** @type {Object} */
  #state;

  /** @type {Array<Function>} */
  #unsubscribers = [];

  /** @type {boolean} */
  #enabled = false;

  // 服务实例
  /** @type {PDFManager} */
  #pdfManager;

  /** @type {FileHandler} */
  #fileHandler;

  /** @type {NavigationHandler} */
  #navigationHandler;

  /** @type {ZoomHandler} */
  #zoomHandler;

  /**
   * 功能名称（唯一标识）
   * @returns {string}
   */
  get name() {
    return PDFReaderFeatureConfig.name;
  }

  /**
   * 版本号
   * @returns {string}
   */
  get version() {
    return PDFReaderFeatureConfig.version;
  }

  /**
   * 依赖的功能或服务
   * @returns {string[]}
   */
  get dependencies() {
    return PDFReaderFeatureConfig.dependencies;
  }

  /**
   * 安装功能
   *
   * @param {Object} context - 功能上下文
   * @param {import('../../../common/micro-service/index.js').DependencyContainer} context.container - 依赖容器
   * @param {import('../../../common/event/event-bus.js').EventBus} context.globalEventBus - 全局事件总线
   * @param {import('../../../common/event/scoped-event-bus.js').ScopedEventBus} context.scopedEventBus - 作用域事件总线
   * @param {import('../../../common/utils/logger.js').Logger} context.logger - 日志记录器
   * @param {Object} context.config - 功能配置
   * @returns {Promise<void>}
   */
  async install(context) {
    this.#logger = context.logger || getLogger(`Feature.${this.name}`);
    this.#scopedEventBus = context.scopedEventBus;

    this.#logger.info(`Installing ${this.name} v${this.version}...`);

    try {
      // 1. 初始化状态
      await this.#initializeState(context);

      // 2. 注册服务
      await this.#registerServices(context);

      // 3. 注册事件监听
      this.#registerEventListeners();

      // 4. 初始化组件
      await this.#initializeComponents(context);

      this.#enabled = true;
      this.#logger.info(`${this.name} installed successfully`);

    } catch (error) {
      this.#logger.error(`Failed to install ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * 卸载功能
   *
   * @param {Object} context - 功能上下文
   * @returns {Promise<void>}
   */
  async uninstall(context) {
    this.#logger.info(`Uninstalling ${this.name}...`);

    try {
      // 1. 取消事件监听
      this.#unregisterEventListeners();

      // 2. 清理组件
      await this.#cleanupComponents();

      // 3. 清理服务
      await this.#cleanupServices(context);

      // 4. 清理状态
      this.#cleanupState(context);

      this.#enabled = false;
      this.#logger.info(`${this.name} uninstalled successfully`);

    } catch (error) {
      this.#logger.error(`Failed to uninstall ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * 启用功能
   *
   * @returns {Promise<void>}
   */
  async enable() {
    if (this.#enabled) {
      this.#logger.warn(`${this.name} is already enabled`);
      return;
    }

    this.#logger.info(`Enabling ${this.name}...`);
    this.#enabled = true;
    this.#logger.info(`${this.name} enabled`);
  }

  /**
   * 禁用功能
   *
   * @returns {Promise<void>}
   */
  async disable() {
    if (!this.#enabled) {
      this.#logger.warn(`${this.name} is already disabled`);
      return;
    }

    this.#logger.info(`Disabling ${this.name}...`);
    this.#enabled = false;
    this.#logger.info(`${this.name} disabled`);
  }

  /**
   * 获取功能是否启用
   *
   * @returns {boolean}
   */
  isEnabled() {
    return this.#enabled;
  }

  // ==================== 私有方法 ====================

  /**
   * 初始化状态
   * @private
   */
  async #initializeState(context) {
    this.#logger.debug('Initializing state...');

    const stateManager = context.container.get('stateManager');
    this.#state = stateManager.createState(
      this.name,
      PDFReaderFeatureConfig.stateSchema
    );

    this.#logger.debug('State initialized');
  }

  /**
   * 注册服务
   * @private
   */
  async #registerServices(context) {
    this.#logger.debug('Registering services...');

    const { container, scopedEventBus } = context;

    // 创建PDFManager（核心服务）- 使用ScopedEventBus实现事件隔离
    this.#pdfManager = new PDFManager(scopedEventBus);
    await this.#pdfManager.initialize();

    // 注册PDFManager到容器
    container.register(
      'pdfManager',
      this.#pdfManager,
      { scope: 'singleton', isInstance: true }
    );

    // 创建服务适配器上下文（兼容旧的Handler API）
    const serviceContext = {
      eventBus: scopedEventBus, // 使用ScopedEventBus，自动添加@pdf-reader/命名空间
      state: this.#state,
      pdfManager: this.#pdfManager,
      // 提供状态访问器
      get currentFile() { return this.state.currentFile; },
      set currentFile(value) { this.state.currentFile = value; },
      get currentPage() { return this.state.currentPage; },
      set currentPage(value) { this.state.currentPage = value; },
      get totalPages() { return this.state.totalPages; },
      set totalPages(value) { this.state.totalPages = value; },
      get zoomLevel() { return this.state.zoomLevel; },
      set zoomLevel(value) { this.state.zoomLevel = value; },
      // 占位符（待UI迁移后实现）
      uiManager: {
        updatePageInfo: () => {},
        showLoading: () => {},
        hideProgress: () => {},
        updateProgress: () => {},
        showError: () => {},
        hideError: () => {},
        cleanup: () => {},
        getContainerWidth: () => 800,
        getContainerHeight: () => 600,
        setScale: () => {},
        pdfViewerManager: null
      },
      errorHandler: {
        handleError: (error, context) => {
          this.#logger.error(`Error in ${context}:`, error);
        }
      },
      renderToViewer: async () => {
        this.#logger.debug('Render to viewer (placeholder)');
      }
    };

    // 创建Handlers - 它们将通过scopedEventBus自动获得@pdf-reader/命名空间
    this.#fileHandler = new FileHandler(serviceContext);
    this.#navigationHandler = new NavigationHandler(serviceContext);
    this.#zoomHandler = new ZoomHandler(serviceContext);

    this.#logger.debug('Services registered successfully');
  }

  /**
   * 注册事件监听
   * @private
   */
  #registerEventListeners() {
    this.#logger.debug('Registering event listeners...');

    // 设置Handler的事件监听
    if (this.#fileHandler) {
      this.#fileHandler.setupEventListeners();
    }

    if (this.#navigationHandler) {
      this.#navigationHandler.setupEventListeners();
    }

    if (this.#zoomHandler) {
      this.#zoomHandler.setupEventListeners();
    }

    // 监听状态变化，同步更新
    this.#setupStateWatchers();

    this.#logger.debug('Event listeners registered successfully');
  }

  /**
   * 设置状态监听器
   * @private
   */
  #setupStateWatchers() {
    // 监听currentPage变化
    // StateManager会提供watch功能，暂时placeholder

    this.#logger.debug('State watchers setup');
  }

  /**
   * 取消事件监听
   * @private
   */
  #unregisterEventListeners() {
    this.#logger.debug('Unregistering event listeners...');

    this.#unsubscribers.forEach(unsubscribe => unsubscribe());
    this.#unsubscribers = [];

    this.#logger.debug('Event listeners unregistered');
  }

  /**
   * 初始化组件
   * @private
   */
  async #initializeComponents(context) {
    this.#logger.debug('Initializing components...');

    // TODO: 在阶段3实施时，初始化实际的组件
    // 例如：PDF加载器、页面渲染器、缓存管理器等

    this.#logger.debug('Components initialized (placeholder)');
  }

  /**
   * 清理组件
   * @private
   */
  async #cleanupComponents() {
    this.#logger.debug('Cleaning up components...');

    // TODO: 清理组件

    this.#logger.debug('Components cleaned up');
  }

  /**
   * 清理服务
   * @private
   */
  async #cleanupServices(context) {
    this.#logger.debug('Cleaning up services...');

    // 清理Handlers
    if (this.#fileHandler) {
      this.#fileHandler.destroy();
      this.#fileHandler = null;
    }

    if (this.#navigationHandler) {
      this.#navigationHandler.destroy();
      this.#navigationHandler = null;
    }

    if (this.#zoomHandler) {
      this.#zoomHandler.destroy();
      this.#zoomHandler = null;
    }

    // 清理PDFManager
    if (this.#pdfManager) {
      this.#pdfManager.destroy();
      this.#pdfManager = null;
    }

    this.#logger.debug('Services cleaned up');
  }

  /**
   * 清理状态
   * @private
   */
  #cleanupState(context) {
    this.#logger.debug('Cleaning up state...');

    if (this.#state) {
      const stateManager = context.container.get('stateManager');
      stateManager.destroyState(this.name);
      this.#state = null;
    }

    this.#logger.debug('State cleaned up');
  }
}
