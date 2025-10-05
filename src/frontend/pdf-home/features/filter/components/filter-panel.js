/**
 * 筛选面板UI组件
 * 提供高级筛选和保存条件按钮
 */

export class FilterPanel {
  #logger = null;
  #eventBus = null;
  #container = null;
  #advancedBtn = null;
  #savePresetBtn = null;
  #presetDialog = null;
  #presetNameInput = null;

  constructor(logger, eventBus) {
    this.#logger = logger;
    this.#eventBus = eventBus;
  }

  /**
   * 渲染筛选面板
   * @param {HTMLElement} container - 容器元素
   */
  render(container) {
    this.#container = container;
    this.#container.innerHTML = this.#getTemplate();
    this.#bindElements();
    this.#attachEventListeners();
    this.#createPresetDialog();

    this.#logger.info('[FilterPanel] Rendered');
  }

  /**
   * 获取HTML模板
   * @private
   */
  #getTemplate() {
    return `
      <div class="filter-panel">
        <button class="advanced-filter-btn" title="高级筛选">
          🎚️ 高级筛选
        </button>
        <button class="save-preset-btn" title="保存搜索条件">
          💾 保存条件
        </button>
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
    this.#advancedBtn = this.#container.querySelector('.advanced-filter-btn');
    this.#savePresetBtn = this.#container.querySelector('.save-preset-btn');
  }

  /**
   * 附加事件监听
   * @private
   */
  #attachEventListeners() {
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
   * 处理高级筛选
   * @private
   */
  #handleAdvancedFilter() {
    this.#logger.info('[FilterPanel] Advanced filter triggered');
    this.#eventBus.emit('filter:advanced:open');
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
    this.#logger.info('[FilterPanel] Preset dialog shown');
  }

  /**
   * 隐藏预设保存弹窗
   * @private
   */
  #hidePresetDialog() {
    this.#presetDialog.hidden = true;
    this.#presetNameInput.value = '';
    this.#logger.info('[FilterPanel] Preset dialog hidden');
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

    this.#logger.info('[FilterPanel] Save preset requested', { presetName });
    this.#eventBus.emit('filter:preset:save', { presetName });

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

    this.#logger.info('[FilterPanel] Destroyed');
  }
}
