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
   * 标注ID到高亮容器的映射
   * @type {Map<string, { container: HTMLElement, pageNumber: number, boundingBox: { left: number, top: number, right: number, bottom: number, width: number, height: number } }>}
   */
  #annotationHighlights = new Map();

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
   * @param {Array<{start: number, end: number}>} [textRanges=[]] - 文本范围数组
   * @param {string} color - 高亮颜色（hex格式）
   * @param {string} [annotationId] - 标注ID（用于后续删除）
   * @param {Array<{xPercent: number, yPercent: number, widthPercent: number, heightPercent: number}>} [lineRects=null] - 行矩形百分比数据
   * @returns {{ container: HTMLElement, rects: Array, boundingBox: { left: number, top: number, right: number, bottom: number, width: number, height: number } }|null} 高亮渲染结果
   */
  renderHighlight(pageNumber, textRanges, color, annotationId = null, lineRects = null) {
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

    const highlightLayer = this.#getOrCreateHighlightLayer(pageView, pageNumber);

    if (annotationId) {
      this.removeHighlight(annotationId);
    }

    let rects = [];

    if (Array.isArray(lineRects) && lineRects.length > 0) {
      rects = this.#convertPercentRectsToClientRects(pageView, lineRects);
    } else if (Array.isArray(textRanges) && textRanges.length > 0) {
      rects = this.#calculateHighlightRects(textLayer, textRanges);
    } else {
      this.#logger.warn(`[HighlightRenderer] No range data provided for page ${pageNumber}`);
      return null;
    }

    if (rects.length === 0) {
      this.#logger.warn(`[HighlightRenderer] No rects calculated for page ${pageNumber}`);
      return null;
    }

    const highlightContainer = document.createElement('div');
    highlightContainer.className = 'text-highlight-container';
    highlightContainer.style.position = 'absolute';
    highlightContainer.style.left = '0px';
    highlightContainer.style.top = '0px';
    highlightContainer.style.width = '100%';
    highlightContainer.style.height = '100%';
    highlightContainer.style.pointerEvents = 'none';
    if (annotationId) {
      highlightContainer.dataset.annotationId = annotationId;
    }

    rects.forEach((rect) => {
      const highlightEl = this.#createHighlightElement(rect, color);
      highlightContainer.appendChild(highlightEl);
    });

    highlightLayer.appendChild(highlightContainer);

    const boundingBox = this.#calculateBoundingBox(rects);

    if (annotationId) {
      this.#annotationHighlights.set(annotationId, {
        container: highlightContainer,
        pageNumber,
        boundingBox
      });
    }

    this.#logger.info(`[HighlightRenderer] Rendered ${rects.length} highlights on page ${pageNumber}`);

    return {
      container: highlightContainer,
      rects,
      boundingBox
    };
  }

  /**
   * 删除指定标注的高亮
   * @param {string} annotationId - 标注ID
   * @returns {boolean} 是否成功删除
   */
  removeHighlight(annotationId) {
    let removed = false;

    const record = this.#annotationHighlights.get(annotationId);
    if (record?.container) {
      record.container.remove();
      removed = true;
    }

    if (this.#annotationHighlights.has(annotationId)) {
      this.#annotationHighlights.delete(annotationId);
    }

    if (!removed) {
      this.#highlightLayers.forEach((layer) => {
        const container = layer.querySelector(`[data-annotation-id="${annotationId}"]`);
        if (container) {
          container.remove();
          removed = true;
        }
      });
    }

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
      layer.querySelectorAll('[data-annotation-id]').forEach((el) => {
        this.#annotationHighlights.delete(el.dataset.annotationId);
      });
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
    this.#annotationHighlights.clear();
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
   * 将百分比矩形转换为页面坐标矩形
   * @param {HTMLElement} pageView - 页面元素
   * @param {Array<{xPercent: number, yPercent: number, widthPercent: number, heightPercent: number}>} lineRects - 百分比矩形
   * @returns {Array<{left: number, top: number, width: number, height: number}>}
   * @private
   */
  #convertPercentRectsToClientRects(pageView, lineRects) {
    if (!pageView || !Array.isArray(lineRects)) {
      return [];
    }

    const width = pageView.clientWidth || pageView.getBoundingClientRect().width;
    const height = pageView.clientHeight || pageView.getBoundingClientRect().height;

    if (!width || !height) {
      return [];
    }

    return lineRects
      .filter((rect) => rect && typeof rect === 'object')
      .map((rect) => ({
        left: (rect.xPercent / 100) * width,
        top: (rect.yPercent / 100) * height,
        width: (rect.widthPercent / 100) * width,
        height: (rect.heightPercent / 100) * height
      }));
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
   * 更新指定标注的高亮颜色
   * @param {string} annotationId - 标注ID
   * @param {string} color - 新颜色
   * @returns {boolean} 是否更新成功
   */
  updateHighlightColor(annotationId, color) {
    const record = this.#annotationHighlights.get(annotationId);
    if (!record?.container) {
      return false;
    }

    const highlights = record.container.querySelectorAll('.text-highlight');
    highlights.forEach((el) => {
      el.style.backgroundColor = color;
    });

    this.#annotationHighlights.set(annotationId, { ...record, boundingBox: record.boundingBox });
    return true;
  }

  /**
   * 计算高亮区域的包围盒
   * @param {Array<{left: number, top: number, width: number, height: number}>} rects - 高亮矩形集合
   * @returns {{left: number, top: number, right: number, bottom: number, width: number, height: number}}
   * @private
   */
  #calculateBoundingBox(rects) {
    if (!Array.isArray(rects) || rects.length === 0) {
      return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    }

    let left = Number.POSITIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;

    rects.forEach((rect) => {
      left = Math.min(left, rect.left);
      top = Math.min(top, rect.top);
      right = Math.max(right, rect.left + rect.width);
      bottom = Math.max(bottom, rect.top + rect.height);
    });

    return {
      left,
      top,
      right,
      bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top)
    };
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
    this.#annotationHighlights.clear();
    this.#pdfViewerManager = null;
    this.#logger = null;
  }
}
