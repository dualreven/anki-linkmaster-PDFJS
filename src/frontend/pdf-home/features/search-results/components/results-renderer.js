/**
 * 搜索结果渲染器
 * 负责渲染搜索结果列表
 */

import { ResultItemRenderer } from '../../search-result-item/components/result-item-renderer.js';

export class ResultsRenderer {
  #logger = null;
  #eventBus = null;
  #container = null;
  #itemRenderer = null;

  constructor(logger, eventBus) {
    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#itemRenderer = new ResultItemRenderer(logger, {
      showMetadata: true,
      showTags: true,
      showNotes: true
    });
  }

  /**
   * 渲染结果列表
   * @param {HTMLElement} container - 容器元素
   * @param {Array} results - 搜索结果数据
   */
  render(container, results) {
    this.#container = container;

    this.#logger.info('[ResultsRenderer] ===== render() called =====', {
      hasContainer: !!container,
      containerTagName: container?.tagName,
      containerId: container?.id,
      resultsCount: results?.length || 0,
      hasResults: results && results.length > 0
    });

    if (!results || results.length === 0) {
      this.#logger.warn('[ResultsRenderer] No results, showing empty state');
      this.#renderEmptyState();
      return;
    }

    // 清空容器
    this.#container.innerHTML = '';
    this.#logger.info('[ResultsRenderer] Container cleared, starting render loop');

    // 渲染每个结果项
    results.forEach((result, index) => {
      try {
        this.#logger.debug('[ResultsRenderer] Rendering item', index, ':', result.title || result.filename);
        const itemHTML = this.#itemRenderer.render(result);
        const itemElement = this.#createElementFromHTML(itemHTML);

        // 绑定点击事件
        itemElement.addEventListener('click', () => {
          this.#handleItemClick(result, index);
        });

        // 绑定双击事件（打开PDF）
        itemElement.addEventListener('dblclick', () => {
          this.#handleItemDoubleClick(result);
        });

        this.#container.appendChild(itemElement);
      } catch (error) {
        this.#logger.error('[ResultsRenderer] Error rendering item', index, error);
      }
    });

    this.#logger.info('[ResultsRenderer] ===== Render complete =====', { count: results.length });
  }

  /**
   * 渲染空状态
   * @private
   */
  #renderEmptyState() {
    this.#container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>输入关键词开始搜索</h3>
        <p>使用上方搜索框搜索PDF文档，支持文件名、标签、备注等字段</p>
      </div>
    `;
  }

  /**
   * 从HTML字符串创建元素
   * @private
   */
  #createElementFromHTML(htmlString) {
    const div = document.createElement('div');
    div.innerHTML = htmlString.trim();
    return div.firstChild;
  }

  /**
   * 处理条目点击
   * @private
   */
  #handleItemClick(result, index) {
    this.#logger.debug('[ResultsRenderer] Item clicked', { id: result.id, index });

    // 清除其他选中状态
    this.#container.querySelectorAll('.search-result-item.selected').forEach(item => {
      item.classList.remove('selected');
    });

    // 添加选中状态
    const clickedItem = this.#container.querySelector(`[data-id="${result.id}"]`);
    if (clickedItem) {
      clickedItem.classList.add('selected');
    }

    // 发出选中事件
    this.#eventBus.emit('results:item:selected', { result, index });
  }

  /**
   * 处理条目双击（打开PDF）
   * @private
   */
  #handleItemDoubleClick(result) {
    this.#logger.info('[ResultsRenderer] Item double-clicked', { id: result.id });

    // 发出打开事件
    this.#eventBus.emit('results:item:open', { result });
  }

  /**
   * 销毁渲染器
   */
  destroy() {
    if (this.#container) {
      this.#container.innerHTML = '';
    }

    this.#logger.info('[ResultsRenderer] Destroyed');
  }
}
