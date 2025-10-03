/**
 * 搜索状态管理器
 * @file features/search/services/search-state-manager.js
 * @description 管理搜索功能的状态数据，包括当前查询、结果索引、选项等
 */

import { getLogger } from '../../../../common/utils/logger.js';

/**
 * 搜索状态管理器类
 * 负责维护搜索状态的一致性，提供状态查询和更新接口
 * @class SearchStateManager
 */
export class SearchStateManager {
  /** @type {import('../../../../common/utils/logger.js').Logger} */
  #logger = getLogger('SearchStateManager');

  /** @type {string} 当前搜索关键词 */
  #query = '';

  /** @type {number} 当前匹配索引（从1开始，0表示无匹配） */
  #currentIndex = 0;

  /** @type {number} 总匹配数 */
  #totalMatches = 0;

  /** @type {import('../../../types/events').SearchOptions} 当前搜索选项 */
  #options = {
    caseSensitive: false,
    wholeWords: false,
    highlightAll: true,
    useRegex: false,
  };

  /** @type {Array<import('../../../types/events').SearchMatch>} 匹配结果列表 */
  #matches = [];

  /** @type {boolean} 是否正在搜索 */
  #isSearching = false;

  /** @type {boolean} 搜索框是否可见 */
  #isVisible = false;

  /** @type {number} 上次搜索时间戳 */
  #lastSearchTimestamp = 0;

  constructor() {
    this.#logger.info('SearchStateManager created');
  }

  /**
   * 更新搜索关键词
   * @param {string} query - 新的搜索关键词
   */
  updateQuery(query) {
    const oldQuery = this.#query;
    this.#query = query || '';

    if (oldQuery !== this.#query) {
      this.#logger.info(`Query updated: "${oldQuery}" -> "${this.#query}"`);
    }
  }

  /**
   * 更新搜索结果
   * @param {number} currentIndex - 当前匹配索引
   * @param {number} totalMatches - 总匹配数
   * @param {Array<import('../../../types/events').SearchMatch>} matches - 匹配结果数组
   */
  updateResults(currentIndex, totalMatches, matches = []) {
    this.#currentIndex = currentIndex || 0;
    this.#totalMatches = totalMatches || 0;
    this.#matches = matches;
    this.#lastSearchTimestamp = Date.now();

    this.#logger.info(`Results updated: ${this.#currentIndex}/${this.#totalMatches} matches`);
  }

  /**
   * 更新搜索选项
   * @param {Partial<import('../../../types/events').SearchOptions>} options - 新的搜索选项
   */
  updateOptions(options) {
    this.#options = { ...this.#options, ...options };
    this.#logger.info('Options updated:', this.#options);
  }

  /**
   * 切换特定选项
   * @param {string} optionName - 选项名称
   * @returns {boolean} 新的选项值
   */
  toggleOption(optionName) {
    if (optionName in this.#options) {
      this.#options[optionName] = !this.#options[optionName];
      this.#logger.info(`Option toggled: ${optionName} = ${this.#options[optionName]}`);
      return this.#options[optionName];
    }

    this.#logger.warn(`Unknown option: ${optionName}`);
    return false;
  }

  /**
   * 设置搜索状态
   * @param {boolean} isSearching - 是否正在搜索
   */
  setSearching(isSearching) {
    this.#isSearching = !!isSearching;
  }

  /**
   * 设置搜索框可见性
   * @param {boolean} isVisible - 是否可见
   */
  setVisible(isVisible) {
    this.#isVisible = !!isVisible;
    this.#logger.info(`Visibility set to: ${this.#isVisible}`);
  }

  /**
   * 跳转到下一个匹配
   * @returns {number} 新的匹配索引
   */
  nextMatch() {
    if (this.#totalMatches === 0) {
      this.#logger.warn('No matches to navigate');
      return 0;
    }

    // 循环导航
    this.#currentIndex = this.#currentIndex >= this.#totalMatches ? 1 : this.#currentIndex + 1;
    this.#logger.info(`Navigated to next match: ${this.#currentIndex}/${this.#totalMatches}`);

    return this.#currentIndex;
  }

  /**
   * 跳转到上一个匹配
   * @returns {number} 新的匹配索引
   */
  previousMatch() {
    if (this.#totalMatches === 0) {
      this.#logger.warn('No matches to navigate');
      return 0;
    }

    // 循环导航
    this.#currentIndex = this.#currentIndex <= 1 ? this.#totalMatches : this.#currentIndex - 1;
    this.#logger.info(`Navigated to previous match: ${this.#currentIndex}/${this.#totalMatches}`);

    return this.#currentIndex;
  }

  /**
   * 跳转到指定匹配
   * @param {number} index - 目标匹配索引（从1开始）
   * @returns {boolean} 是否成功跳转
   */
  goToMatch(index) {
    if (this.#totalMatches === 0) {
      this.#logger.warn('No matches to navigate');
      return false;
    }

    if (index < 1 || index > this.#totalMatches) {
      this.#logger.warn(`Invalid match index: ${index} (total: ${this.#totalMatches})`);
      return false;
    }

    this.#currentIndex = index;
    this.#logger.info(`Jumped to match: ${this.#currentIndex}/${this.#totalMatches}`);

    return true;
  }

  /**
   * 重置搜索状态
   */
  reset() {
    this.#logger.info('Resetting search state');

    this.#query = '';
    this.#currentIndex = 0;
    this.#totalMatches = 0;
    this.#matches = [];
    this.#isSearching = false;
    this.#lastSearchTimestamp = 0;

    // 保留选项不重置
  }

  /**
   * 重置所有状态（包括选项）
   */
  resetAll() {
    this.#logger.info('Resetting all search state');

    this.reset();

    this.#options = {
      caseSensitive: false,
      wholeWords: false,
      highlightAll: true,
      useRegex: false,
    };

    this.#isVisible = false;
  }

  /**
   * 获取当前查询
   * @returns {string}
   */
  get query() {
    return this.#query;
  }

  /**
   * 获取当前匹配索引
   * @returns {number}
   */
  get currentIndex() {
    return this.#currentIndex;
  }

  /**
   * 获取总匹配数
   * @returns {number}
   */
  get totalMatches() {
    return this.#totalMatches;
  }

  /**
   * 获取当前搜索选项
   * @returns {import('../../../types/events').SearchOptions}
   */
  get options() {
    return { ...this.#options };
  }

  /**
   * 获取匹配结果列表
   * @returns {Array<import('../../../types/events').SearchMatch>}
   */
  get matches() {
    return [...this.#matches];
  }

  /**
   * 是否正在搜索
   * @returns {boolean}
   */
  get isSearching() {
    return this.#isSearching;
  }

  /**
   * 搜索框是否可见
   * @returns {boolean}
   */
  get isVisible() {
    return this.#isVisible;
  }

  /**
   * 是否有搜索结果
   * @returns {boolean}
   */
  get hasResults() {
    return this.#totalMatches > 0;
  }

  /**
   * 是否有活跃的搜索
   * @returns {boolean}
   */
  get hasActiveSearch() {
    return this.#query.length > 0 && this.#totalMatches > 0;
  }

  /**
   * 获取上次搜索时间戳
   * @returns {number}
   */
  get lastSearchTimestamp() {
    return this.#lastSearchTimestamp;
  }

  /**
   * 获取完整状态快照
   * @returns {Object}
   */
  getSnapshot() {
    return {
      query: this.#query,
      currentIndex: this.#currentIndex,
      totalMatches: this.#totalMatches,
      options: { ...this.#options },
      matches: [...this.#matches],
      isSearching: this.#isSearching,
      isVisible: this.#isVisible,
      hasResults: this.hasResults,
      hasActiveSearch: this.hasActiveSearch,
      lastSearchTimestamp: this.#lastSearchTimestamp,
    };
  }

  /**
   * 从快照恢复状态
   * @param {Object} snapshot - 状态快照
   */
  restoreFromSnapshot(snapshot) {
    if (!snapshot) {
      this.#logger.warn('Cannot restore from null/undefined snapshot');
      return;
    }

    this.#logger.info('Restoring state from snapshot');

    this.#query = snapshot.query || '';
    this.#currentIndex = snapshot.currentIndex || 0;
    this.#totalMatches = snapshot.totalMatches || 0;
    this.#options = { ...this.#options, ...snapshot.options };
    this.#matches = snapshot.matches || [];
    this.#isSearching = !!snapshot.isSearching;
    this.#isVisible = !!snapshot.isVisible;
    this.#lastSearchTimestamp = snapshot.lastSearchTimestamp || 0;

    this.#logger.info('State restored successfully');
  }

  /**
   * 销毁状态管理器
   */
  destroy() {
    this.#logger.info('Destroying SearchStateManager');
    this.resetAll();
  }
}
