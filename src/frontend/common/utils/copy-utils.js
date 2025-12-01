/**
 * @file copy-utils.js
 * @description
 * 提供前端统一使用的复制工具：
 * - 使用隐藏 textarea + document.execCommand("copy") 的复制实现；
 * - 只负责“执行复制”本身，不直接做 toast 或域错误提示，由调用方决定如何反馈给用户。
 */

/**
 * 使用隐藏 textarea + document.execCommand('copy') 复制文本。
 *
 * @param {string} text - 要复制的文本
 * @returns {boolean} 是否复制成功
 */
export function copyTextUsingHiddenTextarea(text) {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return false;
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = String(text ?? "");
    textarea.setAttribute("readonly", "");
    textarea.style.cssText = [
      "position: fixed",
      "top: 0",
      "left: 0",
      "width: 2em",
      "height: 2em",
      "padding: 0",
      "border: none",
      "outline: none",
      "box-shadow: none",
      "background: transparent",
      "opacity: 0",
      "pointer-events: none"
    ].join(";");

    document.body.appendChild(textarea);
    try { textarea.focus(); } catch { /* ignore */ }
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return !!ok;
  } catch {
    return false;
  }
}

