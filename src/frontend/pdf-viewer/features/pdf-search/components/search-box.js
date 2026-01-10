/**
 * 搜索框主容器组件
 * @file features/search/components/search-box.js
 * @description 搜索框UI的主容器，管理所有子组件和用户交互
 *
 * 详细说明见：docs/standards/pdf-search-search-box.md
 */

import { getLogger } from "../../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { debounce } from "../utils/debounce.js";
import { validateSearchQuery } from "../utils/search-validator.js";
import { createSearchBoxDom } from "./search-box-dom.js";
import { attachSearchBoxDomBindings } from "./search-box-dom-bindings.js";
import { subscribeSearchBoxEvents } from "./search-box-event-subscriptions.js";

/**
 * 搜索框组件类
 * 负责创建和管理搜索框UI，处理用户输入和交互
 * @class SearchBox
 */
export class SearchBox {
  /** @type {import('../../../../common/utils/logger.js').Logger} */
  #logger = getLogger("SearchBox");

  /** @type {import('../../../types/events').EventBus} */
  #eventBus = null;

  /** @type {import('../services/search.manager.js').SearchManager} */
  #searchManager = null;

  /** @type {HTMLElement} 搜索框容器 */
  #container = null;

  /** @type {HTMLInputElement} 搜索输入框 */
  #searchInput = null;

  /** @type {HTMLButtonElement} 上一个按钮 */
  #prevButton = null;

  /** @type {HTMLButtonElement} 下一个按钮 */
  #nextButton = null;

  /** @type {HTMLElement} 结果计数显示 */
  #resultCounter = null;

  /** @type {HTMLInputElement} 区分大小写复选框 */
  #caseSensitiveCheckbox = null;

  /** @type {HTMLInputElement} 全词匹配复选框 */
  #wholeWordsCheckbox = null;

  /** @type {Function} 防抖后的搜索处理函数 */
  #debouncedSearch = null;

  /** @type {boolean} 是否已初始化 */
  #initialized = false;

  /** @type {boolean} 是否可见 */
  #isVisible = false;

  /** @type {Array<() => void>} */
  #cleanupFns = [];

  /**
   * 构造函数
   * @param {import('../../../types/events').EventBus} eventBus - 事件总线
   * @param {import('../services/search.manager.js').SearchManager} searchManager - 搜索管理器
   */
  constructor(eventBus, searchManager) {
    if (!eventBus) {
      throw new Error("EventBus is required for SearchBox");
    }
    if (!searchManager) {
      throw new Error("SearchManager is required for SearchBox");
    }

    this.#eventBus = eventBus;
    this.#searchManager = searchManager;
    this.#logger.info("SearchBox created");
  }

  /**
   * 初始化搜索框
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.#initialized) {
      this.#logger.warn("SearchBox already initialized");
      return;
    }

    this.#logger.info("Initializing SearchBox...");

    // 设置防抖搜索函数
    this.#debouncedSearch = debounce((query, options) => {
      this.#handleSearch(query, options);
    }, 300);

    // 创建 DOM
    const { container, elements } = createSearchBoxDom({ logger: this.#logger });
    this.#container = container;
    this.#searchInput = elements.searchInput;
    this.#prevButton = elements.prevButton;
    this.#nextButton = elements.nextButton;
    this.#resultCounter = elements.resultCounter;
    this.#caseSensitiveCheckbox = elements.caseSensitiveCheckbox;
    this.#wholeWordsCheckbox = elements.wholeWordsCheckbox;

    // DOM 事件绑定（可清理）
    this.#cleanupFns.push(attachSearchBoxDomBindings({
      elements,
      logger: this.#logger,
      onInput: (query) => {
        const options = this.#getCurrentOptions();
        this.#debouncedSearch(query, options);
      },
      onPrev: () => this.#handlePrevClick(),
      onNext: () => this.#handleNextClick(),
      onClose: () => this.#handleCloseClick(),
      onOptionChanged: (name, value) => this.#handleOptionChange(name, value),
      onToggle: () => this.toggle(),
    }));

    // Subscribe to Manager State
    this.#cleanupFns.push(this.#searchManager.store.subscribe((state, oldState) => {
      // Update UI Visibility
      if (!oldState || state.isVisible !== oldState.isVisible) {
        if (state.isVisible) {this.show();} else {this.hide();}
      }

      // Update Counter
      if (!oldState || state.currentIndex !== oldState.currentIndex || state.totalMatches !== oldState.totalMatches) {
        this.updateResultCounter(state.currentIndex, state.totalMatches);
      }

      // Update Input (if changed externally e.g. via API)
      if (!oldState || state.query !== oldState.query) {
        if (this.#searchInput && this.#searchInput.value !== state.query) {
          this.#searchInput.value = state.query || "";
        }
      }
    }, { fireImmediately: true }));

    // Legacy subscriptions (Toggle command via EventBus)
    // SEARCH.UI.OPEN event is emitted by GlobalShortcut
    this.#cleanupFns.push(subscribeSearchBoxEvents({
      eventBus: this.#eventBus,
      // onResult: removed, handled by Manager subscription
      onOpen: () => this.#searchManager.setVisible(true), // Update state instead of direct DOM
      onClose: () => this.#searchManager.setVisible(false),
      onToggle: () => this.#searchManager.setVisible(!this.#searchManager.store.get().isVisible),
      subscriberId: "SearchBox",
    }));

    this.#initialized = true;
    this.#logger.info("SearchBox initialized");
  }

  /**
   * 获取当前搜索选项
   * @private
   * @returns {import('../../../types/events').SearchOptions}
   */
  #getCurrentOptions() {
    return {
      caseSensitive: this.#caseSensitiveCheckbox.checked,
      wholeWords: this.#wholeWordsCheckbox.checked,
      highlightAll: true,
      useRegex: false,
    };
  }

  /**
   * 处理搜索执行
   * @private
   * @param {string} query - 搜索关键词
   * @param {import('../../../types/events').SearchOptions} options - 搜索选项
   */
  #handleSearch(query, options) {
    // 验证查询
    const validation = validateSearchQuery(query);

    if (!validation.valid) {
      if (query.trim().length > 0) {
        // 仅在用户实际输入了内容但无效时才显示错误
        this.#logger.warn("Invalid search query:", validation.error);
      }
      // 清空结果显示
      this.updateResultCounter(0, 0);
      return;
    }

    this.#logger.info(`Searching for: "${validation.cleaned}"`);

    // 发出搜索事件 (Command)
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.SEARCH.EXECUTE.QUERY,
      {
        query: validation.cleaned,
        options,
      },
      { actorId: "SearchBox" }
    );
  }

  /**
   * 处理"上一个"按钮点击
   * @private
   */
  #handlePrevClick() {
    this.#logger.info("Previous button clicked");

    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.SEARCH.NAVIGATE.PREV,
      {},
      { actorId: "SearchBox" }
    );
  }

  /**
   * 处理"下一个"按钮点击
   * @private
   */
  #handleNextClick() {
    this.#logger.info("Next button clicked");

    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.SEARCH.NAVIGATE.NEXT,
      {},
      { actorId: "SearchBox" }
    );
  }

  /**
   * 处理"关闭"按钮点击
   * @private
   */
  #handleCloseClick() {
    this.#logger.info("Close button clicked");
    // Update State
    this.#searchManager.setVisible(false);
  }

  /**
   * 处理搜索选项改变
   * @private
   * @param {string} optionName - 选项名称
   * @param {boolean} value - 选项值
   */
  #handleOptionChange(optionName, value) {
    this.#logger.info(`Option changed: ${optionName} = ${value}`);

    // 发出选项改变事件
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.SEARCH.OPTION.CHANGED,
      { option: optionName, value },
      { actorId: "SearchBox" }
    );

    // 如果有活跃的搜索，重新执行
    const query = this.#searchInput.value.trim();
    if (query.length > 0) {
      const options = this.#getCurrentOptions();
      this.#handleSearch(query, options);
    }
  }

  /**
   * 显示搜索框 (View Logic)
   */
  show() {
    if (this.#isVisible) {
      return;
    }

    this.#logger.info("Showing search box");

    this.#container.classList.remove("hidden");
    this.#searchInput.focus();
    this.#searchInput.select();
    this.#isVisible = true;
  }

  /**
   * 隐藏搜索框 (View Logic)
   */
  hide() {
    if (!this.#isVisible) {
      return;
    }

    this.#logger.info("Hiding search box");

    this.#container.classList.add("hidden");
    this.#isVisible = false;

    // 清空搜索（发出清空事件）
    // Note: Should hiding clear search? Assuming yes based on legacy behavior.
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.SEARCH.EXECUTE.CLEAR,
      {},
      { actorId: "SearchBox" }
    );
  }

  /**
   * 切换显示/隐藏
   */
  toggle() {
    // Delegate to Manager to update state, which triggers subscription -> show/hide
    const isVisible = this.#searchManager.store.get().isVisible;
    this.#searchManager.setVisible(!isVisible);
  }

  /**
   * 更新结果计数显示
   * @param {number} current - 当前匹配索引
   * @param {number} total - 总匹配数
   */
  updateResultCounter(current, total) {
    if (!this.#resultCounter) {
      return;
    }

    const text = total > 0 ? `${current}/${total}` : "0/0";
    this.#resultCounter.textContent = text;

    // 更新按钮启用状态
    const hasResults = total > 0;
    this.#prevButton.disabled = !hasResults;
    this.#nextButton.disabled = !hasResults;

    this.#logger.info(`Result counter updated: ${text}`);
  }

  /**
   * 设置搜索输入框的值
   * @param {string} query - 搜索关键词
   */
  setQuery(query) {
    // Use Manager
    this.#searchManager.setQuery(query);
  }

  /**
   * 获取搜索输入框的值
   * @returns {string}
   */
  getQuery() {
    // Read from Manager (Source of Truth)
    return this.#searchManager.store.get().query;
  }

  /**
   * 销毁搜索框
   */
  destroy() {
    this.#logger.info("Destroying SearchBox");

    // Cancel pending debounced callbacks to avoid post-destroy side effects.
    try { this.#debouncedSearch?.cancel?.(); } catch (e) { this.#logger.debug("SearchBox debounce cancel failed", e); }

    // 清理订阅与 DOM 事件绑定
    for (const fn of this.#cleanupFns.splice(0)) {
      try { fn?.(); } catch (e) { this.#logger.debug("SearchBox cleanup failed", e); }
    }

    // 移除DOM
    if (this.#container && this.#container.parentNode) {
      this.#container.parentNode.removeChild(this.#container);
    }

    // 清空引用
    this.#container = null;
    this.#searchInput = null;
    this.#prevButton = null;
    this.#nextButton = null;
    this.#resultCounter = null;
    this.#caseSensitiveCheckbox = null;
    this.#wholeWordsCheckbox = null;
    this.#debouncedSearch = null;
    this.#eventBus = null;
    this.#searchManager = null; // Clear manager reference
    this.#cleanupFns = [];

    this.#initialized = false;
    this.#isVisible = false;

    this.#logger.info("SearchBox destroyed");
  }
}
