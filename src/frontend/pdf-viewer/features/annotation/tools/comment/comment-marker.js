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
    const { position, content } = data;

    // 创建标记元素
    const marker = document.createElement('div');
    marker.className = 'comment-marker';
    marker.dataset.annotationId = id;
    marker.dataset.pageNumber = pageNumber;
    marker.title = content || '批注';

    marker.style.cssText = `
      position: absolute;
      left: ${position.x}px;
      top: ${position.y}px;
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
