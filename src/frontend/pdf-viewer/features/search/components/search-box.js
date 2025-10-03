/**
 * 搜索框主容器组件
 * @file features/search/components/search-box.js
 * @description 搜索框UI的主容器，管理所有子组件和用户交互
 */

import { getLogger } from '../../../../common/utils/logger.js';
import { PDF_VIEWER_EVENTS } from '../../../../common/event/pdf-viewer-constants.js';
import { debounce } from '../utils/debounce.js';
import { validateSearchQuery } from '../utils/search-validator.js';

/**
 * 搜索框组件类
 * 负责创建和管理搜索框UI，处理用户输入和交互
 * @class SearchBox
 */
export class SearchBox {
  /** @type {import('../../../../common/utils/logger.js').Logger} */
  #logger = getLogger('SearchBox');

  /** @type {import('../../../types/events').EventBus} */
  #eventBus = null;

  /** @type {HTMLElement} 搜索框容器 */
  #container = null;

  /** @type {HTMLInputElement} 搜索输入框 */
  #searchInput = null;

  /** @type {HTMLButtonElement} 上一个按钮 */
  #prevButton = null;

  /** @type {HTMLButtonElement} 下一个按钮 */
  #nextButton = null;

  /** @type {HTMLButtonElement} 关闭按钮 */
  #closeButton = null;

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

  /**
   * 构造函数
   * @param {import('../../../types/events').EventBus} eventBus - 事件总线
   */
  constructor(eventBus) {
    if (!eventBus) {
      throw new Error('EventBus is required for SearchBox');
    }

    this.#eventBus = eventBus;
    this.#logger.info('SearchBox created');
  }

  /**
   * 初始化搜索框
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.#initialized) {
      this.#logger.warn('SearchBox already initialized');
      return;
    }

    this.#logger.info('Initializing SearchBox...');

    // 创建搜索框DOM
    this.#createDOM();

    // 绑定事件监听器
    this.#attachEventListeners();

    // 设置防抖搜索函数
    this.#debouncedSearch = debounce((query, options) => {
      this.#handleSearch(query, options);
    }, 300);

    // 监听应用事件
    this.#setupAppEventListeners();

    this.#initialized = true;
    this.#logger.info('SearchBox initialized');
  }

  /**
   * 创建搜索框DOM结构
   * @private
   */
  #createDOM() {
    // 创建容器
    this.#container = document.createElement('div');
    this.#container.id = 'pdf-search-box';
    this.#container.className = 'pdf-search-box hidden';
    this.#container.setAttribute('role', 'search');
    this.#container.setAttribute('aria-label', 'PDF搜索');

    // 创建HTML结构
    this.#container.innerHTML = `
      <div class="search-box-main">
        <input
          type="text"
          id="pdf-search-input"
          class="search-input"
          placeholder="搜索PDF..."
          aria-label="搜索关键词"
          autocomplete="off"
        />

        <div class="search-controls">
          <button
            id="pdf-search-prev"
            class="search-btn search-btn-prev"
            title="上一个 (Shift+Enter)"
            aria-label="上一个搜索结果"
          >
            <span class="icon">▲</span>
          </button>

          <button
            id="pdf-search-next"
            class="search-btn search-btn-next"
            title="下一个 (Enter)"
            aria-label="下一个搜索结果"
          >
            <span class="icon">▼</span>
          </button>

          <span
            id="pdf-search-counter"
            class="search-counter"
            aria-live="polite"
            aria-atomic="true"
          >0/0</span>

          <button
            id="pdf-search-close"
            class="search-btn search-btn-close"
            title="关闭 (Esc)"
            aria-label="关闭搜索"
          >
            <span class="icon">✕</span>
          </button>
        </div>
      </div>

      <div class="search-box-options">
        <label class="search-option">
          <input
            type="checkbox"
            id="pdf-search-case-sensitive"
            class="search-checkbox"
          />
          <span>区分大小写</span>
        </label>

        <label class="search-option">
          <input
            type="checkbox"
            id="pdf-search-whole-words"
            class="search-checkbox"
          />
          <span>全词匹配</span>
        </label>
      </div>
    `;

    // 插入到页面
    document.body.appendChild(this.#container);

    // 获取DOM元素引用
    this.#searchInput = document.getElementById('pdf-search-input');
    this.#prevButton = document.getElementById('pdf-search-prev');
    this.#nextButton = document.getElementById('pdf-search-next');
    this.#closeButton = document.getElementById('pdf-search-close');
    this.#resultCounter = document.getElementById('pdf-search-counter');
    this.#caseSensitiveCheckbox = document.getElementById('pdf-search-case-sensitive');
    this.#wholeWordsCheckbox = document.getElementById('pdf-search-whole-words');

    this.#logger.info('DOM created successfully');
  }

  /**
   * 绑定DOM事件监听器
   * @private
   */
  #attachEventListeners() {
    // 搜索输入事件
    this.#searchInput.addEventListener('input', (e) => {
      const query = e.target.value;
      const options = this.#getCurrentOptions();

      // 使用防抖处理
      this.#debouncedSearch(query, options);
    });

    // Enter键 - 下一个结果
    this.#searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();

        if (e.shiftKey) {
          // Shift+Enter - 上一个
          this.#handlePrevClick();
        } else {
          // Enter - 下一个
          this.#handleNextClick();
        }
      } else if (e.key === 'Escape') {
        // Esc - 关闭
        this.#handleCloseClick();
      }
    });

    // 上一个按钮
    this.#prevButton.addEventListener('click', () => {
      this.#handlePrevClick();
    });

    // 下一个按钮
    this.#nextButton.addEventListener('click', () => {
      this.#handleNextClick();
    });

    // 关闭按钮
    this.#closeButton.addEventListener('click', () => {
      this.#handleCloseClick();
    });

    // 区分大小写复选框
    this.#caseSensitiveCheckbox.addEventListener('change', (e) => {
      this.#handleOptionChange('caseSensitive', e.target.checked);
    });

    // 全词匹配复选框
    this.#wholeWordsCheckbox.addEventListener('change', (e) => {
      this.#handleOptionChange('wholeWords', e.target.checked);
    });

    // Header上的搜索按钮
    this.#attachHeaderSearchButton();

    this.#logger.info('Event listeners attached');
  }

  /**
   * 绑定header中搜索按钮的事件
   * @private
   */
  #attachHeaderSearchButton() {
    this.#logger.info('[DEBUG] Attempting to attach search button...');
    this.#logger.info('[DEBUG] document.readyState:', document.readyState);
    this.#logger.info('[DEBUG] document.body exists:', !!document.body);

    const searchToggleBtn = document.getElementById('search-toggle-btn');

    this.#logger.info('[DEBUG] Button element found:', !!searchToggleBtn);
    this.#logger.info('[DEBUG] Button:', searchToggleBtn);

    if (searchToggleBtn) {
      searchToggleBtn.addEventListener('click', () => {
        this.#logger.info('Header search button clicked');
        this.toggle();
      });
      this.#logger.info('Header search button listener attached successfully');
    } else {
      this.#logger.error('❌ Header search button NOT FOUND (#search-toggle-btn)');

      // 列出所有button元素的id
      const allButtons = document.querySelectorAll('button[id]');
      this.#logger.info('[DEBUG] All buttons with id:', Array.from(allButtons).map(b => b.id));
    }
  }

  /**
   * 设置应用级事件监听器
   * @private
   */
  #setupAppEventListeners() {
    // 监听搜索结果更新
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.SEARCH.RESULT.UPDATED,
      ({ current, total }) => {
        this.updateResultCounter(current, total);
      },
      { subscriberId: 'SearchBox' }
    );

    // 监听搜索结果找到
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.SEARCH.RESULT.FOUND,
      ({ current, total }) => {
        this.updateResultCounter(current, total);
      },
      { subscriberId: 'SearchBox' }
    );

    // 监听搜索结果未找到
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.SEARCH.RESULT.NOT_FOUND,
      () => {
        this.updateResultCounter(0, 0);
      },
      { subscriberId: 'SearchBox' }
    );

    // 监听打开搜索框事件
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.SEARCH.UI.OPEN,
      () => {
        this.show();
      },
      { subscriberId: 'SearchBox' }
    );

    // 监听关闭搜索框事件
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.SEARCH.UI.CLOSE,
      () => {
        this.hide();
      },
      { subscriberId: 'SearchBox' }
    );

    // 监听切换搜索框事件
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.SEARCH.UI.TOGGLE,
      () => {
        this.toggle();
      },
      { subscriberId: 'SearchBox' }
    );

    this.#logger.info('App event listeners attached');
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
        this.#logger.warn('Invalid search query:', validation.error);
      }
      // 清空结果显示
      this.updateResultCounter(0, 0);
      return;
    }

    this.#logger.info(`Searching for: "${validation.cleaned}"`);

    // 发出搜索事件
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.SEARCH.EXECUTE.QUERY,
      {
        query: validation.cleaned,
        options,
      },
      { actorId: 'SearchBox' }
    );
  }

  /**
   * 处理"上一个"按钮点击
   * @private
   */
  #handlePrevClick() {
    this.#logger.info('Previous button clicked');

    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.SEARCH.NAVIGATE.PREV,
      {},
      { actorId: 'SearchBox' }
    );
  }

  /**
   * 处理"下一个"按钮点击
   * @private
   */
  #handleNextClick() {
    this.#logger.info('Next button clicked');

    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.SEARCH.NAVIGATE.NEXT,
      {},
      { actorId: 'SearchBox' }
    );
  }

  /**
   * 处理"关闭"按钮点击
   * @private
   */
  #handleCloseClick() {
    this.#logger.info('Close button clicked');
    this.hide();
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
      { actorId: 'SearchBox' }
    );

    // 如果有活跃的搜索，重新执行
    const query = this.#searchInput.value.trim();
    if (query.length > 0) {
      const options = this.#getCurrentOptions();
      this.#handleSearch(query, options);
    }
  }

  /**
   * 显示搜索框
   */
  show() {
    if (this.#isVisible) {
      return;
    }

    this.#logger.info('Showing search box');

    this.#container.classList.remove('hidden');
    this.#searchInput.focus();
    this.#searchInput.select();
    this.#isVisible = true;
  }

  /**
   * 隐藏搜索框
   */
  hide() {
    if (!this.#isVisible) {
      return;
    }

    this.#logger.info('Hiding search box');

    this.#container.classList.add('hidden');
    this.#isVisible = false;

    // 清空搜索（发出清空事件）
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.SEARCH.EXECUTE.CLEAR,
      {},
      { actorId: 'SearchBox' }
    );
  }

  /**
   * 切换显示/隐藏
   */
  toggle() {
    if (this.#isVisible) {
      this.hide();
    } else {
      this.show();
    }
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

    const text = total > 0 ? `${current}/${total}` : '0/0';
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
    if (this.#searchInput) {
      this.#searchInput.value = query || '';
    }
  }

  /**
   * 获取搜索输入框的值
   * @returns {string}
   */
  getQuery() {
    return this.#searchInput ? this.#searchInput.value : '';
  }

  /**
   * 销毁搜索框
   */
  destroy() {
    this.#logger.info('Destroying SearchBox');

    // 移除DOM
    if (this.#container && this.#container.parentNode) {
      this.#container.parentNode.removeChild(this.#container);
    }

    // 清空引用
    this.#container = null;
    this.#searchInput = null;
    this.#prevButton = null;
    this.#nextButton = null;
    this.#closeButton = null;
    this.#resultCounter = null;
    this.#caseSensitiveCheckbox = null;
    this.#wholeWordsCheckbox = null;
    this.#debouncedSearch = null;
    this.#eventBus = null;

    this.#initialized = false;
    this.#isVisible = false;

    this.#logger.info('SearchBox destroyed');
  }
}
