const MANAGE_DIALOG_HTML = `
<div class="preset-save-dialog" hidden>
  <div class="preset-dialog-overlay"></div>
  <div class="preset-dialog-content">
    <div class="preset-dialog-header">
      <h3>⚙️ 管理已存搜索条件</h3>
      <button class="preset-dialog-close" aria-label="关闭">&times;</button>
    </div>
    <div class="preset-dialog-body">
      <div class="sf-manage-list" id="sf-manage-list"></div>
    </div>
    <div class="preset-dialog-footer">
      <button class="preset-dialog-cancel">取消</button>
      <button class="preset-dialog-save">确定</button>
    </div>
  </div>
</div>`;

function mustBeFunction(fn, name) {
  if (typeof fn !== "function") {
    throw new Error(`[SavedFiltersManageDialog] ${name} must be a function`);
  }
}

function newSavedFilterId() {
  return `sf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function createSavedFiltersManageDialog({ logger, escapeHtml, onSaveList }) {
  if (!logger) {
    throw new Error("[SavedFiltersManageDialog] logger is required");
  }
  mustBeFunction(escapeHtml, "escapeHtml");
  mustBeFunction(onSaveList, "onSaveList");

  const wrap = document.createElement("div");
  wrap.innerHTML = MANAGE_DIALOG_HTML.trim();
  const dialog = wrap.firstChild;
  document.body.appendChild(dialog);

  const listEl = dialog.querySelector("#sf-manage-list");
  const closeBtn = dialog.querySelector(".preset-dialog-close");
  const cancelBtn = dialog.querySelector(".preset-dialog-cancel");
  const saveBtn = dialog.querySelector(".preset-dialog-save");
  const overlay = dialog.querySelector(".preset-dialog-overlay");

  let editorList = [];

  const close = () => { dialog.hidden = true; };

  const render = () => {
    if (!listEl) { return; }
    if (!Array.isArray(editorList) || editorList.length === 0) {
      listEl.innerHTML = "<div class=\"saved-filters-empty\">暂无数据</div>";
      return;
    }
    listEl.innerHTML = editorList.map((sf, idx) => (
      `<div class="sf-manage-item" draggable="true" data-index="${idx}">` +
      "<span class=\"sf-drag-handle\" title=\"拖动排序\">☰</span>" +
      `<input class="sf-name-input" type="text" value="${escapeHtml(sf.name || "")}" data-index="${idx}" />` +
      `<button class="sf-btn sf-dup" data-index="${idx}" title="复制">📄</button>` +
      `<button class="sf-btn sf-del" data-index="${idx}" title="删除">🗑️</button>` +
      "</div>"
    )).join("\n");

    // 名称编辑
    listEl.querySelectorAll(".sf-name-input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const i = parseInt(e.target.getAttribute("data-index"), 10);
        if (!Number.isNaN(i) && editorList[i]) {
          editorList[i].name = e.target.value;
        }
      });
    });

    // 删除
    listEl.querySelectorAll(".sf-del").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const i = parseInt(e.currentTarget.getAttribute("data-index"), 10);
        if (!Number.isNaN(i)) {
          editorList.splice(i, 1);
          render();
        }
      });
    });

    // 复制
    listEl.querySelectorAll(".sf-dup").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const i = parseInt(e.currentTarget.getAttribute("data-index"), 10);
        if (!Number.isNaN(i) && editorList[i]) {
          const base = editorList[i];
          const copy = {
            ...base,
            id: newSavedFilterId(),
            name: `${base.name || ""} (副本)`,
            ts: Date.now()
          };
          editorList.splice(i + 1, 0, copy);
          render();
        }
      });
    });

    // 拖动排序
    listEl.querySelectorAll(".sf-manage-item").forEach((row) => {
      row.addEventListener("dragstart", (e) => {
        try { e.dataTransfer.setData("text/plain", row.getAttribute("data-index")); } catch (err) { logger?.debug?.("[SavedFiltersManageDialog] dragstart failed", err); }
      });
      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        row.classList.add("drag-over");
      });
      row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        row.classList.remove("drag-over");
        const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
        const to = parseInt(row.getAttribute("data-index"), 10);
        if (Number.isNaN(from) || Number.isNaN(to) || from === to) { return; }
        const moved = editorList.splice(from, 1)[0];
        editorList.splice(to, 0, moved);
        render();
      });
    });
  };

  const onClose = () => close();
  const onSave = () => {
    try {
      const normalized = editorList.map((sf) => ({ ...sf, name: (sf.name && sf.name.trim()) ? sf.name.trim() : (sf.name || "") }));
      onSaveList(normalized);
      close();
    } catch (e) {
      logger.error("[SavedFiltersManageDialog] Save failed", e);
    }
  };

  closeBtn?.addEventListener("click", onClose);
  cancelBtn?.addEventListener("click", onClose);
  overlay?.addEventListener("click", onClose);
  saveBtn?.addEventListener("click", onSave);

  return {
    open(savedFilters) {
      editorList = Array.isArray(savedFilters) ? savedFilters.map((sf) => ({ ...sf })) : [];
      render();
      dialog.hidden = false;
    },
    close,
    destroy() {
      closeBtn?.removeEventListener("click", onClose);
      cancelBtn?.removeEventListener("click", onClose);
      overlay?.removeEventListener("click", onClose);
      saveBtn?.removeEventListener("click", onSave);
      try { dialog.remove(); } catch (e) { logger?.debug?.("[SavedFiltersManageDialog] destroy failed", e); }
    }
  };
}

