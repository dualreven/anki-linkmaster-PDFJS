/**
 * SearchResultItem Feature - 搜索结果条目
 * 负责渲染单个PDF搜索结果的展示
 */

import { SearchResultItemFeatureConfig } from './feature.config.js';
import './styles/search-result-item.css';

export class SearchResultItemFeature {
  name = SearchResultItemFeatureConfig.name;
  version = SearchResultItemFeatureConfig.version;
  dependencies = [];

  #context = null;
  #logger = null;
  #scopedEventBus = null;
  #globalEventBus = null;
  #unsubscribers = [];

  /**
   * 安装Feature
   */
  async install(context) {
    this.#context = context;
    this.#logger = context.logger;
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;

    this.#logger.info('[SearchResultItemFeature] Installing...');

    try {
      // TODO: 实现功能
      // 1. 注册条目渲染器
      // 2. 监听条目交互事件
      // 3. 提供条目渲染API

      this.#logger.info('[SearchResultItemFeature] Installed successfully');
    } catch (error) {
      this.#logger.error('[SearchResultItemFeature] Installation failed', error);
      throw error;
    }
  }

  /**
   * 卸载Feature
   */
  async uninstall() {
    this.#logger.info('[SearchResultItemFeature] Uninstalling...');

    // 取消事件订阅
    this.#unsubscribers.forEach(unsub => unsub());
    this.#unsubscribers = [];

    // TODO: 清理资源

    this.#logger.info('[SearchResultItemFeature] Uninstalled');
  }

  /**
   * 渲染单个结果条目
   * @param {Object} data - PDF数据
   * @returns {string} HTML字符串
   */
  renderItem(data) {
    // TODO: 实现条目渲染逻辑
    return `<div class="search-result-item">${data.filename}</div>`;
  }
}

export default SearchResultItemFeature;
