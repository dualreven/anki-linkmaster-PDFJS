/**
 * 书签侧边栏UI
 * @file 渲染书签树并处理交互
 * @module BookmarkSidebarUI
 */

import { getLogger } from "../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { BookmarkToolbar } from "../features/pdf-bookmark/components/bookmark-toolbar.js";

export class BookmarkSidebarUI {
  #eventBus;
  #logger;
  #container;
  #sidebar;
  #sidebarHeader; // 书签侧边栏的header元素（包含关闭按钮）
  #sidebarContent; // 书签侧边栏的内容区域（完整容器，包含工具栏+列表）
  #bookmarkList; // 书签列表容器
  #toolbar; // 工具栏组件
  #toggleBtn;
  #bookmarks = [];
  #selectedBookmarkId = null; // 当前选中的书签ID
  #unsubs = [];

  constructor(eventBus, options = {}) {
    this.#eventBus = eventBus;
    this.#logger = getLogger('BookmarkSidebarUI');
    // 侧边栏应该添加到main元素，与viewerContainer并列
    this.#container = options.container || document.querySelector('main');
    this.#sidebar = null;
  }

  initialize() {
    // 创建完整内容容器
    this.#sidebarContent = document.createElement('div');
    this.#sidebarContent.style.cssText = 'height:100%;display:flex;flex-direction:column;box-sizing:border-box;';

    // 创建并初始化工具栏
    this.#toolbar = new BookmarkToolbar({ eventBus: this.#eventBus });
    this.#toolbar.initialize();
    this.#sidebarContent.appendChild(this.#toolbar.getElement());

    // 创建书签列表容器
    this.#bookmarkList = document.createElement('div');
    this.#bookmarkList.style.cssText = 'flex:1;overflow-y:auto;padding:12px;';
    this.#sidebarContent.appendChild(this.#bookmarkList);

    // 监听书签加载
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.BOOKMARK.LOAD.SUCCESS,
      (data) => {
        this.#logger.info('🎯 [DEBUG] BookmarkSidebarUI received BOOKMARK.LOAD.SUCCESS', {
          bookmarksCount: data?.bookmarks?.length || 0,
          eventName: PDF_VIEWER_EVENTS.BOOKMARK.LOAD.SUCCESS
        });
        this.#renderBookmarks(data?.bookmarks || []);
      },
      { subscriberId: 'BookmarkSidebarUI' }
    ));

    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.BOOKMARK.LOAD.EMPTY,
      () => this.#renderEmpty(),
      { subscriberId: 'BookmarkSidebarUI' }
    ));

    this.#logger.info('BookmarkSidebarUI initialized with toolbar');
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
    if (!this.#bookmarkList) return;

    // 清空列表区域
    this.#bookmarkList.innerHTML = '';

    const list = document.createElement('ul');
    list.style.listStyle = 'none';
    list.style.margin = '0';
    list.style.padding = '0';

    const buildNode = (node, level = 0) => {
      const li = document.createElement('li');
      li.style.paddingLeft = `${level * 12}px`;
      li.dataset.bookmarkId = node.id || node.title; // 存储书签ID用于选中
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

      // 创建书签项容器
      const itemContainer = document.createElement('div');
      itemContainer.style.cssText = 'display:flex;align-items:center;position:relative;';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bookmark-title-btn';  // 添加class用于选择器
      btn.textContent = node.title || '(未命名)';
      btn.dataset.bookmarkId = node.id || node.title;
      btn.style.display = 'block';
      btn.style.flex = '1';
      btn.style.textAlign = 'left';
      btn.style.border = 'none';
      btn.style.background = 'transparent';
      btn.style.padding = '4px 6px';
      btn.style.cursor = 'pointer';
      btn.style.whiteSpace = 'nowrap';
      btn.style.overflow = 'hidden';
      btn.style.textOverflow = 'ellipsis';

      // 创建跳转按钮（默认隐藏）
      const jumpBtn = document.createElement('button');
      jumpBtn.type = 'button';
      jumpBtn.className = 'bookmark-jump-btn';  // 添加class区分
      jumpBtn.textContent = '→';
      jumpBtn.title = '跳转到此书签';
      jumpBtn.style.cssText = `
        display: none;
        width: 24px;
        height: 24px;
        border: none;
        background: #1976d2;
        color: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
        line-height: 24px;
        padding: 0;
        margin-right: 4px;
        flex-shrink: 0;
      `;

      // Hover显示跳转按钮
      itemContainer.addEventListener('mouseenter', () => {
        jumpBtn.style.display = 'block';
      });

      itemContainer.addEventListener('mouseleave', () => {
        jumpBtn.style.display = 'none';
      });

      // 跳转按钮点击
      jumpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#logger.info(`Bookmark jump button clicked: ${node.title}`);
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.REQUESTED,
          { bookmark: node, timestamp: Date.now() },
          { actorId: 'BookmarkSidebarUI' }
        );
      });

      // 双击导航（保留作为备选方式）
      btn.addEventListener('dblclick', () => {
        this.#logger.info(`Bookmark double-clicked (navigate): ${node.title}`);
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.REQUESTED,
          { bookmark: node, timestamp: Date.now() },
          { actorId: 'BookmarkSidebarUI' }
        );
      });

      // 单击选中
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#selectBookmark(node.id || node.title, node);
      });

      itemContainer.appendChild(btn);
      itemContainer.appendChild(jumpBtn);
      li.appendChild(itemContainer);

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
    this.#bookmarkList.appendChild(list);
  }

  /**
   * 选中书签
   * @param {string} bookmarkId - 书签ID
   * @param {Object} bookmark - 书签对象
   * @private
   */
  #selectBookmark(bookmarkId, bookmark) {
    // 清除之前的选中状态（只选择书签标题按钮，不包括跳转按钮）
    this.#bookmarkList.querySelectorAll('.bookmark-title-btn').forEach(btn => {
      btn.style.backgroundColor = 'transparent';
      btn.style.fontWeight = 'normal';
    });

    // 设置新的选中状态
    const selectedBtn = this.#bookmarkList.querySelector(`.bookmark-title-btn[data-bookmark-id="${bookmarkId}"]`);
    if (selectedBtn) {
      selectedBtn.style.backgroundColor = '#e3f2fd';
      selectedBtn.style.fontWeight = 'bold';
    }

    this.#selectedBookmarkId = bookmarkId;

    // 发出选择变化事件
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.BOOKMARK.SELECT.CHANGED,
      { bookmarkId, bookmark },
      { actorId: 'BookmarkSidebarUI' }
    );

    this.#logger.debug(`Bookmark selected: ${bookmarkId}`);
  }

  #renderEmpty() {
    if (!this.#bookmarkList) return;

    // 清空列表区域
    this.#bookmarkList.innerHTML = '<div style="color:#666;padding:8px;text-align:center;">无书签</div>';
  }

  // show/hide/toggle 方法已移除，由 SidebarManager 统一管理

  destroy() {
    this.#unsubs.forEach(u => { try { u(); } catch(_){} });
    this.#unsubs = [];

    // 销毁工具栏
    if (this.#toolbar) {
      this.#toolbar.destroy();
      this.#toolbar = null;
    }

    // 移除DOM元素
    if (this.#sidebarContent && this.#sidebarContent.parentNode) {
      this.#sidebarContent.parentNode.removeChild(this.#sidebarContent);
    }

    this.#sidebarContent = null;
    this.#bookmarkList = null;
    this.#logger.info('BookmarkSidebarUI destroyed');
  }
}

export default BookmarkSidebarUI;
