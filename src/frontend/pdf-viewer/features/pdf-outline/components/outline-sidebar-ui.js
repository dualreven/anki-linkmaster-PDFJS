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
import { showSuccess, showError } from "../../../../common/utils/notification.js";

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
    this.#logger.info("[OutlineUI] 初始化", { toast: { type: "info", ms: 1500 } });

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
        try {
          const cnt = Array.isArray(data?.bookmarks) ? data.bookmarks.length : 0;
          if (cnt > 0) { this.#logger.info(`[OutlineUI] 收到大纲：${cnt} 项`, { toast: true }); }
          else { this.#logger.warn("[OutlineUI] 当前无大纲（可通过＋创建或自动导入）", { toast: { type: "warn", ms: 3500 } }); }
        } catch {}
        this.#renderTree(data?.bookmarks || []);
      },
      { subscriberId: "OutlineSidebarUI" }
    ));

    this.#logger.info("[DEBUG] OutlineSidebarUI initialized successfully");

    // UI 初始化后，主动请求一次大纲列表，避免错过早先发射的加载事件
    try {
      // 使用全局事件名（与 Feature 对齐）
      this.#eventBus.emit(PDF_VIEWER_EVENTS.BOOKMARK.LOAD.REQUESTED, {}, { actorId: "OutlineSidebarUI" });
      this.#logger.info("[OutlineUI] 请求刷新大纲列表", { toast: true });
    } catch {}
  }

  getContentElement() { return this.#content; }

  #mountToolbar() {
    // 直接挂载现有 BookmarkToolbar，保证同步渲染
    try {
      const toolbar = new BookmarkToolbar({ eventBus: this.#eventBus });
      toolbar.initialize();
      const tbEl = toolbar.getElement();
      this.#toolbarEl.appendChild(tbEl);

      // 在同一行工具栏末尾添加“复制ID”按钮（样式对齐现有按钮）
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.dataset.action = "copy-outline-id";
      copyBtn.title = "复制选中的大纲项ID";
      copyBtn.innerHTML = "<span style=\"font-size:18px;\">📋</span>";
      copyBtn.style.cssText = [
        "display:flex","align-items:center","justify-content:center",
        "width:36px","height:36px","padding:0",
        "border:1px solid #ccc","border-radius:4px",
        "background-color:white","cursor:pointer","transition:all .2s"
      ].join(";");
      copyBtn.addEventListener("mouseenter", () => {
        if (!copyBtn.disabled) { copyBtn.style.backgroundColor = "#e8e8e8"; copyBtn.style.borderColor = "#aaa"; }
      });
      copyBtn.addEventListener("mouseleave", () => {
        if (!copyBtn.disabled) { copyBtn.style.backgroundColor = "white"; copyBtn.style.borderColor = "#ccc"; }
      });
      copyBtn.addEventListener("click", () => this.#handleCopySelectedOutlineId());

      tbEl.appendChild(copyBtn);
    } catch (e) {
      this.#logger.warn("Failed to mount BookmarkToolbar (fallback without toolbar):", e);
    }
  }

  #toJsTreeData(bookmarks) {
    const flat = [];
    const walk = (nodes, parentId) => {
      nodes.forEach((n) => {
        // 统一读取 pageAt/position，兼容旧字段 pageNumber/region.scrollY
        const pageAt = (typeof n.pageAt === "number" && n.pageAt > 0) ? n.pageAt : null;
        const position = (typeof n.position === "number") ? n.position : null;
        flat.push({
          id: n.id,
          parent: parentId || "#",
          text: n.name || "(未命名)",
          data: {
            // 仅保留标准字段；缺失即为无效节点
            pageAt,
            position,
            invalid: !(typeof n.pageAt === "number" && n.pageAt > 0),
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
    try { this.#logger.info(`[OutlineUI] 构建树：${data.length} 节点`, { toast: true }); } catch {}

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
        try { this.#logger.info("[OutlineUI] 大纲树渲染完成并已展开", { toast: true }); } catch {}
      } catch (err) {
        this.#logger.error("❌ Failed to expand outline tree: " + err.message);
        try { this.#logger.error(`[OutlineUI] 展开失败：${err?.message || "error"}`, { toast: { type: "error", ms: 4500 } }); } catch {}
      }
    });

    // 选择节点 → 导航
    // eslint-disable-next-line custom/event-name-format
    $tree.on("select_node.jstree", (e, selected) => {
      try {
        const node = selected.node;
        const info = node?.data || {};
        const outlineItemId = node?.id || null;
        // 统一改为按ID发射导航请求
        const payload = { outlineItemId };
        try {
          try { this.#logger.info(`[OutlineSidebarUI] emit BOOKMARK.NAVIGATE_BY_ID.REQUESTED ${JSON.stringify(payload)}`); } catch {}
          try { this.#logger.info(`[OutlineUI] 选择节点：${outlineItemId}`, { toast: true }); } catch {}
          this.#eventBus.emitGlobal(
            PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE_BY_ID.REQUESTED,
            payload,
            { actorId: "OutlineSidebarUI" }
          );
        } catch {
          try { this.#logger.info(`[OutlineUI] (scoped) 选择节点：${outlineItemId}`, { toast: true }); } catch {}
          this.#eventBus.emit(
            PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE_BY_ID.REQUESTED,
            payload,
            { actorId: "OutlineSidebarUI" }
          );
        }
      } catch (err) {
        this.#logger.warn("select_node failed", err);
        try { this.#logger.error(`[OutlineUI] 选择失败：${err?.message || "error"}`, { toast: { type: "error", ms: 4500 } }); } catch {}
      }
    });

    // 拖拽移动 → 触发重排
    // eslint-disable-next-line custom/event-name-format
    $tree.on("move_node.jstree", (e, dataEvt) => {
      try {
        const movedId = dataEvt.node.id;
        const newParent = dataEvt.parent === "#" ? null : dataEvt.parent;
        const newIndex = dataEvt.position; // 0-based index under parent
        try { this.#logger.info(`[OutlineUI] 拖拽：${movedId} → parent=${newParent || "root"} pos=${newIndex}`, { toast: true }); } catch {}
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.BOOKMARK.REORDER.REQUESTED,
          { bookmarkId: movedId, newParentId: newParent, newIndex },
          { actorId: "OutlineSidebarUI" }
        );
      } catch (err) {
        this.#logger.warn("move_node failed", err);
        try { this.#logger.error(`[OutlineUI] 拖拽失败：${err?.message || "error"}`, { toast: { type: "error", ms: 4500 } }); } catch {}
      }
    });
  }

  #handleCopySelectedOutlineId() {
    try {
      const $tree = $(this.#treeContainer);
      // jsTree API: get_selected(true) 返回包含节点对象的数组
      const inst = $tree.jstree(true);
      const selected = inst ? inst.get_selected(true) : [];
      const node = Array.isArray(selected) && selected.length > 0 ? selected[0] : null;
      const id = node?.id || null;
      if (!id) {
        showError("✗ 请先选中一个大纲项", 3000);
        try { this.#logger.warn("[OutlineUI] 复制失败：未选中节点", { toast: { type: "warn", ms: 2500 } }); } catch {}
        return;
      }
      const ok = this.#copyUsingExecCommand(id);
      if (ok) {
        showSuccess("✓ 已复制大纲ID", 2000);
        this.#logger.info(`[OutlineUI] 已复制大纲ID: ${id}`);
      } else {
        showError("✗ 复制失败", 3000);
        this.#logger.error("[OutlineUI] 复制失败：execCommand 返回 false");
      }
    } catch (e) {
      this.#logger.error("[OutlineUI] 复制失败（异常）", e);
      try { showError("✗ 复制失败", 3000); } catch {}
    }
  }

  #copyUsingExecCommand(text) {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = String(text ?? "");
      textarea.style.cssText = [
        "position: fixed",
        "top: 0",
        "left: 0",
        "width: 2em",
        "height: 2em",
        "padding: 0",
        "border: none",
        "outline: none",
        "boxShadow: none",
        "background: transparent",
        "opacity: 0",
        "pointer-events: none"
      ].join(";");
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return !!ok;
    } catch {
      return false;
    }
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
