/**
 * 侧边栏容器组件
 * 负责侧边栏的整体布局和收起/展开功能
 */

export class SidebarContainer {
  #logger = null;
  #eventBus = null;
  #container = null;

  constructor(logger, eventBus) {
    this.#logger = logger;
    this.#eventBus = eventBus;
  }

  /**
   * 渲染侧边栏容器
   * @param {HTMLElement} container - 容器元素
   */
  render(container) {
    this.#container = container;

    // 创建侧边栏面板结构
    this.#container.innerHTML = `
      <div class="sidebar-panel">
        <!-- 最近搜索区域 -->
        <div class="sidebar-section" id="recent-searches-section">
          <h3 class="sidebar-section-title">
            <span>🔍 最近搜索</span>
          </h3>
          <ul class="sidebar-list" id="recent-searches-list">
            <li class="sidebar-empty">暂无搜索记录</li>
          </ul>
        </div>

        <!-- 最近阅读区域 -->
        <div class="sidebar-section" id="recent-opened-section">
          <h3 class="sidebar-section-title">
            <span>📖 最近阅读</span>
          </h3>
          <ul class="sidebar-list" id="recent-opened-list">
            <li class="sidebar-empty">暂无阅读记录</li>
          </ul>
        </div>

        <!-- 最近添加区域 -->
        <div class="sidebar-section" id="recent-added-section">
          <h3 class="sidebar-section-title">
            <span>➕ 最近添加</span>
          </h3>
          <ul class="sidebar-list" id="recent-added-list">
            <li class="sidebar-empty">暂无添加记录</li>
          </ul>
        </div>
      </div>
    `;

    // 创建收起/展开按钮
    this.#createToggleButton();

    // 根据当前状态应用主内容布局（默认未折叠时应推开主内容，避免遮挡）
    const isCollapsed = this.#container.classList.contains('collapsed');
    this.#updateMainContentLayout(isCollapsed);

    this.#logger.info('[SidebarContainer] Rendered');
  }

  /**
   * 创建收起/展开按钮
   * @private
   */
  #createToggleButton() {
    // 检查按钮是否已存在
    if (document.getElementById('sidebar-toggle-btn')) {
      return;
    }

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'sidebar-toggle-btn';
    toggleBtn.className = 'sidebar-toggle-btn';
    toggleBtn.innerHTML = '◀';
    toggleBtn.title = '收起侧边栏';

    // 添加到body（fixed定位）
    document.body.appendChild(toggleBtn);

    // 绑定点击事件
    toggleBtn.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      const isCollapsed = sidebar.classList.contains('collapsed');

      if (isCollapsed) {
        sidebar.classList.remove('collapsed');
        toggleBtn.innerHTML = '◀';
        toggleBtn.title = '收起侧边栏';
        toggleBtn.classList.remove('collapsed');
        // 展开：推开右侧内容，避免遮挡搜索结果
        this.#updateMainContentLayout(false);
        this.#eventBus.emit('sidebar:toggle:completed', { collapsed: false });
      } else {
        sidebar.classList.add('collapsed');
        toggleBtn.innerHTML = '▶';
        toggleBtn.title = '展开侧边栏';
        toggleBtn.classList.add('collapsed');
        // 收起：恢复右侧内容布局
        this.#updateMainContentLayout(true);
        this.#eventBus.emit('sidebar:toggle:completed', { collapsed: true });
      }
    });

    this.#logger.info('[SidebarContainer] Toggle button created');
  }

  /**
   * 根据侧边栏折叠状态，更新主内容区域布局，避免遮挡
   * @param {boolean} collapsed - 是否处于折叠状态
   * @private
   */
  #updateMainContentLayout(collapsed) {
    try {
      const main = document.querySelector('.main-content');
      if (!main) return;

      if (collapsed) {
        // 恢复默认布局
        main.style.marginLeft = '';
        main.style.width = '';
      } else {
        // 与侧边栏宽度保持一致：280px
        main.style.marginLeft = '280px';
        main.style.width = 'calc(100% - 280px)';
      }
    } catch (_) {
      // 忽略布局更新异常，避免影响主流程
    }
  }

  /**
   * 销毁组件
   */
  destroy() {
    // 移除toggle按钮
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    if (toggleBtn) {
      toggleBtn.remove();
    }

    if (this.#container) {
      this.#container.innerHTML = '';
    }
    this.#logger.info('[SidebarContainer] Destroyed');
  }
}
