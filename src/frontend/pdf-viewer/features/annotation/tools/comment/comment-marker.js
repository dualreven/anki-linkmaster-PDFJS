/**
 * CommentMarker - 批注标记渲染器
 * @module features/annotation/tools/comment/comment-marker
 * @description 在PDF上渲染批注图标标记
 */

import { getLogger } from '../../../../../common/utils/logger.js';

/**
 * 批注标记渲染器类
 * @class CommentMarker
 */
export class CommentMarker {
  /** @type {import('../../../../../common/utils/logger.js').Logger} */
  #logger = getLogger('CommentMarker');

  /** @type {Map<string, HTMLElement>} 标记元素映射 (annotationId -> markerElement) */
  #markers = new Map();

  /**
   * 构造函数
   */
  constructor() {
    this.#logger.info('CommentMarker created');
  }

  /**
   * 创建批注标记
   * @param {Annotation} annotation - 标注对象
   * @param {string} annotation.id - 标注ID
   * @param {number} annotation.pageNumber - 页码
   * @param {Object} annotation.data - 批注数据
   * @param {Object} annotation.data.position - 位置信息 {x, y}
   * @param {string} annotation.data.content - 批注内容
   * @returns {HTMLElement} 标记元素
   */
  createMarker(annotation) {
    const { id, pageNumber, data } = annotation;
    const { positionPercent, position, content } = data;

    // 创建标记元素
    const marker = document.createElement('div');
    marker.className = 'comment-marker';
    marker.dataset.annotationId = id;
    marker.dataset.pageNumber = pageNumber;
    marker.title = content || '批注';

    // 保存百分比或像素信息到 dataset，渲染时换算
    try {
      if (positionPercent && typeof positionPercent.xPercent === 'number' && typeof positionPercent.yPercent === 'number') {
        marker.dataset.xPercent = String(positionPercent.xPercent);
        marker.dataset.yPercent = String(positionPercent.yPercent);
      } else if (position && typeof position.x === 'number' && typeof position.y === 'number') {
        marker.dataset.x = String(position.x);
        marker.dataset.y = String(position.y);
      }
    } catch(_) {}

    marker.style.cssText = `
      position: absolute;
      left: 0px;
      top: 0px;
      width: 32px;
      height: 32px;
      background: #FFC107;
      border: 2px solid #FF9800;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 18px;
      z-index: 100;
      transition: transform 0.2s, box-shadow 0.2s;
      user-select: none;
    `;

    // 添加图标
    marker.textContent = '📝';

    // 悬停效果
    marker.addEventListener('mouseenter', () => {
      marker.style.transform = 'scale(1.2)';
      marker.style.boxShadow = '0 4px 12px rgba(255, 152, 0, 0.4)';
    });

    marker.addEventListener('mouseleave', () => {
      marker.style.transform = 'scale(1)';
      marker.style.boxShadow = 'none';
    });

    // 保存标记
    this.#markers.set(id, marker);

    this.#logger.info(`Comment marker created for annotation ${id} at page ${pageNumber}`);

    return marker;
  }

  /**
   * 渲染标记到PDF页面
   * @param {string} annotationId - 标注ID
   * @param {HTMLElement} pageElement - 页面元素
   * @returns {boolean} 是否成功渲染
   */
  renderToPage(annotationId, pageElement) {
    const marker = this.#markers.get(annotationId);

    if (!marker) {
      this.#logger.warn(`Marker not found for annotation ${annotationId}`);
      return false;
    }

    if (!pageElement) {
      this.#logger.warn(`Page element not found for annotation ${annotationId}`);
      return false;
    }

    // 添加到页面
    pageElement.appendChild(marker);

    // 根据百分比（优先）或像素设置位置
    try {
      const w = pageElement.clientWidth || pageElement.offsetWidth || 1;
      const h = pageElement.clientHeight || pageElement.offsetHeight || 1;

      let leftPx = 0, topPx = 0;
      let xp = null, yp = null;
      if (marker.dataset.xPercent && marker.dataset.yPercent) {
        xp = parseFloat(marker.dataset.xPercent);
        yp = parseFloat(marker.dataset.yPercent);
      } else if (marker.dataset.x && marker.dataset.y) {
        // 允许从像素推导百分比并回写，统一缩放行为
        const x = parseFloat(marker.dataset.x);
        const y = parseFloat(marker.dataset.y);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          xp = Math.max(0, Math.min(100, (x / Math.max(1, w)) * 100));
          yp = Math.max(0, Math.min(100, (y / Math.max(1, h)) * 100));
          marker.dataset.xPercent = String(xp);
          marker.dataset.yPercent = String(yp);
        }
      }
      if (Number.isFinite(xp) && Number.isFinite(yp)) {
        leftPx = (xp / 100) * w;
        topPx = (yp / 100) * h;
      }
      marker.style.left = `${Math.round(leftPx)}px`;
      marker.style.top = `${Math.round(topPx)}px`;
    } catch (e) {
      this.#logger.warn('Failed to compute marker position', e);
    }

    this.#logger.info(`Marker ${annotationId} rendered to page`);
    return true;
  }

  /**
   * 移除标记
   * @param {string} annotationId - 标注ID
   */
  removeMarker(annotationId) {
    const marker = this.#markers.get(annotationId);

    if (marker) {
      marker.remove();
      this.#markers.delete(annotationId);
      this.#logger.info(`Marker ${annotationId} removed`);
    }
  }

  /**
   * 高亮标记
   * @param {string} annotationId - 标注ID
   */
  highlightMarker(annotationId) {
    const marker = this.#markers.get(annotationId);

    if (marker) {
      marker.style.background = '#FF5722';
      marker.style.borderColor = '#D32F2F';
      marker.style.transform = 'scale(1.3)';
      marker.style.boxShadow = '0 6px 16px rgba(211, 47, 47, 0.5)';

      // 3秒后恢复
      setTimeout(() => {
        marker.style.background = '#FFC107';
        marker.style.borderColor = '#FF9800';
        marker.style.transform = 'scale(1)';
        marker.style.boxShadow = 'none';
      }, 3000);

      this.#logger.info(`Marker ${annotationId} highlighted`);
    }
  }

  /**
   * 获取标记元素
   * @param {string} annotationId - 标注ID
   * @returns {HTMLElement|null}
   */
  getMarker(annotationId) {
    return this.#markers.get(annotationId) || null;
  }

  /**
   * 清空所有标记
   */
  clear() {
    this.#markers.forEach((marker, id) => {
      this.removeMarker(id);
    });

    this.#logger.info('All markers cleared');
  }

  /**
   * 销毁渲染器
   */
  destroy() {
    this.clear();
    this.#logger.info('CommentMarker destroyed');
  }
}

export default CommentMarker;
