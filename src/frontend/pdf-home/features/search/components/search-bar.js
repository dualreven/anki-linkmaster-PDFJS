/**
 * 搜索框UI组件
 * 负责渲染搜索输入框和相关按钮
 */

export class SearchBar {
  // 轻量依赖：用于显示“搜索中”提示
  // 注意：相对路径从 features/search/components 到 common/utils
  // 路径计算：components -> search -> features -> pdf-home -> frontend -> common
  
  #logger = null;
  #eventBus = null;
  #container = null;
  #searchInput = null;
  #searchBtn = null;
  #clearBtn = null;
  #addBtn = null;
  #sortBtn = null;
  #advancedBtn = null;
  #savePresetBtn = null;
  #statsDisplay = null;
  #config = null;
  #presetDialog = null;
  #presetNameInput = null;

  constructor(logger, eventBus, config = {}) {
    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#config = {
      debounceDelay: 300,
      enableLiveSearch: true,
      placeholder: '输入关键词（空格=且）搜索PDF（标题、作者、文件名、标签、备注、主题、关键词）...',
      ...config
    };
  }

  /**
   * 渲染搜索栏
   * @param {HTMLElement} container - 容器元素
   */
  render(container) {
    this.#container = container;
    this.#container.innerHTML = this.#getTemplate();
    this.#bindElements();
    this.#attachEventListeners();
    this.#createPresetDialog();

    this.#logger.info('[SearchBar] Rendered');
  }

  /**
   * 获取HTML模板
   * @private
   */
  #getTemplate() {
    return `
      <div class="search-bar">
        <button id="add-pdf-btn" title="添加PDF文件">
          ＋添加
        </button>
        <div class="search-input-wrapper">
          <input
            type="text"
            class="search-input"
            placeholder="${this.#config.placeholder}"
            autocomplete="off"
          />
          <button class="clear-search-btn" title="清除搜索" style="display: none;">
            ✕
          </button>
        </div>
        <div class="search-controls-right">
          <button class="search-btn" title="执行搜索">
            🔍 搜索
          </button>
          <button class="advanced-filter-btn" title="高级筛选">
            🎚️ 高级
          </button>
          <button class="save-preset-btn" title="保存搜索条件">
            💾 保存条件
          </button>
          <button id="sort-btn" title="排序PDF列表">
            🔃 排序
          </button>
        </div>
        <div class="search-stats" style="display: none;">
          找到 <span class="result-count">0</span> 个结果
        </div>
      </div>
    `;
  }

  /**
   * 绑定DOM元素
   * @private
   */
  #bindElements() {
    this.#searchInput = this.#container.querySelector('.search-input');
    this.#searchBtn = this.#container.querySelector('.search-btn');
    this.#clearBtn = this.#container.querySelector('.clear-search-btn');
    this.#addBtn = this.#container.querySelector('#add-pdf-btn');
    this.#sortBtn = this.#container.querySelector('#sort-btn');
    this.#advancedBtn = this.#container.querySelector('.advanced-filter-btn');
    this.#savePresetBtn = this.#container.querySelector('.save-preset-btn');
    this.#statsDisplay = this.#container.querySelector('.search-stats');
  }

  /**
   * 附加事件监听
   * @private
   */
  #attachEventListeners() {
    // 搜索输入 - 实时搜索（可配置）
    if (this.#config.enableLiveSearch) {
      let searchTimeout = null;
      this.#searchInput.addEventListener('input', (e) => {
        const searchText = e.target.value.trim();

        // 防抖处理
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.#handleSearch(searchText);
        }, this.#config.debounceDelay);

        // 显示/隐藏清除按钮
        this.#clearBtn.style.display = searchText ? 'block' : 'none';
      });

      // Enter键触发立即搜索
      this.#searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          clearTimeout(searchTimeout);
          this.#handleSearch(e.target.value.trim());
        }
      });
    }

    // 搜索按钮
    this.#searchBtn.addEventListener('click', () => {
      const searchText = this.#searchInput.value.trim();
      this.#handleSearch(searchText);
    });

    // 清除按钮
    this.#clearBtn.addEventListener('click', () => {
      this.#searchInput.value = '';
      this.#clearBtn.style.display = 'none';
      this.#handleClear();
    });

    // 添加按钮
    this.#addBtn.addEventListener('click', () => {
      this.#logger.info('[SearchBar] Add button clicked');
      this.#eventBus.emit('search:add:requested');
    });

    // 排序按钮
    this.#sortBtn.addEventListener('click', () => {
      this.#logger.info('[SearchBar] Sort button clicked');
      this.#eventBus.emit('search:sort:requested');
    });

    // 高级筛选按钮
    this.#advancedBtn.addEventListener('click', () => {
      this.#logger.info('[SearchBar] Advanced filter button clicked');
      this.#eventBus.emit('search:advanced:clicked');
    });

    // 保存条件按钮
    this.#savePresetBtn.addEventListener('click', () => {
      this.#logger.info('[SearchBar] Save preset button clicked');
      this.#showPresetDialog();
    });
  }

  /**
   * 创建预设保存弹窗（挂载到body）
   * @private
   */
  #createPresetDialog() {
    const dialogHTML = `
      <div class="preset-save-dialog" hidden>
        <div class="preset-dialog-overlay"></div>
        <div class="preset-dialog-content">
          <div class="preset-dialog-header">
            <h3>💾 保存为预设</h3>
            <button class="preset-dialog-close" aria-label="关闭">&times;</button>
          </div>
          <div class="preset-dialog-body">
            <label for="preset-name-input">预设名称:</label>
            <input
              type="text"
              id="preset-name-input"
              class="preset-name-input"
              placeholder="请输入预设名称..."
              autocomplete="off"
            />
            <div class="preset-description">
              <small>保存当前的搜索关键词和筛选条件</small>
            </div>
          </div>
          <div class="preset-dialog-footer">
            <button class="preset-dialog-cancel">取消</button>
            <button class="preset-dialog-save">保存</button>
          </div>
        </div>
      </div>
    `;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = dialogHTML.trim();
    this.#presetDialog = tempDiv.firstChild;
    document.body.appendChild(this.#presetDialog);

    this.#presetNameInput = this.#presetDialog.querySelector('.preset-name-input');

    // 绑定弹窗事件
    this.#bindDialogEvents();
  }

  /**
   * 绑定弹窗事件
   * @private
   */
  #bindDialogEvents() {
    // 弹窗关闭按钮
    const closeBtn = this.#presetDialog.querySelector('.preset-dialog-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.#hidePresetDialog();
      });
    }

    // 弹窗取消按钮
    const cancelBtn = this.#presetDialog.querySelector('.preset-dialog-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.#hidePresetDialog();
      });
    }

    // 弹窗保存按钮
    const saveBtn = this.#presetDialog.querySelector('.preset-dialog-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.#handlePresetSave();
      });
    }

    // 弹窗遮罩层点击关闭
    const overlay = this.#presetDialog.querySelector('.preset-dialog-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        this.#hidePresetDialog();
      });
    }

    // Enter键保存
    if (this.#presetNameInput) {
      this.#presetNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.#handlePresetSave();
        }
      });
    }
  }

  /**
   * 显示预设保存弹窗
   * @private
   */
  #showPresetDialog() {
    this.#presetDialog.hidden = false;
    this.#presetNameInput.value = '';
    // 聚焦输入框
    setTimeout(() => {
      this.#presetNameInput.focus();
    }, 100);
    this.#logger.info('[SearchBar] Preset dialog shown');
  }

  /**
   * 隐藏预设保存弹窗
   * @private
   */
  #hidePresetDialog() {
    this.#presetDialog.hidden = true;
    this.#presetNameInput.value = '';
    this.#logger.info('[SearchBar] Preset dialog hidden');
  }

  /**
   * 处理预设保存
   * @private
   */
  #handlePresetSave() {
    const presetName = this.#presetNameInput.value.trim();

    if (!presetName) {
      alert('请输入预设名称');
      return;
    }

    this.#logger.info('[SearchBar] Save preset requested', { presetName });
    this.#eventBus.emit('search:preset:save', { presetName });

    this.#hidePresetDialog();
  }

  /**
   * 处理搜索
   * @private
   */
  #handleSearch(searchText) {
    // 空搜索也是有效的搜索，应该显示所有记录
    this.#logger.info('[SearchBar] Search triggered', { searchText: searchText || '(empty)' });
    // 提示展示统一交给 SearchFeature 在 'search:query:started' 事件中处理
    this.#eventBus.emit('search:query:requested', { searchText: searchText || '' });
  }

  /**
   * 处理清除
   * @private
   */
  #handleClear() {
    this.#logger.info('[SearchBar] Clear triggered');
    this.#eventBus.emit('search:clear:requested');
    this.updateStats(null);
  }

  /**
   * 更新统计信息显示
   * @param {Object} stats - 统计信息 {count, hasResults}
   */
  updateStats(stats) {
    if (!stats || !stats.hasResults) {
      this.#statsDisplay.style.display = 'none';
      return;
    }

    const resultCountSpan = this.#statsDisplay.querySelector('.result-count');
    resultCountSpan.textContent = stats.count;
    this.#statsDisplay.style.display = 'block';
  }

  /**
   * 设置搜索文本（编程式设置）
   * @param {string} text
   */
  setSearchText(text) {
    this.#searchInput.value = text;
    this.#clearBtn.style.display = text ? 'block' : 'none';
  }

  /**
   * 获取当前搜索文本
   * @returns {string}
   */
  getSearchText() {
    return this.#searchInput.value.trim();
  }

  /**
   * 聚焦搜索框
   */
  focus() {
    this.#searchInput.focus();
  }

  /**
   * 销毁组件
   */
  destroy() {
    if (this.#container) {
      this.#container.innerHTML = '';
    }

    // 移除弹窗
    if (this.#presetDialog) {
      this.#presetDialog.remove();
      this.#presetDialog = null;
      this.#presetNameInput = null;
    }

    this.#logger.info('[SearchBar] Destroyed');
  }
}
