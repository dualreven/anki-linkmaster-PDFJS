/**
 * ScreenshotTool 预览对话框（从 screenshot/index.js 抽离）
 * @param {string} imageData - base64 图片 data URL
 * @returns {Promise<string|null>} description（可为空字符串）/ null 表示取消
 */
export function showScreenshotPreviewDialog(imageData) {
  return new Promise((resolve) => {
    const dialog = document.createElement("div");
    dialog.className = "screenshot-preview-dialog";
    dialog.style.cssText = [
      "position: fixed",
      "top: 50%",
      "left: 50%",
      "transform: translate(-50%, -50%)",
      "background: white",
      "border-radius: 8px",
      "box-shadow: 0 4px 20px rgba(0,0,0,0.3)",
      "padding: 20px",
      "z-index: 10000",
      "max-width: 600px",
      "max-height: 80vh",
      "overflow: auto"
    ].join(";");

    dialog.innerHTML = `
      <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #333;">截图预览</h3>
      <img src="${imageData}" style="max-width: 100%; border: 1px solid #ddd; border-radius: 4px; display: block;">
      <div style="margin-top: 16px;">
        <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #666;">
          标注描述（可选）:
        </label>
        <textarea
          id="screenshot-description"
          placeholder="为这个截图添加描述..."
          style="width: 100%; min-height: 80px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; resize: vertical; box-sizing: border-box; font-family: inherit;"
        ></textarea>
      </div>
      <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;">
        <button id="screenshot-cancel-btn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; color: #666; border-radius: 4px; cursor: pointer; font-size: 14px;">取消</button>
        <button id="screenshot-save-btn" style="padding: 8px 16px; border: none; background: #2196f3; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;">保存</button>
      </div>
    `;

    document.body.appendChild(dialog);

    const textarea = dialog.querySelector("#screenshot-description");
    const saveBtn = dialog.querySelector("#screenshot-save-btn");
    const cancelBtn = dialog.querySelector("#screenshot-cancel-btn");

    const cleanup = () => {
      try { dialog.remove(); } catch (e) { void e; /* logger-guard */ }
      try { document.removeEventListener("keydown", onKeyDown); } catch (e) { void e; /* logger-guard */ }
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        cleanup();
        resolve(null);
      }
    };

    try { textarea?.focus?.(); } catch (e) { void e; /* logger-guard */ }

    saveBtn?.addEventListener?.("click", () => {
      const description = String(textarea?.value || "").trim();
      cleanup();
      resolve(description);
    });

    cancelBtn?.addEventListener?.("click", () => {
      cleanup();
      resolve(null);
    });

    document.addEventListener("keydown", onKeyDown);
  });
}

