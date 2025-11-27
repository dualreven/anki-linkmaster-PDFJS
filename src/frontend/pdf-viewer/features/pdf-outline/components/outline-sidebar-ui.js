/* eslint no-empty: "off" */
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
} catch (e) { void e; }
import "jstree";
import "jstree/dist/themes/default/style.css";
import { OutlineToolbar } from "../../../outline/components/outline-toolbar.js";
import { showSuccess, showError } from "../../../../common/utils/notification.js";
import { notifyDomainError } from "../../../../common/utils/domain-error-notifier.js";

export class OutlineSidebarUI {
  #eventBus;
  #logger;
  #content;
  #treeContainer;
  #toolbarEl;
  #unsubs = [];
  #initialized = false;

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("OutlineSidebarUI");
  }

  initialize() {
    if (this.#initialized) {
      // 避免被重复初始化导致重复订阅
      this.#logger.warn("[OutlineSidebarUI] initialize() called more than once, skip");
      return;
    }
    this.#logger.info("[DEBUG] OutlineSidebarUI initialize() called");
    this.#logger.info("[OutlineUI] 初始化", { toast: { type: "info", ms: 1500 } });

    this.#content = document.createElement("div");
    this.#content.style.cssText = "height:100%;display:flex;flex-direction:column;box-sizing:border-box;";

    // 使用 OutlineToolbar（创建/编辑/删除）
    this.#toolbarEl = document.createElement("div");
    this.#toolbarEl.style.cssText = "flex:0 0 auto;";
    this.#content.appendChild(this.#toolbarEl);
    this.#mountToolbar();

    // 树容器
    this.#treeContainer = document.createElement("div");
    this.#treeContainer.id = "pdf-outline-tree";
    this.#treeContainer.style.cssText = "flex:1;overflow:auto;padding:8px;";
    this.#content.appendChild(this.#treeContainer);

    this.#logger.info(`[DEBUG] Subscribing to event: ${PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS}`);

    // 监听数据加载事件（全局事件，数据层通过 emitGlobal 发射）
    this.#unsubs.push(this.#eventBus.onGlobal(
      PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS,
      (data) => {
        this.#logger.info(`[DEBUG] OUTLINE.LOAD.SUCCESS event received! Outline items count: ${data?.outlineItems?.length || 0}`);
        try {
          const cnt = Array.isArray(data?.outlineItems) ? data.outlineItems.length : 0;
          if (cnt > 0) { this.#logger.info(`[OutlineUI] 收到大纲：${cnt} 项`, { toast: true }); }
          else { this.#logger.info("[OutlineUI] 当前无大纲（可通过＋创建或自动导入）", { toast: { type: "warn", ms: 3500 } }); }
        } catch (e) { void e; }
        this.#renderTree(data?.outlineItems || []);
      },
      { subscriberId: "OutlineSidebarUI" }
    ));

    // 监听来自其他模块的“选中改变”事件，用于外部导航时高亮并滚动到指定大纲项
    this.#unsubs.push(this.#eventBus.onGlobal(
      PDF_VIEWER_EVENTS.OUTLINE.SELECT.CHANGED,
      (data, metadata) => {
        try {
          const outlineItemId = data?.outlineItemId || data?.bookmarkId || null;
          const actorId = metadata?.actorId || "";
          // 避免自己触发的事件再次处理（只处理外部来源）
          if (!outlineItemId || actorId === "OutlineSidebarUI") {
            return;
          }
          this.#focusNodeById(String(outlineItemId));
        } catch (e) {
          this.#logger.warn("[OutlineUI] 处理外部选中事件失败", e);
        }
      },
      { subscriberId: "OutlineSidebarUI" }
    ));

    this.#logger.info("[DEBUG] OutlineSidebarUI initialized successfully");
    this.#initialized = true;

    // UI 初始化后，主动请求一次大纲列表，避免错过早先发射的加载事件
    try {
      // 使用全局事件名，与数据层 OutlineManager 的 onGlobal 匹配
      this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.LOAD.REQUESTED, {}, { actorId: "OutlineSidebarUI" });
      this.#logger.info("[OutlineUI] 请求刷新大纲列表", { toast: true });
    } catch (e) { void e; }
  }

  getContentElement() { return this.#content; }
  isInitialized() { return this.#initialized; }

  #focusNodeById(outlineItemId) {
    try {
      const id = (outlineItemId || "").trim();
      if (!id) { return; }
      const $tree = $(this.#treeContainer);
      const inst = $tree.jstree(true);
      if (!inst) {
        this.#logger.warn("[OutlineUI] jsTree instance not ready when trying to focus node", { id });
        return;
      }
      // 选中并滚动到节点（若不存在则静默返回）
      if (!inst.get_node(id)) {
        this.#logger.warn("[OutlineUI] outline node not found when trying to focus", { id });
        return;
      }
      inst.deselect_all(true);
      inst.select_node(id, true, true);
      // jsTree 自带的滚动行为有时不稳定，这里再用 DOM 确保滚动可见
      const nodeEl = this.#treeContainer.querySelector(`[id="${CSS.escape(id)}"]`);
      if (nodeEl && nodeEl.scrollIntoView) {
        nodeEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      this.#logger.info("[OutlineUI] Focused outline node by id", { id });
    } catch (e) {
      this.#logger.warn("[OutlineUI] focusNodeById failed", e);
    }
  }

  #mountToolbar() {
    // 直接挂载现有 OutlineToolbar，保证同步渲染
    try {
      const toolbar = new OutlineToolbar({ eventBus: this.#eventBus });
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
      this.#logger.warn("Failed to mount OutlineToolbar (fallback without toolbar):", e);
    }
  }

  #toJsTreeData(outlineItems) {
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
    walk(outlineItems, null);
    return flat;
  }

  #renderTree(outlineItems) {
    // 清空并重建 jsTree
    const $tree = $(this.#treeContainer);
    try { $tree.off("ready.jstree"); } catch (e) { void e; }
    try { $tree.jstree("destroy"); } catch (e) { void e; }

    const data = this.#toJsTreeData(outlineItems);
    this.#logger.info(`[DEBUG] Creating jstree with ${data.length} nodes`);
    try { this.#logger.info(`[OutlineUI] 构建树：${data.length} 节点`, { toast: true }); } catch (e) { void e; }

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

    $tree.on("ready.jstree", () => {
      this.#logger.info("[DEBUG] jsTree ready event fired!");
      try {
        const inst = $tree.jstree(true);
        if (inst) {
          inst.open_all();
          // 启动时不默认选中任何节点，等待用户或外部导航显式指定
          inst.deselect_all(true);
        }
        this.#logger.info("✅ Outline tree expanded automatically");
        try { this.#logger.info("[OutlineUI] 大纲树渲染完成并已展开", { toast: true }); } catch (e) { void e; }
      } catch (err) {
        this.#logger.error("❌ Failed to expand outline tree: " + err.message);
        try { this.#logger.error(`[OutlineUI] 展开失败：${err?.message || "error"}`, { toast: { type: "error", ms: 4500 } }); } catch (e2) { void e2; }
      }
    });

    // 选择节点 → 导航
    $tree.on("select_node.jstree", (e, selected) => {
      try {
        const node = selected.node;
        const info = node?.data || {};
        const outlineItemId = node?.id || null;
        // 先广播选择变化（供工具栏启用编辑/删除按钮等）
        try {
          this.#eventBus.emit(
            PDF_VIEWER_EVENTS.OUTLINE.SELECT.CHANGED,
            { outlineItemId, outlineItem: info?.raw || null },
            { actorId: "OutlineSidebarUI" }
          );
        } catch (e) { void e; }
        // 直接根据节点携带的 pageAt/position 进行页面导航（等价于手工点击）
        const pageAt = typeof info.pageAt === "number" && info.pageAt > 0 ? info.pageAt : null;
        const position = typeof info.position === "number" ? info.position : null;
        if (pageAt != null) {
          const req = { pageAt };
          if (position != null) { req.position = position; }
          try {
            this.#logger.info(`[OutlineUI] 选择节点：${outlineItemId} → 导航到第 ${pageAt} 页`, { toast: true });
          } catch (e2) { void e2; }
          this.#eventBus.emitGlobal(
            PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED,
            req,
            { actorId: "OutlineSidebarUI" }
          );
        }
      } catch (err) {
        this.#logger.warn("select_node failed", err);
        try { this.#logger.error(`[OutlineUI] 选择失败：${err?.message || "error"}`, { toast: { type: "error", ms: 4500 } }); } catch (e2) { void e2; }
      }
    });

    // 拖拽移动 → 触发重排

    $tree.on("move_node.jstree", (e, dataEvt) => {
      try {
        const movedId = dataEvt.node.id;
        const newParent = dataEvt.parent === "#" ? null : dataEvt.parent;
        const newIndex = dataEvt.position; // 0-based index under parent
        try { this.#logger.info(`[OutlineUI] 拖拽：${movedId} → parent=${newParent || "root"} pos=${newIndex}`, { toast: true }); } catch (e) { void e; }
        // 使用全局事件，交由特性/适配器转发到后端
        this.#eventBus.emitGlobal(
          PDF_VIEWER_EVENTS.OUTLINE.REORDER.REQUESTED,
          { outlineItemId: movedId, newParentId: newParent, newIndex },
          { actorId: "OutlineSidebarUI" }
        );
      } catch (err) {
        this.#logger.warn("move_node failed", err);
        try { this.#logger.error(`[OutlineUI] 拖拽失败：${err?.message || "error"}`, { toast: { type: "error", ms: 4500 } }); } catch (e2) { void e2; }
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
        notifyDomainError({
          message: "✗ 请先选中一个大纲项",
          logger: this.#logger,
          scope: "pdf-viewer:outline:copy-id:no-selection"
        });
        try { this.#logger.warn("[OutlineUI] 复制失败：未选中节点", { toast: { type: "warn", ms: 2500 } }); } catch (e) { void e; }
        return;
      }
      const ok = this.#copyUsingExecCommand(id);
      if (ok) {
        showSuccess("✓ 已复制大纲ID", 2000);
        this.#logger.info(`[OutlineUI] 已复制大纲ID: ${id}`);
      } else {
        notifyDomainError({
          message: "✗ 复制失败",
          logger: this.#logger,
          scope: "pdf-viewer:outline:copy-id:exec-false"
        });
        this.#logger.error("[OutlineUI] 复制失败：execCommand 返回 false");
      }
    } catch (e) {
      this.#logger.error("[OutlineUI] 复制失败（异常）", e);
      notifyDomainError({
        message: "✗ 复制失败",
        logger: this.#logger,
        scope: "pdf-viewer:outline:copy-id:exception",
        error: e
      });
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

