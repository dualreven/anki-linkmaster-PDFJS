/**
 * @file PDF Home应用核心类 V2（功能域架构版本）
 * @module PDFHomeAppV2
 * @description
 * 基于功能域架构重构的新版应用类，使用：
 * - DependencyContainer: 依赖注入
 * - FeatureRegistry: 功能域管理
 * - StateManager: 统一状态管理
 * - FeatureFlagManager: Feature Flag 控制
 * - ScopedEventBus: 命名空间事件隔离
 */

import { DependencyContainer } from './dependency-container.js';
import { FeatureRegistry } from './feature-registry.js';
import { StateManager } from './state-manager.js';
import { FeatureFlagManager } from './feature-flag-manager.js';
import { getLogger } from '../../common/utils/logger.js';
import eventBus from '../../common/event/event-bus.js';
import WSClient from '../../common/ws/ws-client.js';

// 导入功能域
import { PDFListFeature } from '../features/pdf-list/index.js';
import { PDFEditorFeature } from '../features/pdf-editor/index.js';
import { PDFSorterFeature } from '../features/pdf-sorter/index.js';

/**
 * @class PDFHomeAppV2
 * @description 新版应用核心类，使用功能域架构
 */
export class PDFHomeAppV2 {
  /**
   * 依赖注入容器
   * @type {DependencyContainer}
   * @private
   */
  #container = null;

  /**
   * 功能注册中心
   * @type {FeatureRegistry}
   * @private
   */
  #registry = null;

  /**
   * 状态管理器
   * @type {StateManager}
   * @private
   */
  #stateManager = null;

  /**
   * Feature Flag 管理器
   * @type {FeatureFlagManager}
   * @private
   */
  #flagManager = null;

  /**
   * WebSocket 客户端
   * @type {WSClient}
   * @private
   */
  #wsClient = null;

  /**
   * 全局事件总线
   * @type {EventBus}
   * @private
   */
  #eventBus = null;

  /**
   * 日志记录器
   * @type {Logger}
   * @private
   */
  #logger = null;

  /**
   * 应用状态
   * @type {string}
   * @private
   */
  #status = 'uninitialized'; // uninitialized | initializing | ready | error

  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {string} [options.wsUrl] - WebSocket URL
   * @param {string} [options.environment='production'] - 运行环境
   * @param {Object} [options.featureFlagConfig] - Feature Flag 配置对象
   * @param {string} [options.featureFlagConfigPath] - Feature Flag 配置文件路径
   */
  constructor(options = {}) {
    this.#logger = getLogger('PDFHomeAppV2');
    this.#logger.info('Initializing PDF Home App V2 (Feature Domain Architecture)...');

    // 1. 创建核心组件
    this.#initializeCoreComponents(options);

    // 2. 注册全局服务到容器
    this.#registerGlobalServices(options);

    this.#logger.info('PDF Home App V2 constructed (not yet initialized)');
  }

  /**
   * 初始化核心组件
   * @param {Object} options - 配置选项
   * @private
   */
  #initializeCoreComponents(options) {
    // 创建依赖容器
    this.#container = new DependencyContainer('pdf-home-v2');

    // 创建状态管理器
    this.#stateManager = new StateManager();

    // 创建 Feature Flag 管理器
    this.#flagManager = new FeatureFlagManager({
      environment: options.environment || 'production',
      defaultEnabled: true
    });

    // 创建功能注册中心
    this.#registry = new FeatureRegistry({
      container: this.#container,
      globalEventBus: eventBus
    });

    // 使用全局事件总线（保持向后兼容）
    this.#eventBus = eventBus;

    this.#logger.debug('Core components created');
  }

  /**
   * 注册全局服务到容器
   * @param {Object} options - 配置选项
   * @private
   */
  #registerGlobalServices(options) {
    // 注册状态管理器（单例）
    this.#container.register('stateManager', this.#stateManager, {
      scope: 'singleton'
    });

    // 注册全局事件总线（单例）
    this.#container.register('eventBus', this.#eventBus, {
      scope: 'singleton'
    });

    // 注册 Feature Flag 管理器（单例）
    this.#container.register('featureFlagManager', this.#flagManager, {
      scope: 'singleton'
    });

    // 创建并注册 WebSocket 客户端（如果提供了 URL）
    if (options.wsUrl) {
      this.#wsClient = new WSClient(options.wsUrl, this.#eventBus);
      this.#container.register('wsClient', this.#wsClient, {
        scope: 'singleton'
      });
    }

    this.#logger.debug('Global services registered to container');
  }

  /**
   * 初始化应用
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.#status === 'ready') {
      this.#logger.warn('App already initialized');
      return;
    }

    if (this.#status === 'initializing') {
      this.#logger.warn('App is already initializing');
      return;
    }

    this.#status = 'initializing';
    this.#logger.info('Starting app initialization...');

    try {
      // 1. 加载 Feature Flag 配置
      await this.#loadFeatureFlags();

      // 2. 注册功能域
      this.#registerFeatures();

      // 3. 安装启用的功能域
      await this.#installEnabledFeatures();

      // 4. 连接 WebSocket（如果有）
      if (this.#wsClient) {
        try {
          await this.#wsClient.connect();
          this.#logger.info('WebSocket connected successfully');
        } catch (error) {
          // WebSocket 连接失败不应阻止应用启动
          this.#logger.warn('WebSocket connection failed (app will continue without real-time features):', error.message);
        }
      }

      this.#status = 'ready';
      this.#logger.info('App initialization completed successfully');

      // 触发初始化完成事件
      // 事件名称格式：{module}:{action}:{status}
      this.#eventBus.emit('app:initialize:completed', {
        version: 'v2',
        features: this.#registry.getInstalledFeatures()
      });

    } catch (error) {
      this.#status = 'error';
      this.#logger.error('App initialization failed:', error);
      throw error;
    }
  }

  /**
   * 加载 Feature Flag 配置
   * @returns {Promise<void>}
   * @private
   */
  async #loadFeatureFlags() {
    this.#logger.debug('Loading Feature Flags...');

    try {
      // 尝试从配置文件加载
      try {
        await this.#flagManager.loadFromConfig('./config/feature-flags.json');
        this.#logger.info('Feature Flags loaded from config file');
      } catch (error) {
        this.#logger.warn('Failed to load feature-flags.json, using defaults:', error.message);

        // 使用默认配置
        this.#flagManager.loadFromObject({
          'pdf-list': { enabled: true, description: 'PDF 列表功能' },
          'pdf-editor': { enabled: false, description: 'PDF 编辑功能（开发中）' },
          'pdf-sorter': { enabled: false, description: 'PDF 排序功能（开发中）' }
        });
      }

      // 记录当前 Feature Flag 状态
      const stats = this.#flagManager.getStats();
      this.#logger.info(`Feature Flags: ${stats.enabled}/${stats.total} enabled`);

    } catch (error) {
      this.#logger.error('Failed to load Feature Flags:', error);
      throw error;
    }
  }

  /**
   * 注册功能域
   * @private
   */
  #registerFeatures() {
    this.#logger.debug('Registering features...');

    // 注册所有功能域（注册不等于安装）
    const features = [
      new PDFListFeature(),
      new PDFEditorFeature(),
      new PDFSorterFeature()
    ];

    for (const feature of features) {
      try {
        this.#registry.register(feature);
        this.#logger.debug(`Feature registered: ${feature.name} v${feature.version}`);
      } catch (error) {
        this.#logger.error(`Failed to register feature ${feature.name}:`, error);
      }
    }

    this.#logger.info(`${features.length} features registered`);
  }

  /**
   * 安装启用的功能域
   * @returns {Promise<void>}
   * @private
   */
  async #installEnabledFeatures() {
    this.#logger.debug('Installing enabled features...');

    const registeredFeatures = this.#registry.getRegisteredFeatures();

    for (const featureName of registeredFeatures) {
      if (this.#flagManager.isEnabled(featureName)) {
        try {
          await this.#registry.install(featureName);
          this.#logger.info(`Feature installed: ${featureName}`);
        } catch (error) {
          this.#logger.error(`Failed to install feature ${featureName}:`, error);
          // 继续安装其他功能
        }
      } else {
        this.#logger.debug(`Feature ${featureName} is disabled, skipping installation`);
      }
    }

    const installedCount = this.#registry.getInstalledFeatures().length;
    this.#logger.info(`${installedCount}/${registeredFeatures.length} features installed`);
  }

  /**
   * 销毁应用
   * @returns {Promise<void>}
   */
  async destroy() {
    this.#logger.info('Destroying app...');

    try {
      // 1. 卸载所有功能域
      const installedFeatures = this.#registry.getInstalledFeatures();
      for (const featureName of installedFeatures.reverse()) {
        try {
          await this.#registry.uninstall(featureName);
        } catch (error) {
          this.#logger.error(`Failed to uninstall ${featureName}:`, error);
        }
      }

      // 2. 断开 WebSocket
      if (this.#wsClient) {
        this.#wsClient.disconnect();
      }

      // 3. 清理状态
      this.#stateManager.clear();

      this.#status = 'uninitialized';
      this.#logger.info('App destroyed successfully');

    } catch (error) {
      this.#logger.error('Failed to destroy app:', error);
      throw error;
    }
  }

  /**
   * 获取应用状态
   * @returns {Object} 应用状态信息
   */
  getState() {
    return {
      version: 'v2',
      status: this.#status,
      architecture: 'feature-domain',
      features: {
        registered: this.#registry.getRegisteredFeatures(),
        installed: this.#registry.getInstalledFeatures(),
        flags: this.#flagManager.getAllFlags()
      },
      container: {
        name: this.#container.getName(),
        services: this.#container.has('wsClient') ? ['wsClient', 'eventBus', 'stateManager'] : ['eventBus', 'stateManager']
      }
    };
  }

  /**
   * 动态启用功能
   * @param {string} featureName - 功能名称
   * @returns {Promise<void>}
   */
  async enableFeature(featureName) {
    this.#logger.info(`Enabling feature: ${featureName}`);

    // 1. 更新 Feature Flag
    this.#flagManager.enable(featureName);

    // 2. 如果功能已注册但未安装，安装它
    if (this.#registry.has(featureName) && !this.#registry.getInstalledFeatures().includes(featureName)) {
      await this.#registry.install(featureName);
      this.#logger.info(`Feature ${featureName} installed successfully`);
    }
  }

  /**
   * 动态禁用功能
   * @param {string} featureName - 功能名称
   * @returns {Promise<void>}
   */
  async disableFeature(featureName) {
    this.#logger.info(`Disabling feature: ${featureName}`);

    // 1. 更新 Feature Flag
    this.#flagManager.disable(featureName);

    // 2. 如果功能已安装，卸载它
    if (this.#registry.getInstalledFeatures().includes(featureName)) {
      await this.#registry.uninstall(featureName);
      this.#logger.info(`Feature ${featureName} uninstalled successfully`);
    }
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
   * 获取 Feature Flag 管理器
   * @returns {FeatureFlagManager}
   */
  getFeatureFlagManager() {
    return this.#flagManager;
  }

  /**
   * 获取依赖容器
   * @returns {DependencyContainer}
   */
  getContainer() {
    return this.#container;
  }

  /**
   * 获取 WebSocket 客户端
   * @returns {WSClient|null}
   */
  getWSClient() {
    return this.#wsClient;
  }

  /**
   * 获取事件总线
   * @returns {EventBus}
   */
  getEventBus() {
    return this.#eventBus;
  }
}

/**
 * 创建 PDFHomeAppV2 实例的工厂函数
 * @param {Object} options - 配置选项
 * @returns {PDFHomeAppV2}
 */
export function createPDFHomeAppV2(options = {}) {
  return new PDFHomeAppV2(options);
}

export default PDFHomeAppV2;
