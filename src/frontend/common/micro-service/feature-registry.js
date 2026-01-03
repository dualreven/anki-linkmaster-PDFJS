/**
 * @file 功能注册中心 - Feature Registry
 * @module FeatureRegistry
 * 详细说明见：`docs/standards/feature-registry.md`
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

import { getLogger } from "../utils/logger.js";
import { FeatureRecord } from "./feature-record.js";
import { createFeatureContext, cleanupFeatureContext } from "./feature-registry-context.js";
import { checkMissingDependencies, resolveInstallOrder } from "./feature-registry-deps.js";
import { validateFeature } from "./feature-registry-validators.js";

// ==================== 类型定义 ====================

/**
 * 功能状态枚举
 * @enum {string}
 */
export const FeatureStatus = {
  /** 已注册，未安装 */
  REGISTERED: "registered",
  /** 正在安装 */
  INSTALLING: "installing",
  /** 已安装，已启用 */
  INSTALLED: "installed",
  /** 已安装，已禁用 */
  DISABLED: "disabled",
  /** 安装失败 */
  FAILED: "failed",
  /** 已卸载 */
  UNINSTALLED: "uninstalled"
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

// ==================== 功能注册中心 ====================

/**
 * 功能注册中心类
 * @class FeatureRegistry
 */
export class FeatureRegistry {
  /** @type {Map<string, FeatureRecord>} */
  #features = new Map();

  /** @type {Map<string, string>} 别名映射：old -> canonical */
  #aliases = new Map();

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
  constructor({ container, logger, globalEventBus, aliases } = {}) {
    if (!container) {
      throw new Error("FeatureRegistry requires a DependencyContainer instance");
    }

    this.#container = container;
    this.#logger = logger || getLogger("FeatureRegistry");
    this.#globalEventBus = globalEventBus || null;

    // 初始化别名映射（可选）
    if (aliases && typeof aliases === "object") {
      for (const [k, v] of Object.entries(aliases)) {
        if (typeof k === "string" && typeof v === "string" && k && v) {
          this.#aliases.set(k, v);
        }
      }
    }

    this.#logger.debug("FeatureRegistry created");
  }

  /**
   * 设置/追加别名映射（运行期可调用）
   * @param {Record<string,string>} aliases
   */
  setAliases(aliases = {}) {
    for (const [k, v] of Object.entries(aliases)) {
      if (typeof k === "string" && typeof v === "string" && k && v) {
        this.#aliases.set(k, v);
      }
    }
  }

  /**
   * 将输入名称映射为规范名（若存在别名）；否则原样返回
   * @param {string} name
   * @returns {string}
   */
  #resolveName(name) {
    if (!name) { return name; }
    return this.#aliases.get(name) || name;
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
    validateFeature(feature);

    const canonical = this.#resolveName(feature.name);

    // 检查是否已注册
    if (this.#features.has(canonical)) {
      throw new Error(`Feature "${canonical}" is already registered`);
    }

    // 创建功能记录
    const record = new FeatureRecord(feature, FeatureStatus);
    this.#features.set(canonical, record);

    this.#logger.info(`Feature registered: ${canonical} (v${feature.version})`);
  }

  /**
   * 检查功能是否已注册
   * @param {string} name - 功能名称
   * @returns {boolean}
   */
  has(name) {
    return this.#features.has(this.#resolveName(name));
  }

  /**
   * 获取功能记录
   * @param {string} name - 功能名称
   * @returns {FeatureRecord|null}
   */
  get(name) {
    return this.#features.get(this.#resolveName(name)) || null;
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
    // 对外统一返回“规范名”（别名已归一），避免测试与外部代码感知到历史命名
    return Array.from(this.#features.entries())
      .filter(([, record]) => record.status === FeatureStatus.INSTALLED)
      .map(([canonical /*, record*/]) => canonical);
  }

  /**
   * 获取指定功能的安装状态（便于测试/调试）
   * @param {string} name - 功能名称（支持别名）
   * @returns {string} FeatureStatus 值；未注册返回 'unregistered'
   */
  getStatus(name) {
    const canonical = this.#resolveName(name);
    const record = this.#features.get(canonical);
    return record ? record.status : "unregistered";
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
    const canonical = this.#resolveName(name);
    const record = this.#features.get(canonical);

    if (!record) {
      throw new Error(`Feature "${canonical}" is not registered`);
    }

    // 如果已安装，跳过
    if (record.status === FeatureStatus.INSTALLED) {
      this.#logger.debug(`Feature "${canonical}" is already installed, skipping`);
      return;
    }

    // 检查依赖
    const { feature } = record;
    const missingDeps = checkMissingDependencies({
      feature,
      resolveName: (n) => this.#resolveName(n),
      features: this.#features,
      container: this.#container,
      installedStatus: FeatureStatus.INSTALLED,
    });

    if (missingDeps.length > 0) {
      throw new Error(
        `Feature "${canonical}" has missing dependencies: ${missingDeps.join(", ")}`
      );
    }

    // 标记为正在安装
    record.setStatus(FeatureStatus.INSTALLING);

    try {
      // 创建功能上下文
      const context = await createFeatureContext({
        featureName: canonical,
        container: this.#container,
        globalEventBus: this.#globalEventBus,
        features: this.#features,
      });
      record.setContext(context);

      // 调用安装方法
      this.#logger.info(`Installing feature: ${canonical}...`);
      await feature.install(context);

      // 标记为已安装
      record.markInstalled();
      this.#logger.info(`Feature installed successfully: ${canonical}`);

    } catch (error) {
      // 安装失败
      record.setStatus(FeatureStatus.FAILED);
      record.setError(error);
      this.#logger.error(`Feature installation failed: ${canonical}`, error);
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
    const installOrder = resolveInstallOrder({
      features: this.#features,
      resolveName: (n) => this.#resolveName(n),
    });

    this.#logger.info(`Installing ${installOrder.length} features in order: ${installOrder.join(" -> ")}`);

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
      cleanupFeatureContext(context);

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

    if (typeof feature.enable === "function") {
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

    if (typeof feature.disable === "function") {
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

    this.#features.forEach((record, canonicalName) => {
      // 统一输出规范名与规范依赖，提升可读性与一致性
      const canonicalDeps = (record.feature?.dependencies || []).map(d => this.#resolveName(d));
      const info = {
        name: canonicalName,
        version: record.feature?.version,
        status: record.status,
        dependencies: canonicalDeps,
        installedAt: record.installedAt,
        error: record.error?.message || null
      };
      summary.features.push(info);

      if (record.status === FeatureStatus.INSTALLED) {summary.installed++;}
      if (record.status === FeatureStatus.DISABLED) {summary.disabled++;}
      if (record.status === FeatureStatus.FAILED) {summary.failed++;}
    });

    return summary;
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
