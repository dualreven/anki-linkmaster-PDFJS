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
  #toggleBtn;
  #bookmarks = [];
  #unsubs = [];

  constructor(eventBus, options = {}) {
    this.#eventBus = eventBus;
    this.#logger = getLogger('BookmarkSidebarUI');
    this.#container = options.container || document.getElementById('pdf-container');
    this.#sidebar = null;
  }

  initialize() {
    // 创建侧边栏DOM
    this.#ensureSidebar();
    this.#ensureToggleButton();
    this.#ensureHeaderToggle();

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

    // 监听侧边栏切换
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.BOOKMARK.SIDEBAR.TOGGLE,
      () => this.toggle(),
      { subscriberId: 'BookmarkSidebarUI' }
    ));
  }

  #ensureSidebar() {
    if (!this.#container) return;
    if (this.#sidebar && this.#sidebar.parentNode) return;

    const sidebar = document.createElement('div');
    sidebar.id = 'bookmark-sidebar';
    sidebar.className = 'bookmark-sidebar';
    sidebar.style.cssText = [
      'position: absolute',
      'left: 0',
      'top: 0',
      'bottom: 0',
      'width: 260px',
      'overflow: auto',
      'background: #f7f7f7',
      'border-right: 1px solid #ddd',
      'padding: 8px',
      'box-sizing: border-box',
      'display: none',
      'z-index: 20'
    ].join(';');

    this.#container.style.position = this.#container.style.position || 'relative';
    this.#container.appendChild(sidebar);
    this.#sidebar = sidebar;

    // 添加简易标题栏与关闭按钮，避免遮挡
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 6px;margin:-8px -8px 8px -8px;border-bottom:1px solid #eee;background:#fafafa;';
    const title = document.createElement('div');
    title.textContent = '书签';
    title.style.cssText = 'font-weight:600;color:#333;';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.title = '关闭书签';
    closeBtn.style.cssText = 'border:none;background:transparent;font-size:16px;cursor:pointer;line-height:1;color:#666;';
    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(title);
    header.appendChild(closeBtn);
    sidebar.appendChild(header);
  }

  #renderBookmarks(bookmarks) {
    this.#bookmarks = Array.isArray(bookmarks) ? bookmarks : [];
    if (!this.#sidebar) this.#ensureSidebar();
    if (!this.#sidebar) return;
    this.#sidebar.innerHTML = '';

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
    this.#sidebar.appendChild(list);
    // 自动展开侧边栏
    this.show();
  }

  #renderEmpty() {
    if (!this.#sidebar) this.#ensureSidebar();
    if (!this.#sidebar) return;
    this.#sidebar.innerHTML = '<div style="color:#666;">无书签</div>';
  }

  show() {
    if (this.#sidebar) this.#sidebar.style.display = 'block';
    if (this.#toggleBtn) this.#toggleBtn.style.display = 'none';
    this.#eventBus.emit(PDF_VIEWER_EVENTS.BOOKMARK.SIDEBAR.OPENED, {}, { actorId: 'BookmarkSidebarUI' });
  }

  hide() {
    if (this.#sidebar) this.#sidebar.style.display = 'none';
    if (this.#toggleBtn) this.#toggleBtn.style.display = 'block';
    this.#eventBus.emit(PDF_VIEWER_EVENTS.BOOKMARK.SIDEBAR.CLOSED, {}, { actorId: 'BookmarkSidebarUI' });
  }

  toggle() {
    if (!this.#sidebar) return;
    const visible = this.#sidebar.style.display !== 'none';
    if (visible) this.hide();
    else this.show();
  }

  #ensureToggleButton() {
    if (this.#toggleBtn) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '≡ 书签';
    btn.title = '打开书签';
    // 根据容器可见性选择定位策略：优先挂在容器，否则挂到 body（fixed）
    const attachToBody = !this.#container || (this.#container.offsetWidth === 0 && this.#container.offsetHeight === 0);
    if (attachToBody) {
      btn.style.cssText = [
        'position:fixed','left:8px','top:80px','z-index:1000',
        'padding:4px 8px','border:1px solid #ddd','border-radius:4px',
        'background:#fff','cursor:pointer','box-shadow:0 1px 2px rgba(0,0,0,0.06)'
      ].join(';');
      document.body.appendChild(btn);
    } else {
      btn.style.cssText = [
        'position:absolute','left:8px','top:8px','z-index:10',
        'padding:4px 8px','border:1px solid #ddd','border-radius:4px',
        'background:#fff','cursor:pointer','box-shadow:0 1px 2px rgba(0,0,0,0.06)'
      ].join(';');
      this.#container.style.position = this.#container.style.position || 'relative';
      this.#container.appendChild(btn);
    }
    btn.addEventListener('click', () => this.show());
    this.#logger.info('[BookmarkSidebarUI] Toggle button created', { attachToBody });
    this.#toggleBtn = btn;
  }

  #ensureHeaderToggle() {
    const header = document.querySelector('header .header-left');
    if (!header) {
      this.#logger.debug('[BookmarkSidebarUI] header-left not found, skip header toggle');
      return;
    }
    let existing = document.getElementById('bookmark-toggle-header');
    if (existing) {
      existing.addEventListener('click', () => this.toggle());
      return;
    }
    const btn = document.createElement('button');
    btn.id = 'bookmark-toggle-header';
    btn.type = 'button';
    btn.textContent = '书签';
    btn.className = 'btn';
    btn.style.marginLeft = '8px';
    btn.addEventListener('click', () => this.toggle());
    header.appendChild(btn);
    this.#logger.info('[BookmarkSidebarUI] Header toggle button appended');
  }

  destroy() {
    this.#unsubs.forEach(u => { try { u(); } catch(_){} });
    this.#unsubs = [];
    if (this.#sidebar && this.#sidebar.parentNode) {
      this.#sidebar.parentNode.removeChild(this.#sidebar);
    }
    if (this.#toggleBtn && this.#toggleBtn.parentNode) {
      this.#toggleBtn.parentNode.removeChild(this.#toggleBtn);
    }
    this.#sidebar = null;
    this.#toggleBtn = null;
  }
}

export default BookmarkSidebarUI;
