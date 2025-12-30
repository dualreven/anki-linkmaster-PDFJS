/**
 * ScreenshotTool 的 UI 小工具（从 screenshot/index.js 抽离）
 */

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
        try { overlay.remove(); } catch (e) { void e; /* logger-guard */ }
        resolve(false);
      });
      btnOk.addEventListener("click", () => {
        try { overlay.remove(); } catch (e) { void e; /* logger-guard */ }
        resolve(true);
      });
      footer.appendChild(btnCancel); footer.appendChild(btnOk);
      dlg.appendChild(body); dlg.appendChild(footer); overlay.appendChild(dlg);
      document.body.appendChild(overlay);
    } catch {
      resolve(true);
    }
  });
}

/**
 * 获取图片URL（port 优先走 APP_CONFIG）
 * @param {string} imagePath
 * @returns {string}
 */
export function getImageUrl(imagePath) {
  const port = window.APP_CONFIG?.fileServerPort || 8080;
  return `http://localhost:${port}${imagePath}`;
}

/**
 * HTML 转义（用于 innerHTML 拼接）
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 格式化日期（保持与旧实现一致：toLocaleString zh-CN）
 * @param {string} isoString
 * @returns {string}
 */
export function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
