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
    // 创建侧边栏DOM
    this.#ensureSidebar();
    this.#ensureToggleButton();
    // 不再在header添加书签按钮，已有侧边栏内置的关闭按钮
    // this.#ensureHeaderToggle();

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
      'width: 280px',
      'overflow: auto',
      'background: #ffffff',
      'border-right: 1px solid #ccc',
      'box-shadow: 2px 0 8px rgba(0,0,0,0.15)', // 添加阴影，更明显的悬浮效果
      'padding: 8px',
      'box-sizing: border-box',
      'display: none',
      'z-index: 1000' // 更高的z-index确保不被任何元素遮挡
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
    this.#sidebarHeader = header;

    // 创建内容区域
    const content = document.createElement('div');
    content.style.cssText = 'flex:1;overflow:auto;';
    sidebar.appendChild(content);
    this.#sidebarContent = content;
  }

  #renderBookmarks(bookmarks) {
    this.#bookmarks = Array.isArray(bookmarks) ? bookmarks : [];
    if (!this.#sidebar) this.#ensureSidebar();
    if (!this.#sidebarContent) return;

    // 只清空内容区域，保留header
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
    // 自动展开侧边栏
    this.show();
  }

  #renderEmpty() {
    if (!this.#sidebar) this.#ensureSidebar();
    if (!this.#sidebarContent) return;

    // 只清空内容区域，保留header
    this.#sidebarContent.innerHTML = '<div style="color:#666;padding:8px;">无书签</div>';
  }

  show() {
    if (this.#sidebar) this.#sidebar.style.display = 'block';
    // 书签侧边栏使用绝对定位悬浮显示，不调整PDF渲染区域
    this.#eventBus.emit(PDF_VIEWER_EVENTS.BOOKMARK.SIDEBAR.OPENED, {}, { actorId: 'BookmarkSidebarUI' });
  }

  hide() {
    if (this.#sidebar) this.#sidebar.style.display = 'none';
    // 书签侧边栏使用绝对定位悬浮显示，不调整PDF渲染区域
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

    // 优先查找header中的按钮容器
    let buttonContainer = document.getElementById('pdf-viewer-button-container');
    let inHeader = !!buttonContainer;

    // 如果header中没有容器，使用旧的浮动方式创建（向后兼容）
    if (!buttonContainer) {
      buttonContainer = document.createElement('div');
      buttonContainer.id = 'pdf-viewer-button-container';

      // 根据容器可见性选择定位策略：优先挂在容器，否则挂到 body（fixed）
      const attachToBody = !this.#container || (this.#container.offsetWidth === 0 && this.#container.offsetHeight === 0);

      if (attachToBody) {
        buttonContainer.style.cssText = [
          'position:fixed','left:8px','top:80px','z-index:1000',
          'display:flex','flex-direction:column','gap:8px'
        ].join(';');
        document.body.appendChild(buttonContainer);
      } else {
        buttonContainer.style.cssText = [
          'position:absolute','left:8px','top:8px','z-index:10',
          'display:flex','flex-direction:column','gap:8px'
        ].join(';');
        this.#container.style.position = this.#container.style.position || 'relative';
        this.#container.appendChild(buttonContainer);
      }
    }

    // 创建书签按钮
    const bookmarkBtn = document.createElement('button');
    bookmarkBtn.type = 'button';
    bookmarkBtn.textContent = '≡ 书签';
    bookmarkBtn.title = '打开书签';
    bookmarkBtn.className = 'btn'; // 使用统一的btn样式
    // 只有在非header模式才添加内联样式
    if (!inHeader) {
      bookmarkBtn.style.cssText = [
        'padding:4px 8px','border:1px solid #ddd','border-radius:4px',
        'background:#fff','cursor:pointer','box-shadow:0 1px 2px rgba(0,0,0,0.06)',
        'font-size:13px','white-space:nowrap'
      ].join(';');
    }
    bookmarkBtn.addEventListener('click', () => this.show());
    buttonContainer.appendChild(bookmarkBtn);

    // 标注按钮已移至 AnnotationFeature 中管理

    // 创建卡片按钮
    const cardBtn = document.createElement('button');
    cardBtn.type = 'button';
    cardBtn.textContent = '📇 卡片';
    cardBtn.title = '打开卡片';
    cardBtn.className = 'btn'; // 使用统一的btn样式
    // 只有在非header模式才添加内联样式
    if (!inHeader) {
      cardBtn.style.cssText = [
        'padding:4px 8px','border:1px solid #ddd','border-radius:4px',
        'background:#fff','cursor:pointer','box-shadow:0 1px 2px rgba(0,0,0,0.06)',
        'font-size:13px','white-space:nowrap'
      ].join(';');
    }
    cardBtn.addEventListener('click', () => {
      this.#logger.info('[BookmarkSidebarUI] Card button clicked');
      // TODO: 实现卡片功能
    });
    buttonContainer.appendChild(cardBtn);

    // 创建翻译按钮（空壳子）
    const translateBtn = document.createElement('button');
    translateBtn.id = 'translate-sidebar-button';
    translateBtn.type = 'button';
    translateBtn.textContent = '🌐 翻译';
    translateBtn.title = '打开翻译';
    translateBtn.className = 'btn'; // 使用统一的btn样式
    // 只有在非header模式才添加内联样式
    if (!inHeader) {
      translateBtn.style.cssText = [
        'padding:4px 8px','border:1px solid #ddd','border-radius:4px',
        'background:#fff','cursor:pointer','box-shadow:0 1px 2px rgba(0,0,0,0.06)',
        'font-size:13px','white-space:nowrap'
      ].join(';');
    }
    translateBtn.addEventListener('click', () => {
      this.#logger.info('[BookmarkSidebarUI] Translate button clicked');
      // TODO: 实现翻译功能
    });
    buttonContainer.appendChild(translateBtn);

    this.#logger.info('[BookmarkSidebarUI] Toggle buttons created', { inHeader, fallbackMode: !inHeader });
    this.#toggleBtn = bookmarkBtn; // 保持对书签按钮的引用
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
