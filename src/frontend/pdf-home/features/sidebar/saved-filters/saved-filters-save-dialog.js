const SAVE_DIALOG_HTML = `
<div class="preset-save-dialog" hidden>
  <div class="preset-dialog-overlay"></div>
  <div class="preset-dialog-content">
    <div class="preset-dialog-header">
      <h3>💾 保存搜索条件</h3>
      <button class="preset-dialog-close" aria-label="关闭">&times;</button>
    </div>
    <div class="preset-dialog-body">
      <label for="sf-preset-name-input">名称:</label>
      <input type="text" id="sf-preset-name-input" class="preset-name-input" placeholder="请输入名称..." autocomplete="off" />
      <div class="preset-description"><small>将保存当前的搜索关键词、筛选条件与排序规则</small></div>
      <div id="sf-preset-summary" style="margin-top:8px"></div>
    </div>
    <div class="preset-dialog-footer">
      <button class="preset-dialog-cancel">取消</button>
      <button class="preset-dialog-save">保存</button>
    </div>
  </div>
</div>`;

function mustBeFunction(fn, name) {
  if (typeof fn !== "function") {
    throw new Error(`[SavedFiltersSaveDialog] ${name} must be a function`);
  }
}

export function createSavedFiltersSaveDialog({ logger, onConfirmName }) {
  if (!logger) {
    throw new Error("[SavedFiltersSaveDialog] logger is required");
  }
  mustBeFunction(onConfirmName, "onConfirmName");

  const wrapper = document.createElement("div");
  wrapper.innerHTML = SAVE_DIALOG_HTML.trim();
  const dialog = wrapper.firstChild;
  document.body.appendChild(dialog);

  const nameInput = dialog.querySelector("#sf-preset-name-input");
  const summaryEl = dialog.querySelector("#sf-preset-summary");
  const closeBtn = dialog.querySelector(".preset-dialog-close");
  const cancelBtn = dialog.querySelector(".preset-dialog-cancel");
  const saveBtn = dialog.querySelector(".preset-dialog-save");
  const overlay = dialog.querySelector(".preset-dialog-overlay");

  const close = () => { dialog.hidden = true; };
  const tryFocus = () => { try { nameInput?.focus?.(); } catch (e) { logger?.debug?.("[SavedFiltersSaveDialog] focus failed", e); } };

  const onClose = () => close();
  const onSave = () => {
    const name = (nameInput && nameInput.value) ? nameInput.value.trim() : "";
    const ok = onConfirmName(name);
    if (ok) { close(); }
  };
  const onKeypress = (e) => { if (e.key === "Enter") { onSave(); } };

  closeBtn?.addEventListener("click", onClose);
  cancelBtn?.addEventListener("click", onClose);
  overlay?.addEventListener("click", onClose);
  saveBtn?.addEventListener("click", onSave);
  nameInput?.addEventListener("keypress", onKeypress);

  return {
    open({ defaultName, summaryHtml }) {
      if (nameInput) { nameInput.value = String(defaultName || ""); }
      if (summaryEl) { summaryEl.innerHTML = String(summaryHtml || ""); }
      dialog.hidden = false;
      setTimeout(tryFocus, 50);
    },
    close,
    destroy() {
      closeBtn?.removeEventListener("click", onClose);
      cancelBtn?.removeEventListener("click", onClose);
      overlay?.removeEventListener("click", onClose);
      saveBtn?.removeEventListener("click", onSave);
      nameInput?.removeEventListener("keypress", onKeypress);
      try { dialog.remove(); } catch (e) { logger?.debug?.("[SavedFiltersSaveDialog] destroy failed", e); }
    }
  };
}

