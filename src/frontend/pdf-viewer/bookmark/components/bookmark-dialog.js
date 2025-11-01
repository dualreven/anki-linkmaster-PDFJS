/**
 * @file BookmarkDialog 大纲对话框组件（从废弃的 pdf-bookmark 迁移至公共域）
 * @module bookmark/components/bookmark-dialog
 */

import { getLogger } from "../../../common/utils/logger.js";

export class BookmarkDialog {
  #logger;
  #dialog = null;
  #mode = null; // 'add'|'edit'|'delete'
  #currentBookmark = null;
  #callbacks = { onConfirm: null, onCancel: null };

  constructor() {
    this.#logger = getLogger("BookmarkDialog");
  }

  showAdd({ currentPage, onConfirm, onCancel }) {
    this.#mode = "add";
    this.#callbacks.onConfirm = onConfirm;
    this.#callbacks.onCancel = onCancel;
    this.#dialog = this.#createDialog({
      title: "添加大纲",
      content: this.#createAddEditForm({ pageAt: currentPage, position: null }),
      buttons: [
        { text: "取消", onClick: () => this.#handleCancel() },
        { text: "添加", onClick: () => this.#handleAddConfirm(), primary: true }
      ]
    });
    document.body.appendChild(this.#dialog);
  }

  showEdit({ bookmark, onConfirm, onCancel }) {
    this.#mode = "edit";
    this.#currentBookmark = bookmark;
    this.#callbacks.onConfirm = onConfirm;
    this.#callbacks.onCancel = onCancel;
    this.#dialog = this.#createDialog({
      title: "编辑大纲",
      content: this.#createAddEditForm(bookmark),
      buttons: [
        { text: "取消", onClick: () => this.#handleCancel() },
        { text: "保存", onClick: () => this.#handleEditConfirm(), primary: true }
      ]
    });
    document.body.appendChild(this.#dialog);
  }

  showDelete({ bookmark, childCount = 0, onConfirm, onCancel }) {
    this.#mode = "delete";
    this.#currentBookmark = bookmark;
    this.#callbacks.onConfirm = onConfirm;
    this.#callbacks.onCancel = onCancel;
    const message = childCount > 0
      ? `确定删除大纲"${bookmark.name}"吗？\n该大纲包含 ${childCount} 个子大纲，将一起被删除。`
      : `确定删除大纲"${bookmark.name}"吗？`;
    this.#dialog = this.#createDialog({
      title: "删除大纲",
      content: this.#createDeleteConfirm(message),
      buttons: [
        { text: "取消", onClick: () => this.#handleCancel() },
        { text: "删除", onClick: () => this.#handleDeleteConfirm(), primary: true }
      ]
    });
    document.body.appendChild(this.#dialog);
  }

  #createDialog({ title, content, buttons }) {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,.35);
      display:flex; align-items:center; justify-content:center; z-index: 10000;
    `;
    const dialog = document.createElement("div");
    dialog.style.cssText = `
      width: 420px; background:#fff; border-radius:8px; box-shadow:0 6px 18px rgba(0,0,0,.25);
      overflow:hidden; font-family: Arial, sans-serif;
    `;
    const header = document.createElement("div");
    header.style.cssText = `padding:12px 16px; border-bottom:1px solid #eee; font-weight:bold;`;
    header.textContent = title;
    const body = document.createElement("div");
    body.style.cssText = `padding:16px;`;
    body.appendChild(content);
    const footer = document.createElement("div");
    footer.style.cssText = `padding:12px 16px; border-top:1px solid #eee; display:flex; gap:8px; justify-content:flex-end;`;
    buttons.forEach(({ text, onClick, primary }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = text;
      btn.style.cssText = `
        padding: 6px 12px; border:1px solid ${primary ? "#1976d2" : "#ccc"};
        background:${primary ? "#1976d2" : "#fff"}; color:${primary ? "#fff" : "#333"};
        border-radius:4px; cursor:pointer;
      `;
      btn.addEventListener("click", onClick);
      footer.appendChild(btn);
    });
    dialog.appendChild(header); dialog.appendChild(body); dialog.appendChild(footer);
    overlay.appendChild(dialog);
    return overlay;
  }

  #createAddEditForm({ name = "", pageAt = 1, position = null }) {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <label style="display:block; margin-bottom:8px; font-size:13px;">名称</label>
      <input id="bookmark-name" type="text" value="${name}" style="width:100%; padding:6px 8px; margin-bottom:12px; border:1px solid #ccc; border-radius:4px;" />
      <label style="display:block; margin-bottom:8px; font-size:13px;">页码</label>
      <input id="bookmark-page" type="number" min="1" value="${pageAt}" style="width:100%; padding:6px 8px; margin-bottom:12px; border:1px solid #ccc; border-radius:4px;" />
      <label style="display:block; margin-bottom:8px; font-size:13px;">位置(0-100，可选)</label>
      <input id="bookmark-position" type="number" min="0" max="100" value="${position ?? ""}" style="width:100%; padding:6px 8px; border:1px solid #ccc; border-radius:4px;" />
    `;
    return wrap;
  }

  #createDeleteConfirm(message) {
    const content = document.createElement("div");
    content.style.cssText = "font-size: 14px; line-height: 1.6; white-space: pre-wrap;";
    content.textContent = message;
    return content;
  }

  #handleAddConfirm() {
    const name = document.getElementById("bookmark-name").value.trim();
    const pageAt = parseInt(document.getElementById("bookmark-page").value, 10);
    const posRaw = document.getElementById("bookmark-position")?.value ?? "";
    const position = posRaw === "" ? null : Math.max(0, Math.min(100, parseInt(posRaw, 10)));
    if (!name) { alert("请输入书签名称"); return; }
    if (!pageAt || pageAt < 1) { alert("请输入有效的页码"); return; }
    if (this.#callbacks.onConfirm) {
      this.#callbacks.onConfirm({ name, pageAt, position });
    }
    this.close();
  }

  #handleEditConfirm() {
    const name = document.getElementById("bookmark-name").value.trim();
    const pageAt = parseInt(document.getElementById("bookmark-page").value, 10);
    const posRaw = document.getElementById("bookmark-position")?.value ?? "";
    const position = posRaw === "" ? null : Math.max(0, Math.min(100, parseInt(posRaw, 10)));
    if (!name) { alert("请输入书签名称"); return; }
    if (!pageAt || pageAt < 1) { alert("请输入有效的页码"); return; }
    if (this.#callbacks.onConfirm) {
      this.#callbacks.onConfirm({ name, pageAt, position });
    }
    this.close();
  }

  #handleDeleteConfirm() {
    if (this.#callbacks.onConfirm) { this.#callbacks.onConfirm(true); }
    this.close();
  }

  #handleCancel() {
    if (this.#callbacks.onCancel) { this.#callbacks.onCancel(); }
    this.close();
  }

  close() {
    if (this.#dialog?.parentNode) { this.#dialog.parentNode.removeChild(this.#dialog); }
    this.#dialog = null; this.#mode = null; this.#currentBookmark = null;
    this.#callbacks = { onConfirm: null, onCancel: null };
  }
}

export default BookmarkDialog;

