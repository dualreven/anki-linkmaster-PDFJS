/**
 * HighlightRenderer - 高亮渲染器
 * @module features/annotation/tools/text-highlight/highlight-renderer
 * @description 在PDF页面上渲染文本高亮覆盖层
 */

/**
 * 高亮渲染器
 * @class HighlightRenderer
 */
export class HighlightRenderer {
  /** @type {Object} */
  #pdfViewerManager;

  /** @type {Logger} */
  #logger;

  /** @type {Map<string, HTMLElement>} */
  #highlightLayers = new Map();

  /**
   * 构造函数
   * @param {Object} pdfViewerManager - PDF查看器管理器
   * @param {Logger} logger - 日志记录器
   */
  constructor(pdfViewerManager, logger) {
    this.#pdfViewerManager = pdfViewerManager;
    this.#logger = logger;
  }

  /**
   * 渲染文本高亮
   * @param {number} pageNumber - 页码
   * @param {Array<{start: number, end: number}>} textRanges - 文本范围数组
   * @param {string} color - 高亮颜色（hex格式）
   * @param {string} [annotationId] - 标注ID（用于后续删除）
   * @returns {HTMLElement|null} 高亮层元素
   */
  renderHighlight(pageNumber, textRanges, color, annotationId = null) {
    const pageView = this.#getPageView(pageNumber);
    if (!pageView) {
      this.#logger.error(`[HighlightRenderer] Page ${pageNumber} not found`);
      return null;
    }

    const textLayer = pageView.querySelector('.textLayer');
    if (!textLayer) {
      this.#logger.error(`[HighlightRenderer] TextLayer not found on page ${pageNumber}`);
      return null;
    }

    // 获取或创建高亮层
    const highlightLayer = this.#getOrCreateHighlightLayer(pageView, pageNumber);

    // 计算高亮区域的矩形
    const rects = this.#calculateHighlightRects(textLayer, textRanges);

    if (rects.length === 0) {
      this.#logger.warn(`[HighlightRenderer] No rects calculated for page ${pageNumber}`);
      return null;
    }

    // 创建高亮元素容器
    const highlightContainer = document.createElement('div');
    highlightContainer.className = 'text-highlight-container';
    if (annotationId) {
      highlightContainer.dataset.annotationId = annotationId;
    }

    // 为每个矩形创建高亮元素
    rects.forEach((rect, index) => {
      const highlightEl = this.#createHighlightElement(rect, color);
      highlightContainer.appendChild(highlightEl);
    });

    highlightLayer.appendChild(highlightContainer);

    this.#logger.info(`[HighlightRenderer] Rendered ${rects.length} highlights on page ${pageNumber}`);

    return highlightContainer;
  }

  /**
   * 删除指定标注的高亮
   * @param {string} annotationId - 标注ID
   * @returns {boolean} 是否成功删除
   */
  removeHighlight(annotationId) {
    let removed = false;

    this.#highlightLayers.forEach((layer) => {
      const container = layer.querySelector(`[data-annotation-id="${annotationId}"]`);
      if (container) {
        container.remove();
        removed = true;
      }
    });

    if (removed) {
      this.#logger.info(`[HighlightRenderer] Removed highlight for annotation ${annotationId}`);
    }

    return removed;
  }

  /**
   * 清除指定页面的所有高亮
   * @param {number} pageNumber - 页码
   * @returns {void}
   */
  clearPageHighlights(pageNumber) {
    const layerKey = `page-${pageNumber}`;
    const layer = this.#highlightLayers.get(layerKey);

    if (layer) {
      layer.innerHTML = '';
      this.#logger.info(`[HighlightRenderer] Cleared all highlights on page ${pageNumber}`);
    }
  }

  /**
   * 清除所有高亮
   * @returns {void}
   */
  clearAllHighlights() {
    this.#highlightLayers.forEach((layer) => {
      layer.innerHTML = '';
    });
    this.#logger.info('[HighlightRenderer] Cleared all highlights');
  }

  /**
   * 获取页面视图元素
   * @param {number} pageNumber - 页码
   * @returns {HTMLElement|null} 页面元素
   * @private
   */
  #getPageView(pageNumber) {
    const container = document.getElementById('viewerContainer');
    if (!container) return null;

    return container.querySelector(`.page[data-page-number="${pageNumber}"]`);
  }

  /**
   * 获取或创建高亮层
   * @param {HTMLElement} pageView - 页面视图元素
   * @param {number} pageNumber - 页码
   * @returns {HTMLElement} 高亮层元素
   * @private
   */
  #getOrCreateHighlightLayer(pageView, pageNumber) {
    const layerKey = `page-${pageNumber}`;
    let highlightLayer = this.#highlightLayers.get(layerKey);

    if (highlightLayer && highlightLayer.parentElement) {
      return highlightLayer;
    }

    // 创建新的高亮层
    highlightLayer = document.createElement('div');
    highlightLayer.className = 'highlight-layer';
    highlightLayer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    `;

    // 插入到textLayer之后
    const textLayer = pageView.querySelector('.textLayer');
    if (textLayer && textLayer.parentElement) {
      textLayer.parentElement.insertBefore(highlightLayer, textLayer.nextSibling);
    } else {
      pageView.appendChild(highlightLayer);
    }

    this.#highlightLayers.set(layerKey, highlightLayer);

    return highlightLayer;
  }

  /**
   * 计算高亮区域的矩形
   * @param {HTMLElement} textLayer - textLayer元素
   * @param {Array<{start: number, end: number}>} textRanges - 文本范围
   * @returns {Array<{left: number, top: number, width: number, height: number}>} 矩形数组
   * @private
   */
  #calculateHighlightRects(textLayer, textRanges) {
    const rects = [];

    try {
      // 获取textLayer中的所有文本节点
      const textNodes = this.#getTextNodesInTextLayer(textLayer);

      // 获取textLayer的边界矩形（用于计算相对位置）
      const layerRect = textLayer.getBoundingClientRect();

      // 为每个文本范围计算矩形
      textRanges.forEach((range) => {
        const rangeRects = this.#calculateRectsForRange(
          textNodes,
          range.start,
          range.end,
          layerRect
        );
        rects.push(...rangeRects);
      });

      // 合并相邻或重叠的矩形
      return this.#mergeOverlappingRects(rects);
    } catch (error) {
      this.#logger.error('[HighlightRenderer] Error calculating rects', error);
      return [];
    }
  }

  /**
   * 获取textLayer中的所有文本节点
   * @param {HTMLElement} textLayer - textLayer元素
   * @returns {Array<{node: Node, offset: number, length: number, element: HTMLElement}>}
   * @private
   */
  #getTextNodesInTextLayer(textLayer) {
    const textNodes = [];
    let currentOffset = 0;

    const spans = textLayer.querySelectorAll('span');

    spans.forEach((span) => {
      const walker = document.createTreeWalker(
        span,
        NodeFilter.SHOW_TEXT,
        null
      );

      let textNode;
      while ((textNode = walker.nextNode())) {
        const textContent = textNode.textContent || '';
        textNodes.push({
          node: textNode,
          offset: currentOffset,
          length: textContent.length,
          element: span
        });
        currentOffset += textContent.length;
      }
    });

    return textNodes;
  }

  /**
   * 计算指定范围的矩形
   * @param {Array} textNodes - 文本节点数组
   * @param {number} startOffset - 起始偏移量
   * @param {number} endOffset - 结束偏移量
   * @param {DOMRect} layerRect - textLayer的边界矩形
   * @returns {Array<{left: number, top: number, width: number, height: number}>}
   * @private
   */
  #calculateRectsForRange(textNodes, startOffset, endOffset, layerRect) {
    const rects = [];

    for (const item of textNodes) {
      const nodeStart = item.offset;
      const nodeEnd = item.offset + item.length;

      // 检查是否有交集
      if (nodeEnd <= startOffset || nodeStart >= endOffset) {
        continue;
      }

      // 计算在当前节点内的范围
      const rangeStart = Math.max(0, startOffset - nodeStart);
      const rangeEnd = Math.min(item.length, endOffset - nodeStart);

      // 创建Range对象来获取精确的边界矩形
      const range = document.createRange();
      range.setStart(item.node, rangeStart);
      range.setEnd(item.node, rangeEnd);

      const clientRects = range.getClientRects();

      for (let i = 0; i < clientRects.length; i++) {
        const rect = clientRects[i];

        // 转换为相对于textLayer的坐标
        rects.push({
          left: rect.left - layerRect.left,
          top: rect.top - layerRect.top,
          width: rect.width,
          height: rect.height
        });
      }
    }

    return rects;
  }

  /**
   * 合并重叠或相邻的矩形
   * @param {Array<{left: number, top: number, width: number, height: number}>} rects - 矩形数组
   * @returns {Array<{left: number, top: number, width: number, height: number}>} 合并后的矩形
   * @private
   */
  #mergeOverlappingRects(rects) {
    if (rects.length === 0) return [];

    // 按top坐标排序
    const sorted = rects.slice().sort((a, b) => a.top - b.top);

    const merged = [];
    let current = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];

      // 检查是否在同一行（top坐标接近）
      const isSameLine = Math.abs(next.top - current.top) < 5;

      // 检查是否相邻或重叠
      const isAdjacent = isSameLine && (
        next.left <= current.left + current.width + 2
      );

      if (isAdjacent) {
        // 合并矩形
        const right = Math.max(
          current.left + current.width,
          next.left + next.width
        );
        current = {
          left: Math.min(current.left, next.left),
          top: Math.min(current.top, next.top),
          width: right - Math.min(current.left, next.left),
          height: Math.max(current.height, next.height)
        };
      } else {
        merged.push(current);
        current = next;
      }
    }

    merged.push(current);
    return merged;
  }

  /**
   * 创建高亮元素
   * @param {{left: number, top: number, width: number, height: number}} rect - 矩形
   * @param {string} color - 颜色
   * @returns {HTMLElement} 高亮元素
   * @private
   */
  #createHighlightElement(rect, color) {
    const div = document.createElement('div');
    div.className = 'text-highlight';
    div.style.cssText = `
      position: absolute;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      background-color: ${color};
      opacity: 0.3;
      pointer-events: none;
      border-radius: 2px;
    `;
    return div;
  }

  /**
   * 销毁渲染器
   * @returns {void}
   */
  destroy() {
    this.clearAllHighlights();
    this.#highlightLayers.clear();
    this.#pdfViewerManager = null;
    this.#logger = null;
  }
}
