/**
 * 侧边栏面板组件
 * 包含三个section：最近搜索、最近阅读、最近添加
 */

export class SidebarPanel {
  #logger = null;
  #eventBus = null;
  #container = null;
  #recentSearches = [];
  #recentOpened = [];
  #recentAdded = [];

  constructor(logger, eventBus) {
    this.#logger = logger;
    this.#eventBus = eventBus;
  }

  /**
   * 渲染侧边栏
   * @param {HTMLElement} container - 容器元素
   */
  render(container) {
    this.#container = container;
    this.#container.innerHTML = this.#getTemplate();
    this.#attachEventListeners();
    this.#logger.info('[SidebarPanel] Rendered');
  }

  /**
   * 获取HTML模板
   * @private
   */
  #getTemplate() {
    return `
      <div class="sidebar-panel">
        <!-- 最近搜索关键词 -->
        <div class="sidebar-section">
          <h3 class="sidebar-section-title">
            <span>🔍 最近搜索</span>
          </h3>
          <ul class="sidebar-list" id="recent-searches-list">
            ${this.#renderSearches()}
          </ul>
        </div>

        <!-- 最近阅读书籍 -->
        <div class="sidebar-section">
          <h3 class="sidebar-section-title">
            <span>📖 最近阅读</span>
          </h3>
          <ul class="sidebar-list" id="recent-opened-list">
            ${this.#renderOpened()}
          </ul>
        </div>

        <!-- 最近添加书籍 -->
        <div class="sidebar-section">
          <h3 class="sidebar-section-title">
            <span>➕ 最近添加</span>
          </h3>
          <ul class="sidebar-list" id="recent-added-list">
            ${this.#renderAdded()}
          </ul>
        </div>
      </div>
    `;
  }

  /**
   * 渲染最近搜索列表
   * @private
   */
  #renderSearches() {
    if (this.#recentSearches.length === 0) {
      return '<li class="sidebar-empty">暂无搜索记录</li>';
    }

    return this.#recentSearches
      .map((search, index) => `
        <li class="sidebar-item" data-type="search" data-index="${index}">
          <span class="sidebar-item-icon">🔍</span>
          <span class="sidebar-item-text" title="${this.#escapeHtml(search.text)}">
            ${this.#escapeHtml(search.text)}
          </span>
          <span class="sidebar-item-time">${this.#formatTime(search.timestamp)}</span>
        </li>
      `)
      .join('');
  }

  /**
   * 渲染最近阅读列表
   * @private
   */
  #renderOpened() {
    if (this.#recentOpened.length === 0) {
      return '<li class="sidebar-empty">暂无阅读记录</li>';
    }

    return this.#recentOpened
      .map((pdf, index) => `
        <li class="sidebar-item" data-type="opened" data-index="${index}">
          <span class="sidebar-item-icon">📄</span>
          <span class="sidebar-item-text" title="${this.#escapeHtml(pdf.filename)}">
            ${this.#escapeHtml(pdf.filename)}
          </span>
          <span class="sidebar-item-time">${this.#formatTime(pdf.timestamp)}</span>
        </li>
      `)
      .join('');
  }

  /**
   * 渲染最近添加列表
   * @private
   */
  #renderAdded() {
    if (this.#recentAdded.length === 0) {
      return '<li class="sidebar-empty">暂无添加记录</li>';
    }

    return this.#recentAdded
      .map((pdf, index) => `
        <li class="sidebar-item" data-type="added" data-index="${index}">
          <span class="sidebar-item-icon">📄</span>
          <span class="sidebar-item-text" title="${this.#escapeHtml(pdf.filename)}">
            ${this.#escapeHtml(pdf.filename)}
          </span>
          <span class="sidebar-item-time">${this.#formatTime(pdf.timestamp)}</span>
        </li>
      `)
      .join('');
  }

  /**
   * 附加事件监听
   * @private
   */
  #attachEventListeners() {
    // 监听搜索项点击
    const searchList = this.#container.querySelector('#recent-searches-list');
    if (searchList) {
      searchList.addEventListener('click', (e) => {
        const item = e.target.closest('.sidebar-item');
        if (item && item.dataset.type === 'search') {
          const index = parseInt(item.dataset.index);
          const search = this.#recentSearches[index];
          if (search) {
            this.#logger.info('[SidebarPanel] Search clicked:', search.text);
            this.#eventBus.emit('search:clicked', { searchText: search.text });
          }
        }
      });
    }

    // 监听阅读项点击
    const openedList = this.#container.querySelector('#recent-opened-list');
    if (openedList) {
      openedList.addEventListener('click', (e) => {
        const item = e.target.closest('.sidebar-item');
        if (item && item.dataset.type === 'opened') {
          const index = parseInt(item.dataset.index);
          const pdf = this.#recentOpened[index];
          if (pdf) {
            this.#logger.info('[SidebarPanel] PDF clicked:', pdf.filename);
            this.#eventBus.emit('pdf:clicked', { filename: pdf.filename, path: pdf.path });
          }
        }
      });
    }

    // 监听添加项点击
    const addedList = this.#container.querySelector('#recent-added-list');
    if (addedList) {
      addedList.addEventListener('click', (e) => {
        const item = e.target.closest('.sidebar-item');
        if (item && item.dataset.type === 'added') {
          const index = parseInt(item.dataset.index);
          const pdf = this.#recentAdded[index];
          if (pdf) {
            this.#logger.info('[SidebarPanel] Added PDF clicked:', pdf.filename);
            this.#eventBus.emit('pdf:clicked', { filename: pdf.filename, path: pdf.path });
          }
        }
      });
    }
  }

  /**
   * 更新最近搜索列表
   * @param {Array} searches - 搜索记录数组
   */
  updateSearches(searches) {
    this.#recentSearches = searches;
    const list = this.#container?.querySelector('#recent-searches-list');
    if (list) {
      list.innerHTML = this.#renderSearches();
    }
  }

  /**
   * 更新最近阅读列表
   * @param {Array} pdfs - PDF记录数组
   */
  updateOpened(pdfs) {
    this.#recentOpened = pdfs;
    const list = this.#container?.querySelector('#recent-opened-list');
    if (list) {
      list.innerHTML = this.#renderOpened();
    }
  }

  /**
   * 更新最近添加列表
   * @param {Array} pdfs - PDF记录数组
   */
  updateAdded(pdfs) {
    this.#recentAdded = pdfs;
    const list = this.#container?.querySelector('#recent-added-list');
    if (list) {
      list.innerHTML = this.#renderAdded();
    }
  }

  /**
   * 格式化时间
   * @private
   */
  #formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;

    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  /**
   * HTML转义
   * @private
   */
  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 销毁组件
   */
  destroy() {
    if (this.#container) {
      this.#container.innerHTML = '';
    }
    this.#logger.info('[SidebarPanel] Destroyed');
  }
}
