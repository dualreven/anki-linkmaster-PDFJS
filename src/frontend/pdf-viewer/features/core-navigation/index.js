/**
 * Core Navigation Feature
 * @module CoreNavigationFeature
 * @description 核心导航功能，提供页面跳转和位置滚动服务
 * @implements {IFeature}
 */

import { getLogger } from '../../../common/utils/logger.js';
import { NavigationService } from './services/navigation-service.js';
import { CoreNavigationFeatureConfig } from './feature.config.js';

/**
 * 核心导航功能 Feature
 * @class CoreNavigationFeature
 * @implements {IFeature}
 *
 * @description
 * 核心导航 Feature 负责提供基础的页面导航和位置滚动功能。
 * 它创建并管理 NavigationService 实例，并将其注册到容器中供其他 Feature 使用。
 *
 * 这是一个基础设施 Feature，不依赖任何业务 Feature。
 * 其他需要导航功能的 Feature 应该声明对 'navigationService' 的依赖。
 *
 * @example
 * // 在其他 Feature 中使用
 * class MyFeature {
 *   get dependencies() {
 *     return ['navigationService'];  // 声明依赖
 *   }
 *
 *   async install(context) {
 *     this.#navService = context.container.get('navigationService');
 *     // 使用导航服务
 *     await this.#navService.navigateTo({ pageAt: 5, position: 50 });
 *   }
 * }
 */
export class CoreNavigationFeature {
  /** @type {import('../../../common/utils/logger.js').Logger} */
  #logger = getLogger('CoreNavigationFeature');

  /** @type {EventBus|null} */
  #eventBus = null;

  /** @type {NavigationService|null} */
  #navigationService = null;

  /**
   * Feature 名称
   * @returns {string}
   */
  get name() {
    return CoreNavigationFeatureConfig.name;
  }

  /**
   * Feature 版本
   * @returns {string}
   */
  get version() {
    return CoreNavigationFeatureConfig.version;
  }

  /**
   * Feature 依赖
   * @returns {string[]}
   */
  get dependencies() {
    return CoreNavigationFeatureConfig.dependencies;
  }

  /**
   * 安装 Feature
   * @param {Object} context - Feature 上下文对象
   * @param {import('../../container/simple-dependency-container.js').SimpleDependencyContainer} context.container - 依赖容器
   * @param {Object} context.globalEventBus - 全局事件总线
   * @param {Object} context.logger - 日志器
   * @returns {Promise<void>}
   */
  async install(context) {
    this.#logger.info(`安装 ${this.name} Feature v${this.version}...`);

    // 1. 从 context 中获取依赖
    const container = context.container || context;
    this.#eventBus = context.globalEventBus || container.get('eventBus');

    if (!this.#eventBus) {
      throw new Error(`[${this.name}] EventBus 未在容器或 context 中找到`);
    }

    // 2. 创建 NavigationService 实例
    this.#navigationService = new NavigationService(
      this.#eventBus,
      CoreNavigationFeatureConfig.options
    );

    this.#logger.info('[CoreNavigationFeature] NavigationService 已创建');

    // 3. 将 NavigationService 注册到容器中，供其他 Feature 使用
    if (container.register) {
      container.register('navigationService', this.#navigationService);
      this.#logger.info('[CoreNavigationFeature] NavigationService 已注册到容器');
    } else {
      this.#logger.warn('[CoreNavigationFeature] 容器不支持 register 方法，无法注册服务');
    }

    this.#logger.info(`${this.name} Feature 安装完成`);
  }

  /**
   * 卸载 Feature
   * @returns {Promise<void>}
   */
  async uninstall() {
    this.#logger.info(`卸载 ${this.name} Feature...`);

    // 销毁 NavigationService
    if (this.#navigationService) {
      this.#navigationService.destroy();
      this.#navigationService = null;
    }

    this.#eventBus = null;

    this.#logger.info(`${this.name} Feature 已卸载`);
  }

  /**
   * 获取 NavigationService 实例（仅用于测试或特殊情况）
   * @returns {NavigationService|null}
   * @deprecated 应该通过容器的 get('navigationService') 获取
   */
  getNavigationService() {
    return this.#navigationService;
  }

  /**
   * 获取 Feature 状态（用于调试）
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      name: this.name,
      version: this.version,
      isInstalled: this.#navigationService !== null,
      navigationService: {
        totalPages: this.#navigationService?.getTotalPages() || null,
      },
    };
  }
}

export default CoreNavigationFeature;
