/**
 * @file url-context.js
 * @description
 * 提供与 pdf-viewer URL 上下文相关的最小工具：
 * - 纯函数：从给定 search 字符串中解析 pdf-id；
 * - 环境包装：在极少数 infra/boot 模块中，从 window.location.search 读取 pdf-id。
 *
 * 注意：尽量在上层（bootstrap/container/url-loader）使用 getCurrentPdfIdFromWindow，
 *      深层 Feature 更推荐通过参数注入或容器获取 pdfId，而不是直接依赖 window。
 */

/**
 * 从查询字符串解析 pdf-id（纯函数，不依赖 window）。
 *
 * @param {string} search - 形如 "?pdf-id=xxx&foo=bar" 或 "pdf-id=xxx" 的查询部分
 * @returns {string|null}
 */
export function parsePdfIdFromSearch(search) {
  if (typeof search !== "string") {
    return null;
  }

  const trimmed = search.trim();
  if (!trimmed) {
    return null;
  }

  try {
    // 允许传入带或不带前导 ?
    const normalized = trimmed.startsWith("?") ? trimmed.slice(1) : trimmed;
    const params = new URLSearchParams(normalized);
    const value = params.get("pdf-id");
    return value && typeof value === "string" && value.trim() !== "" ? value : null;
  } catch {
    return null;
  }
}

/**
 * 从 window.location.search 解析当前 pdf-id。
 *
 * @returns {string|null}
 */
export function getCurrentPdfIdFromWindow() {
  try {
    if (typeof window === "undefined" || !window.location) {
      return null;
    }
    const search = window.location.search || "";
    return parsePdfIdFromSearch(search);
  } catch {
    return null;
  }
}

