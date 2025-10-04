/**
 * RecentSearches Feature - 最近搜索功能
 * 显示和管理最近的搜索关键词
 */

import { RecentSearchesFeatureConfig } from './feature.config.js';
import './styles/recent-searches.css';

export class RecentSearchesFeature {
  name = RecentSearchesFeatureConfig.name;
  version = RecentSearchesFeatureConfig.version;
  dependencies = RecentSearchesFeatureConfig.dependencies;

  #context = null;
  #logger = null;
  #scopedEventBus = null;
  #globalEventBus = null;
  #unsubscribers = [];

  // 数据
  #recentSearches = [];
  #displayLimit = RecentSearchesFeatureConfig.config.defaultDisplayLimit;

  /**
   * 安装Feature
   */
  async install(context) {
    this.#context = context;
    this.#logger = context.logger;
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;

    this.#logger.info('[RecentSearchesFeature] Installing...');

    try {
      // TODO: 实现功能
      // 1. 加载历史数据
      // 2. 渲染UI
      // 3. 监听事件

      this.#logger.info('[RecentSearchesFeature] Installed successfully');
    } catch (error) {
      this.#logger.error('[RecentSearchesFeature] Installation failed', error);
      throw error;
    }
  }

  /**
   * 卸载Feature
   */
  async uninstall() {
    this.#logger.info('[RecentSearchesFeature] Uninstalling...');

    // 取消事件订阅
    this.#unsubscribers.forEach(unsub => unsub());
    this.#unsubscribers = [];

    // TODO: 清理UI

    this.#logger.info('[RecentSearchesFeature] Uninstalled');
  }
}

export default RecentSearchesFeature;
