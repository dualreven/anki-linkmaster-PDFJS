/**
 * @file 特性标志管理器
 * @module core/feature-flag-manager
 * @description
 * FeatureFlagManager 提供特性标志（Feature Flag）管理功能，用于运行时控制功能的启用/禁用。
 *
 * 核心特性：
 * - 配置文件加载：支持从 JSON 配置文件加载特性标志
 * - 条件启用：支持基于环境、用户、百分比等条件的动态启用
 * - 运行时控制：支持运行时动态修改特性标志状态
 * - 默认值回退：未配置的特性标志使用默认值
 * - 类型安全：提供类型检查和验证
 *
 * @example
 * // 基本用法
 * const flagManager = new FeatureFlagManager();
 * await flagManager.loadFromConfig('./feature-flags.json');
 *
 * if (flagManager.isEnabled('pdf-sorter')) {
 *   // 启用排序功能
 * }
 *
 * @example
 * // 条件启用
 * flagManager.setFlag('experimental-feature', {
 *   enabled: true,
 *   conditions: {
 *     environment: 'development',
 *     users: ['admin@example.com']
 *   }
 * });
 *
 * @example
 * // 集成 FeatureRegistry
 * const registry = new FeatureRegistry({ container });
 * const flagManager = new FeatureFlagManager();
 *
 * // 只注册启用的功能
 * if (flagManager.isEnabled('pdf-list')) {
 *   registry.register(new PDFListFeature());
 * }
 */

import { getLogger } from '../utils/logger.js';

/**
 * 特性标志配置接口
 * @typedef {Object} FeatureFlagConfig
 * @property {boolean} enabled - 是否启用
 * @property {string} [description] - 特性描述
 * @property {Object} [conditions] - 启用条件
 * @property {string} [conditions.environment] - 环境条件 (development|production|test)
 * @property {string[]} [conditions.users] - 用户白名单
 * @property {number} [conditions.percentage] - 启用百分比 (0-100)
 * @property {string[]} [conditions.roles] - 角色白名单
 * @property {Object} [metadata] - 附加元数据
 */

/**
 * 特性标志管理器类
 * @class FeatureFlagManager
 */
export class FeatureFlagManager {
  /**
   * 特性标志存储
   * @type {Map<string, FeatureFlagConfig>}
   * @private
   */
  #flags = new Map();

  /**
   * 默认标志配置
   * @type {boolean}
   * @private
   */
  #defaultEnabled = false;

  /**
   * 当前环境
   * @type {string}
   * @private
   */
  #environment = 'production';

  /**
   * 当前用户
   * @type {string|null}
   * @private
   */
  #currentUser = null;

  /**
   * 当前用户角色
   * @type {string[]}
   * @private
   */
  #currentUserRoles = [];

  /**
   * 日志记录器
   * @type {import('../common/utils/logger.js').Logger}
   * @private
   */
  #logger = null;

  /**
   * 标志变更监听器
   * @type {Map<string, Set<Function>>}
   * @private
   */
  #listeners = new Map();

  /**
   * 构造函数
   * @param {Object} [options] - 配置选项
   * @param {boolean} [options.defaultEnabled=false] - 默认启用状态
   * @param {string} [options.environment='production'] - 当前环境
   * @param {string} [options.currentUser=null] - 当前用户
   * @param {string[]} [options.currentUserRoles=[]] - 当前用户角色
   * @param {import('../common/utils/logger.js').Logger} [options.logger] - 日志记录器
   */
  constructor(options = {}) {
    this.#defaultEnabled = options.defaultEnabled ?? false;
    this.#environment = options.environment ?? 'production';
    this.#currentUser = options.currentUser ?? null;
    this.#currentUserRoles = options.currentUserRoles ?? [];
    this.#logger = options.logger || getLogger('FeatureFlagManager');
  }

  /**
   * 从配置对象加载特性标志
   * @param {Object<string, FeatureFlagConfig>} config - 配置对象
   * @returns {void}
   */
  loadFromObject(config) {
    if (!config || typeof config !== 'object') {
      this.#logger.error('Invalid config object:', config);
      throw new TypeError('Config must be an object');
    }

    this.#logger.info('Loading feature flags from object...');

    let loadedCount = 0;
    for (const [featureName, flagConfig] of Object.entries(config)) {
      try {
        this.#validateFlagConfig(flagConfig);
        this.#flags.set(featureName, { ...flagConfig });
        loadedCount++;
      } catch (error) {
        this.#logger.error(`Failed to load flag "${featureName}":`, error);
      }
    }

    this.#logger.info(`Loaded ${loadedCount} feature flags`);
  }

  /**
   * 从 JSON 配置文件加载特性标志
   * @param {string} configPath - 配置文件路径
   * @returns {Promise<void>}
   */
  async loadFromConfig(configPath) {
    this.#logger.info(`Loading feature flags from config: ${configPath}`);

    try {
      // 优先使用传入路径
      const tryPaths = [configPath];
      try {
        const loc = typeof window !== 'undefined' ? (window.location || {}) : {};
        const pathname = String(loc.pathname || '');
        // 兼容生产构建下的嵌套路由：/pdf-home/pdf-home/
        // 回退到上级 ../config/feature-flags.json 或根级 /pdf-home/config/feature-flags.json
        if (pathname.includes('/pdf-home/pdf-home/')) {
          tryPaths.push('../config/feature-flags.json');
          tryPaths.push('/pdf-home/config/feature-flags.json');
        }
        // 通用回退（即使非嵌套场景）：
        tryPaths.push('/config/feature-flags.json');
      } catch (_) { /* ignore */ }

      let loaded = false;
      let lastErr = null;
      for (const p of tryPaths) {
        try {
          const resp = await fetch(p);
          if (!resp.ok) { throw new Error(`Failed to fetch config: ${resp.status} ${resp.statusText}`); }
          const cfg = await resp.json();
          this.loadFromObject(cfg);
          this.#logger.info(`[FeatureFlagManager] Loaded from ${p}`);
          loaded = true;
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!loaded) {
        throw lastErr || new Error('Failed to fetch any config path');
      }
    } catch (error) {
      // 构建产物允许无配置文件，采用默认配置继续运行
      this.#logger.warn('[FeatureFlagManager] Failed to load config file, using defaults:', error);
    }
  }

  /**
   * 验证标志配置
   * @param {FeatureFlagConfig} config - 标志配置
   * @returns {void}
   * @private
   */
  #validateFlagConfig(config) {
    if (typeof config !== 'object' || config === null) {
      throw new TypeError('Flag config must be an object');
    }

    if (typeof config.enabled !== 'boolean') {
      throw new TypeError('Flag config.enabled must be a boolean');
    }

    if (config.conditions) {
      const { environment, percentage } = config.conditions;

      if (environment !== undefined && typeof environment !== 'string') {
        throw new TypeError('conditions.environment must be a string');
      }

      if (percentage !== undefined) {
        if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
          throw new TypeError('conditions.percentage must be a number between 0 and 100');
        }
      }
    }
  }

  /**
   * 检查特性是否启用
   * @param {string} featureName - 特性名称
   * @param {Object} [context] - 上下文信息（用于条件判断）
   * @param {string} [context.user] - 用户标识
   * @param {string[]} [context.roles] - 用户角色
   * @returns {boolean} 是否启用
   */
  isEnabled(featureName, context = {}) {
    const flagConfig = this.#flags.get(featureName);

    // 未配置的特性使用默认值
    if (!flagConfig) {
      this.#logger.debug(`Feature "${featureName}" not configured, using default: ${this.#defaultEnabled}`);
      return this.#defaultEnabled;
    }

    // 基础启用检查
    if (!flagConfig.enabled) {
      return false;
    }

    // 条件检查
    if (flagConfig.conditions) {
      return this.#checkConditions(featureName, flagConfig.conditions, context);
    }

    return true;
  }

  /**
   * 检查启用条件
   * @param {string} featureName - 特性名称
   * @param {Object} conditions - 条件配置
   * @param {Object} context - 上下文信息
   * @returns {boolean} 是否满足条件
   * @private
   */
  #checkConditions(featureName, conditions, context) {
    // 环境条件
    if (conditions.environment) {
      if (conditions.environment !== this.#environment) {
        this.#logger.debug(
          `Feature "${featureName}" disabled: environment mismatch (require: ${conditions.environment}, current: ${this.#environment})`
        );
        return false;
      }
    }

    // 用户白名单
    if (conditions.users && conditions.users.length > 0) {
      const user = context.user || this.#currentUser;
      if (!user || !conditions.users.includes(user)) {
        this.#logger.debug(`Feature "${featureName}" disabled: user not in whitelist`);
        return false;
      }
    }

    // 角色白名单
    if (conditions.roles && conditions.roles.length > 0) {
      const roles = context.roles || this.#currentUserRoles;
      const hasRole = roles.some(role => conditions.roles.includes(role));
      if (!hasRole) {
        this.#logger.debug(`Feature "${featureName}" disabled: user role not in whitelist`);
        return false;
      }
    }

    // 百分比灰度发布
    if (conditions.percentage !== undefined) {
      const randomValue = Math.random() * 100;
      if (randomValue > conditions.percentage) {
        this.#logger.debug(`Feature "${featureName}" disabled: percentage rollout (${conditions.percentage}%)`);
        return false;
      }
    }

    return true;
  }

  /**
   * 设置特性标志
   * @param {string} featureName - 特性名称
   * @param {FeatureFlagConfig} config - 标志配置
   * @returns {void}
   */
  setFlag(featureName, config) {
    this.#validateFlagConfig(config);

    const oldConfig = this.#flags.get(featureName);
    this.#flags.set(featureName, { ...config });

    this.#logger.info(`Feature flag "${featureName}" updated:`, config);

    // 触发变更监听器
    this.#notifyListeners(featureName, config, oldConfig);
  }

  /**
   * 启用特性
   * @param {string} featureName - 特性名称
   * @returns {void}
   */
  enable(featureName) {
    const currentConfig = this.#flags.get(featureName) || { enabled: false };
    this.setFlag(featureName, { ...currentConfig, enabled: true });
  }

  /**
   * 禁用特性
   * @param {string} featureName - 特性名称
   * @returns {void}
   */
  disable(featureName) {
    const currentConfig = this.#flags.get(featureName) || { enabled: false };
    this.setFlag(featureName, { ...currentConfig, enabled: false });
  }

  /**
   * 获取特性标志配置
   * @param {string} featureName - 特性名称
   * @returns {FeatureFlagConfig|null} 标志配置
   */
  getFlag(featureName) {
    const config = this.#flags.get(featureName);
    return config ? { ...config } : null;
  }

  /**
   * 获取所有特性标志
   * @returns {Object<string, FeatureFlagConfig>} 所有标志配置
   */
  getAllFlags() {
    const result = {};
    for (const [name, config] of this.#flags.entries()) {
      result[name] = { ...config };
    }
    return result;
  }

  /**
   * 删除特性标志
   * @param {string} featureName - 特性名称
   * @returns {boolean} 是否成功删除
   */
  removeFlag(featureName) {
    const oldConfig = this.#flags.get(featureName);
    const deleted = this.#flags.delete(featureName);
    if (deleted) {
      this.#logger.info(`Feature flag "${featureName}" removed`);
      this.#notifyListeners(featureName, null, oldConfig);
    }
    return deleted;
  }

  /**
   * 清空所有特性标志
   * @returns {void}
   */
  clear() {
    this.#flags.clear();
    this.#logger.info('All feature flags cleared');
  }

  /**
   * 设置环境
   * @param {string} environment - 环境名称
   * @returns {void}
   */
  setEnvironment(environment) {
    this.#logger.info(`Environment changed: ${this.#environment} -> ${environment}`);
    this.#environment = environment;
  }

  /**
   * 设置当前用户
   * @param {string} user - 用户标识
   * @param {string[]} [roles=[]] - 用户角色
   * @returns {void}
   */
  setCurrentUser(user, roles = []) {
    this.#logger.info(`Current user changed: ${this.#currentUser} -> ${user}`);
    this.#currentUser = user;
    this.#currentUserRoles = roles;
  }

  /**
   * 获取当前环境
   * @returns {string}
   */
  getEnvironment() {
    return this.#environment;
  }

  /**
   * 获取当前用户
   * @returns {string|null}
   */
  getCurrentUser() {
    return this.#currentUser;
  }

  /**
   * 监听标志变更
   * @param {string} featureName - 特性名称
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消监听函数
   */
  onChange(featureName, callback) {
    if (!this.#listeners.has(featureName)) {
      this.#listeners.set(featureName, new Set());
    }

    this.#listeners.get(featureName).add(callback);

    // 返回取消监听函数
    return () => {
      const listeners = this.#listeners.get(featureName);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.#listeners.delete(featureName);
        }
      }
    };
  }

  /**
   * 通知监听器
   * @param {string} featureName - 特性名称
   * @param {FeatureFlagConfig|null} newConfig - 新配置
   * @param {FeatureFlagConfig|null} oldConfig - 旧配置
   * @returns {void}
   * @private
   */
  #notifyListeners(featureName, newConfig, oldConfig) {
    const listeners = this.#listeners.get(featureName);
    if (!listeners || listeners.size === 0) {
      return;
    }

    for (const callback of listeners) {
      try {
        callback(newConfig, oldConfig);
      } catch (error) {
        this.#logger.error(`Error in onChange listener for "${featureName}":`, error);
      }
    }
  }

  /**
   * 导出配置为 JSON
   * @returns {string} JSON 字符串
   */
  exportToJSON() {
    const config = this.getAllFlags();
    return JSON.stringify(config, null, 2);
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const total = this.#flags.size;
    let enabled = 0;
    let conditional = 0;

    for (const config of this.#flags.values()) {
      if (config.enabled) {
        enabled++;
      }
      if (config.conditions) {
        conditional++;
      }
    }

    return {
      total,
      enabled,
      disabled: total - enabled,
      conditional,
      unconditional: total - conditional
    };
  }
}

/**
 * 创建 FeatureFlagManager 实例的工厂函数
 * @param {Object} [options] - 配置选项
 * @returns {FeatureFlagManager}
 */
export function createFeatureFlagManager(options = {}) {
  return new FeatureFlagManager(options);
}

export default FeatureFlagManager;
