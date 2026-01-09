/**
 * TextLayerManager
 * 说明（详细）：`docs/standards/text-layer-manager.md`
 */

import { getLogger } from "../../common/utils/logger.js";
const logger = getLogger("TextLayerManager");

// 动态导入PDF.js的renderTextLayer
let renderTextLayerFunc = null;

async function loadRenderTextLayer() {
  if (renderTextLayerFunc) {
    return renderTextLayerFunc;
  }

  try {
    const pdfjsModule = await import("pdfjs-dist");
    if (pdfjsModule.renderTextLayer) {
      renderTextLayerFunc = pdfjsModule.renderTextLayer;
      return renderTextLayerFunc;
    }
  } catch (error) {
    logger.warn("Failed to import renderTextLayer from pdfjs-dist:", error);
  }

  return null;
}

export class TextLayerManager {
  #logger;
  #textLayerContainer = null;
  #textLayerEnabled = false;
  #currentPage = null;
  #textContent = null;
  #textDivs = [];
  #selectionChangeHandler = null;
  #selectionContainerVersion = 0;

  constructor(options = {}) {
    this.#logger = getLogger("TextLayerManager");
    this.#updateContainerReference(options.container || null);
    this.#logger.info("TextLayerManager initialized", {
      enabled: this.#textLayerEnabled,
      hasContainer: !!this.#textLayerContainer
    });

    this.#setupSelectionListener();
  }

  /**
   * 设置选择变化监听器
   * @private
   */
  #setupSelectionListener() {
    if (typeof document !== "undefined") {
      this.#selectionChangeHandler = () => {
        const selectedText = this.getSelectedText();
        if (selectedText) {
          this.#logger.debug("Text selection changed", { text: selectedText });
          this.#dispatchSelectionEvent(selectedText);
        }
      };
      document.addEventListener("selectionchange", this.#selectionChangeHandler);
    }
  }

  /**
   * 更新文字层容器引用，维护版本号
   * @param {HTMLElement|null} container
   * @private
   */
  #updateContainerReference(container) {
    this.#textLayerContainer = container;
    this.#textLayerEnabled = !!container;
    this.#selectionContainerVersion += 1;
  }

  /**
   * 触发选择变化事件
   * @param {string} selectedText - 选中的文字
   * @private
   */
  #dispatchSelectionEvent(selectedText) {
    if (!selectedText) {
      return;
    }

    const versionAtStart = this.#selectionContainerVersion;
    let targetContainer = this.#textLayerContainer;

    if (!targetContainer) {
      this.#logger.debug("Selection dispatch skipped because container is unset");
      return;
    }

    const rects = this.getSelectedTextRect();

    if (versionAtStart !== this.#selectionContainerVersion) {
      this.#logger.debug("Text layer container changed while processing selection, routing to latest container");
      targetContainer = this.#textLayerContainer;
      if (!targetContainer) {
        return;
      }
    }

    const event = new CustomEvent("selectionchanged", {
      detail: {
        text: selectedText,
        rect: rects
      }
    });
    targetContainer.dispatchEvent(event);
  }

  /**
   * 设置PDF文档对象
   * @param {Object} pdfDocument - PDF文档对象
   */
  setPDFDocument(pdfDocument) {
    this.#logger.info("PDF document set");
  }

  /**
   * 设置文字层容器
   * @param {HTMLElement} container - 文字层容器元素
   */
  setContainer(container) {
    this.#updateContainerReference(container);
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

      this.#updateContainerReference(container);
      this.#currentPage = page;

      container.innerHTML = "";
      this.#textDivs = [];

      this.#textContent = await page.getTextContent();

      if (!this.#textContent || !this.#textContent.items || this.#textContent.items.length === 0) {
        this.#logger.warn("No text content found on page");
        return;
      }

      this.#logger.debug("Text content loaded", {
        itemCount: this.#textContent.items.length
      });

      if (!viewport) {
        viewport = page.getViewport({ scale: 1.0 });
      }

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
    const renderTextLayer = await loadRenderTextLayer();

    if (renderTextLayer) {
      try {
        this.#logger.debug("Using PDF.js renderTextLayer API");

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
      const textDiv = document.createElement("span");
      textDiv.textContent = item.str;
      textDiv.className = "textLayer-item";

      const transform = item.transform;
      const angle = Math.atan2(transform[1], transform[0]);
      const fontSize = Math.sqrt(transform[0] * transform[0] + transform[1] * transform[1]);
      const left = transform[4] * scale;
      const top = (viewport.height / scale - transform[5]) * scale - fontSize;

      textDiv.style.position = "absolute";
      textDiv.style.left = `${left}px`;
      textDiv.style.top = `${top}px`;
      textDiv.style.fontSize = `${fontSize}px`;
      textDiv.style.fontFamily = item.fontName || "sans-serif";
      textDiv.style.whiteSpace = "pre";
      textDiv.style.transformOrigin = "0% 0%";

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
        return "";
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
      return "";
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

      this.#clearHighlights();

      areaList.forEach((area, index) => {
        if (!Array.isArray(area) || area.length < 4) {
          this.#logger.warn("Invalid area format", { index, area });
          return;
        }

        const [x, y, width, height] = area;
        const highlightDiv = document.createElement("div");
        highlightDiv.className = "text-highlight";
        highlightDiv.style.position = "absolute";
        highlightDiv.style.left = `${x}px`;
        highlightDiv.style.top = `${y}px`;
        highlightDiv.style.width = `${width}px`;
        highlightDiv.style.height = `${height}px`;
        highlightDiv.style.backgroundColor = "rgba(255, 255, 0, 0.3)";
        highlightDiv.style.pointerEvents = "none";
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
    if (!this.#textLayerContainer) {return;}

    const highlights = this.#textLayerContainer.querySelectorAll(".text-highlight");
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

    if (this.#textLayerContainer) {
      this.#textLayerContainer.innerHTML = "";
    }

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

    if (this.#selectionChangeHandler) {
      document.removeEventListener("selectionchange", this.#selectionChangeHandler);
      this.#selectionChangeHandler = null;
    }

    this.cleanup();

    this.#updateContainerReference(null);

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
