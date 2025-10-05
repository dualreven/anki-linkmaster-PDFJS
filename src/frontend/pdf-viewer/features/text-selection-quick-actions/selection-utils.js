/**
 * Selection utilities for text quick actions.
 * @module features/text-selection-quick-actions/selection-utils
 */

/**
 * 查找包含当前节点的PDF页面元素
 * @param {Node} startNode - 起始节点
 * @returns {HTMLElement|null} .page 元素
 */
export function findPageElement(startNode) {
  let node = startNode instanceof Node ? startNode : null;
  while (node) {
    if (node instanceof HTMLElement && node.classList.contains('page')) {
      return node;
    }
    node = node.parentNode;
  }
  return null;
}

/**
 * 提取页面编号
 * @param {HTMLElement} pageElement - 页面元素
 * @returns {number|null}
 */
export function extractPageNumber(pageElement) {
  if (!pageElement) return null;
  const value = pageElement.getAttribute('data-page-number');
  const pageNumber = value ? parseInt(value, 10) : NaN;
  return Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : null;
}

/**
 * 获取 Range 的所有可见 ClientRects
 * @param {Range} range - 文本范围
 * @returns {Array<DOMRect>}
 */
export function getVisibleClientRects(range) {
  if (!range || typeof range.getClientRects !== 'function') {
    return [];
  }
  const rectList = Array.from(range.getClientRects?.() || []);
  return rectList.filter((rect) => rect && rect.width > 0 && rect.height > 0);
}

/**
 * 将客户端矩形转换为页面百分比矩形
 * @param {DOMRect} rect - 绝对位置矩形（viewport）
 * @param {DOMRect} pageRect - 页面矩形（viewport）
 * @returns {{xPercent:number,yPercent:number,widthPercent:number,heightPercent:number}}
 */
export function rectToPercent(rect, pageRect) {
  if (!rect || !pageRect || pageRect.width === 0 || pageRect.height === 0) {
    return { xPercent: 0, yPercent: 0, widthPercent: 0, heightPercent: 0 };
  }
  const xPercent = ((rect.left - pageRect.left) / pageRect.width) * 100;
  const yPercent = ((rect.top - pageRect.top) / pageRect.height) * 100;
  const widthPercent = (rect.width / pageRect.width) * 100;
  const heightPercent = (rect.height / pageRect.height) * 100;

  const clamp = (value) => Number.isFinite(value) ? Math.max(-100, Math.min(200, value)) : 0;
  const round = (value) => Math.round(value * 1000) / 1000;

  return {
    xPercent: round(clamp(xPercent)),
    yPercent: round(clamp(yPercent)),
    widthPercent: round(clamp(widthPercent)),
    heightPercent: round(clamp(heightPercent))
  };
}

/**
 * 根据 Range 计算百分比行矩形
 * @param {Range} range - 文本范围
 * @param {DOMRect} pageRect - 页面矩形
 * @returns {Array<{xPercent:number,yPercent:number,widthPercent:number,heightPercent:number}>}
 */
export function calculateLineRects(range, pageRect) {
  const clientRects = getVisibleClientRects(range);
  if (!pageRect) {
    return [];
  }
  if (clientRects.length === 0) {
    return [];
  }
  return clientRects.map((rect) => rectToPercent(rect, pageRect));
}

/**
 * 计算 bounding box（相对于页面容器）
 * @param {DOMRect} selectionRect - Range 的 bounding rect（viewport）
 * @param {DOMRect} pageRect - 页面矩形
 * @returns {{left:number,top:number,width:number,height:number}}
 */
export function calculateRelativeBoundingBox(selectionRect, pageRect) {
  if (!selectionRect || !pageRect) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  return {
    left: selectionRect.left - pageRect.left,
    top: selectionRect.top - pageRect.top,
    width: selectionRect.width,
    height: selectionRect.height
  };
}

/**
 * 生成选择的数据快照
 * @param {Range} range - 文本范围
 * @param {HTMLElement} pageElement - 页面元素
 * @returns {Object|null} 选择数据
 */
export function buildSelectionSnapshot(range, pageElement) {
  if (!range || !pageElement) {
    return null;
  }

  const pageRect = pageElement.getBoundingClientRect?.();
  if (!pageRect || pageRect.width === 0 || pageRect.height === 0) {
    return null;
  }

  const selectionRect = range.getBoundingClientRect();
  let lineRects = calculateLineRects(range, pageRect);
  const boundingBox = calculateRelativeBoundingBox(selectionRect, pageRect);

  if ((!lineRects || lineRects.length === 0) && selectionRect) {
    lineRects = [rectToPercent(selectionRect, pageRect)];
  }

  return {
    pageElement,
    pageRect,
    selectionRect,
    lineRects,
    boundingBox
  };
}
