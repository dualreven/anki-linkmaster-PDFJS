/**
 * @file OutlineSidebarUI - 使用 jsTree 展示 PDF 大纲
 * @module features/pdf-outline/components/outline-sidebar-ui
 */

import { getLogger } from "../../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
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
import { BookmarkToolbar } from "../../pdf-bookmark/components/bookmark-toolbar.js";

export class OutlineSidebarUI {
  #eventBus;
  #logger;
  #content;
  #treeContainer;
  #toolbarEl;
  #unsubs = [];

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("OutlineSidebarUI");
  }

  initialize() {
    this.#logger.info("[DEBUG] OutlineSidebarUI initialize() called");

    this.#content = document.createElement("div");
    this.#content.style.cssText = "height:100%;display:flex;flex-direction:column;box-sizing:border-box;";

    // 复用现有 BookmarkToolbar，以保持创建/删除按钮与体验一致
    this.#toolbarEl = document.createElement("div");
    this.#toolbarEl.style.cssText = "flex:0 0 auto;";
    this.#content.appendChild(this.#toolbarEl);
    this.#mountToolbar();

    // 树容器
    this.#treeContainer = document.createElement("div");
    this.#treeContainer.id = "pdf-outline-tree";
    this.#treeContainer.style.cssText = "flex:1;overflow:auto;padding:8px;";
    this.#content.appendChild(this.#treeContainer);

    this.#logger.info(`[DEBUG] Subscribing to event: ${PDF_VIEWER_EVENTS.BOOKMARK.LOAD.SUCCESS}`);

    // 监听数据加载事件
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.BOOKMARK.LOAD.SUCCESS,
      (data) => {
        this.#logger.info(`[DEBUG] BOOKMARK.LOAD.SUCCESS event received! Bookmarks count: ${data?.bookmarks?.length || 0}`);
        this.#renderTree(data?.bookmarks || []);
      },
      { subscriberId: "OutlineSidebarUI" }
    ));

    this.#logger.info("[DEBUG] OutlineSidebarUI initialized successfully");
  }

  getContentElement() { return this.#content; }

  #mountToolbar() {
    // 直接挂载现有 BookmarkToolbar，保证同步渲染
    try {
      const toolbar = new BookmarkToolbar({ eventBus: this.#eventBus });
      toolbar.initialize();
      this.#toolbarEl.appendChild(toolbar.getElement());
    } catch (e) {
      this.#logger.warn("Failed to mount BookmarkToolbar (fallback without toolbar):", e);
    }
  }

  #toJsTreeData(bookmarks) {
    const flat = [];
    const walk = (nodes, parentId) => {
      nodes.forEach((n) => {
        flat.push({
          id: n.id,
          parent: parentId || "#",
          text: n.name || "(未命名)",
          data: {
            pageNumber: n.pageNumber || 1,
            region: n.region || null,
            raw: n
          }
        });
        if (n.children?.length) { walk(n.children, n.id); }
      });
    };
    walk(bookmarks, null);
    return flat;
  }

  #renderTree(bookmarks) {
    // 清空并重建 jsTree
    const $tree = $(this.#treeContainer);
    try { $tree.jstree("destroy"); } catch { /* ignore */ }

    const data = this.#toJsTreeData(bookmarks);
    this.#logger.info(`[DEBUG] Creating jstree with ${data.length} nodes`);

    $tree.jstree({
      core: {
        data,
        check_callback: true,
        themes: { stripes: true }
      },
      plugins: ["dnd", "wholerow"]
    });

    this.#logger.info("[DEBUG] jsTree created, waiting for ready event...");

    // 等待 jsTree 渲染完成后展开所有节点
    // eslint-disable-next-line custom/event-name-format
    $tree.on("ready.jstree", () => {
      this.#logger.info("[DEBUG] jsTree ready event fired!");
      try {
        $tree.jstree("open_all");
        this.#logger.info("✅ Outline tree expanded automatically");
      } catch (err) {
        this.#logger.error("❌ Failed to expand outline tree: " + err.message);
      }
    });

    // 选择节点 → 导航
    // eslint-disable-next-line custom/event-name-format
    $tree.on("select_node.jstree", (e, selected) => {
      try {
        const node = selected.node;
        const info = node?.data || {};
        const pageNumber = info.pageNumber || 1;
        const region = info.region || null;
        const position = (region && typeof region.scrollY === "number") ? region.scrollY : null;
        // 统一使用 URL 导航入口（若存在位置百分比，一并携带）
        try {
          // 重要：同文档内跳转不应携带 pdfId，避免被 URLNavigationFeature 误判为“需要重新加载PDF”
          this.#eventBus.emitGlobal(
            PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED,
            { pageAt: pageNumber, position: (typeof position === "number" ? position : null) },
            { actorId: "OutlineSidebarUI" }
          );
        } catch {
          this.#eventBus.emit(
            PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED,
            { pageAt: pageNumber, position: (typeof position === "number" ? position : null) },
            { actorId: "OutlineSidebarUI" }
          );
        }
      } catch (err) {
        this.#logger.warn("select_node failed", err);
      }
    });

    // 拖拽移动 → 触发重排
    // eslint-disable-next-line custom/event-name-format
    $tree.on("move_node.jstree", (e, dataEvt) => {
      try {
        const movedId = dataEvt.node.id;
        const newParent = dataEvt.parent === "#" ? null : dataEvt.parent;
        const newIndex = dataEvt.position; // 0-based index under parent
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.BOOKMARK.REORDER.REQUESTED,
          { bookmarkId: movedId, newParentId: newParent, newIndex },
          { actorId: "OutlineSidebarUI" }
        );
      } catch (err) {
        this.#logger.warn("move_node failed", err);
      }
    });
  }

  destroy() {
    this.#unsubs.forEach(u => { try { u(); } catch { /* ignore */ } });
    this.#unsubs = [];
    try { $(this.#treeContainer).jstree("destroy"); } catch { /* ignore */ }
    if (this.#content?.parentNode) { this.#content.parentNode.removeChild(this.#content); }
    this.#content = null;
    this.#treeContainer = null;
    this.#toolbarEl = null;
  }
}

export default OutlineSidebarUI;
