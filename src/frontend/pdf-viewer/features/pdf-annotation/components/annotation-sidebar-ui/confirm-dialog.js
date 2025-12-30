/**
 * 简易确认弹窗（替代 window.confirm 以通过 lint）
 * @param {Object} params
 * @param {string} params.message
 * @param {string} [params.confirmText="删除"]
 * @param {string} [params.cancelText="取消"]
 * @returns {Promise<boolean>}
 */
export function confirmDialogAsync({ message, confirmText = "删除", cancelText = "取消" }) {
  return new Promise((resolve) => {
    try {
      const overlay = document.createElement("div");
      overlay.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999;";
      const dlg = document.createElement("div");
      dlg.style.cssText =
        "width:360px;background:#fff;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.25);overflow:hidden;";
      const body = document.createElement("div");
      body.style.cssText = "padding:16px;font-size:14px;";
      body.textContent = message;
      const footer = document.createElement("div");
      footer.style.cssText =
        "display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid #eee;";
      const btnCancel = document.createElement("button");
      btnCancel.textContent = cancelText;
      btnCancel.style.cssText =
        "padding:6px 12px;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer;";
      const btnOk = document.createElement("button");
      btnOk.textContent = confirmText;
      btnOk.style.cssText =
        "padding:6px 12px;border:1px solid #c62828;background:#c62828;color:#fff;border-radius:4px;cursor:pointer;";
      btnCancel.addEventListener("click", () => {
        try {
          overlay.remove();
        } catch (e) {
          void e; /* logger-guard */
        }
        resolve(false);
      });
      btnOk.addEventListener("click", () => {
        try {
          overlay.remove();
        } catch (e) {
          void e; /* logger-guard */
        }
        resolve(true);
      });
      footer.appendChild(btnCancel);
      footer.appendChild(btnOk);
      dlg.appendChild(body);
      dlg.appendChild(footer);
      overlay.appendChild(dlg);
      document.body.appendChild(overlay);
    } catch (e) {
      void e; /* logger-guard */
      resolve(true);
    }
  });
}

