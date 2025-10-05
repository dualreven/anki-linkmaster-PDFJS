/**
 * 简单搜索框UI组件
 */

export class FilterSearchBar {
  #logger = null;
  #eventBus = null;
  #container = null;
  #searchInput = null;
  #searchBtn = null;
  #clearBtn = null;
  #advancedBtn = null;
  #savePresetBtn = null;
  #statsDisplay = null;
  #callbacks = null;
  #presetDialog = null;
  #presetNameInput = null;

  constructor(logger, eventBus, callbacks = {}) {
    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#callbacks = callbacks;
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

    this.#logger.info('[FilterSearchBar] Rendered');
  }

  /**
   * 获取HTML模板
   * @private
   */
  #getTemplate() {
    return `
      <div class="filter-search-bar">
        <button id="add-pdf-btn" class="btn primary" title="添加PDF文件">
          ＋添加
        </button>
        <div class="search-input-wrapper">
          <input
            type="text"
            class="search-input"
            placeholder="输入关键词搜索PDF（文件名、标签、备注）..."
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
          <button id="sort-btn" class="btn" title="排序PDF列表">
            🔃 排序
          </button>
        </div>
        <div class="filter-stats" style="display: none;">
          找到 <span class="result-count">0</span> 个结果
        </div>
      </div>
    `;
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
   * 绑定DOM元素
   * @private
   */
  #bindElements() {
    this.#searchInput = this.#container.querySelector('.search-input');
    this.#searchBtn = this.#container.querySelector('.search-btn');
    this.#clearBtn = this.#container.querySelector('.clear-search-btn');
    this.#advancedBtn = this.#container.querySelector('.advanced-filter-btn');
    this.#savePresetBtn = this.#container.querySelector('.save-preset-btn');
    this.#statsDisplay = this.#container.querySelector('.filter-stats');
  }

  /**
   * 附加事件监听
   * @private
   */
  #attachEventListeners() {
    // 搜索输入 - 实时搜索（可选，保留原有功能）
    let searchTimeout = null;
    this.#searchInput.addEventListener('input', (e) => {
      const searchText = e.target.value.trim();

      // 防抖处理
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.#handleSearch(searchText);
      }, 300);

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

    // 高级筛选按钮
    this.#advancedBtn.addEventListener('click', () => {
      this.#handleAdvancedFilter();
    });

    // 保存预设按钮
    this.#savePresetBtn.addEventListener('click', () => {
      this.#showPresetDialog();
    });
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
   * 处理搜索
   * @private
   */
  #handleSearch(searchText) {
    if (!searchText) {
      this.#handleClear();
      return;
    }

    this.#logger.info('[FilterSearchBar] Search triggered', { searchText });
    this.#eventBus.emit('filter:search:requested', { searchText });
  }

  /**
   * 处理清除
   * @private
   */
  #handleClear() {
    this.#logger.info('[FilterSearchBar] Clear triggered');
    this.#eventBus.emit('filter:clear:requested');
    this.updateStats(null);
  }

  /**
   * 处理高级筛选
   * @private
   */
  #handleAdvancedFilter() {
    this.#logger.info('[FilterSearchBar] Advanced filter triggered');

    // 优先使用回调函数
    if (this.#callbacks.onAdvancedClick) {
      this.#callbacks.onAdvancedClick();
    } else {
      // 回退到事件机制
      this.#eventBus.emit('filter:advanced:open');
    }
  }

  /**
   * 更新统计信息显示
   * @param {Object} stats - 统计信息 {filteredCount, originalCount}
   */
  updateStats(stats) {
    if (!stats || !stats.hasFilter) {
      this.#statsDisplay.style.display = 'none';
      return;
    }

    const resultCountSpan = this.#statsDisplay.querySelector('.result-count');
    resultCountSpan.textContent = stats.filteredCount;
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
    this.#logger.info('[FilterSearchBar] Preset dialog shown');
  }

  /**
   * 隐藏预设保存弹窗
   * @private
   */
  #hidePresetDialog() {
    this.#presetDialog.hidden = true;
    this.#presetNameInput.value = '';
    this.#logger.info('[FilterSearchBar] Preset dialog hidden');
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

    this.#logger.info('[FilterSearchBar] Save preset requested', { presetName });

    // TODO: 实现保存逻辑
    console.log('保存预设:', presetName);

    this.#hidePresetDialog();
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

    this.#logger.info('[FilterSearchBar] Destroyed');
  }
}
