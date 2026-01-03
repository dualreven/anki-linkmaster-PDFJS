/**
 * TextHighlightTool confirm dialog（Fail-Closed）
 * - 任何异常/环境不满足（如无 DOM）都返回 false
 */

/**
 * @param {string} message
 * @param {{ doc?: Document, logger?: any }} [deps]
 * @returns {Promise<boolean>}
 */
export function confirmTextHighlightAction(message, deps = {}) {
  const doc = Object.prototype.hasOwnProperty.call(deps, "doc")
    ? deps.doc
    : (typeof document !== "undefined" ? document : null);
  const logger = Object.prototype.hasOwnProperty.call(deps, "logger")
    ? deps.logger
    : console;

  if (!doc?.body || typeof doc.createElement !== "function") {
    logger?.error?.("[TextHighlightTool] confirm dialog unavailable (no DOM)");
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    try {
      const overlay = doc.createElement("div");
      overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:99999;";

      const box = doc.createElement("div");
      box.style.cssText = "min-width:280px;max-width:420px;background:#fff;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.2);padding:16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;";

      const text = doc.createElement("div");
      text.textContent = String(message || "确认执行该操作？");
      text.style.cssText = "font-size:14px;color:#111;line-height:1.6;margin-bottom:12px;";

      const row = doc.createElement("div");
      row.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";

      const btnCancel = doc.createElement("button");
      btnCancel.type = "button";
      btnCancel.textContent = "取消";
      btnCancel.style.cssText = "padding:6px 12px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer;";

      const btnOk = doc.createElement("button");
      btnOk.type = "button";
      btnOk.textContent = "确定";
      btnOk.style.cssText = "padding:6px 12px;border-radius:6px;border:1px solid #1e88e5;background:#2196f3;color:#fff;cursor:pointer;";

      const cleanup = (result) => {
        try { overlay.remove(); } catch (e) { logger?.debug?.("[TextHighlightTool] confirm overlay remove failed", e); }
        resolve(result);
      };

      btnCancel.addEventListener("click", () => cleanup(false));
      btnOk.addEventListener("click", () => cleanup(true));

      row.appendChild(btnCancel);
      row.appendChild(btnOk);
      box.appendChild(text);
      box.appendChild(row);
      overlay.appendChild(box);
      doc.body.appendChild(overlay);
    } catch (e) {
      logger?.error?.("[TextHighlightTool] confirm dialog failed", e);
      resolve(false);
    }
  });
}
