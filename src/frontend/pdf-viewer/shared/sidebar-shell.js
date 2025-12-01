/**
 * @file sidebar-shell.js
 * @description
 * 提供 PDF Viewer 内部各类侧边栏共享的“根容器壳子”创建函数。
 * 只负责通用布局样式（100% 高度 + flex column + box-sizing:border-box），
 * 不包含任何业务逻辑，供具体 Sidebar UI 通过组合方式复用。
 */

/**
 * 创建侧边栏根容器元素。
 *
 * @param {{ className?: string, extraStyle?: string }} [options]
 * @returns {HTMLDivElement}
 */
export function createSidebarRoot(options = {}) {
  const { className, extraStyle } = options;
  const root = /** @type {HTMLDivElement} */ (document.createElement("div"));

  const styles = [
    "height:100%",
    "display:flex",
    "flex-direction:column",
    "box-sizing:border-box"
  ];

  if (extraStyle && typeof extraStyle === "string" && extraStyle.trim().length > 0) {
    styles.push(extraStyle);
  }

  root.style.cssText = styles.join(";");

  if (className && typeof className === "string") {
    root.className = className;
  }

  return root;
}

