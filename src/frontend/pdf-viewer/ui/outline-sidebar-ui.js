/**
 * 大纲侧边栏UI（经典实现）
 * @file 渲染大纲树并处理交互
 * @module OutlineSidebarUIClassic
 */

import { getLogger } from "../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { OutlineToolbar } from "../outline/components/outline-toolbar.js";
import $ from "jquery";
try { if (typeof window !== "undefined") { window.$ = window.$ || $; window.jQuery = window.jQuery || $; } } catch {}
import "jstree";
import "jstree/dist/themes/default/style.css";

export class OutlineSidebarUIClassic {
  #eventBus;
  #logger;
  #sidebarContent;
  #outlineList;
  #toolbar;
  // #container/#sidebar/#sidebarHeader/#toggleBtn 已移除（未使用）
  #outlineItems = [];
  // 选中项/排序/拖拽状态由外部 UI 管理，避免在本类中持有未用私有字段
  #unsubs = [];

  constructor(eventBus, options = {}) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("OutlineSidebarUIClassic");
    // 容器与头部引用由外部 UI 基础设施管理；此处不再持有未使用的字段
  }

  initialize() {
    this.#sidebarContent = document.createElement("div");
    this.#sidebarContent.style.cssText = "height:100%;display:flex;flex-direction:column;box-sizing:border-box;";

    this.#toolbar = new OutlineToolbar({ eventBus: this.#eventBus });
    this.#toolbar.initialize();
    this.#sidebarContent.appendChild(this.#toolbar.getElement());

    this.#outlineList = document.createElement("div");
    this.#outlineList.style.cssText = "flex:1;overflow-y:auto;padding:12px;";
    this.#sidebarContent.appendChild(this.#outlineList);

    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS,
      (data) => {
        this.#logger.info("🎯 [DEBUG] OutlineSidebarUIClassic received OUTLINE.LOAD.SUCCESS", {
          outlineItemsCount: data?.outlineItems?.length || 0,
          eventName: PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS
        });
        this.#renderOutlineItems(data?.outlineItems || []);
      },
      { subscriberId: "OutlineSidebarUIClassic" }
    ));

    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.OUTLINE.LOAD.EMPTY,
      () => this.#renderEmpty(),
      { subscriberId: "OutlineSidebarUIClassic" }
    ));

    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.OUTLINE.SORT.MODE_CHANGED,
      (data) => this.#handleSortModeChanged(data),
      { subscriberId: "OutlineSidebarUIClassic" }
    ));

    // 监听来自其它模块的选择变化，用于远程导航时高亮并滚动到对应节点
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.OUTLINE.SELECT.CHANGED,
      (data, metadata) => {
        try {
          const actorId = metadata?.actorId || "";
          if (actorId === "OutlineSidebarUIClassic") { return; }
          const outlineItemId = data?.outlineItemId || data?.bookmarkId || null;
          if (!outlineItemId) { return; }
          this.#handleExternalSelection({ outlineItemId });
        } catch (e) {
          this.#logger.warn("OutlineSidebarUIClassic.handleExternalSelection failed", e);
        }
      },
      { subscriberId: "OutlineSidebarUIClassic" }
    ));

    this.#logger.info("OutlineSidebarUIClassic initialized with toolbar");

    try {
      this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.LOAD.REQUESTED, {}, { actorId: "OutlineSidebarUIClassic" });
    } catch {
      try { this.#eventBus.emit(PDF_VIEWER_EVENTS.OUTLINE.LOAD.REQUESTED, {}, { actorId: "OutlineSidebarUIClassic" }); } catch {}
    }
  }

  getContentElement() { return this.#sidebarContent; }

  #renderOutlineItems(outlineItems) {
    this.#outlineItems = Array.isArray(outlineItems) ? outlineItems : [];
    if (!this.#outlineList) {return;}
    const $container = $(this.#outlineList);
    try { $container.jstree("destroy"); } catch {}
    this.#outlineList.innerHTML = "";
    const data = this.#toJsTreeData(this.#outlineItems);
    this.#logger.info(`[DEBUG] Creating jstree with ${data.length} nodes`);
    $container.jstree({ core: { data, check_callback: true, themes: { stripes: true } }, plugins: ["dnd", "wholerow"], dnd: { is_draggable: () => true } });

    $container.on("ready.jstree", () => {
      try {
        const inst = $container.jstree(true);
        if (inst) {
          inst.open_all();
          // 启动时不默认选中任何节点，等待用户或外部导航显式指定
          inst.deselect_all(true);
        }
        this.#logger.info("✅ Outline tree expanded automatically");
      } catch (err) {
        this.#logger.error("❌ Expand outline tree failed: " + err.message);
      }
    });

    $container.on("select_node.jstree", (e, selected) => {
      try {
        const info = selected?.node?.data || {};
        const outlineItemId = selected?.node?.id || null;
        // 通知其他模块“当前选中项变化”，供工具栏等使用
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.OUTLINE.SELECT.CHANGED,
          { outlineItemId: outlineItemId, outlineItem: info.raw || null },
          { actorId: "OutlineSidebarUIClassic" }
        );
        // 直接根据节点携带的 pageAt/position 进行页面导航（等价于手工点击）
        const pageAt = typeof info.pageAt === "number" && info.pageAt > 0 ? info.pageAt : null;
        const position = typeof info.position === "number" ? info.position : null;
        if (pageAt != null) {
          const req = { pageAt };
          if (position != null) { req.position = position; }
          this.#eventBus.emitGlobal(
            PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED,
            req,
            { actorId: "OutlineSidebarUIClassic" }
          );
        }
      } catch (err) { this.#logger.warn("select_node failed", err); }
    });

    $container.on("move_node.jstree", (e, dataEvt) => {
      try {
        const movedId = dataEvt.node.id;
        const newParent = dataEvt.parent === "#" ? null : dataEvt.parent;
        const newIndexFinal = dataEvt.position;
        const sameParent = (dataEvt.old_parent === dataEvt.parent);
        const oldIndex = dataEvt.old_position;
        const preRemovalIndex = sameParent && (newIndexFinal > oldIndex) ? (newIndexFinal + 1) : newIndexFinal;
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.OUTLINE.REORDER.REQUESTED,
          { outlineItemId: movedId, newParentId: newParent, newIndex: preRemovalIndex },
          { actorId: "OutlineSidebarUIClassic" }
        );
      } catch (err) { this.#logger.warn("move_node failed", err); }
    });
  }

  #renderEmpty() {
    if (!this.#outlineList) { return; }
    this.#outlineList.innerHTML = "<div style='padding:12px;color:#666;'>暂无大纲</div>";
  }

  #toJsTreeData(outlineItems) {
    const flat = [];
    const walk = (nodes, parentId) => {
      nodes.forEach((n) => {
        const pageAt = (typeof n.pageAt === "number" && n.pageAt > 0) ? n.pageAt : null;
        const position = (typeof n.position === "number") ? n.position : null;
        flat.push({
          id: n.id,
          parent: parentId || "#",
          text: n.name || "(未命名)",
          data: { pageAt, position, invalid: !(typeof n.pageAt === "number" && n.pageAt > 0), raw: n }
        });
        if (n.children?.length) { walk(n.children, n.id); }
      });
    };
    walk(outlineItems, null);
    return flat;
  }

  #handleSortModeChanged(data) {
    // 排序模式 UI 交给外部；此处不持有状态
  }

  #handleExternalSelection(data) {
    try {
      const targetId = (data?.outlineItemId || data?.bookmarkId || "").trim();
      if (!targetId) { return; }
      if (!this.#outlineList) { return; }
      const $container = $(this.#outlineList);
      const inst = $container.jstree(true);
      if (!inst) {
        this.#logger.warn("OutlineSidebarUIClassic: jsTree instance not ready when handling external selection", { targetId });
        return;
      }
      if (!inst.get_node(targetId)) {
        this.#logger.warn("OutlineSidebarUIClassic: node not found for external selection", { targetId });
        return;
      }
      inst.deselect_all(true);
      inst.select_node(targetId, true, true);
      const nodeEl = this.#outlineList.querySelector(`[id="${CSS.escape(targetId)}"]`);
      if (nodeEl && nodeEl.scrollIntoView) {
        nodeEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      this.#logger.info("OutlineSidebarUIClassic: focused node by external selection", { targetId });
    } catch (e) {
      this.#logger.warn("OutlineSidebarUIClassic: handleExternalSelection failed", e);
    }
  }

  destroy() {
    try { this.#unsubs.forEach(u => { try { u(); } catch {} }); } catch {}
    this.#unsubs = [];
    if (this.#outlineList) {
      try { $(this.#outlineList).jstree("destroy"); } catch {}
      this.#outlineList.innerHTML = "";
    }
    this.#toolbar?.destroy?.();
  }
}

export default OutlineSidebarUIClassic;
