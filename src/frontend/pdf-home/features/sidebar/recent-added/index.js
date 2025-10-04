/**
 * RecentAdded Feature - 最近添加功能
 * 显示和管理最近添加的PDF文档
 */

import { RecentAddedFeatureConfig } from './feature.config.js';
import './styles/recent-added.css';

export class RecentAddedFeature {
  name = RecentAddedFeatureConfig.name;
  version = RecentAddedFeatureConfig.version;
  dependencies = RecentAddedFeatureConfig.dependencies;

  #context = null;
  #logger = null;
  #scopedEventBus = null;
  #globalEventBus = null;
  #unsubscribers = [];

  // 数据
  #recentAdded = [];
  #displayLimit = RecentAddedFeatureConfig.config.defaultDisplayLimit;

  /**
   * 安装Feature
   */
  async install(context) {
    this.#context = context;
    this.#logger = context.logger;
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;

    this.#logger.info('[RecentAddedFeature] Installing...');

    try {
      // TODO: 实现功能
      // 1. 加载历史数据
      // 2. 渲染UI
      // 3. 监听事件

      this.#logger.info('[RecentAddedFeature] Installed successfully');
    } catch (error) {
      this.#logger.error('[RecentAddedFeature] Installation failed', error);
      throw error;
    }
  }

  /**
   * 卸载Feature
   */
  async uninstall() {
    this.#logger.info('[RecentAddedFeature] Uninstalling...');

    // 取消事件订阅
    this.#unsubscribers.forEach(unsub => unsub());
    this.#unsubscribers = [];

    // TODO: 清理UI

    this.#logger.info('[RecentAddedFeature] Uninstalled');
  }
}

export default RecentAddedFeature;
