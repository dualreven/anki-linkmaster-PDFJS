/**
 * @file PDF 页码检测工具
 * @module pdf-page-detection-utils
 * @description 提供 PDF 容器中心页码检测和位置百分比测量的纯函数工具。
 *              供 pdf-resume、pdf-anchor、pdf-annotation 等多个 Feature 复用。
 */

/**
 * 检测容器视口中心可见的页码
 * @param {HTMLElement} container - viewerContainer 元素
 * @returns {number|null} 页码（1-based）或 null（无法检测时）
 * @throws {Error} 当 container 参数无效时抛出
 */
export function detectCenterPageNumber(container) {
  if (!container || !(container instanceof HTMLElement)) {
    throw new Error("[pdf-page-detection] container must be a valid HTMLElement");
  }

  const centerY = container.scrollTop + (container.clientHeight / 2);
  const pages = Array.from(container.querySelectorAll(".page[data-page-number]"));

  if (pages.length === 0) {
    return null;
  }

  let bestElement = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const pageEl of pages) {
    const top = pageEl.offsetTop || 0;
    const height = pageEl.offsetHeight || 1;
    const midY = top + height / 2;
    const distance = Math.abs(midY - centerY);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestElement = pageEl;
    }
  }

  if (!bestElement) {
    return null;
  }

  const pageNumber = Number(bestElement.getAttribute("data-page-number"));
  return Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : null;
}

/**
 * 测量指定页码在容器中的 Y 百分比位置
 * @param {HTMLElement} container - viewerContainer 元素
 * @param {number} pageNumber - 页码（1-based）
 * @returns {number|null} 0-100 百分比或 null（找不到页面时）
 * @throws {Error} 当 container 无效或 pageNumber 非正整数时抛出
 */
export function measureYPercent(container, pageNumber) {
  if (!container || !(container instanceof HTMLElement)) {
    throw new Error("[pdf-page-detection] container must be a valid HTMLElement");
  }
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new Error(`[pdf-page-detection] pageNumber must be a positive integer, got: ${pageNumber}`);
  }

  const pageEl = container.querySelector(`.page[data-page-number="${pageNumber}"]`);
  if (!pageEl) {
    return null;
  }

  const pageTop = pageEl.offsetTop;
  const pageHeight = pageEl.offsetHeight || 1;
  const centerY = container.scrollTop + (container.clientHeight / 2);
  const relativeY = centerY - pageTop;
  const percent = (relativeY / pageHeight) * 100;

  return Math.max(0, Math.min(100, percent));
}

/**
 * 获取当前页码和位置百分比（合并版本）
 * @param {HTMLElement} container - viewerContainer 元素
 * @returns {{ pageAt: number, position: number } | null} 当前位置或 null
 * @throws {Error} 当 container 无效时抛出
 */
export function getCurrentPageAndPosition(container) {
  if (!container || !(container instanceof HTMLElement)) {
    throw new Error("[pdf-page-detection] container must be a valid HTMLElement");
  }

  const pageAt = detectCenterPageNumber(container);
  if (pageAt === null) {
    return null;
  }

  const position = measureYPercent(container, pageAt);
  if (position === null) {
    return null;
  }

  return { pageAt, position };
}
