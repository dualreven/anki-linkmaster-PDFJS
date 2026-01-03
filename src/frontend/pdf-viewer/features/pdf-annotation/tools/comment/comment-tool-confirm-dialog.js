/**
 * CommentTool confirm dialog (Fail-Closed)
 * - 任何异常都返回 false，避免“删除默认放行”的兜底行为
 */

export function confirmCommentDeleteAsync({ message, documentRef = document, logger }) {
  return new Promise((resolve) => {
    try {
      const overlay = documentRef.createElement("div");
      overlay.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999;";

      const dlg = documentRef.createElement("div");
      dlg.style.cssText =
        "width:360px;background:#fff;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.25);overflow:hidden;";

      const body = documentRef.createElement("div");
      body.style.cssText = "padding:16px;font-size:14px;";
      body.textContent = String(message ?? "");

      const footer = documentRef.createElement("div");
      footer.style.cssText =
        "display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid #eee;";

      const btnCancel = documentRef.createElement("button");
      btnCancel.textContent = "取消";
      btnCancel.style.cssText =
        "padding:6px 12px;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer;";

      const btnOk = documentRef.createElement("button");
      btnOk.textContent = "删除";
      btnOk.style.cssText =
        "padding:6px 12px;border:1px solid #c62828;background:#c62828;color:#fff;border-radius:4px;cursor:pointer;";

      const close = (result) => {
        try {
          overlay.remove();
        } catch (e) {
          void e; /* logger-guard */
        }
        resolve(result);
      };

      btnCancel.addEventListener("click", () => close(false));
      btnOk.addEventListener("click", () => close(true));

      footer.appendChild(btnCancel);
      footer.appendChild(btnOk);
      dlg.appendChild(body);
      dlg.appendChild(footer);
      overlay.appendChild(dlg);
      documentRef.body.appendChild(overlay);
    } catch (e) {
      if (logger?.error) {
        logger.error("[CommentTool] confirm dialog failed", e);
      }
      resolve(false);
    }
  });
}

