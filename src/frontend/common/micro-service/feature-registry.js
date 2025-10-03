/**
 * @file 功能注册中心 - Feature Registry
 * @module FeatureRegistry
 * @description
 * 功能注册中心，负责管理功能域的注册、安装、卸载、启用、禁用。
 *
 * 核心功能：
 * 1. 功能注册：注册功能域到注册中心
 * 2. 依赖解析：自动解析功能依赖关系，计算安装顺序（拓扑排序）
 * 3. 生命周期管理：install、uninstall、enable、disable
 * 4. 状态追踪：记录功能的安装状态、启用状态
 * 5. 错误处理：功能安装失败不影响其他功能
 *
 * @example
 * // 创建功能注册中心
 * const registry = new FeatureRegistry({ container, logger });
 *
 * // 注册功能
 * registry.register(new PDFListFeature());
 * registry.register(new PDFEditorFeature());
 *
 * // 安装所有功能（自动解析依赖顺序）
 * await registry.installAll();
 *
 * // 卸载某个功能
 * await registry.uninstall('pdf-editor');
 */

import { getLogger } from '../utils/logger.js';

// ==================== 类型定义 ====================

/**
 * 功能状态枚举
 * @enum {string}
 */
export const FeatureStatus = {
  /** 已注册，未安装 */
  REGISTERED: 'registered',
  /** 正在安装 */
  INSTALLING: 'installing',
  /** 已安装，已启用 */
  INSTALLED: 'installed',
  /** 已安装，已禁用 */
  DISABLED: 'disabled',
  /** 安装失败 */
  FAILED: 'failed',
  /** 已卸载 */
  UNINSTALLED: 'uninstalled'
};

/**
 * 功能上下文接口
 * @typedef {Object} FeatureContext
 * @property {import('./dependency-container.js').DependencyContainer} container - 依赖注入容器
 * @property {import('../../common/event/event-bus.js').EventBus} globalEventBus - 全局事件总线
 * @property {import('../../common/event/scoped-event-bus.js').ScopedEventBus} scopedEventBus - 作用域事件总线（功能域专用）
 * @property {import('../../common/utils/logger.js').Logger} logger - 日志记录器（功能域专用）
 * @property {Object} config - 功能配置（可选）
 */

/**
 * 功能接口
 * @interface IFeature
 * @description
 * 所有功能域必须实现此接口
 *
 * @example
 * class PDFListFeature {
 *   get name() { return 'pdf-list'; }
 *   get version() { return '1.0.0'; }
 *   get dependencies() { return ['core', 'websocket']; }
 *
 *   async install(context) {
 *     const { scopedEventBus, logger } = context;
 *     logger.info('PDFListFeature installed');
 *     // 注册事件监听、初始化状态等
 *   }
 *
 *   async uninstall(context) {
 *     const { scopedEventBus, logger } = context;
 *     logger.info('PDFListFeature uninstalled');
 *     // 清理事件监听、清理状态等
 *   }
 * }
 */

/**
 * @typedef {Object} IFeature
 * @property {string} name - 功能名称（唯一标识）
 * @property {string} version - 版本号（遵循 SemVer 规范）
 * @property {string[]} dependencies - 依赖的功能或服务名称列表
 * @property {(context: FeatureContext) => Promise<void>} install - 安装功能（初始化逻辑）
 * @property {(context: FeatureContext) => Promise<void>} uninstall - 卸载功能（清理逻辑）
 * @property {() => Promise<void>} [enable] - 启用功能（可选）
 * @property {() => Promise<void>} [disable] - 禁用功能（可选）
 */

// ==================== 功能记录 ====================

/**
 * 功能记录类（内部使用）
 * @class FeatureRecord
 * @private
 */
class FeatureRecord {
  /** @type {IFeature} */
  #feature = null;

  /** @type {FeatureStatus} */
  #status = FeatureStatus.REGISTERED;

  /** @type {FeatureContext|null} */
  #context = null;

  /** @type {Error|null} */
  #error = null;

  /** @type {number} */
  #installedAt = 0;

  /**
   * @param {IFeature} feature - 功能实例
   */
  constructor(feature) {
    this.#feature = feature;
  }

  /** 获取功能实例 @returns {IFeature} */
  get feature() { return this.#feature; }
  /** 获取功能状态 @returns {FeatureStatus} */
  get status() { return this.#status; }
  /** 获取功能上下文 @returns {FeatureContext|null} */
  get context() { return this.#context; }
  /** 获取错误信息 @returns {Error|null} */
  get error() { return this.#error; }
  /** 获取安装时间戳 @returns {number} */
  get installedAt() { return this.#installedAt; }

  /** 设置功能状态 @param {FeatureStatus} status */
  setStatus(status) { this.#status = status; }
  /** 设置功能上下文 @param {FeatureContext} context */
  setContext(context) { this.#context = context; }
  /** 设置错误信息 @param {Error} error */
  setError(error) { this.#error = error; }
  /** 标记功能为已安装状态，同时记录安装时间戳 */
  markInstalled() {
    this.#installedAt = Date.now();
    this.#status = FeatureStatus.INSTALLED;
  }

  /**
   * 获取功能信息摘要
   * @returns {Object}
   */
  toJSON() {
    return {
      name: this.#feature.name,
      version: this.#feature.version,
      status: this.#status,
      dependencies: this.#feature.dependencies,
      installedAt: this.#installedAt,
      error: this.#error?.message || null
    };
  }
}

// ==================== 功能注册中心 ====================

/**
 * 功能注册中心类
 * @class FeatureRegistry
 */
export class FeatureRegistry {
  /** @type {Map<string, FeatureRecord>} */
  #features = new Map();

  /** @type {import('./dependency-container.js').DependencyContainer} */
  #container = null;

  /** @type {import('../../common/utils/logger.js').Logger} */
  #logger = null;

  /** @type {import('../../common/event/event-bus.js').EventBus} */
  #globalEventBus = null;

  /**
   * 创建功能注册中心
   * @param {Object} options - 配置选项
   * @param {import('./dependency-container.js').DependencyContainer} options.container - 依赖注入容器
   * @param {import('../../common/utils/logger.js').Logger} [options.logger] - 日志记录器（可选）
   * @param {import('../../common/event/event-bus.js').EventBus} [options.globalEventBus] - 全局事件总线（可选）
   */
  constructor({ container, logger, globalEventBus } = {}) {
    if (!container) {
      throw new Error('FeatureRegistry requires a DependencyContainer instance');
    }

    this.#container = container;
    this.#logger = logger || getLogger('FeatureRegistry');
    this.#globalEventBus = globalEventBus || null;

    this.#logger.debug('FeatureRegistry created');
  }

  /**
   * 注册功能
   * @param {IFeature} feature - 功能实例
   * @throws {Error} 如果功能名称已存在或功能无效
   *
   * @example
   * registry.register(new PDFListFeature());
   */
  register(feature) {
    // 验证功能接口
    this.#validateFeature(feature);

    const { name } = feature;

    // 检查是否已注册
    if (this.#features.has(name)) {
      throw new Error(`Feature "${name}" is already registered`);
    }

    // 创建功能记录
    const record = new FeatureRecord(feature);
    this.#features.set(name, record);

    this.#logger.info(`Feature registered: ${name} (v${feature.version})`);
  }

  /**
   * 检查功能是否已注册
   * @param {string} name - 功能名称
   * @returns {boolean}
   */
  has(name) {
    return this.#features.has(name);
  }

  /**
   * 获取功能记录
   * @param {string} name - 功能名称
   * @returns {FeatureRecord|null}
   */
  get(name) {
    return this.#features.get(name) || null;
  }

  /**
   * 获取所有已注册的功能名称
   * @returns {string[]}
   */
  getRegisteredFeatures() {
    return Array.from(this.#features.keys());
  }

  /**
   * 获取所有已安装的功能名称
   * @returns {string[]}
   */
  getInstalledFeatures() {
    return Array.from(this.#features.values())
      .filter(record => record.status === FeatureStatus.INSTALLED)
      .map(record => record.feature.name);
  }

  /**
   * 安装单个功能
   * @param {string} name - 功能名称
   * @returns {Promise<void>}
   * @throws {Error} 如果功能不存在或依赖未满足
   *
   * @example
   * await registry.install('pdf-list');
   */
  async install(name) {
    const record = this.#features.get(name);

    if (!record) {
      throw new Error(`Feature "${name}" is not registered`);
    }

    // 如果已安装，跳过
    if (record.status === FeatureStatus.INSTALLED) {
      this.#logger.debug(`Feature "${name}" is already installed, skipping`);
      return;
    }

    // 检查依赖
    const { feature } = record;
    const missingDeps = this.#checkDependencies(feature);

    if (missingDeps.length > 0) {
      throw new Error(
        `Feature "${name}" has missing dependencies: ${missingDeps.join(', ')}`
      );
    }

    // 标记为正在安装
    record.setStatus(FeatureStatus.INSTALLING);

    try {
      // 创建功能上下文
      const context = await this.#createFeatureContext(name);
      record.setContext(context);

      // 调用安装方法
      this.#logger.info(`Installing feature: ${name}...`);
      await feature.install(context);

      // 标记为已安装
      record.markInstalled();
      this.#logger.info(`Feature installed successfully: ${name}`);

    } catch (error) {
      // 安装失败
      record.setStatus(FeatureStatus.FAILED);
      record.setError(error);
      this.#logger.error(`Feature installation failed: ${name}`, error);
      throw error;
    }
  }

  /**
   * 安装所有已注册的功能（按依赖顺序）
   * @returns {Promise<void>}
   *
   * @example
   * await registry.installAll();
   */
  async installAll() {
    // 计算安装顺序（拓扑排序）
    const installOrder = this.#resolveInstallOrder();

    this.#logger.info(`Installing ${installOrder.length} features in order: ${installOrder.join(' -> ')}`);

    // 按顺序安装
    for (const name of installOrder) {
      try {
        await this.install(name);
      } catch (error) {
        // 某个功能安装失败，记录错误但继续安装其他功能
        this.#logger.error(`Failed to install feature "${name}":`, error.message || error);
        this.#logger.warn(`Failed to install feature "${name}", continuing with others...`);
      }
    }

    const installedCount = this.getInstalledFeatures().length;
    this.#logger.info(`Installed ${installedCount}/${installOrder.length} features`);
  }

  /**
   * 卸载单个功能
   * @param {string} name - 功能名称
   * @returns {Promise<void>}
   *
   * @example
   * await registry.uninstall('pdf-editor');
   */
  async uninstall(name) {
    const record = this.#features.get(name);

    if (!record) {
      throw new Error(`Feature "${name}" is not registered`);
    }

    // 如果未安装，跳过
    if (record.status !== FeatureStatus.INSTALLED && record.status !== FeatureStatus.DISABLED) {
      this.#logger.debug(`Feature "${name}" is not installed, skipping uninstall`);
      return;
    }

    try {
      const { feature, context } = record;

      this.#logger.info(`Uninstalling feature: ${name}...`);
      await feature.uninstall(context);

      // 清理功能上下文（销毁 ScopedEventBus 等）
      this.#cleanupFeatureContext(context);

      record.setStatus(FeatureStatus.UNINSTALLED);
      record.setContext(null);

      this.#logger.info(`Feature uninstalled: ${name}`);

    } catch (error) {
      this.#logger.error(`Feature uninstall failed: ${name}`, error);
      throw error;
    }
  }

  /**
   * 启用功能
   * @param {string} name - 功能名称
   * @returns {Promise<void>}
   */
  async enable(name) {
    const record = this.#features.get(name);

    if (!record) {
      throw new Error(`Feature "${name}" is not registered`);
    }

    if (record.status !== FeatureStatus.DISABLED) {
      this.#logger.debug(`Feature "${name}" is not disabled, skipping enable`);
      return;
    }

    const { feature } = record;

    if (typeof feature.enable === 'function') {
      this.#logger.info(`Enabling feature: ${name}...`);
      await feature.enable();
      record.setStatus(FeatureStatus.INSTALLED);
      this.#logger.info(`Feature enabled: ${name}`);
    } else {
      this.#logger.warn(`Feature "${name}" does not support enable()`);
    }
  }

  /**
   * 禁用功能
   * @param {string} name - 功能名称
   * @returns {Promise<void>}
   */
  async disable(name) {
    const record = this.#features.get(name);

    if (!record) {
      throw new Error(`Feature "${name}" is not registered`);
    }

    if (record.status !== FeatureStatus.INSTALLED) {
      this.#logger.debug(`Feature "${name}" is not installed, skipping disable`);
      return;
    }

    const { feature } = record;

    if (typeof feature.disable === 'function') {
      this.#logger.info(`Disabling feature: ${name}...`);
      await feature.disable();
      record.setStatus(FeatureStatus.DISABLED);
      this.#logger.info(`Feature disabled: ${name}`);
    } else {
      this.#logger.warn(`Feature "${name}" does not support disable()`);
    }
  }

  /**
   * 获取功能状态摘要
   * @returns {Object} 状态摘要
   */
  getStatusSummary() {
    const summary = {
      total: this.#features.size,
      installed: 0,
      disabled: 0,
      failed: 0,
      features: []
    };

    this.#features.forEach(record => {
      const info = record.toJSON();
      summary.features.push(info);

      if (record.status === FeatureStatus.INSTALLED) summary.installed++;
      if (record.status === FeatureStatus.DISABLED) summary.disabled++;
      if (record.status === FeatureStatus.FAILED) summary.failed++;
    });

    return summary;
  }

  // ==================== 私有方法 ====================

  /**
   * 验证功能接口
   * @param {IFeature} feature - 功能实例
   * @throws {Error} 如果功能接口不完整
   * @private
   */
  #validateFeature(feature) {
    if (!feature || typeof feature !== 'object') {
      throw new Error('Feature must be an object');
    }

    // 验证必需属性
    const requiredProps = ['name', 'version', 'dependencies', 'install', 'uninstall'];

    for (const prop of requiredProps) {
      if (!(prop in feature)) {
        throw new Error(`Feature is missing required property: ${prop}`);
      }
    }

    // 验证类型
    if (typeof feature.name !== 'string' || feature.name.trim() === '') {
      throw new Error('Feature.name must be a non-empty string');
    }

    if (typeof feature.version !== 'string' || feature.version.trim() === '') {
      throw new Error('Feature.version must be a non-empty string');
    }

    if (!Array.isArray(feature.dependencies)) {
      throw new Error('Feature.dependencies must be an array');
    }

    if (typeof feature.install !== 'function') {
      throw new Error('Feature.install must be a function');
    }

    if (typeof feature.uninstall !== 'function') {
      throw new Error('Feature.uninstall must be a function');
    }

    // 可选方法验证
    if ('enable' in feature && typeof feature.enable !== 'function') {
      throw new Error('Feature.enable must be a function');
    }

    if ('disable' in feature && typeof feature.disable !== 'function') {
      throw new Error('Feature.disable must be a function');
    }
  }

  /**
   * 检查功能的依赖是否满足
   * @param {IFeature} feature - 功能实例
   * @returns {string[]} 缺失的依赖列表
   * @private
   */
  #checkDependencies(feature) {
    const missing = [];

    for (const dep of feature.dependencies) {
      // 检查依赖是否已注册并已安装
      const depRecord = this.#features.get(dep);

      if (!depRecord) {
        // 依赖未注册，可能是核心服务（在容器中）
        if (!this.#container.has(dep)) {
          missing.push(dep);
        }
      } else if (depRecord.status !== FeatureStatus.INSTALLED) {
        // 依赖已注册但未安装
        missing.push(dep);
      }
    }

    return missing;
  }

  /**
   * 解析安装顺序（拓扑排序）
   * @returns {string[]} 按依赖顺序排列的功能名称列表
   * @throws {Error} 如果存在循环依赖
   * @private
   */
  #resolveInstallOrder() {
    const visited = new Set();
    const visiting = new Set();
    const order = [];

    /**
     * 深度优先搜索
     * @param {string} name - 功能名称
     */
    const dfs = (name) => {
      if (visited.has(name)) return;

      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected: ${name}`);
      }

      visiting.add(name);

      const record = this.#features.get(name);
      if (record) {
        const { feature } = record;

        // 先处理依赖
        for (const dep of feature.dependencies) {
          if (this.#features.has(dep)) {
            dfs(dep);
          }
          // 如果依赖不是功能（而是核心服务），跳过
        }
      }

      visiting.delete(name);
      visited.add(name);
      order.push(name);
    };

    // 对所有功能执行 DFS
    for (const name of this.#features.keys()) {
      dfs(name);
    }

    return order;
  }

  /**
   * 创建功能上下文
   * @param {string} featureName - 功能名称
   * @returns {FeatureContext}
   * @private
   */
  async #createFeatureContext(featureName) {
    // 创建功能域专用的作用域容器
    const featureScope = this.#container.createScope(featureName);

    // 创建功能域专用的 Logger
    const featureLogger = getLogger(`Feature.${featureName}`);

    // 创建功能域专用的 ScopedEventBus
    let scopedEventBus = null;
    if (this.#globalEventBus) {
      // 动态导入 ScopedEventBus（避免循环依赖）
      const { ScopedEventBus } = await import('../../common/event/scoped-event-bus.js');
      scopedEventBus = new ScopedEventBus(this.#globalEventBus, featureName);
    }

    return {
      container: featureScope,
      globalEventBus: this.#globalEventBus,
      scopedEventBus,
      logger: featureLogger,
      config: {}
    };
  }

  /**
   * 清理功能上下文
   * @param {FeatureContext} context - 功能上下文
   * @private
   */
  #cleanupFeatureContext(context) {
    if (!context) return;

    // 销毁 ScopedEventBus
    if (context.scopedEventBus && typeof context.scopedEventBus.destroy === 'function') {
      context.scopedEventBus.destroy();
    }

    // 销毁作用域容器
    if (context.container && typeof context.container.dispose === 'function') {
      context.container.dispose();
    }
  }
}

/**
 * 创建功能注册中心的工厂函数
 * @param {Object} options - 配置选项
 * @returns {FeatureRegistry}
 */
export function createFeatureRegistry(options) {
  return new FeatureRegistry(options);
}

export default FeatureRegistry;
