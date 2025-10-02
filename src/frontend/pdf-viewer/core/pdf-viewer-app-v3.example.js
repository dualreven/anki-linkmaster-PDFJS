/**
 * @file PDF-Viewer应用类 V3 - 功能域架构示例
 * @description 演示如何使用公共微服务组件构建PDF-Viewer应用
 *
 * ⚠️ 注意：这是一个示例文件，展示新架构的使用方式
 * 实际实施将在阶段2-7完成
 */

import {
  DependencyContainer,
  FeatureRegistry,
  StateManager,
  FeatureFlagManager
} from '../../common/micro-service/index.js';

/**
 * PDF-Viewer应用类 V3
 * 基于功能域架构
 */
export class PDFViewerAppV3 {
  /** @type {DependencyContainer} */
  #container;

  /** @type {FeatureRegistry} */
  #registry;

  /** @type {StateManager} */
  #stateManager;

  /** @type {FeatureFlagManager} */
  #flagManager;

  /** @type {boolean} */
  #initialized = false;

  /**
   * 创建PDF-Viewer应用实例
   *
   * @param {Object} options - 配置选项
   * @param {string} [options.environment='development'] - 环境名称
   * @param {string} [options.configPath='./config/feature-flags.json'] - 配置文件路径
   */
  constructor(options = {}) {
    const {
      environment = 'development',
      configPath = './config/feature-flags.json'
    } = options;

    // 1. 创建依赖注入容器
    this.#container = new DependencyContainer('pdf-viewer');

    // 2. 创建状态管理器
    this.#stateManager = new StateManager();

    // 3. 创建Feature Flag管理器
    this.#flagManager = new FeatureFlagManager({ environment });

    // 4. 创建功能注册中心
    this.#registry = new FeatureRegistry({
      container: this.#container
    });

    // 保存配置路径
    this.configPath = configPath;

    console.log('[PDFViewerAppV3] Application created');
  }

  /**
   * 初始化应用
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.#initialized) {
      console.warn('[PDFViewerAppV3] Already initialized');
      return;
    }

    console.log('[PDFViewerAppV3] Initializing...');

    try {
      // 1. 加载Feature Flags配置
      await this.#loadFeatureFlags();

      // 2. 注册全局服务
      this.#registerGlobalServices();

      // 3. 注册功能域
      this.#registerFeatures();

      // 4. 按需安装功能
      await this.#installEnabledFeatures();

      // 5. 设置全局对象（向后兼容）
      window.pdfViewerApp = this;

      this.#initialized = true;
      console.log('[PDFViewerAppV3] Initialized successfully');

    } catch (error) {
      console.error('[PDFViewerAppV3] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * 加载Feature Flags配置
   * @private
   */
  async #loadFeatureFlags() {
    console.log('[PDFViewerAppV3] Loading feature flags...');
    await this.#flagManager.loadFromConfig(this.configPath);
    console.log('[PDFViewerAppV3] Feature flags loaded');
  }

  /**
   * 注册全局服务
   * @private
   */
  #registerGlobalServices() {
    console.log('[PDFViewerAppV3] Registering global services...');

    // 注册状态管理器
    this.#container.register('stateManager', this.#stateManager, {
      scope: 'singleton'
    });

    // 注册Feature Flag管理器
    this.#container.register('flagManager', this.#flagManager, {
      scope: 'singleton'
    });

    // 注册功能注册中心
    this.#container.register('registry', this.#registry, {
      scope: 'singleton'
    });

    // TODO: 注册EventBus（从common/event导入）
    // this.#container.register('eventBus', globalEventBus, { scope: 'singleton' });

    // TODO: 注册WSClient（从websocket-adapter获取）
    // this.#container.register('wsClient', wsClient, { scope: 'singleton' });

    // TODO: 注册Logger（从common/utils导入）
    // this.#container.register('logger', LoggerService, { scope: 'singleton' });

    console.log('[PDFViewerAppV3] Global services registered');
  }

  /**
   * 注册功能域
   * @private
   */
  #registerFeatures() {
    console.log('[PDFViewerAppV3] Registering features...');

    // TODO: 实施阶段2-7时，导入并注册实际的功能域

    // Phase 1 功能域（待实施）:
    // import { PDFReaderFeature } from '../features/pdf-reader/index.js';
    // import { PDFUIFeature } from '../features/pdf-ui/index.js';
    // import { PDFBookmarkFeature } from '../features/pdf-bookmark/index.js';
    // import { WebSocketAdapterFeature } from '../features/websocket-adapter/index.js';

    // this.#registry.register(new PDFReaderFeature());
    // this.#registry.register(new PDFUIFeature());
    // this.#registry.register(new PDFBookmarkFeature());
    // this.#registry.register(new WebSocketAdapterFeature());

    console.log('[PDFViewerAppV3] Features registered (placeholder)');
  }

  /**
   * 按需安装功能
   * @private
   */
  async #installEnabledFeatures() {
    console.log('[PDFViewerAppV3] Installing enabled features...');

    // TODO: 根据Feature Flags安装功能

    // 示例逻辑：
    // const features = ['pdf-reader', 'pdf-ui', 'pdf-bookmark', 'websocket-adapter'];
    //
    // for (const featureName of features) {
    //   if (this.#flagManager.isEnabled(featureName)) {
    //     await this.#registry.install(featureName);
    //   }
    // }

    console.log('[PDFViewerAppV3] Features installed (placeholder)');
  }

  /**
   * 销毁应用
   */
  async destroy() {
    if (!this.#initialized) {
      return;
    }

    console.log('[PDFViewerAppV3] Destroying...');

    try {
      // 卸载所有功能
      await this.#registry.uninstallAll();

      // 清理容器
      this.#container.dispose();

      this.#initialized = false;
      console.log('[PDFViewerAppV3] Destroyed successfully');

    } catch (error) {
      console.error('[PDFViewerAppV3] Destroy failed:', error);
      throw error;
    }
  }

  /**
   * 获取是否已初始化
   * @returns {boolean}
   */
  isInitialized() {
    return this.#initialized;
  }

  /**
   * 获取依赖容器
   * @returns {DependencyContainer}
   */
  getContainer() {
    return this.#container;
  }

  /**
   * 获取功能注册中心
   * @returns {FeatureRegistry}
   */
  getRegistry() {
    return this.#registry;
  }

  /**
   * 获取状态管理器
   * @returns {StateManager}
   */
  getStateManager() {
    return this.#stateManager;
  }

  /**
   * 获取Feature Flag管理器
   * @returns {FeatureFlagManager}
   */
  getFlagManager() {
    return this.#flagManager;
  }
}

/**
 * 使用示例：
 *
 * // 1. 创建应用实例
 * const app = new PDFViewerAppV3({
 *   environment: 'development',
 *   configPath: './config/feature-flags.json'
 * });
 *
 * // 2. 初始化应用
 * await app.initialize();
 *
 * // 3. 获取服务
 * const stateManager = app.getStateManager();
 * const flagManager = app.getFlagManager();
 *
 * // 4. 使用功能
 * if (flagManager.isEnabled('pdf-bookmark')) {
 *   // 书签功能已启用
 * }
 *
 * // 5. 销毁应用
 * await app.destroy();
 */
