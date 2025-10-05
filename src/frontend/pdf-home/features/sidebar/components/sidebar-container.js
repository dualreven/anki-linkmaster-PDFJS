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
        this.#eventBus.emit('sidebar:toggle:completed', { collapsed: false });
      } else {
        sidebar.classList.add('collapsed');
        toggleBtn.innerHTML = '▶';
        toggleBtn.title = '展开侧边栏';
        toggleBtn.classList.add('collapsed');
        this.#eventBus.emit('sidebar:toggle:completed', { collapsed: true });
      }
    });

    this.#logger.info('[SidebarContainer] Toggle button created');
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
