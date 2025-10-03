/**
 * TextSelectionHandler - 文本选择处理器
 * @module features/annotation/tools/text-highlight/text-selection-handler
 * @description 处理PDF文本选择，提取文本范围和位置信息
 */

/**
 * 文本选择处理器
 * @class TextSelectionHandler
 */
export class TextSelectionHandler {
  /** @type {EventBus} */
  #eventBus;

  /** @type {Logger} */
  #logger;

  /** @type {boolean} */
  #isListening = false;

  /** @type {Function} */
  #mouseUpHandler = null;

  /**
   * 构造函数
   * @param {EventBus} eventBus - 事件总线
   * @param {Logger} logger - 日志记录器
   */
  constructor(eventBus, logger) {
    this.#eventBus = eventBus;
    this.#logger = logger;
    this.#mouseUpHandler = this.#handleMouseUp.bind(this);
  }

  /**
   * 开始监听文本选择
   * @returns {void}
   */
  startListening() {
    if (this.#isListening) {
      this.#logger.warn('[TextSelectionHandler] Already listening');
      return;
    }

    this.#isListening = true;
    document.addEventListener('mouseup', this.#mouseUpHandler);
    this.#logger.info('[TextSelectionHandler] Started listening');
  }

  /**
   * 停止监听文本选择
   * @returns {void}
   */
  stopListening() {
    if (!this.#isListening) return;

    this.#isListening = false;
    document.removeEventListener('mouseup', this.#mouseUpHandler);
    this.#logger.info('[TextSelectionHandler] Stopped listening');
  }

  /**
   * 检查是否正在监听
   * @returns {boolean}
   */
  isListening() {
    return this.#isListening;
  }

  /**
   * 处理鼠标抬起事件
   * @param {MouseEvent} e - 鼠标事件
   * @returns {void}
   * @private
   */
  #handleMouseUp(e) {
    // 延迟一小段时间，确保selection已经完成
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return;
      }

      const range = selection.getRangeAt(0);
      const text = range.toString().trim();

      // 文本长度必须大于0
      if (text.length === 0) {
        return;
      }

      // 检查是否在PDF页面内选择
      const pageContainer = this.#findPageContainer(range.startContainer);
      if (!pageContainer) {
        this.#logger.warn('[TextSelectionHandler] Selection not in PDF page');
        return;
      }

      // 提取页码
      const pageNumber = this.#extractPageNumber(pageContainer);
      if (!pageNumber) {
        this.#logger.error('[TextSelectionHandler] Failed to extract page number');
        return;
      }

      // 提取文本范围
      const textRanges = this.#extractTextRanges(range, pageContainer);

      // 获取选择区域的边界矩形
      const boundingRect = range.getBoundingClientRect();
      const pageRect = pageContainer.getBoundingClientRect();

      const relativeRect = {
        left: boundingRect.left - pageRect.left,
        top: boundingRect.top - pageRect.top,
        width: boundingRect.width,
        height: boundingRect.height
      };

      this.#logger.info('[TextSelectionHandler] Text selected', {
        text: text.substring(0, 50) + '...',
        pageNumber,
        textLength: text.length,
        rangesCount: textRanges.length
      });

      // 发送文本选择完成事件
      this.#eventBus.emit('annotation-highlight:selection:completed', {
        text: text,
        pageNumber: pageNumber,
        ranges: textRanges,
        range: range,
        rect: relativeRect
      });
    }, 10);
  }

  /**
   * 查找所在的PDF页面容器
   * @param {Node} node - DOM节点
   * @returns {HTMLElement|null} 页面容器元素
   * @private
   */
  #findPageContainer(node) {
    let current = node;

    while (current) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        const element = /** @type {HTMLElement} */ (current);
        if (element.classList?.contains('page')) {
          return element;
        }
      }
      current = current.parentElement;
    }

    return null;
  }

  /**
   * 从页面容器提取页码
   * @param {HTMLElement} pageContainer - 页面容器
   * @returns {number|null} 页码
   * @private
   */
  #extractPageNumber(pageContainer) {
    const pageNumberAttr = pageContainer.getAttribute('data-page-number');
    if (!pageNumberAttr) return null;

    const pageNumber = parseInt(pageNumberAttr, 10);
    return isNaN(pageNumber) ? null : pageNumber;
  }

  /**
   * 提取文本范围（在textLayer中的字符索引）
   * @param {Range} range - 浏览器Range对象
   * @param {HTMLElement} pageContainer - 页面容器
   * @returns {Array<{start: number, end: number}>} 文本范围数组
   * @private
   */
  #extractTextRanges(range, pageContainer) {
    const textLayer = pageContainer.querySelector('.textLayer');
    if (!textLayer) {
      this.#logger.warn('[TextSelectionHandler] No textLayer found');
      // 返回简化的范围
      return [{
        start: 0,
        end: range.toString().length
      }];
    }

    try {
      // 获取textLayer中的所有文本节点
      const allTextNodes = this.#getTextNodesInTextLayer(textLayer);

      // 找到startContainer和endContainer在textLayer中的位置
      const startOffset = this.#calculateTextOffset(
        allTextNodes,
        range.startContainer,
        range.startOffset
      );

      const endOffset = this.#calculateTextOffset(
        allTextNodes,
        range.endContainer,
        range.endOffset
      );

      if (startOffset === -1 || endOffset === -1) {
        this.#logger.warn('[TextSelectionHandler] Failed to calculate text offsets');
        return [{
          start: 0,
          end: range.toString().length
        }];
      }

      return [{
        start: Math.min(startOffset, endOffset),
        end: Math.max(startOffset, endOffset)
      }];
    } catch (error) {
      this.#logger.error('[TextSelectionHandler] Error extracting text ranges', error);
      return [{
        start: 0,
        end: range.toString().length
      }];
    }
  }

  /**
   * 获取textLayer中的所有文本节点
   * @param {HTMLElement} textLayer - textLayer元素
   * @returns {Array<{node: Node, offset: number}>} 文本节点及其累积偏移量
   * @private
   */
  #getTextNodesInTextLayer(textLayer) {
    const textNodes = [];
    let currentOffset = 0;

    const walker = document.createTreeWalker(
      textLayer,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node;
    while ((node = walker.nextNode())) {
      const textContent = node.textContent || '';
      textNodes.push({
        node: node,
        offset: currentOffset,
        length: textContent.length
      });
      currentOffset += textContent.length;
    }

    return textNodes;
  }

  /**
   * 计算节点在textLayer中的字符偏移量
   * @param {Array} textNodes - 文本节点数组
   * @param {Node} targetNode - 目标节点
   * @param {number} nodeOffset - 节点内偏移量
   * @returns {number} 总偏移量（-1表示未找到）
   * @private
   */
  #calculateTextOffset(textNodes, targetNode, nodeOffset) {
    for (const item of textNodes) {
      if (item.node === targetNode) {
        return item.offset + nodeOffset;
      }

      // 如果targetNode是元素节点，检查其子节点
      if (targetNode.nodeType === Node.ELEMENT_NODE) {
        const walker = document.createTreeWalker(
          targetNode,
          NodeFilter.SHOW_TEXT,
          null
        );

        let textNode;
        let accumulatedOffset = 0;
        while ((textNode = walker.nextNode())) {
          if (textNode === item.node) {
            return item.offset + Math.min(nodeOffset, accumulatedOffset);
          }
          accumulatedOffset += (textNode.textContent || '').length;
        }
      }
    }

    return -1;
  }

  /**
   * 销毁处理器
   * @returns {void}
   */
  destroy() {
    this.stopListening();
    this.#eventBus = null;
    this.#logger = null;
    this.#mouseUpHandler = null;
  }
}
