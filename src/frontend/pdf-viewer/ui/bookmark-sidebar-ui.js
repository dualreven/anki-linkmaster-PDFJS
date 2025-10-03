/**
 * 书签侧边栏UI
 * @file 渲染书签树并处理交互
 * @module BookmarkSidebarUI
 */

import { getLogger } from "../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";

export class BookmarkSidebarUI {
  #eventBus;
  #logger;
  #container;
  #sidebar;
  #sidebarHeader; // 书签侧边栏的header元素（包含关闭按钮）
  #sidebarContent; // 书签侧边栏的内容区域（书签列表）
  #toggleBtn;
  #bookmarks = [];
  #unsubs = [];

  constructor(eventBus, options = {}) {
    this.#eventBus = eventBus;
    this.#logger = getLogger('BookmarkSidebarUI');
    // 侧边栏应该添加到main元素，与viewerContainer并列
    this.#container = options.container || document.querySelector('main');
    this.#sidebar = null;
  }

  initialize() {
    // 创建内容容器（只负责内容，不负责容器）
    this.#sidebarContent = document.createElement('div');
    this.#sidebarContent.style.cssText = 'height:100%;overflow-y:auto;padding:12px;box-sizing:border-box;';

    // 监听书签加载
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.BOOKMARK.LOAD.SUCCESS,
      (data) => this.#renderBookmarks(data?.bookmarks || []),
      { subscriberId: 'BookmarkSidebarUI' }
    ));

    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.BOOKMARK.LOAD.EMPTY,
      () => this.#renderEmpty(),
      { subscriberId: 'BookmarkSidebarUI' }
    ));

    this.#logger.info('BookmarkSidebarUI initialized (content only)');
  }

  /**
   * 获取内容元素（供SidebarManager使用）
   * @returns {HTMLElement} 内容元素
   */
  getContentElement() {
    return this.#sidebarContent;
  }

  #renderBookmarks(bookmarks) {
    this.#bookmarks = Array.isArray(bookmarks) ? bookmarks : [];
    if (!this.#sidebarContent) return;

    // 清空内容区域
    this.#sidebarContent.innerHTML = '';

    const list = document.createElement('ul');
    list.style.listStyle = 'none';
    list.style.margin = '0';
    list.style.padding = '0';

    const buildNode = (node, level = 0) => {
      const li = document.createElement('li');
      li.style.paddingLeft = `${level * 12}px`;
      const hasChildren = Array.isArray(node.items) && node.items.length > 0;

      // 展开/收起图标
      if (hasChildren) {
        const caret = document.createElement('span');
        caret.textContent = '▾'; // 展开符号
        caret.style.cssText = 'display:inline-block;width:14px;color:#444;cursor:pointer;margin-right:2px;';
        li.appendChild(caret);
      } else {
        const spacer = document.createElement('span');
        spacer.style.cssText = 'display:inline-block;width:14px;margin-right:2px;';
        li.appendChild(spacer);
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = node.title || '(未命名)';
      btn.style.display = 'block';
      btn.style.width = '100%';
      btn.style.textAlign = 'left';
      btn.style.border = 'none';
      btn.style.background = 'transparent';
      btn.style.padding = '4px 6px';
      btn.style.cursor = 'pointer';
      btn.style.whiteSpace = 'nowrap';
      btn.style.overflow = 'hidden';
      btn.style.textOverflow = 'ellipsis';
      btn.addEventListener('click', () => {
        this.#logger.info(`Bookmark clicked: ${node.title}, dest:`, node.dest);
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.REQUESTED,
          { bookmark: node, timestamp: Date.now() },
          { actorId: 'BookmarkSidebarUI' }
        );
      });
      li.appendChild(btn);

      // 子节点容器
      let childContainer = null;
      if (hasChildren) {
        childContainer = document.createElement('ul');
        childContainer.style.listStyle = 'none';
        childContainer.style.margin = '0';
        childContainer.style.padding = '0';
        node.items.forEach(child => childContainer.appendChild(buildNode(child, level + 1)));
        li.appendChild(childContainer);

        // 切换展开/收起
        const caretEl = li.firstChild;
        caretEl.addEventListener('click', () => {
          const visible = childContainer.style.display !== 'none';
          childContainer.style.display = visible ? 'none' : 'block';
          caretEl.textContent = visible ? '▸' : '▾';
        });
      }
      return li;
    };

    this.#bookmarks.forEach(n => list.appendChild(buildNode(n, 0)));
    this.#sidebarContent.appendChild(list);
    // 不再自动展开，由SidebarManager控制
  }

  #renderEmpty() {
    if (!this.#sidebarContent) return;

    // 清空内容区域
    this.#sidebarContent.innerHTML = '<div style="color:#666;padding:8px;text-align:center;">无书签</div>';
  }

  // show/hide/toggle 方法已移除，由 SidebarManager 统一管理

  destroy() {
    this.#unsubs.forEach(u => { try { u(); } catch(_){} });
    this.#unsubs = [];
    if (this.#sidebarContent && this.#sidebarContent.parentNode) {
      this.#sidebarContent.parentNode.removeChild(this.#sidebarContent);
    }
    this.#sidebarContent = null;
    this.#logger.info('BookmarkSidebarUI destroyed');
  }
}

export default BookmarkSidebarUI;
