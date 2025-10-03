/**
 * @file 排序面板主组件
 * @module features/pdf-sorter/components/sorter-panel
 * @description
 * 排序面板容器组件，负责整体布局和子组件协调
 * 参考 filter 功能的面板设计，吸附在 header 下方
 */

/**
 * 排序面板UI组件
 * @class SorterPanel
 */
export class SorterPanel {
  /**
   * 日志记录器
   * @type {Logger}
   * @private
   */
  #logger = null;

  /**
   * 作用域事件总线
   * @type {ScopedEventBus}
   * @private
   */
  #eventBus = null;

  /**
   * 面板DOM容器
   * @type {HTMLElement|null}
   * @private
   */
  #panel = null;

  /**
   * 模式选择器容器
   * @type {HTMLElement|null}
   * @private
   */
  #modeSelectorContainer = null;

  /**
   * 多级排序构建器容器
   * @type {HTMLElement|null}
   * @private
   */
  #multiSortContainer = null;

  /**
   * 加权排序编辑器容器
   * @type {HTMLElement|null}
   * @private
   */
  #weightedSortContainer = null;

  /**
   * ESC键处理器
   * @type {Function|null}
   * @private
   */
  #escKeyHandler = null;

  /**
   * 事件取消订阅函数列表
   * @type {Function[]}
   * @private
   */
  #unsubscribers = [];

  /**
   * 构造函数
   * @param {Logger} logger - 日志记录器
   * @param {ScopedEventBus} eventBus - 作用域事件总线
   */
  constructor(logger, eventBus) {
    this.#logger = logger;
    this.#eventBus = eventBus;
  }

  /**
   * 渲染面板
   * @public
   */
  render() {
    this.#createPanelDOM();
    this.#attachEventListeners();

    // 初始化时，默认隐藏所有配置区（等待模式选择器触发事件）
    this.#multiSortContainer.style.display = 'none';
    this.#weightedSortContainer.style.display = 'none';

    this.#logger.info('[SorterPanel] Rendered');
  }

  /**
   * 创建面板DOM结构
   * @private
   */
  #createPanelDOM() {
    this.#panel = document.createElement('div');
    this.#panel.className = 'sorter-panel';
    this.#panel.innerHTML = this.#getTemplate();

    // 插入到header之后（与filter面板相同的位置逻辑）
    const header = document.querySelector('header');
    if (header && header.nextSibling) {
      header.parentNode.insertBefore(this.#panel, header.nextSibling);
    } else if (header) {
      header.parentNode.appendChild(this.#panel);
    } else {
      document.body.insertBefore(this.#panel, document.body.firstChild);
    }

    // 绑定容器引用
    this.#modeSelectorContainer = this.#panel.querySelector('.sorter-mode-selector-container');
    this.#multiSortContainer = this.#panel.querySelector('.sorter-multi-sort-container');
    this.#weightedSortContainer = this.#panel.querySelector('.sorter-weighted-sort-container');

    this.#logger.debug('[SorterPanel] DOM created and inserted');
  }

  /**
   * 获取HTML模板
   * @returns {string}
   * @private
   */
  #getTemplate() {
    return `
      <div class="sorter-panel-content">
        <!-- 排序模式选择器 -->
        <div class="sorter-mode-selector-container"></div>

        <!-- 多级排序配置区（默认显示） -->
        <div class="sorter-multi-sort-container"></div>

        <!-- 加权排序配置区（默认隐藏） -->
        <div class="sorter-weighted-sort-container" style="display: none;"></div>
      </div>
    `;
  }

  /**
   * 附加事件监听
   * @private
   */
  #attachEventListeners() {
    console.log('[DEBUG SorterPanel] #attachEventListeners called');
    console.log('[DEBUG SorterPanel] #eventBus:', this.#eventBus);

    // ESC键关闭面板
    this.#escKeyHandler = (e) => {
      if (e.key === 'Escape' && this.#panel.classList.contains('active')) {
        this.hide();
      }
    };
    document.addEventListener('keydown', this.#escKeyHandler);

    // 监听排序模式切换事件（三段式格式）
    // 关键修复：指定唯一的 subscriberId 避免被其他订阅者覆盖
    console.log('[DEBUG SorterPanel] About to subscribe to sorter:mode:changed');
    const unsubModeChanged = this.#eventBus.on('sorter:mode:changed', (data) => {
      console.log('[DEBUG SorterPanel] sorter:mode:changed event received:', data);
      this.#handleModeChange(data.mode);
    }, {
      subscriberId: 'SorterPanel.modeChanged'
    });
    console.log('[DEBUG SorterPanel] Unsubscribe function:', unsubModeChanged);
    this.#unsubscribers.push(unsubModeChanged);

    this.#logger.debug('[SorterPanel] Event listeners attached');
    console.log('[DEBUG SorterPanel] Event listeners attached, unsubscribers count:', this.#unsubscribers.length);
  }

  /**
   * 处理排序模式切换
   * @param {number} mode - 排序模式 (0=默认, 1=拖拽, 2=多级, 3=加权)
   * @private
   */
  #handleModeChange(mode) {
    console.log('[DEBUG SorterPanel] #handleModeChange called with mode:', mode);
    this.#logger.info(`[SorterPanel] Mode changed to: ${mode}`);

    console.log('[DEBUG SorterPanel] Before hide - multiSortContainer.display:', this.#multiSortContainer?.style.display);
    console.log('[DEBUG SorterPanel] Before hide - weightedSortContainer.display:', this.#weightedSortContainer?.style.display);

    // 隐藏所有配置区
    this.#multiSortContainer.style.display = 'none';
    this.#weightedSortContainer.style.display = 'none';

    // 根据模式显示对应配置区
    switch (mode) {
      case 0: // 默认排序 - 不显示任何配置
        console.log('[DEBUG SorterPanel] Mode 0: Hiding all configs');
        break;
      case 1: // 手动拖拽 - 不显示任何配置
        console.log('[DEBUG SorterPanel] Mode 1: Hiding all configs');
        break;
      case 2: // 多级排序
        console.log('[DEBUG SorterPanel] Mode 2: Showing multi-sort config');
        this.#multiSortContainer.style.display = 'block';
        break;
      case 3: // 加权排序
        console.log('[DEBUG SorterPanel] Mode 3: Showing weighted-sort config');
        this.#weightedSortContainer.style.display = 'block';
        break;
      default:
        this.#logger.warn(`[SorterPanel] Unknown mode: ${mode}`);
    }

    console.log('[DEBUG SorterPanel] After change - multiSortContainer.display:', this.#multiSortContainer?.style.display);
    console.log('[DEBUG SorterPanel] After change - weightedSortContainer.display:', this.#weightedSortContainer?.style.display);
  }

  /**
   * 显示面板
   * @public
   */
  show() {
    this.#panel.classList.add('active');
    this.#adjustTablePosition(true);
    this.#logger.info('[SorterPanel] Panel shown');

    // 触发面板显示事件（三段式格式）
    this.#eventBus.emit('sorter:panel:shown', {});
  }

  /**
   * 隐藏面板
   * @public
   */
  hide() {
    this.#panel.classList.remove('active');
    this.#adjustTablePosition(false);
    this.#logger.info('[SorterPanel] Panel hidden');

    // 触发面板隐藏事件（三段式格式）
    this.#eventBus.emit('sorter:panel:hidden', {});
  }

  /**
   * 切换面板显示/隐藏
   * @public
   */
  toggle() {
    if (this.#panel.classList.contains('active')) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * 调整表格位置避免被面板遮挡
   * @param {boolean} show - true显示面板，false隐藏面板
   * @private
   */
  #adjustTablePosition(show) {
    const tableContainer = document.getElementById('pdf-table-container');
    if (!tableContainer) {
      this.#logger.warn('[SorterPanel] Table container not found');
      return;
    }

    if (show) {
      // 面板高度动态计算，但至少保留150px
      tableContainer.style.marginTop = '150px';
      tableContainer.style.transition = 'margin-top 0.3s ease';
    } else {
      // 恢复原始margin
      tableContainer.style.marginTop = '0';
    }
  }

  /**
   * 获取模式选择器容器
   * @returns {HTMLElement}
   * @public
   */
  getModeSelectorContainer() {
    return this.#modeSelectorContainer;
  }

  /**
   * 获取多级排序容器
   * @returns {HTMLElement}
   * @public
   */
  getMultiSortContainer() {
    return this.#multiSortContainer;
  }

  /**
   * 获取加权排序容器
   * @returns {HTMLElement}
   * @public
   */
  getWeightedSortContainer() {
    return this.#weightedSortContainer;
  }

  /**
   * 销毁组件
   * @public
   */
  destroy() {
    // 取消事件订阅
    this.#unsubscribers.forEach(unsub => unsub());
    this.#unsubscribers = [];

    // 移除ESC键监听
    if (this.#escKeyHandler) {
      document.removeEventListener('keydown', this.#escKeyHandler);
      this.#escKeyHandler = null;
    }

    // 移除DOM
    if (this.#panel) {
      this.#panel.remove();
      this.#panel = null;
    }

    this.#logger.info('[SorterPanel] Destroyed');
  }
}
