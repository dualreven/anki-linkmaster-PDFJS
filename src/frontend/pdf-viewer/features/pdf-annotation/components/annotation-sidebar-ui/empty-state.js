/**
 * 渲染空态（暂无标注）
 * @param {Object} params
 * @param {HTMLElement} params.container
 */
export function renderAnnotationSidebarEmptyState({ container }) {
  container.innerHTML = "";

  const emptyDiv = document.createElement("div");
  emptyDiv.className = "annotation-empty";
  emptyDiv.style.cssText = [
    "text-align: center",
    "padding: 40px 20px",
    "color: #999",
    "font-size: 14px",
  ].join(";");

  const icon = document.createElement("div");
  icon.textContent = "📝";
  icon.style.cssText = "font-size: 48px; margin-bottom: 16px;";

  const message = document.createElement("div");
  message.textContent = "暂无标注";

  const hint = document.createElement("div");
  hint.textContent = "🖱️ 点击上方工具按钮开始标注";
  hint.style.cssText = "margin-top: 8px; font-size: 12px; color: #bbb;";

  emptyDiv.appendChild(icon);
  emptyDiv.appendChild(message);
  emptyDiv.appendChild(hint);

  container.appendChild(emptyDiv);
}

