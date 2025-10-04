/**
 * SearchResults Feature - 搜索结果功能
 * 显示和管理PDF搜索结果表格
 */

import { SearchResultsFeatureConfig } from './feature.config.js';
import './styles/search-results.css';

export class SearchResultsFeature {
  name = SearchResultsFeatureConfig.name;
  version = SearchResultsFeatureConfig.version;
  dependencies = SearchResultsFeatureConfig.dependencies;

  #context = null;
  #logger = null;
  #scopedEventBus = null;
  #globalEventBus = null;
  #unsubscribers = [];

  // 表格实例
  #table = null;

  /**
   * 安装Feature
   */
  async install(context) {
    this.#context = context;
    this.#logger = context.logger;
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;

    this.#logger.info('[SearchResultsFeature] Installing...');

    try {
      // TODO: 实现功能
      // 1. 初始化表格
      // 2. 监听搜索事件
      // 3. 处理行选择和双击

      this.#logger.info('[SearchResultsFeature] Installed successfully');
    } catch (error) {
      this.#logger.error('[SearchResultsFeature] Installation failed', error);
      throw error;
    }
  }

  /**
   * 卸载Feature
   */
  async uninstall() {
    this.#logger.info('[SearchResultsFeature] Uninstalling...');

    // 取消事件订阅
    this.#unsubscribers.forEach(unsub => unsub());
    this.#unsubscribers = [];

    // TODO: 销毁表格

    this.#logger.info('[SearchResultsFeature] Uninstalled');
  }
}

export default SearchResultsFeature;
