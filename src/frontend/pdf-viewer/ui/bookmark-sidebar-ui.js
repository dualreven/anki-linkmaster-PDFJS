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
  #sortMode = false; // 排序模式状态
  #isDragging = false; // 是否正在拖拽（通过悬浮拖拽柄触发）
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

    // 监听排序模式切换
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.BOOKMARK.SORT.MODE_CHANGED,
      (data) => this.#handleSortModeChanged(data),
      { subscriberId: 'BookmarkSidebarUI' }
    ));

    // 监听外部选中事件（来自 PDFBookmarkFeature）
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.BOOKMARK.SELECT.CHANGED,
      (data, metadata) => {
        // 只处理来自外部的选中事件（不是自己发出的）
        if (metadata?.actorId !== 'BookmarkSidebarUI') {
          this.#handleExternalSelection(data);
        }
      },
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

    // 记录并恢复滚动位置，避免重渲染时“跳到顶部”产生错觉
    const prevScrollTop = this.#bookmarkList.scrollTop;
    // 清空列表区域
    this.#bookmarkList.innerHTML = '';

    const list = document.createElement('ul');
    list.style.listStyle = 'none';
    list.style.margin = '0';
    list.style.padding = '0';

    const buildNode = (node, level = 0) => {
      const li = document.createElement('li');
      li.style.paddingLeft = `${level * 12}px`;
      li.dataset.bookmarkId = node.id; // 存储书签ID用于选中
      const hasChildren = Array.isArray(node.children) && node.children.length > 0;

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
      btn.textContent = node.name || '(未命名)';
      btn.dataset.bookmarkId = node.id;
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

      // Hover显示跳转按钮与拖拽柄
      itemContainer.addEventListener('mouseenter', () => {
        jumpBtn.style.display = 'block';
        if (dragHandle) dragHandle.style.display = 'inline-flex';
      });

      itemContainer.addEventListener('mouseleave', () => {
        jumpBtn.style.display = 'none';
        if (dragHandle) dragHandle.style.display = 'none';
      });

      // 跳转按钮点击
      jumpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#logger.info(`Bookmark jump button clicked: ${node.name}`);
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.REQUESTED,
          { bookmark: node, timestamp: Date.now() },
          { actorId: 'BookmarkSidebarUI' }
        );
      });

      // 双击导航（保留作为备选方式）
      btn.addEventListener('dblclick', () => {
        this.#logger.info(`Bookmark double-clicked (navigate): ${node.name}`);
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE.REQUESTED,
          { bookmark: node, timestamp: Date.now() },
          { actorId: 'BookmarkSidebarUI' }
        );
      });

      // 单击选中
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#selectBookmark(node.id, node);
      });

      // 拖拽柄（默认隐藏，仅在 hover 时显示）
      const dragHandle = document.createElement('div');
      dragHandle.title = '拖动以排序';
      dragHandle.textContent = '☰';
      dragHandle.style.cssText = `
        display: none;
        width: 20px;
        height: 20px;
        align-items: center;
        justify-content: center;
        margin-left: 4px;
        color: #666;
        cursor: grab;
        user-select: none;
        border-radius: 4px;
      `;
      dragHandle.setAttribute('draggable', 'true');

      dragHandle.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        this.#isDragging = true;
        try {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', node.id);
        } catch (_) {}
        li.style.opacity = '0.4';
      });

      dragHandle.addEventListener('dragend', (e) => {
        e.stopPropagation();
        this.#isDragging = false;
        li.style.opacity = '1';
      });

      itemContainer.appendChild(btn);
      itemContainer.appendChild(jumpBtn);
      itemContainer.appendChild(dragHandle);
      li.appendChild(itemContainer);

      // 拖拽排序功能
      li.draggable = false; // 统一通过拖拽柄触发
      li.dataset.bookmarkId = node.id;
      li.dataset.parentId = node.parentId || '';

      // 拖拽开始
      // 取消 li 自身的拖拽开始，统一用拖拽柄

      // 拖拽结束
      li.addEventListener('dragend', (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        li.style.opacity = '1';
      });

      // 拖拽经过
      li.addEventListener('dragover', (e) => {
        if (!this.#isDragging) return;
        e.preventDefault();
        e.stopPropagation(); // 阻止事件冒泡到父节点
        e.dataTransfer.dropEffect = 'move';

        // 视觉反馈：根据鼠标位置显示不同的插入方式
        const rect = li.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const height = rect.height;

        // 划分三个区域：
        // - 上方 30%：插入到前面（同级）
        // - 中间 40%：成为子项
        // - 下方 30%：插入到后面（同级）
        if (relativeY < height * 0.3) {
          // 上方区域 - 插入到前面
          li.style.borderTop = '2px solid #4CAF50';
          li.style.borderBottom = '';
          li.style.backgroundColor = '';
          li.dataset.dropZone = 'before';
        } else if (relativeY > height * 0.7) {
          // 下方区域 - 插入到后面
          li.style.borderTop = '';
          li.style.borderBottom = '2px solid #4CAF50';
          li.style.backgroundColor = '';
          li.dataset.dropZone = 'after';
        } else {
          // 中间区域 - 成为子项
          li.style.borderTop = '';
          li.style.borderBottom = '';
          li.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
          li.dataset.dropZone = 'child';
        }
      });

      // 离开拖拽区域
      li.addEventListener('dragleave', (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        li.style.borderTop = '';
        li.style.borderBottom = '';
        li.style.backgroundColor = '';
        delete li.dataset.dropZone;
      });

      // 放下
      li.addEventListener('drop', (e) => {
        if (!this.#isDragging) return;
        e.preventDefault();
        e.stopPropagation();

        // 清除视觉反馈
        li.style.borderTop = '';
        li.style.borderBottom = '';
        li.style.backgroundColor = '';

        const draggedId = e.dataTransfer.getData('text/plain');
        const targetId = node.id;

        if (draggedId === targetId) {
          delete li.dataset.dropZone;
          return; // 不能拖到自己
        }

        // 获取放置区域类型
        const dropZone = li.dataset.dropZone || 'before';
        delete li.dataset.dropZone;

        this.#logger.info(`Drop: dragged=${draggedId}, target=${targetId}, zone=${dropZone}`);
        this.#handleDrop(draggedId, targetId, dropZone);
        // 结束拖拽态
        this.#isDragging = false;
      });

      // 子节点容器
      let childContainer = null;
      if (hasChildren) {
        childContainer = document.createElement('ul');
        childContainer.style.listStyle = 'none';
        childContainer.style.margin = '0';
        childContainer.style.padding = '0';
        node.children.forEach(child => childContainer.appendChild(buildNode(child, level + 1)));
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
    // 尝试恢复滚动条位置（若后续有选中事件滚动，将被覆盖）
    try { this.#bookmarkList.scrollTop = prevScrollTop; } catch(_) {}
  }

  /**
   * 选中书签
   * @param {string} bookmarkId - 书签ID
   * @param {Object} bookmark - 书签对象
   * @param {boolean} scrollIntoView - 是否滚动到可见区域
   * @private
   */
  #selectBookmark(bookmarkId, bookmark, scrollIntoView = false) {
    // 更新UI
    this.#updateSelectionUI(bookmarkId, scrollIntoView);

    this.#selectedBookmarkId = bookmarkId;

    // 发出选择变化事件
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.BOOKMARK.SELECT.CHANGED,
      { bookmarkId, bookmark },
      { actorId: 'BookmarkSidebarUI' }
    );

    this.#logger.debug(`Bookmark selected: ${bookmarkId}`);
  }

  /**
   * 更新选中状态的UI（不发出事件）
   * @param {string} bookmarkId - 书签ID
   * @param {boolean} scrollIntoView - 是否滚动到可见区域
   * @private
   */
  #updateSelectionUI(bookmarkId, scrollIntoView = false) {
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

      // 滚动到可见区域
      if (scrollIntoView) {
        selectedBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    this.#selectedBookmarkId = bookmarkId;
  }

  /**
   * 处理外部选中事件
   * @param {Object} data - 选中数据
   * @param {string|null} data.bookmarkId - 书签ID
   * @private
   */
  #handleExternalSelection(data) {
    const bookmarkId = data?.bookmarkId;
    if (!bookmarkId) {
      this.#logger.warn('External selection event missing bookmarkId');
      return;
    }

    this.#logger.info(`Handling external selection: ${bookmarkId}`);
    // 更新UI并滚动到选中的书签
    this.#updateSelectionUI(bookmarkId, true);
  }

  #renderEmpty() {
    if (!this.#bookmarkList) return;

    // 清空列表区域
    this.#bookmarkList.innerHTML = '<div style="color:#666;padding:8px;text-align:center;">无书签</div>';
  }

  /**
   * 处理排序模式切换
   * @param {Object} data - 事件数据
   * @param {boolean} data.sortMode - 排序模式状态
   * @private
   */
  #handleSortModeChanged(data) {
    this.#sortMode = data.sortMode;
    this.#logger.info(`Sort mode changed: ${this.#sortMode}`);

    // 更新所有书签项的 draggable 属性
    const bookmarkItems = this.#bookmarkList.querySelectorAll('li[data-bookmark-id]');
    bookmarkItems.forEach(li => {
      li.draggable = this.#sortMode;
      // 在排序模式下添加视觉提示
      if (this.#sortMode) {
        li.style.cursor = 'move';
      } else {
        li.style.cursor = '';
      }
    });

    // 在排序模式下强制隐藏所有跳转按钮
    if (this.#sortMode) {
      const jumpButtons = this.#bookmarkList.querySelectorAll('.bookmark-jump-btn');
      jumpButtons.forEach(btn => {
        btn.style.display = 'none';
      });
    }
  }

  /**
   * 处理拖拽放下
   * @param {string} draggedId - 被拖拽的书签ID
   * @param {string} targetId - 目标书签ID
   * @param {string} dropZone - 放置区域 ('before'|'after'|'child')
   * @private
   */
  #handleDrop(draggedId, targetId, dropZone) {
    // 找到被拖拽的书签和目标书签
    const draggedBookmark = this.#findBookmarkById(this.#bookmarks, draggedId);
    const targetBookmark = this.#findBookmarkById(this.#bookmarks, targetId);

    if (!draggedBookmark || !targetBookmark) {
      this.#logger.warn('Dragged or target bookmark not found');
      return;
    }

    // 防止把父书签拖到自己的子孙书签中（会造成循环引用）
    if (this.#isDescendant(draggedId, targetId)) {
      this.#logger.warn('Cannot move parent into its own descendant');
      return;
    }

    let newParentId;
    let newIndex;

    if (dropZone === 'child') {
      // 成为目标书签的子项
      newParentId = targetId;
      newIndex = 0; // 插入到子项列表的开头
    } else {
      // 插入到目标书签的同级（before 或 after）
      const draggedParentId = draggedBookmark.parentId || null;
      const targetParentId = targetBookmark.parentId || null;

      // 获取目标书签的同级列表
      let siblings = [];
      if (targetParentId) {
        const parent = this.#findBookmarkById(this.#bookmarks, targetParentId);
        siblings = parent ? parent.children : [];
      } else {
        siblings = this.#bookmarks;
      }

      // 找到目标书签在同级列表中的索引
      const targetIndex = siblings.findIndex(b => b.id === targetId);
      if (targetIndex === -1) {
        this.#logger.warn('Target bookmark not found in siblings');
        return;
      }

      newParentId = targetParentId;

      // 如果在同一父级下移动
      if (draggedParentId === targetParentId) {
        const draggedIndex = siblings.findIndex(b => b.id === draggedId);

        if (draggedIndex === -1) {
          this.#logger.warn(`Dragged bookmark not found in siblings, treating as cross-parent move`);
          newIndex = dropZone === 'before' ? targetIndex : targetIndex + 1;
        } else {
          if (dropZone === 'before') {
            newIndex = targetIndex;
            if (draggedIndex < targetIndex) {
              newIndex = targetIndex - 1;
            }
          } else {
            newIndex = targetIndex;
            if (draggedIndex > targetIndex) {
              newIndex = targetIndex + 1;
            }
          }
        }
      } else {
        // 跨父级移动
        newIndex = dropZone === 'before' ? targetIndex : targetIndex + 1;
      }
    }

    // 发出重新排序事件
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.BOOKMARK.REORDER.REQUESTED,
      {
        bookmarkId: draggedId,
        newParentId: newParentId,
        newIndex
      },
      { actorId: 'BookmarkSidebarUI' }
    );

    this.#logger.info(`Reorder requested: ${draggedId} -> parent=${newParentId || 'root'}, index=${newIndex} (zone=${dropZone})`);

    // 本地立即应用排序结果，避免用户误以为未生效
    try {
      const removed = this.#removeLocalNode(draggedId);
      if (removed && removed.node) {
        this.#insertLocalNode(removed.node, newParentId, newIndex);
        this.#renderBookmarks(this.#bookmarks);
        // 高亮并滚动到移动后的节点
        this.#updateSelectionUI(draggedId, true);
      }
    } catch (e) {
      this.#logger.warn('Local reorder preview failed:', e);
    }
  }

  /**
   * 从本地树中移除节点
   * @param {string} bookmarkId
   * @returns {{node: Object|null, parentId: string|null, index: number}}
   * @private
   */
  #removeLocalNode(bookmarkId) {
    const result = { node: null, parentId: null, index: -1 };

    const removeFrom = (arr, pid=null) => {
      if (!Array.isArray(arr)) return false;
      const idx = arr.findIndex(x => x && x.id === bookmarkId);
      if (idx !== -1) {
        result.node = arr.splice(idx, 1)[0];
        result.parentId = pid;
        result.index = idx;
        return true;
      }
      // 深度查找
      for (const item of arr) {
        if (item && Array.isArray(item.children) && removeFrom(item.children, item.id)) {
          return true;
        }
      }
      return false;
    };

    removeFrom(this.#bookmarks, null);
    return result;
  }

  /**
   * 将节点插入到本地树
   * @param {Object} node - 要插入的节点
   * @param {string|null} parentId - 目标父ID，null表示根
   * @param {number} index - 目标索引
   * @private
   */
  #insertLocalNode(node, parentId, index) {
    if (!node) return;
    const clamp = (i, len) => Math.max(0, Math.min(typeof i === 'number' ? i : 0, len));

    if (!parentId) {
      const i = clamp(index, this.#bookmarks.length);
      this.#bookmarks.splice(i, 0, node);
      return;
    }

    const parent = this.#findBookmarkById(this.#bookmarks, parentId);
    if (!parent) return;
    if (!Array.isArray(parent.children)) parent.children = [];
    const i = clamp(index, parent.children.length);
    parent.children.splice(i, 0, node);
  }

  /**
   * 检查 childId 是否是 ancestorId 的子孙
   * @param {string} ancestorId - 祖先ID
   * @param {string} childId - 子孙ID
   * @returns {boolean} 是否是子孙关系
   * @private
   */
  #isDescendant(ancestorId, childId) {
    const ancestor = this.#findBookmarkById(this.#bookmarks, ancestorId);
    if (!ancestor) return false;

    const checkChildren = (bookmark) => {
      if (bookmark.id === childId) return true;
      if (bookmark.children && bookmark.children.length > 0) {
        return bookmark.children.some(child => checkChildren(child));
      }
      return false;
    };

    return checkChildren(ancestor);
  }

  /**
   * 在书签树中查找书签
   * @param {Array} bookmarks - 书签数组
   * @param {string} bookmarkId - 书签ID
   * @returns {Object|null} 找到的书签对象
   * @private
   */
  #findBookmarkById(bookmarks, bookmarkId) {
    for (const bookmark of bookmarks) {
      if (bookmark.id === bookmarkId) {
        return bookmark;
      }
      if (bookmark.children && bookmark.children.length > 0) {
        const found = this.#findBookmarkById(bookmark.children, bookmarkId);
        if (found) return found;
      }
    }
    return null;
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
