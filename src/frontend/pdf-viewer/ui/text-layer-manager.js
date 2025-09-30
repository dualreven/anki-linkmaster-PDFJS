/**
 * @file 文字层管理器
 * @module TextLayerManager
 * @description 管理PDF文字层的加载、渲染和交互功能
 *
 * 需求来源: 20250922143000-pdf-text-layer/v001-spec.md
 * 功能说明:
 * - 加载和渲染PDF页面的文字层
 * - 支持文字选择和复制
 * - 获取选中文字的内容和位置信息
 * - 支持文字高亮显示
 */

import { getLogger } from "../../common/utils/logger.js";

// 动态导入PDF.js的renderTextLayer
let renderTextLayerFunc = null;

/**
 * 动态加载PDF.js的renderTextLayer函数
 * @returns {Promise<Function>}
 */
async function loadRenderTextLayer() {
  if (renderTextLayerFunc) {
    return renderTextLayerFunc;
  }

  try {
    // 尝试从pdfjs-dist导入renderTextLayer
    const pdfjsModule = await import('pdfjs-dist');
    if (pdfjsModule.renderTextLayer) {
      renderTextLayerFunc = pdfjsModule.renderTextLayer;
      return renderTextLayerFunc;
    }
  } catch (error) {
    console.warn("Failed to import renderTextLayer from pdfjs-dist:", error);
  }

  return null;
}

/**
 * @class TextLayerManager
 * @description 管理PDF文字层的加载和交互
 *
 * 属性:
 * - pdfDocument: PDF文档对象
 * - textLayerContainer: 文字层容器元素
 * - textLayerEnabled: 文字层是否已启用
 *
 * 方法:
 * - loadTextLayer(container, page): 加载指定page的文字层到container中
 * - getSelectedText(): 获取当前选中的文字
 * - getSelectedTextRect(): 获取当前选中文字的矩形区域
 * - clearTextSelection(): 清除当前选中的文字
 * - highlightSelectedText(area_list): 高亮当前选中的文字
 */
export class TextLayerManager {
  // 私有属性
  #logger;
  #pdfDocument = null;
  #textLayerContainer = null;
  #textLayerEnabled = false;
  #currentPage = null;
  #textContent = null;
  #textDivs = [];
  #selectionChangeHandler = null;

  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {HTMLElement} options.container - 文字层容器元素
   * @param {Object} options.pdfDocument - PDF文档对象（可选）
   */
  constructor(options = {}) {
    this.#logger = getLogger("TextLayerManager");
    this.#textLayerContainer = options.container || null;
    this.#pdfDocument = options.pdfDocument || null;
    this.#textLayerEnabled = !!this.#textLayerContainer;

    this.#logger.info("TextLayerManager initialized", {
      enabled: this.#textLayerEnabled,
      hasContainer: !!this.#textLayerContainer
    });

    // 设置选择变化监听器
    this.#setupSelectionListener();
  }

  /**
   * 设置选择变化监听器
   * @private
   */
  #setupSelectionListener() {
    if (typeof document !== 'undefined') {
      this.#selectionChangeHandler = () => {
        const selectedText = this.getSelectedText();
        if (selectedText) {
          this.#logger.debug("Text selection changed", { text: selectedText });
          // 触发自定义事件
          this.#dispatchSelectionEvent(selectedText);
        }
      };
      document.addEventListener('selectionchange', this.#selectionChangeHandler);
    }
  }

  /**
   * 触发选择变化事件
   * @param {string} selectedText - 选中的文字
   * @private
   */
  #dispatchSelectionEvent(selectedText) {
    if (this.#textLayerContainer) {
      const event = new CustomEvent('selectionchanged', {
        detail: {
          text: selectedText,
          rect: this.getSelectedTextRect()
        }
      });
      this.#textLayerContainer.dispatchEvent(event);
    }
  }

  /**
   * 设置PDF文档对象
   * @param {Object} pdfDocument - PDF文档对象
   */
  setPDFDocument(pdfDocument) {
    this.#pdfDocument = pdfDocument;
    this.#logger.info("PDF document set");
  }

  /**
   * 设置文字层容器
   * @param {HTMLElement} container - 文字层容器元素
   */
  setContainer(container) {
    this.#textLayerContainer = container;
    this.#textLayerEnabled = !!container;
    this.#logger.info("Text layer container set", { enabled: this.#textLayerEnabled });
  }

  /**
   * 加载文字层到指定容器
   * @param {HTMLElement} container - 文字层加载的目标容器元素
   * @param {Object} page - 要加载的pdf页面对象
   * @param {Object} viewport - 视图端口(可选,如不提供则使用scale=1.0)
   * @returns {Promise<void>}
   *
   * 接口实现: loadTextLayer(container, page)
   * 需求: v001-spec.md - 接口1
   */
  async loadTextLayer(container, page, viewport = null) {
    try {
      if (!container) {
        throw new Error("Container element is required");
      }

      if (!page) {
        throw new Error("PDF page object is required");
      }

      this.#logger.info("Loading text layer", {
        pageNum: page.pageNumber || page._pageIndex + 1
      });

      // 更新容器引用
      this.#textLayerContainer = container;
      this.#currentPage = page;

      // 清空容器
      container.innerHTML = '';
      this.#textDivs = [];

      // 获取页面的文字内容
      this.#textContent = await page.getTextContent();

      if (!this.#textContent || !this.#textContent.items || this.#textContent.items.length === 0) {
        this.#logger.warn("No text content found on page");
        return;
      }

      this.#logger.debug("Text content loaded", {
        itemCount: this.#textContent.items.length
      });

      // 使用传入的viewport或创建默认viewport
      if (!viewport) {
        viewport = page.getViewport({ scale: 1.0 });
      }

      // 使用PDF.js的renderTextLayer方法渲染文字层
      await this.#renderTextContent(container, viewport);

      this.#textLayerEnabled = true;
      this.#logger.info("Text layer loaded successfully");

    } catch (error) {
      this.#logger.error("Failed to load text layer", error);
      throw error;
    }
  }

  /**
   * 渲染文字内容
   * @param {HTMLElement} container - 容器元素
   * @param {Object} viewport - 视图端口
   * @returns {Promise<void>}
   * @private
   */
  async #renderTextContent(container, viewport) {
    // 尝试使用PDF.js的renderTextLayer API
    const renderTextLayer = await loadRenderTextLayer();

    if (renderTextLayer) {
      try {
        this.#logger.debug("Using PDF.js renderTextLayer API");

        // 使用PDF.js官方API渲染文字层
        const renderTask = renderTextLayer({
          textContentSource: this.#textContent,
          container: container,
          viewport: viewport,
          textDivs: this.#textDivs
        });

        await renderTask.promise;
        this.#logger.info("Text layer rendered with PDF.js API");
        return;

      } catch (error) {
        this.#logger.warn("PDF.js renderTextLayer failed, using fallback:", error);
      }
    }

    // 如果API不可用或失败，使用fallback方法
    this.#logger.debug("Using fallback text layer rendering");
    await this.#renderTextContentFallback(container, viewport);
  }

  /**
   * 备用的文字内容渲染方法
   * @param {HTMLElement} container - 容器元素
   * @param {Object} viewport - 视图端口
   * @returns {Promise<void>}
   * @private
   */
  async #renderTextContentFallback(container, viewport) {
    const items = this.#textContent.items;
    const scale = viewport.scale;

    this.#logger.debug(`Rendering ${items.length} text items with viewport scale ${scale}`);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // 创建文字div元素
      const textDiv = document.createElement('span');
      textDiv.textContent = item.str;
      textDiv.className = 'textLayer-item';

      // 设置位置和样式
      // transform = [scaleX, skewY, skewX, scaleY, translateX, translateY]
      const transform = item.transform;
      const angle = Math.atan2(transform[1], transform[0]);
      const fontSize = Math.sqrt(transform[0] * transform[0] + transform[1] * transform[1]);

      // PDF坐标系转换为CSS坐标系
      // PDF: 左下角为原点，Y轴向上
      // CSS: 左上角为原点，Y轴向下
      const left = transform[4] * scale;
      const top = (viewport.height / scale - transform[5]) * scale - fontSize;

      textDiv.style.position = 'absolute';
      textDiv.style.left = `${left}px`;
      textDiv.style.top = `${top}px`;
      textDiv.style.fontSize = `${fontSize}px`;
      textDiv.style.fontFamily = item.fontName || 'sans-serif';
      textDiv.style.whiteSpace = 'pre';
      textDiv.style.transformOrigin = '0% 0%';

      // 如果有旋转，应用旋转变换
      if (angle !== 0) {
        textDiv.style.transform = `rotate(${angle}rad)`;
      }

      container.appendChild(textDiv);
      this.#textDivs.push(textDiv);
    }

    this.#logger.debug("Text layer rendered with fallback method", {
      itemCount: items.length,
      scale: scale
    });
  }

  /**
   * 获取当前选中的文字
   * @returns {string} 当前选中的文字
   *
   * 接口实现: getSelectedText()
   * 需求: v001-spec.md - 接口2
   */
  getSelectedText() {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return '';
      }

      const selectedText = selection.toString().trim();

      if (selectedText) {
        this.#logger.debug("Got selected text", {
          length: selectedText.length,
          preview: selectedText.substring(0, 50)
        });
      }

      return selectedText;

    } catch (error) {
      this.#logger.error("Failed to get selected text", error);
      return '';
    }
  }

  /**
   * 获取当前选中文字的矩形区域
   * @returns {Array<Array<number>>} 矩形区域列表，每个元素为[x, y, width, height]
   *
   * 接口实现: getSelectedTextRect()
   * 需求: v001-spec.md - 接口3
   */
  getSelectedTextRect() {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return [];
      }

      const rects = [];
      for (let i = 0; i < selection.rangeCount; i++) {
        const range = selection.getRangeAt(i);
        const clientRects = range.getClientRects();

        for (let j = 0; j < clientRects.length; j++) {
          const rect = clientRects[j];

          // 转换为容器相对坐标
          const containerRect = this.#textLayerContainer?.getBoundingClientRect();
          const relativeX = containerRect ? rect.left - containerRect.left : rect.left;
          const relativeY = containerRect ? rect.top - containerRect.top : rect.top;

          rects.push([
            relativeX,
            relativeY,
            rect.width,
            rect.height
          ]);
        }
      }

      if (rects.length > 0) {
        this.#logger.debug("Got selected text rects", { count: rects.length });
      }

      return rects;

    } catch (error) {
      this.#logger.error("Failed to get selected text rect", error);
      return [];
    }
  }

  /**
   * 清除当前选中的文字
   *
   * 接口实现: clearTextSelection()
   * 需求: v001-spec.md - 接口4
   */
  clearTextSelection() {
    try {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        this.#logger.debug("Text selection cleared");
      }
    } catch (error) {
      this.#logger.error("Failed to clear text selection", error);
    }
  }

  /**
   * 高亮指定区域的文字
   * @param {Array<Array<number>>} areaList - 矩形区域列表，每个元素为[x, y, width, height]
   *
   * 接口实现: highlightSelectedText(area_list)
   * 需求: v001-spec.md - 接口5
   */
  highlightSelectedText(areaList) {
    try {
      if (!Array.isArray(areaList) || areaList.length === 0) {
        this.#logger.warn("Invalid area list provided");
        return;
      }

      this.#logger.info("Highlighting text areas", { count: areaList.length });

      // 清除之前的高亮
      this.#clearHighlights();

      // 为每个区域创建高亮元素
      areaList.forEach((area, index) => {
        if (!Array.isArray(area) || area.length < 4) {
          this.#logger.warn("Invalid area format", { index, area });
          return;
        }

        const [x, y, width, height] = area;
        const highlightDiv = document.createElement('div');
        highlightDiv.className = 'text-highlight';
        highlightDiv.style.position = 'absolute';
        highlightDiv.style.left = `${x}px`;
        highlightDiv.style.top = `${y}px`;
        highlightDiv.style.width = `${width}px`;
        highlightDiv.style.height = `${height}px`;
        highlightDiv.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
        highlightDiv.style.pointerEvents = 'none';
        highlightDiv.dataset.highlightIndex = index;

        if (this.#textLayerContainer) {
          this.#textLayerContainer.appendChild(highlightDiv);
        }
      });

      this.#logger.debug("Text highlighting completed");

    } catch (error) {
      this.#logger.error("Failed to highlight text", error);
    }
  }

  /**
   * 清除所有高亮
   * @private
   */
  #clearHighlights() {
    if (!this.#textLayerContainer) return;

    const highlights = this.#textLayerContainer.querySelectorAll('.text-highlight');
    highlights.forEach(highlight => highlight.remove());

    if (highlights.length > 0) {
      this.#logger.debug("Cleared highlights", { count: highlights.length });
    }
  }

  /**
   * 清理文字层资源
   */
  cleanup() {
    this.#logger.info("Cleaning up text layer");

    // 清空容器
    if (this.#textLayerContainer) {
      this.#textLayerContainer.innerHTML = '';
    }

    // 清理引用
    this.#textDivs = [];
    this.#textContent = null;
    this.#currentPage = null;

    this.#logger.debug("Text layer cleaned up");
  }

  /**
   * 销毁文字层管理器
   */
  destroy() {
    this.#logger.info("Destroying TextLayerManager");

    // 移除事件监听器
    if (this.#selectionChangeHandler) {
      document.removeEventListener('selectionchange', this.#selectionChangeHandler);
      this.#selectionChangeHandler = null;
    }

    // 清理资源
    this.cleanup();

    // 清空所有引用
    this.#textLayerContainer = null;
    this.#pdfDocument = null;
    this.#textLayerEnabled = false;

    this.#logger.info("TextLayerManager destroyed");
  }

  /**
   * 获取文字层是否已启用
   * @returns {boolean} 文字层是否已启用
   */
  isEnabled() {
    return this.#textLayerEnabled;
  }

  /**
   * 获取文字层容器
   * @returns {HTMLElement|null} 文字层容器元素
   */
  getContainer() {
    return this.#textLayerContainer;
  }

  /**
   * 获取当前页面对象
   * @returns {Object|null} 当前页面对象
   */
  getCurrentPage() {
    return this.#currentPage;
  }
}