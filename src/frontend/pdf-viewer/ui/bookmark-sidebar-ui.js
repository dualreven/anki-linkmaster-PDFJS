/**
 * 大纲侧边栏UI
 * @file 渲染大纲树并处理交互
 * @module BookmarkSidebarUI
 */

import { getLogger } from "../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { BookmarkToolbar } from "../features/pdf-bookmark/components/bookmark-toolbar.js";
import $ from "jquery";
// 确保 jstree 能正确挂到全局 jQuery（Vite/ESM 环境）
try {
  if (typeof window !== "undefined") {

    window.$ = window.$ || $;

    window.jQuery = window.jQuery || $;
  }
} catch { /* ignore */ }
import "jstree";
import "jstree/dist/themes/default/style.css";

export class BookmarkSidebarUI {
  #eventBus;
  #logger;
  #container;
  #sidebar;
  #sidebarHeader; // 大纲侧边栏的header元素（包含关闭按钮）
  #sidebarContent; // 大纲侧边栏的内容区域（完整容器，包含工具栏+列表）
  #bookmarkList; // 大纲列表容器
  #toolbar; // 工具栏组件
  #toggleBtn;
  #bookmarks = [];
  #selectedBookmarkId = null; // 当前选中的大纲ID
  #sortMode = false; // 排序模式状态
  #isDragging = false; // 是否正在拖拽（通过悬浮拖拽柄触发）
  #unsubs = [];

  constructor(eventBus, options = {}) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("BookmarkSidebarUI");
    // 侧边栏应该添加到main元素，与viewerContainer并列
    this.#container = options.container || document.querySelector("main");
    this.#sidebar = null;
  }

  initialize() {
    // 创建完整内容容器
    this.#sidebarContent = document.createElement("div");
    this.#sidebarContent.style.cssText = "height:100%;display:flex;flex-direction:column;box-sizing:border-box;";

    // 创建并初始化工具栏
    this.#toolbar = new BookmarkToolbar({ eventBus: this.#eventBus });
    this.#toolbar.initialize();
    this.#sidebarContent.appendChild(this.#toolbar.getElement());

    // 创建书签列表容器
    this.#bookmarkList = document.createElement("div");
    this.#bookmarkList.style.cssText = "flex:1;overflow-y:auto;padding:12px;";
    this.#sidebarContent.appendChild(this.#bookmarkList);

    // 监听书签加载
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.BOOKMARK.LOAD.SUCCESS,
      (data) => {
        this.#logger.info("🎯 [DEBUG] BookmarkSidebarUI received BOOKMARK.LOAD.SUCCESS", {
          bookmarksCount: data?.bookmarks?.length || 0,
          eventName: PDF_VIEWER_EVENTS.BOOKMARK.LOAD.SUCCESS
        });
        this.#renderBookmarks(data?.bookmarks || []);
      },
      { subscriberId: "BookmarkSidebarUI" }
    ));

    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.BOOKMARK.LOAD.EMPTY,
      () => this.#renderEmpty(),
      { subscriberId: "BookmarkSidebarUI" }
    ));

    // 监听排序模式切换
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.BOOKMARK.SORT.MODE_CHANGED,
      (data) => this.#handleSortModeChanged(data),
      { subscriberId: "BookmarkSidebarUI" }
    ));

    // 监听外部选中事件（来自 PDFBookmarkFeature）
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.BOOKMARK.SELECT.CHANGED,
      (data, metadata) => {
        // 只处理来自外部的选中事件（不是自己发出的）
        if (metadata?.actorId !== "BookmarkSidebarUI") {
          this.#handleExternalSelection(data);
        }
      },
      { subscriberId: "BookmarkSidebarUI" }
    ));

    this.#logger.info("BookmarkSidebarUI initialized with toolbar");
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
    if (!this.#bookmarkList) {return;}

    // 使用 jsTree 渲染树形结构
    const $container = $(this.#bookmarkList);
    try { $container.jstree("destroy"); } catch { /* ignore */ }
    this.#bookmarkList.innerHTML = "";
    const data = this.#toJsTreeData(this.#bookmarks);
    this.#logger.info(`[DEBUG] Creating jstree with ${data.length} nodes`, { toast: true });
    $container.jstree({
      core: { data, check_callback: true, themes: { stripes: true } },
      plugins: ["dnd", "wholerow"],
      dnd: { is_draggable: () => true }
    });

    this.#logger.info("[DEBUG] jsTree created, waiting for ready event...", { toast: true });

    // 等待 jsTree 渲染完成后展开所有节点
    // eslint-disable-next-line custom/event-name-format
    $container.on("ready.jstree", () => {
      this.#logger.info("[DEBUG] jsTree ready event fired!", { toast: true });
      try {
        $container.jstree("open_all");
        this.#logger.info("✅ Outline tree expanded automatically", { toast: true });
      } catch (err) {
        this.#logger.error("❌ Failed to expand outline tree: " + err.message, { toast: true });
      }
    });
    // 选择节点 → 发出导航与选中事件
    // eslint-disable-next-line custom/event-name-format
    $container.on("select_node.jstree", (e, selected) => {
      try {
        const info = selected?.node?.data || {};
        const pageNumber = info.pageNumber || 1;
        const region = info.region || null;
        const position = region && typeof region.scrollY === "number" ? region.scrollY : null;
        // 更新内存的当前选中ID
        this.#selectedBookmarkId = selected?.node?.id || null;
        // 向工具栏等消费者广播“选中变化”，保证编辑/删除针对最新选中项
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.BOOKMARK.SELECT.CHANGED,
          { bookmarkId: selected?.node?.id || null, bookmark: info.raw || null },
          { actorId: "BookmarkSidebarUI" }
        );
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.NAVIGATION.GOTO,
          { pageNumber, ...(position !== null ? { position } : {}) },
          { actorId: "BookmarkSidebarUI" }
        );
      } catch (err) { this.#logger.warn("select_node failed", err); }
    });
    // 拖拽重排 → 发出 REORDER
    // eslint-disable-next-line custom/event-name-format
    $container.on("move_node.jstree", (e, dataEvt) => {
      try {
        const movedId = dataEvt.node.id;
        const newParent = dataEvt.parent === "#" ? null : dataEvt.parent;
        const newIndexFinal = dataEvt.position; // jsTree 提供的是“移动后”的最终索引
        const sameParent = (dataEvt.old_parent === dataEvt.parent);
        const oldIndex = dataEvt.old_position;
        // BookmarkManager 期望的索引是“移动前兄弟数组中的目标插入位”，
        // 且在“同父且 oldIndex < targetIndex”时会自行左移 1。
        // 因此当同父且向后移动(newIndexFinal > oldIndex)时，需要先 +1，避免被再次左移后落到前面。
        const preRemovalIndex = sameParent && (newIndexFinal > oldIndex)
          ? (newIndexFinal + 1)
          : newIndexFinal;

        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.BOOKMARK.REORDER.REQUESTED,
          { bookmarkId: movedId, newParentId: newParent, newIndex: preRemovalIndex },
          { actorId: "BookmarkSidebarUI" }
        );
      } catch (err) { this.#logger.warn("move_node failed", err); }
    });

    // 自定义拖放视觉反馈：上边框=前插入、下边框=后插入、背景色=成为子节点
    // 使用全局 dnd 事件，并限定在本组件容器内生效
    const NS = ".bookmarkDnd";
    const self = this;
    let lastEl = null; let lastZone = null; let dragNodeId = null; let movedHandled = false;
    const clearHighlight = () => {
      if (!lastEl) {return;}
      try {
        lastEl.style.borderTop = "";
        lastEl.style.borderBottom = "";
        lastEl.style.backgroundColor = "";
      } catch (_) {}
      lastEl = null; lastZone = null;
    };
    try { $(document).off(NS); } catch (_) {}
    // 捕获开始拖拽，记录被拖拽的节点ID
    $(document).on("dnd_start.vakata" + NS, (evt, data) => {
      try {
        if (data && data.data && data.data.jstree && Array.isArray(data.data.nodes)) {
          dragNodeId = data.data.nodes[0] || null;
        } else { dragNodeId = null; }
        movedHandled = false;
      } catch (_) { dragNodeId = null; movedHandled = false; }
    });
    $(document).on("dnd_move.vakata" + NS, (evt, data) => {
      try {
        const $li = $(data.event.target).closest("li.jstree-node");
        if (!$li.length || !$li.closest(self.#bookmarkList).length) { clearHighlight(); return; }
        const el = $li.get(0);
        const rect = el.getBoundingClientRect();
        const y = data.event.clientY - rect.top;
        const h = rect.height || 1;
        const zone = y < h * 0.3 ? "before" : (y > h * 0.7 ? "after" : "child");
        if (el !== lastEl || zone !== lastZone) {
          clearHighlight();
          if (zone === "before") { el.style.borderTop = "2px solid #4CAF50"; }
          if (zone === "after") { el.style.borderBottom = "2px solid #4CAF50"; }
          if (zone === "child") { el.style.backgroundColor = "rgba(76, 175, 80, 0.2)"; }
          lastEl = el; lastZone = zone;
        }
      } catch (err) { /* ignore */ }
    });
    // move_node 已处理的标记
    $container.on("move_node.jstree", () => { movedHandled = true; });
    // 停止拖拽：如未触发 move_node 且在容器内空白区域，视为“放到根的末尾”
    $(document).on("dnd_stop.vakata" + NS, (evt, data) => {
      try {
        const $target = $(data && data.event && data.event.target);
        const inContainer = $target && $target.closest(self.#bookmarkList).length > 0;
        const onNode = $target && $target.closest("li.jstree-node").length > 0;
        if (inContainer && !onNode && !movedHandled && dragNodeId) {
          // 作为根级最后一个插入
          self.#eventBus.emit(
            PDF_VIEWER_EVENTS.BOOKMARK.REORDER.REQUESTED,
            { bookmarkId: dragNodeId, newParentId: null, newIndex: self.#bookmarks.length },
            { actorId: "BookmarkSidebarUI" }
          );
        }
      } catch (_) { /* ignore */ }
      clearHighlight();
      dragNodeId = null; movedHandled = false;
    });
  }

  #toJsTreeData(bookmarks) {
    const flat = [];
    const walk = (nodes, parentId) => {
      nodes.forEach((n) => {
        flat.push({
          id: n.id,
          parent: parentId || "#",
          text: n.name || "(未命名)",
          data: { pageNumber: n.pageNumber || 1, region: n.region || null, raw: n }
        });
        if (n.children && n.children.length) { walk(n.children, n.id); }
      });
    };
    walk(bookmarks, null);
    return flat;
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
      { actorId: "BookmarkSidebarUI" }
    );

    this.#logger.debug(`Outline selected: ${bookmarkId}`);
  }

  /**
   * 更新选中状态的UI（不发出事件）
   * @param {string} bookmarkId - 书签ID
   * @param {boolean} scrollIntoView - 是否滚动到可见区域
   * @private
   */
  #updateSelectionUI(bookmarkId, scrollIntoView = false) {
    // 清除之前的选中状态（只选择书签标题按钮，不包括跳转按钮）
    this.#bookmarkList.querySelectorAll(".bookmark-title-btn").forEach(btn => {
      btn.style.backgroundColor = "transparent";
      btn.style.fontWeight = "normal";
    });

    // 设置新的选中状态
    const selectedBtn = this.#bookmarkList.querySelector(`.bookmark-title-btn[data-bookmark-id="${bookmarkId}"]`);
    if (selectedBtn) {
      selectedBtn.style.backgroundColor = "#e3f2fd";
      selectedBtn.style.fontWeight = "bold";

      // 滚动到可见区域
      if (scrollIntoView) {
        selectedBtn.scrollIntoView({ behavior: "smooth", block: "center" });
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
      this.#logger.warn("External selection event missing bookmarkId");
      return;
    }

    this.#logger.info(`Handling external selection: ${bookmarkId}`);
    // 更新UI并滚动到选中的书签
    this.#updateSelectionUI(bookmarkId, true);
  }

  #renderEmpty() {
    if (!this.#bookmarkList) {return;}

    // 清空列表区域
    this.#bookmarkList.innerHTML = "<div style=\"color:#666;padding:8px;text-align:center;\">无书签</div>";
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
    const bookmarkItems = this.#bookmarkList.querySelectorAll("li[data-bookmark-id]");
    bookmarkItems.forEach(li => {
      li.draggable = this.#sortMode;
      // 在排序模式下添加视觉提示
      if (this.#sortMode) {
        li.style.cursor = "move";
      } else {
        li.style.cursor = "";
      }
    });

    // 在排序模式下强制隐藏所有跳转按钮
    if (this.#sortMode) {
      const jumpButtons = this.#bookmarkList.querySelectorAll(".bookmark-jump-btn");
      jumpButtons.forEach(btn => {
        btn.style.display = "none";
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
      this.#logger.warn("Dragged or target bookmark not found");
      return;
    }

    // 防止把父书签拖到自己的子孙书签中（会造成循环引用）
    if (this.#isDescendant(draggedId, targetId)) {
      this.#logger.warn("Cannot move parent into its own descendant");
      return;
    }

    let newParentId;
    let newIndex;

    if (dropZone === "child") {
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
        this.#logger.warn("Target bookmark not found in siblings");
        return;
      }

      newParentId = targetParentId;
      // 统一的索引策略（与后端管理器的同父左移修正配合）：
      // - before: 传递 targetIndex
      // - after:  传递 targetIndex + 1
      // BookmarkManager 在同父且 oldIdx < targetIndex 的情况下会将内部插入索引左移 1，
      // 从而实现最终“before/after”语义的稳定结果。
      newIndex = (dropZone === "before") ? targetIndex : (targetIndex + 1);
    }

    // 发出重新排序事件（同时附带引用与位置，便于特性层重新计算更稳妥的索引）
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.BOOKMARK.REORDER.REQUESTED,
      {
        bookmarkId: draggedId,
        newParentId: newParentId,
        newIndex,
        referenceId: targetId,
        position: dropZone
      },
      { actorId: "BookmarkSidebarUI" }
    );

    this.#logger.info(`Reorder requested: ${draggedId} -> parent=${newParentId || "root"}, index=${newIndex} (zone=${dropZone})`);

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
      this.#logger.warn("Local reorder preview failed:", e);
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
      if (!Array.isArray(arr)) {return false;}
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
    if (!node) {return;}
    const clamp = (i, len) => Math.max(0, Math.min(typeof i === "number" ? i : 0, len));

    if (!parentId) {
      const i = clamp(index, this.#bookmarks.length);
      this.#bookmarks.splice(i, 0, node);
      return;
    }

    const parent = this.#findBookmarkById(this.#bookmarks, parentId);
    if (!parent) {return;}
    if (!Array.isArray(parent.children)) {parent.children = [];}
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
    if (!ancestor) {return false;}

    const checkChildren = (bookmark) => {
      if (bookmark.id === childId) {return true;}
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
        if (found) {return found;}
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
    this.#logger.info("BookmarkSidebarUI destroyed");
  }
}

export default BookmarkSidebarUI;
