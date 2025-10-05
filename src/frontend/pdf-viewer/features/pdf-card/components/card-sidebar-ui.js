/**
 * 卡片侧边栏UI组件
 * @file 负责渲染卡片侧边栏的UI界面
 * @module CardSidebarUI
 * @description 第一期实现：仅包含UI容器和占位内容，不实现实际功能
 */

import { getLogger } from '../../../../common/utils/logger.js';

export class CardSidebarUI {
  #eventBus;
  #logger;
  #sidebarContent; // 侧边栏完整内容容器
  #header; // Header区域（包含按钮）
  #body; // Body区域（占位内容）
  #unsubs = [];

  /**
   * 构造函数
   * @param {EventBus} eventBus - 事件总线
   */
  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger('CardSidebarUI');
  }

  /**
   * 初始化UI组件
   */
  initialize() {
    this.#logger.info('Initializing CardSidebarUI...');

    // 创建完整内容容器
    this.#sidebarContent = document.createElement('div');
    this.#sidebarContent.className = 'card-sidebar-content';
    this.#sidebarContent.style.cssText = 'height:100%;display:flex;flex-direction:column;box-sizing:border-box;';

    // 创建Header区域
    this.#header = this.#createHeader();
    this.#sidebarContent.appendChild(this.#header);

    // 创建Body区域
    this.#body = this.#createBody();
    this.#sidebarContent.appendChild(this.#body);

    this.#logger.info('CardSidebarUI initialized successfully');
  }

  /**
   * 创建Header区域（包含5个按钮）
   * @returns {HTMLElement} Header元素
   * @private
   */
  #createHeader() {
    const header = document.createElement('div');
    header.className = 'card-sidebar-header';
    header.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
      background: #f9f9f9;
    `;

    // 定义按钮配置
    const buttons = [
      { id: 'quick-create', text: '快速制卡', icon: '⚡', title: '快速制作Anki卡片（第2期）' },
      { id: 'create', text: '制卡', icon: '➕', title: '打开完整制卡窗口（第3期）' },
      { id: 'review', text: '复习', icon: '📖', title: '开始复习卡片（第4期）' },
      { id: 'filter', text: '筛选', icon: '🔽', title: '排序和筛选卡片（第2期）' },
      { id: 'auto-create-all', text: '整书制卡', icon: '📚', title: '一键整书自动制卡（第3期）' }
    ];

    // 创建按钮
    buttons.forEach(({ id, text, icon, title }) => {
      const btn = document.createElement('button');
      btn.className = `card-header-btn card-header-btn-${id}`;
      btn.title = title;
      btn.style.cssText = `
        flex: 1 1 calc(50% - 4px);
        min-width: 100px;
        padding: 8px 12px;
        border: 1px solid #d0d0d0;
        background: #ffffff;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.2s;
      `;

      // 添加hover效果
      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#f0f0f0';
        btn.style.borderColor = '#1976d2';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = '#ffffff';
        btn.style.borderColor = '#d0d0d0';
      });

      // 点击事件（第一期仅显示提示）
      btn.addEventListener('click', () => {
        this.#handleButtonClick(id, text);
      });

      const iconSpan = document.createElement('span');
      iconSpan.className = 'icon';
      iconSpan.textContent = icon;
      iconSpan.style.fontSize = '16px';

      const textSpan = document.createElement('span');
      textSpan.className = 'text';
      textSpan.textContent = text;

      btn.appendChild(iconSpan);
      btn.appendChild(textSpan);
      header.appendChild(btn);
    });

    return header;
  }

  /**
   * 创建Body区域（占位内容）
   * @returns {HTMLElement} Body元素
   * @private
   */
  #createBody() {
    const body = document.createElement('div');
    body.className = 'card-sidebar-body';
    body.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 24px 16px;
      background: #ffffff;
    `;

    // 创建占位内容
    const placeholder = document.createElement('div');
    placeholder.className = 'card-placeholder';
    placeholder.style.cssText = `
      text-align: center;
      padding: 40px 20px;
      color: #666;
    `;

    // 图标
    const icon = document.createElement('div');
    icon.className = 'placeholder-icon';
    icon.textContent = '📇';
    icon.style.cssText = `
      font-size: 64px;
      margin-bottom: 16px;
    `;

    // 标题
    const title = document.createElement('div');
    title.className = 'placeholder-title';
    title.textContent = '卡片功能开发中...';
    title.style.cssText = `
      font-size: 18px;
      font-weight: 500;
      margin-bottom: 24px;
      color: #333;
    `;

    // 功能说明
    const features = document.createElement('div');
    features.className = 'placeholder-features';
    features.innerHTML = `
      <p style="font-size: 14px; margin-bottom: 12px; color: #666;">即将支持：</p>
      <ul style="text-align: left; list-style: none; padding: 0; font-size: 13px;">
        <li style="padding: 8px 0; padding-left: 24px; position: relative;">
          <span style="position: absolute; left: 8px; color: #1976d2;">•</span>
          查看与此PDF相关的卡片
        </li>
        <li style="padding: 8px 0; padding-left: 24px; position: relative;">
          <span style="position: absolute; left: 8px; color: #1976d2;">•</span>
          快速制作Anki卡片
        </li>
        <li style="padding: 8px 0; padding-left: 24px; position: relative;">
          <span style="position: absolute; left: 8px; color: #1976d2;">•</span>
          在阅读时复习卡片
        </li>
      </ul>
    `;

    placeholder.appendChild(icon);
    placeholder.appendChild(title);
    placeholder.appendChild(features);
    body.appendChild(placeholder);

    return body;
  }

  /**
   * 处理按钮点击事件
   * @param {string} buttonId - 按钮ID
   * @param {string} buttonText - 按钮文本
   * @private
   */
  #handleButtonClick(buttonId, buttonText) {
    this.#logger.info(`Card button clicked: ${buttonId}`);

    // 第一期：仅显示提示信息
    const messages = {
      'quick-create': '快速制卡功能开发中，敬请期待！\n预计第二期（2025-10-15）发布',
      'create': '完整制卡功能开发中，敬请期待！\n预计第三期（2025-10-22）发布',
      'review': '复习功能开发中，敬请期待！\n预计第四期（2025-11-01）发布',
      'filter': '筛选功能开发中，敬请期待！\n预计第二期（2025-10-15）发布',
      'auto-create-all': '一键整书自动制卡功能开发中，敬请期待！\n预计第三期（2025-10-22）发布'
    };

    alert(messages[buttonId] || `${buttonText}功能开发中...`);
  }

  /**
   * 获取内容元素（供SidebarManager使用）
   * @returns {HTMLElement} 内容元素
   */
  getContentElement() {
    return this.#sidebarContent;
  }

  /**
   * 销毁UI组件
   */
  destroy() {
    this.#logger.info('Destroying CardSidebarUI...');

    // 取消所有事件订阅
    this.#unsubs.forEach(unsub => unsub());
    this.#unsubs = [];

    // 移除DOM元素
    if (this.#sidebarContent && this.#sidebarContent.parentElement) {
      this.#sidebarContent.remove();
    }

    this.#logger.info('CardSidebarUI destroyed');
  }
}
