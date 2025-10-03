/**
 * CommentTool - 批注工具插件
 * @module features/annotation/tools/comment
 * @description 实现PDF批注功能的工具插件
 */

import { getLogger } from '../../../../../common/utils/logger.js';
import { IAnnotationTool } from '../../interfaces/IAnnotationTool.js';
import { CommentInput } from './comment-input.js';
import { CommentMarker } from './comment-marker.js';
import { Annotation } from '../../models/annotation.js';

/**
 * 批注工具类
 * @class CommentTool
 * @implements {IAnnotationTool}
 */
export class CommentTool extends IAnnotationTool {
  // ==================== 元数据属性 ====================

  get name() {
    return 'comment';
  }

  get displayName() {
    return '批注';
  }

  get icon() {
    return '📝';
  }

  get version() {
    return '1.0.0';
  }

  get dependencies() {
    return [];
  }

  // ==================== 私有属性 ====================

  /** @type {import('../../../../../common/utils/logger.js').Logger} */
  #logger = null;

  /** @type {import('../../../../../common/event/event-bus.js').EventBus} */
  #eventBus = null;

  /** @type {Object} PDF查看器管理器 */
  #pdfViewerManager = null;

  /** @type {Object} 依赖容器 */
  #container = null;

  /** @type {boolean} 是否激活 */
  #isActive = false;

  /** @type {CommentInput} 输入组件 */
  #commentInput = null;

  /** @type {CommentMarker} 标记渲染器 */
  #commentMarker = null;

  /** @type {Function} 点击处理器 */
  #clickHandler = null;

  /** @type {string} 原始鼠标样式 */
  #originalCursor = '';

  // ==================== 生命周期方法 ====================

  /**
   * 初始化工具
   * @param {Object} context - 上下文对象
   * @returns {Promise<void>}
   */
  async initialize(context) {
    const { eventBus, logger, pdfViewerManager, container } = context;

    this.#logger = logger || getLogger('CommentTool');
    this.#eventBus = eventBus;
    this.#pdfViewerManager = pdfViewerManager;
    this.#container = container;

    // 创建辅助组件
    this.#commentInput = new CommentInput();
    this.#commentMarker = new CommentMarker();

    this.#logger.info(`CommentTool initialized (v${this.version})`);
  }

  /**
   * 激活工具
   */
  activate() {
    if (this.#isActive) {
      this.#logger.warn('CommentTool already active');
      return;
    }

    this.#isActive = true;

    // 保存原始鼠标样式
    const pdfContainer = document.querySelector('.pdf-container');
    if (pdfContainer) {
      this.#originalCursor = pdfContainer.style.cursor || 'default';
      pdfContainer.style.cursor = 'crosshair';
    }

    // 添加点击事件监听
    this.#clickHandler = (e) => this.#handlePdfClick(e);
    if (pdfContainer) {
      pdfContainer.addEventListener('click', this.#clickHandler);
    }

    this.#logger.info('CommentTool activated');

    // 发布激活事件
    this.#eventBus.emit(
      'annotation-tool:activate:success',
      { tool: this.name },
      { actorId: 'CommentTool' }
    );
  }

  /**
   * 停用工具
   */
  deactivate() {
    if (!this.#isActive) {
      return;
    }

    this.#isActive = false;

    // 恢复鼠标样式
    const pdfContainer = document.querySelector('.pdf-container');
    if (pdfContainer) {
      pdfContainer.style.cursor = this.#originalCursor;
    }

    // 移除点击事件监听
    if (this.#clickHandler && pdfContainer) {
      pdfContainer.removeEventListener('click', this.#clickHandler);
      this.#clickHandler = null;
    }

    // 隐藏输入框（如果显示中）
    if (this.#commentInput && this.#commentInput.isVisible()) {
      this.#commentInput.hide();
    }

    this.#logger.info('CommentTool deactivated');

    // 发布停用事件
    this.#eventBus.emit(
      'annotation-tool:deactivate:success',
      { tool: this.name },
      { actorId: 'CommentTool' }
    );
  }

  /**
   * 检查工具是否激活
   * @returns {boolean}
   */
  isActive() {
    return this.#isActive;
  }

  // ==================== 事件处理 ====================

  /**
   * 处理PDF点击
   * @private
   * @param {MouseEvent} e - 鼠标事件
   */
  #handlePdfClick(e) {
    // 如果输入框正在显示，忽略点击
    if (this.#commentInput.isVisible()) {
      return;
    }

    // 阻止事件默认行为和冒泡，避免触发其他导航逻辑
    e.preventDefault();
    e.stopPropagation();

    // 查找实际点击的页面元素
    let pageElement = e.target.closest('.page');
    if (!pageElement) {
      this.#logger.warn('Click target is not within a .page element, ignoring');
      return;
    }

    // 从页面元素获取页码
    const pageNumber = parseInt(pageElement.dataset.pageNumber) || this.#getCurrentPageNumber();

    // 获取点击位置（相对于页面元素）
    const pageRect = pageElement.getBoundingClientRect();
    const x = e.clientX - pageRect.left;
    const y = e.clientY - pageRect.top;

    // 获取显示输入框的位置（相对于视口）
    const displayX = e.clientX;
    const displayY = e.clientY;

    this.#logger.info(`PDF clicked at (${x}, ${y}) on page ${pageNumber}`);

    // 显示输入框（使用视口坐标）
    this.#commentInput.show({
      x: displayX,
      y: displayY,
      pageNumber,
      onConfirm: (content) => this.#createComment(x, y, pageNumber, content),
      onCancel: () => {
        this.#logger.info('Comment creation cancelled');
      },
    });
  }

  /**
   * 创建批注
   * @private
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {number} pageNumber - 页码
   * @param {string} content - 批注内容
   */
  #createComment(x, y, pageNumber, content) {
    this.#logger.info(`Creating comment at (${x}, ${y}) on page ${pageNumber}: "${content}"`);

    // 创建标注对象（使用静态工厂方法）
    const annotation = Annotation.createComment(pageNumber, { x, y }, content);

    // 创建并渲染标记
    const marker = this.#commentMarker.createMarker(annotation);

    // 添加标记到页面
    const pageElement = this.#getPageElement(pageNumber);
    if (pageElement) {
      this.#commentMarker.renderToPage(annotation.id, pageElement);
    }

    // 添加标记点击事件
    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#handleMarkerClick(annotation.id);
    });

    // 发布创建事件
    this.#eventBus.emit(
      'annotation:create:requested',
      { annotation },
      { actorId: 'CommentTool' }
    );

    this.#logger.info(`Comment annotation created: ${annotation.id}`);
  }

  /**
   * 处理标记点击
   * @private
   * @param {string} annotationId - 标注ID
   */
  #handleMarkerClick(annotationId) {
    this.#logger.info(`Comment marker clicked: ${annotationId}`);

    // 高亮标记
    this.#commentMarker.highlightMarker(annotationId);

    // 发布选择事件
    this.#eventBus.emit(
      'annotation:select:requested',
      { id: annotationId },
      { actorId: 'CommentTool' }
    );
  }

  /**
   * 获取当前页码
   * @private
   * @returns {number}
   */
  #getCurrentPageNumber() {
    // 简化版：返回1，实际应该从PDFViewerManager获取
    if (this.#pdfViewerManager && this.#pdfViewerManager.currentPageNumber) {
      return this.#pdfViewerManager.currentPageNumber;
    }
    return 1;
  }

  /**
   * 获取页面元素
   * @private
   * @param {number} pageNumber - 页码
   * @returns {HTMLElement|null}
   */
  #getPageElement(pageNumber) {
    // 查找对应页码的页面元素
    const pageElement = document.querySelector(`.page[data-page-number="${pageNumber}"]`);
    if (pageElement) {
      return pageElement;
    }

    // 备用方案：使用PDF容器
    const pdfContainer = document.querySelector('.pdf-container');
    return pdfContainer;
  }

  // ==================== UI方法 ====================

  /**
   * 创建工具按钮
   * @returns {HTMLElement}
   */
  createToolButton() {
    const button = document.createElement('button');
    button.id = `${this.name}-tool-btn`;
    button.className = 'annotation-tool-button';
    button.textContent = `${this.icon} ${this.displayName}`;
    button.title = `${this.displayName}工具`;

    button.style.cssText = `
      padding: 8px 16px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s, border-color 0.2s;
      display: flex;
      align-items: center;
      gap: 6px;
    `;

    // 点击事件
    button.addEventListener('click', () => {
      if (this.isActive()) {
        this.deactivate();
        button.style.background = 'white';
        button.style.borderColor = '#ddd';
      } else {
        this.#eventBus.emit(
          'annotation-tool:activate:requested',
          { tool: this.name },
          { actorId: 'CommentTool' }
        );
        button.style.background = '#E3F2FD';
        button.style.borderColor = '#2196F3';
      }
    });

    return button;
  }

  /**
   * 创建标注卡片
   * @param {Annotation} annotation - 标注对象
   * @returns {HTMLElement}
   */
  createAnnotationCard(annotation) {
    const card = document.createElement('div');
    card.className = 'annotation-card comment-card';
    card.dataset.annotationId = annotation.id;

    card.style.cssText = `
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      margin-bottom: 12px;
      background: white;
      cursor: pointer;
      transition: box-shadow 0.2s;
    `;

    card.innerHTML = `
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">${this.icon}</span>
          <span style="font-weight: bold; color: #333;">批注</span>
        </div>
        <span style="font-size: 12px; color: #999;">第${annotation.pageNumber}页</span>
      </div>
      <div class="card-content" style="color: #555; font-size: 14px; line-height: 1.5; margin-bottom: 8px;">
        ${annotation.data.content || '无内容'}
      </div>
      <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 12px; color: #999;">${annotation.getFormattedDate()}</span>
        <div class="card-actions" style="display: flex; gap: 8px;">
          <button class="jump-btn" style="padding: 4px 12px; border: 1px solid #2196F3; border-radius: 4px; background: white; color: #2196F3; cursor: pointer; font-size: 12px;">
            跳转
          </button>
          <button class="delete-btn" style="padding: 4px 12px; border: 1px solid #f44336; border-radius: 4px; background: white; color: #f44336; cursor: pointer; font-size: 12px;">
            删除
          </button>
        </div>
      </div>
    `;

    // 卡片点击高亮
    card.addEventListener('click', (e) => {
      if (!e.target.classList.contains('jump-btn') && !e.target.classList.contains('delete-btn')) {
        this.#commentMarker.highlightMarker(annotation.id);
      }
    });

    // 悬停效果
    card.addEventListener('mouseenter', () => {
      card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
    });

    card.addEventListener('mouseleave', () => {
      card.style.boxShadow = 'none';
    });

    // 跳转按钮
    const jumpBtn = card.querySelector('.jump-btn');
    jumpBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#eventBus.emit(
        'annotation:jump:requested',
        { id: annotation.id },
        { actorId: 'CommentTool' }
      );
    });

    // 删除按钮
    const deleteBtn = card.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('确定要删除这条批注吗？')) {
        this.#eventBus.emit(
          'annotation:delete:requested',
          { id: annotation.id },
          { actorId: 'CommentTool' }
        );
      }
    });

    return card;
  }

  // ==================== 清理方法 ====================

  /**
   * 销毁工具
   */
  destroy() {
    this.#logger.info('Destroying CommentTool');

    // 停用工具
    if (this.isActive()) {
      this.deactivate();
    }

    // 销毁组件
    if (this.#commentInput) {
      this.#commentInput.destroy();
      this.#commentInput = null;
    }

    if (this.#commentMarker) {
      this.#commentMarker.destroy();
      this.#commentMarker = null;
    }

    // 清空引用
    this.#eventBus = null;
    this.#logger = null;
    this.#pdfViewerManager = null;
    this.#container = null;

    this.#logger.info('CommentTool destroyed');
  }
}

export default CommentTool;
