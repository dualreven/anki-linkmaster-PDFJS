/**
 * Annotation position utility functions
 * @module features/annotation/utils/position-utils
 */

/**
 * 根据截图标注的百分比矩形计算页面内的中心位置百分比。
 * @param {{xPercent?: number, yPercent?: number, widthPercent?: number, heightPercent?: number}|null|undefined} rectPercent - 百分比矩形
 * @returns {number|null} 中心位置的百分比(0-100)，无法计算时返回null
 */
export function getCenterPercentFromRect(rectPercent) {
  if (!rectPercent || typeof rectPercent !== 'object') {
    return null;
  }

  const { yPercent, heightPercent } = rectPercent;
  const top = Number.isFinite(yPercent) ? Number(yPercent) : null;
  const height = Number.isFinite(heightPercent) ? Number(heightPercent) : 0;

  if (top === null) {
    return null;
  }

  const center = top + (height / 2);
  if (!Number.isFinite(center)) {
    return null;
  }

  if (center < 0) {
    return 0;
  }
  if (center > 100) {
    return 100;
  }
  return Number(center.toFixed(6));
}

export default {
  getCenterPercentFromRect,
};
