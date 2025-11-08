/**
 * @file OutlineToolbar 大纲工具栏组件
 * @module outline/components/outline-toolbar
 */

import { getLogger } from "../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { showInfo } from "../../../common/utils/notification.js";

export class OutlineToolbar {
  #logger;
  #eventBus;
  #container;
  #buttons = {};
  #selectedOutlineItemId = null;
  #sortMode = false;
  #instanceId;

  constructor({ eventBus }) {
    this.#logger = getLogger("OutlineToolbar");
    this.#eventBus = eventBus;
    this.#instanceId = `otb-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36).slice(-4)}`;
  }

  initialize() {
    this.#container = this.#createToolbarElement();
    this.#setupEventListeners();
    this.#updateButtonStates();
    this.#logger.info("OutlineToolbar initialized");
  }

  #createToolbarElement() {
    const toolbar = document.createElement("div");
    toolbar.className = "outline-toolbar";
    toolbar.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-bottom: 1px solid #ddd;
      background-color: #f5f5f5;
    `;

    this.#buttons.add = this.#createButton({ id: "add", icon: "➕", tooltip: "将当前页添加为大纲" });
    this.#buttons.delete = this.#createButton({ id: "delete", icon: "🗑️", tooltip: "删除选中的大纲" });
    this.#buttons.edit = this.#createButton({ id: "edit", icon: "✏️", tooltip: "编辑选中的大纲" });

    const separator = document.createElement("div");
    separator.style.cssText = "width: 1px; height: 20px; background-color: #ccc; margin: 0 4px;";

    this.#buttons.sort = this.#createButton({ id: "sort", icon: "⇅", tooltip: "拖拽柄已启用，无需此按钮" });
    this.#buttons.sort.style.display = "none";

    toolbar.appendChild(this.#buttons.add);
    toolbar.appendChild(this.#buttons.delete);
    toolbar.appendChild(this.#buttons.edit);
    toolbar.appendChild(separator);
    toolbar.appendChild(this.#buttons.sort);
    return toolbar;
  }

  #createButton({ id, icon, tooltip }) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `outline-btn outline-btn-${id}`;
    btn.title = tooltip;
    btn.textContent = icon;
    btn.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background-color: white;
      cursor: pointer;
      transition: all 0.2s ease;
      user-select: none;
    `;

    btn.addEventListener("mouseenter", () => {
      if (!btn.disabled) { btn.style.backgroundColor = "#e8e8e8"; btn.style.borderColor = "#aaa"; }
    });
    btn.addEventListener("mouseleave", () => {
      if (!btn.disabled) { btn.style.backgroundColor = "white"; btn.style.borderColor = "#ccc"; }
    });

    if (id === "add") { btn.addEventListener("click", () => this.#handleAddClick()); }
    if (id === "delete") { btn.addEventListener("click", () => this.#handleDeleteClick()); }
    if (id === "edit") { btn.addEventListener("click", () => this.#handleEditClick()); }
    if (id === "sort") { btn.addEventListener("click", () => this.#handleSortClick()); }

    return btn;
  }

  #setupEventListeners() {
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.OUTLINE.SELECT.CHANGED,
      (data) => this.#handleSelectionChanged(data),
      { subscriberId: `OutlineToolbar:${this.#instanceId}` }
    );
  }

  #handleAddClick() {
    // 统一使用 CREATE 事件族
    this.#eventBus.emitGlobal(
      PDF_VIEWER_EVENTS.OUTLINE.CREATE.REQUESTED,
      {},
      { actorId: "OutlineToolbar" }
    );
  }
  #handleDeleteClick() {
    if (!this.#selectedOutlineItemId) {return;}
    this.#eventBus.emitGlobal(
      PDF_VIEWER_EVENTS.OUTLINE.DELETE.REQUESTED,
      { outlineItemId: this.#selectedOutlineItemId, cascadeDelete: true },
      { actorId: "OutlineToolbar" }
    );
  }
  #handleEditClick() {
    if (!this.#selectedOutlineItemId) {return;}
    this.#eventBus.emitGlobal(
      PDF_VIEWER_EVENTS.OUTLINE.UPDATE.REQUESTED,
      { outlineItemId: this.#selectedOutlineItemId },
      { actorId: "OutlineToolbar" }
    );
  }
  #handleSortClick() {
    this.#sortMode = !this.#sortMode;
    const msg = this.#sortMode ? "拖动大纲进行排序" : "排序模式已关闭";
    try { showInfo(msg); } catch {}
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.OUTLINE.SORT.MODE_CHANGED,
      { sortMode: this.#sortMode },
      { actorId: "OutlineToolbar" }
    );
  }

  #handleSelectionChanged(data) {
    this.#selectedOutlineItemId = data?.outlineItemId || null;
    this.#updateButtonStates();
  }

  #updateButtonStates() {
    const hasSelection = !!this.#selectedOutlineItemId;
    this.#setButtonEnabled(this.#buttons.add, true);
    this.#setButtonEnabled(this.#buttons.delete, hasSelection);
    this.#setButtonEnabled(this.#buttons.edit, hasSelection);
  }

  #setButtonEnabled(button, enabled) {
    button.disabled = !enabled;
    button.style.opacity = enabled ? "1" : "0.5";
    button.style.cursor = enabled ? "pointer" : "not-allowed";
  }

  getElement() { return this.#container; }

  destroy() {
    if (this.#container?.parentNode) { this.#container.parentNode.removeChild(this.#container); }
    this.#container = null;
    this.#buttons = {};
  }
}

export default OutlineToolbar;
