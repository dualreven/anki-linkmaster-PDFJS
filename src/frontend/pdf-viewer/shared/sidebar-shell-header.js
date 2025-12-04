/**
 * @file sidebar-shell-header.js
 * @description
 * 提供 PDF Viewer 通用侧边栏 Header 布局创建函数。
 * 封装「标题 + 可选扩展按钮区域 + 关闭按钮」的结构，
 * 方便各具体 Sidebar UI 复用，避免重复实现。
 */

/**
 * 创建通用侧边栏 Header 容器。
 *
 * @param {{
 *   titleText?: string,
 *   onClose?: () => void,
 *   showExtraSquareButton?: boolean,
 *   onExtraSquareButtonClick?: () => void
 * }} [options]
 * @returns {HTMLDivElement}
 */
export function createSidebarHeader(options = {}) {
  const {
    titleText = "",
    onClose,
    showExtraSquareButton = false,
    onExtraSquareButtonClick
  } = options;

  const header = /** @type {HTMLDivElement} */ (document.createElement("div"));
  header.className = "pdf-sidebar-header";
  header.style.cssText = [
    "display:flex",
    "align-items:center",
    "justify-content:space-between",
    "padding:8px 8px",
    "border-bottom:1px solid #eee",
    "background:#fafafa",
    "box-sizing:border-box",
    "flex-shrink:0"
  ].join(";");

  const left = document.createElement("div");
  left.style.cssText = [
    "display:flex",
    "align-items:center",
    "gap:8px",
    "min-width:0"
  ].join(";");

  const titleEl = document.createElement("div");
  titleEl.className = "pdf-sidebar-title";
  titleEl.textContent = titleText;
  titleEl.style.cssText = [
    "font-size:14px",
    "font-weight:600",
    "color:#333",
    "white-space:nowrap",
    "overflow:hidden",
    "text-overflow:ellipsis"
  ].join(";");
  left.appendChild(titleEl);

  const extraBtnWrapper = document.createElement("div");
  extraBtnWrapper.className = "pdf-sidebar-extra-actions";
  extraBtnWrapper.style.cssText = [
    "display:flex",
    "align-items:center",
    "gap:4px"
  ].join(";");

  if (showExtraSquareButton && typeof onExtraSquareButtonClick === "function") {
    const extraBtn = document.createElement("button");
    extraBtn.type = "button";
    extraBtn.className = "pdf-sidebar-square-btn";
    extraBtn.title = "打开标注管理器";
    extraBtn.style.cssText = [
      "width:20px",
      "height:20px",
      "padding:0",
      "border:1px solid #ddd",
      "border-radius:2px",
      "background:#fff",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "cursor:pointer"
    ].join(";");
    extraBtn.textContent = "□";
    extraBtn.addEventListener("click", (evt) => {
      evt.stopPropagation();
      onExtraSquareButtonClick();
    });
    extraBtnWrapper.appendChild(extraBtn);
  }

  left.appendChild(extraBtnWrapper);
  header.appendChild(left);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "pdf-sidebar-close-btn";
  closeBtn.textContent = "×";
  closeBtn.style.cssText = [
    "width:20px",
    "height:20px",
    "padding:0",
    "border:1px solid #ddd",
    "border-radius:2px",
    "background:#fff",
    "cursor:pointer",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "font-size:14px",
    "line-height:1"
  ].join(";");

  if (typeof onClose === "function") {
    closeBtn.addEventListener("click", () => {
      onClose();
    });
  }

  header.appendChild(closeBtn);

  return header;
}
