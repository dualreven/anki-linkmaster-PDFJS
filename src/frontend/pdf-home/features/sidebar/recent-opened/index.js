/**
 * RecentOpened Feature - 最近阅读功能
 * 显示和管理最近阅读的PDF文档
 */

import { RecentOpenedFeatureConfig } from './feature.config.js';
import './styles/recent-opened.css';

export class RecentOpenedFeature {
  name = RecentOpenedFeatureConfig.name;
  version = RecentOpenedFeatureConfig.version;
  dependencies = RecentOpenedFeatureConfig.dependencies;

  #context = null;
  #logger = null;
  #scopedEventBus = null;
  #globalEventBus = null;
  #unsubscribers = [];

  // 数据
  #recentOpened = [];
  #displayLimit = RecentOpenedFeatureConfig.config.defaultDisplayLimit;

  /**
   * 安装Feature
   */
  async install(context) {
    this.#context = context;
    this.#logger = context.logger;
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;

    this.#logger.info('[RecentOpenedFeature] Installing...');

    try {
      // TODO: 实现功能
      // 1. 加载历史数据
      // 2. 渲染UI
      // 3. 监听事件

      this.#logger.info('[RecentOpenedFeature] Installed successfully');
    } catch (error) {
      this.#logger.error('[RecentOpenedFeature] Installation failed', error);
      throw error;
    }
  }

  /**
   * 卸载Feature
   */
  async uninstall() {
    this.#logger.info('[RecentOpenedFeature] Uninstalling...');

    // 取消事件订阅
    this.#unsubscribers.forEach(unsub => unsub());
    this.#unsubscribers = [];

    // TODO: 清理UI

    this.#logger.info('[RecentOpenedFeature] Uninstalled');
  }
}

export default RecentOpenedFeature;
