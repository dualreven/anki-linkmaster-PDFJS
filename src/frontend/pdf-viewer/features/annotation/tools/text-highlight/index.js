/**
 * TextHighlightTool - 文字高亮工具
 * @module features/annotation/tools/text-highlight
 * @description 实现文本选择和高亮标注功能
 */

import { IAnnotationTool } from '../../interfaces/IAnnotationTool.js';
import { TextSelectionHandler } from './text-selection-handler.js';
import { HighlightRenderer } from './highlight-renderer.js';
import { FloatingColorToolbar } from './floating-color-toolbar.js';
import { HighlightActionMenu } from './highlight-action-menu.js';
import { PDF_TRANSLATOR_EVENTS } from '../../../pdf-translator/events.js';
import { Annotation } from '../../models/annotation.js';
import { PDF_VIEWER_EVENTS } from '../../../../../common/event/pdf-viewer-constants.js';

const HIGHLIGHT_COLOR_PRESETS = ['#ffeb3b', '#4caf50', '#2196f3', '#ff9800', '#e91e63', '#9c27b0'];

/**
 * 文字高亮工具
 * @class TextHighlightTool
 * @implements {IAnnotationTool}
 */
export class TextHighlightTool extends IAnnotationTool {
  // ==================== 私有属性 ====================

  /** @type {EventBus} */
  #eventBus = null;

  /** @type {Logger} */
  #logger = null;

  /** @type {Object} */
  #pdfViewerManager = null;

  /** @type {Object|null} PDF.js EventBus */
  #pdfjsEventBus = null;

  /** @type {Object|null} 依赖容器 */
  #container = null;

  /** @type {TextSelectionHandler} */
  #selectionHandler = null;

  /** @type {HighlightRenderer} */
  #highlightRenderer = null;

  /** @type {FloatingColorToolbar} */
  #floatingToolbar = null;

  /** @type {HighlightActionMenu} */
  #actionMenu = null;

  /** @type {Map<string, { annotation: Annotation, container: HTMLElement, boundingBox: { left: number, top: number, right: number, bottom: number, width: number, height: number } }>} */
  #annotationHighlightRecords = new Map();

  /** @type {Function} */
  #onAnnotationUpdatedHandler = null;

  /** @type {Function} */
  #onAnnotationDeletedHandler = null;

  /** @type {boolean} */
  #isActive = false;

  /** @type {Object|null} 当前选择数据（等待用户选择颜色） */
  #pendingSelection = null;

  /** @type {string} */
  #defaultColor = '#ffff00'; // 默认黄色

  /** @type {Function} */
  #onTextSelectionCompletedHandler = null;

  /** @type {Function} */
  #onAnnotationCreatedHandler = null;

  // ==================== 元数据属性 ====================

  /**
   * 工具唯一标识
   * @returns {string}
   */
  get name() {
    return 'text-highlight';
  }

  /**
   * 工具显示名称
   * @returns {string}
   */
  get displayName() {
    return '选字';
  }

  /**
   * 工具图标
   * @returns {string}
   */
  get icon() {
    return '✏️';
  }

  /**
   * 工具版本
   * @returns {string}
   */
  get version() {
    return '1.0.0';
  }

  /**
   * 工具依赖
   * @returns {string[]}
   */
  get dependencies() {
    return [];
  }

  // ==================== 生命周期方法 ====================

  /**
   * 初始化工具
   * @param {Object} context - 上下文对象
   * @param {EventBus} context.eventBus - 事件总线
   * @param {Logger} context.logger - 日志器
   * @param {Object} context.pdfViewerManager - PDF查看器管理器
   * @param {Object} context.container - 依赖容器
   * @returns {Promise<void>}
   */
  async initialize(context) {
    const { eventBus, logger, pdfViewerManager, container } = context;

    this.#eventBus = eventBus;
    this.#logger = logger || console;
    this.#pdfViewerManager = pdfViewerManager;
    this.#container = container || null;
    try {
      this.#pdfjsEventBus = this.#pdfViewerManager?.eventBus || null;
    } catch (_) {
      this.#pdfjsEventBus = null;
    }

    // 创建工具特定的对象
    this.#selectionHandler = new TextSelectionHandler(this.#eventBus, this.#logger);
    this.#highlightRenderer = new HighlightRenderer(this.#pdfViewerManager, this.#logger);

    // 创建浮动颜色工具栏
    this.#floatingToolbar = new FloatingColorToolbar({
      onColorSelected: this.#handleColorSelected.bind(this),
      onCancel: this.#handleColorSelectionCancelled.bind(this)
    });

    this.#actionMenu = new HighlightActionMenu({
      logger: this.#logger,
      colorPresets: HIGHLIGHT_COLOR_PRESETS,
      onDelete: this.#handleDeleteRequested.bind(this),
      onCopy: this.#handleCopyRequested.bind(this),
      onColorChange: this.#handleColorChangeRequested.bind(this),
      onJump: this.#handleJumpRequested.bind(this),
      onTranslate: this.#handleTranslateRequested.bind(this)
    });

    // 绑定事件处理器
    this.#onTextSelectionCompletedHandler = this.#handleTextSelectionCompleted.bind(this);
    this.#onAnnotationCreatedHandler = this.#handleAnnotationCreated.bind(this);
    this.#onAnnotationUpdatedHandler = this.#handleAnnotationUpdated.bind(this);
    this.#onAnnotationDeletedHandler = this.#handleAnnotationDeleted.bind(this);

    // 注册事件监听器
    this.#eventBus.on('annotation-highlight:selection:completed', this.#onTextSelectionCompletedHandler);
    this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.CREATED, this.#onAnnotationCreatedHandler);
    this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.UPDATED, this.#onAnnotationUpdatedHandler);
    this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.DELETED, this.#onAnnotationDeletedHandler);

    // 页面渲染完成后恢复该页的高亮（确保跳转或翻页后可见）
    if (this.#pdfjsEventBus && typeof this.#pdfjsEventBus.on === 'function') {
      this.#pdfjsEventBus.on('pagerendered', (evt) => {
        try {
          const pn = evt?.pageNumber;
          if (!pn) return;
          this.#restoreHighlightsForPage(pn);
        } catch (e) {
          this.#logger?.warn?.('[TextHighlightTool] restore on pagerendered failed', e);
        }
      });
    }

    // 跳转成功后，若为高亮标注则确保渲染
    this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_SUCCESS, ({ annotation }) => {
      try {
        if (!annotation || annotation.type !== 'text-highlight') return;
        setTimeout(() => this.#renderHighlightForAnnotation(annotation), 120);
      } catch (e) {
        this.#logger?.warn?.('[TextHighlightTool] ensure render on jump failed', e);
      }
    });

    this.#logger.info('[TextHighlightTool] Initialized successfully');
  }

  /**
   * 激活工具
   * @returns {void}
   */
  activate() {
    if (this.#isActive) {
      this.#logger.warn('[TextHighlightTool] Already active');
      return;
    }

    this.#isActive = true;

    // 开始监听文本选择
    this.#selectionHandler.startListening();

    // 更改鼠标指针样式
    const viewerContainer = document.getElementById('viewerContainer');
    if (viewerContainer) {
      viewerContainer.style.cursor = 'text';
    }

    this.#logger.info('[TextHighlightTool] Activated');

    // 发布工具激活事件
    this.#eventBus.emit('annotation-tool:activate:success', {
      tool: this.name
    });
  }

  /**
   * 停用工具
   * @returns {void}
   */
  deactivate() {
    if (!this.#isActive) {
      return;
    }

    this.#isActive = false;

    // 停止监听文本选择
    this.#selectionHandler.stopListening();

    // 恢复鼠标指针样式
    const viewerContainer = document.getElementById('viewerContainer');
    if (viewerContainer) {
      viewerContainer.style.cursor = 'default';
    }

    // 清除当前选择
    window.getSelection()?.removeAllRanges();

    this.#logger.info('[TextHighlightTool] Deactivated');

    // 发布工具停用事件
    this.#eventBus.emit('annotation-tool:deactivate:success', {
      tool: this.name
    });
  }

  /**
   * 检查工具是否激活
   * @returns {boolean}
   */
  isActive() {
    return this.#isActive;
  }

  // ==================== 事件处理器 ====================

  /**
   * 处理文本选择完成事件
   * @param {Object} data - 选择数据
   * @param {string} data.text - 选中的文本
   * @param {number} data.pageNumber - 页码
   * @param {Array<{start: number, end: number}>} data.ranges - 文本范围
   * @param {Range} data.range - 浏览器Range对象
   * @param {Object} data.rect - 边界矩形（相对于页面容器）
   * @returns {void}
   * @private
   */
  #handleTextSelectionCompleted(data) {
    if (!this.#isActive) {
      return;
    }

    const { text, pageNumber, ranges, rect, range, lineRects } = data;

    this.#logger.info('[TextHighlightTool] Text selected', {
      text: text.substring(0, 50) + '...',
      pageNumber,
      rangesCount: ranges.length
    });

    // 保存选择数据，等待用户选择颜色
    this.#pendingSelection = { text, pageNumber, ranges, rect, lineRects };

    // 获取选择区域相对于viewport的位置
    const viewportRect = range.getBoundingClientRect();

    // 显示浮动颜色工具栏
    this.#floatingToolbar.show(viewportRect);

    this.#logger.debug('[TextHighlightTool] Floating toolbar shown at', viewportRect);
  }

  /**
   * 处理颜色选择
   * @param {string} color - 选中的颜色
   * @private
   */
  #handleColorSelected(color) {
    if (!this.#pendingSelection) {
      this.#logger.warn('[TextHighlightTool] No pending selection');
      return;
    }

    const { text, pageNumber, ranges, rect, lineRects } = this.#pendingSelection;

    this.#logger.info('[TextHighlightTool] Color selected', { color });

    try {
      // 创建标注对象
      const annotationData = {
        selectedText: text,
        highlightColor: color,
        textRanges: ranges,
        boundingBox: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        }
      };

      if (Array.isArray(lineRects) && lineRects.length > 0) {
        annotationData.lineRects = lineRects;
      }

      const annotation = new Annotation({
        type: 'text-highlight',
        pageNumber: pageNumber,
        data: annotationData
      });

      // 发送创建标注请求
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.CREATE, {
        annotation: annotation
      });

      this.#logger.info('[TextHighlightTool] Annotation created', {
        id: annotation.id,
        type: annotation.type,
        pageNumber: annotation.pageNumber
      });
    } catch (error) {
      this.#logger.error('[TextHighlightTool] Error creating annotation', error);
    } finally {
      // 清除选择和待处理数据
      window.getSelection()?.removeAllRanges();
      this.#pendingSelection = null;
    }
  }

  /**
   * 处理颜色选择取消
   * @private
   */
  #handleColorSelectionCancelled() {
    this.#logger.info('[TextHighlightTool] Color selection cancelled');

    // 清除选择和待处理数据
    window.getSelection()?.removeAllRanges();
    this.#pendingSelection = null;
  }

  /**
   * 处理标注创建成功事件
   * @param {Object} data - 事件数据
   * @param {Annotation} data.annotation - 标注对象
   * @returns {void}
   * @private
   */
  #handleAnnotationCreated(data) {
    const { annotation } = data;

    // 只处理文本高亮类型的标注
    if (annotation.type !== 'text-highlight') {
      return;
    }

    this.#logger.info('[TextHighlightTool] Rendering highlight for annotation', annotation.id);

    const renderResult = this.#highlightRenderer.renderHighlight(
      annotation.pageNumber,
      annotation.data.textRanges,
      annotation.data.highlightColor,
      annotation.id,
      annotation.data.lineRects
    );

    if (!renderResult) {
      return;
    }

    this.#annotationHighlightRecords.set(annotation.id, {
      annotation,
      container: renderResult.container,
      boundingBox: renderResult.boundingBox
    });

    this.#actionMenu?.attach(renderResult.container, annotation, { boundingBox: renderResult.boundingBox });
  }

  /**
   * 处理删除请求
   * @param {Annotation} annotation - 标注对象
   * @private
   */
  #handleDeleteRequested(annotation) {
    if (!annotation?.id) {
      return;
    }

    const shouldDelete = typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm('确定要删除这个高亮标注吗？')
      : true;

    if (!shouldDelete) {
      return;
    }

    this.#logger.info(`[TextHighlightTool] Delete requested for annotation ${annotation.id}`);
    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DELETE, { id: annotation.id });
  }

  /**
   * 处理复制请求
   * @param {Annotation} annotation - 标注对象
   * @private
   */
  #handleCopyRequested(annotation) {
    const latestRecord = annotation?.id ? this.#annotationHighlightRecords.get(annotation.id)?.annotation : null;
    const text = latestRecord?.data?.selectedText ?? annotation?.data?.selectedText;
    if (!text) {
      this.#logger.warn('[TextHighlightTool] No text available for copy');
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          this.#logger.info('[TextHighlightTool] Copied highlight text to clipboard');
        })
        .catch((error) => {
          this.#logger.warn('[TextHighlightTool] Clipboard API failed, fallback in use', error);
          this.#fallbackCopyToClipboard(text);
        });
    } else {
      this.#fallbackCopyToClipboard(text);
    }
  }

  /**
   * 剪贴板复制回退方案
   * @param {string} text - 要复制的文本
   * @private
   */
  #fallbackCopyToClipboard(text) {
    if (typeof document === 'undefined') {
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
      this.#logger.info('[TextHighlightTool] Copied highlight text via fallback');
    } catch (error) {
      this.#logger.error('[TextHighlightTool] Failed to copy highlight text', error);
    } finally {
      textarea.remove();
    }
  }

  /**
   * 处理颜色变更请求
   * @param {Annotation} annotation - 标注对象
   * @param {string} color - 新颜色
   * @private
   */
  #handleColorChangeRequested(annotation, color) {
    if (!annotation?.id) {
      return;
    }

    this.#logger.info(`[TextHighlightTool] Color change requested: ${color} for ${annotation.id}`);

    this.#highlightRenderer.updateHighlightColor(annotation.id, color);
    this.#actionMenu?.updateColor(annotation.id, color);

    const record = this.#annotationHighlightRecords.get(annotation.id);
    if (record) {
      record.annotation = {
        ...annotation,
        data: {
          ...annotation.data,
          highlightColor: color
        }
      };
    }

    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.UPDATE, {
      id: annotation.id,
      changes: {
        data: {
          highlightColor: color
        }
      }
    });
  }

  /**
   * 处理跳转请求
   * @param {Annotation} annotation - 标注对象
   * @private
   */
  #handleJumpRequested(annotation) {
    if (!annotation?.id) {
      return;
    }

    this.#logger.info(`[TextHighlightTool] Jump requested for annotation ${annotation.id}`);
    this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPEN_REQUESTED, { sidebarId: 'annotation' });
    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SELECT, { id: annotation.id });
    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED, { annotation });
  }

  /**
   * 处理翻译请求
   * @param {Annotation} annotation - 标注对象
   * @private
   */
  #handleTranslateRequested(annotation) {
    const latestRecord = annotation?.id ? this.#annotationHighlightRecords.get(annotation.id)?.annotation : null;
    const text = latestRecord?.data?.selectedText ?? annotation?.data?.selectedText;
    if (!text) {
      this.#logger.warn('[TextHighlightTool] No text available for translation');
      return;
    }

    this.#logger.info(`[TextHighlightTool] Translate requested for annotation ${annotation.id}`);
    this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPEN_REQUESTED, { sidebarId: 'translate' });
    this.#eventBus.emitGlobal(PDF_TRANSLATOR_EVENTS.TEXT.SELECTED, {
      text,
      pageNumber: annotation.pageNumber,
      annotationId: annotation.id,
      source: 'text-highlight',
      timestamp: Date.now()
    });
  }

  /**
   * 处理标注更新事件
   * @param {{ annotation: Annotation }} data - 事件数据
   * @private
   */
  #handleAnnotationUpdated(data) {
    const annotation = data?.annotation;
    if (!annotation || annotation.type !== 'text-highlight') {
      return;
    }

    const record = this.#annotationHighlightRecords.get(annotation.id);
    if (!record) {
      return;
    }

    record.annotation = annotation;

    if (annotation.data?.highlightColor) {
      this.#highlightRenderer.updateHighlightColor(annotation.id, annotation.data.highlightColor);
      this.#actionMenu?.updateColor(annotation.id, annotation.data.highlightColor);
    }
  }

  /**
   * 处理标注删除事件
   * @param {{ id: string }} data - 事件数据
   * @private
   */
  #handleAnnotationDeleted(data) {
    const annotationId = data?.id;
    if (!annotationId) {
      return;
    }

    this.#logger.info(`[TextHighlightTool] Annotation deleted event received: ${annotationId}`);
    this.#highlightRenderer.removeHighlight(annotationId);
    this.#actionMenu?.detach(annotationId);
    this.#annotationHighlightRecords.delete(annotationId);
  }

  /**
   * 确保指定高亮注释的覆盖层已渲染
   * @param {Annotation} annotation
   */
  ensureOverlayFor(annotation) {
    try {
      if (!annotation || annotation.type !== 'text-highlight') return;
      // 若页已渲染，直接尝试渲染；否则等待 pagerendered 钩子恢复
      this.#renderHighlightForAnnotation(annotation);
    } catch (e) {
      this.#logger?.warn?.('[TextHighlightTool] ensureOverlayFor failed', e);
    }
  }

  /**
   * 渲染（或确保）高亮注释在页面上可见
   * @param {Annotation} annotation
   * @private
   */
  #renderHighlightForAnnotation(annotation) {
    try {
      if (!annotation || annotation.type !== 'text-highlight') return;
      if (this.#annotationHighlightRecords.has(annotation.id)) {
        if (annotation.data?.highlightColor) {
          this.#highlightRenderer.updateHighlightColor(annotation.id, annotation.data.highlightColor);
          this.#actionMenu?.updateColor(annotation.id, annotation.data.highlightColor);
        }
        return;
      }
      const result = this.#highlightRenderer.renderHighlight(
        annotation.pageNumber,
        annotation.data?.textRanges || [],
        annotation.data?.highlightColor,
        annotation.id,
        annotation.data?.lineRects || null
      );
      if (result) {
        this.#annotationHighlightRecords.set(annotation.id, {
          annotation,
          container: result.container,
          boundingBox: result.boundingBox,
        });
        this.#actionMenu?.attach(result.container, annotation, { boundingBox: result.boundingBox });
      }
    } catch (e) {
      this.#logger?.warn?.('[TextHighlightTool] renderHighlightForAnnotation failed', e);
    }
  }

  /**
   * 恢复某页所有高亮（从 AnnotationManager 获取）
   * @param {number} pageNumber
   * @private
   */
  #restoreHighlightsForPage(pageNumber) {
    try {
      const mgr = this.#container?.get ? this.#container.get('annotationManager') : null;
      if (!mgr || typeof mgr.getAnnotationsByPage !== 'function') return;
      const list = mgr.getAnnotationsByPage(pageNumber) || [];
      list.forEach((ann) => {
        if (ann?.type === 'text-highlight') {
          this.#renderHighlightForAnnotation(ann);
        }
      });
    } catch (e) {
      this.#logger?.warn?.('[TextHighlightTool] restoreHighlightsForPage failed', e);
    }
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
    button.innerHTML = `<span class="tool-icon">${this.icon}</span><span class="tool-name">${this.displayName}</span>`;
    button.title = `${this.displayName}工具 - 选择文本并高亮标注`;

    button.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background-color: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s ease;
      margin: 4px 0;
    `;

    // 鼠标悬停效果
    button.addEventListener('mouseenter', () => {
      if (!this.#isActive) {
        button.style.backgroundColor = '#e8e8e8';
      }
    });

    button.addEventListener('mouseleave', () => {
      if (!this.#isActive) {
        button.style.backgroundColor = '#f5f5f5';
      }
    });

    // 点击切换工具激活状态
    button.addEventListener('click', () => {
      if (this.#isActive) {
        this.deactivate();
        button.style.backgroundColor = '#f5f5f5';
        button.style.borderColor = '#ddd';
      } else {
        // 请求激活此工具（会通过ToolRegistry停用其他工具）
        this.#eventBus.emit('annotation-tool:activate:requested', {
          tool: this.name
        });
        button.style.backgroundColor = '#e3f2fd';
        button.style.borderColor = '#2196F3';
      }
    });

    // 监听工具激活/停用事件来更新按钮样式
    this.#eventBus.on('annotation-tool:activate:success', (data) => {
      if (data.tool === this.name) {
        button.style.backgroundColor = '#e3f2fd';
        button.style.borderColor = '#2196F3';
      } else {
        button.style.backgroundColor = '#f5f5f5';
        button.style.borderColor = '#ddd';
      }
    });

    this.#eventBus.on('annotation-tool:deactivate:success', (data) => {
      if (data.tool === this.name) {
        button.style.backgroundColor = '#f5f5f5';
        button.style.borderColor = '#ddd';
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
    card.className = 'annotation-card text-highlight-card';
    card.dataset.annotationId = annotation.id;

    card.style.cssText = `
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    // 鼠标悬停效果
    card.addEventListener('mouseenter', () => {
      card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      card.style.borderColor = '#2196F3';
    });

    card.addEventListener('mouseleave', () => {
      card.style.boxShadow = 'none';
      card.style.borderColor = '#e0e0e0';
    });

    // 颜色指示条
    const colorIndicator = document.createElement('div');
    colorIndicator.style.cssText = `
      width: 100%;
      height: 4px;
      background-color: ${annotation.data.color};
      border-radius: 2px;
      margin-bottom: 8px;
    `;
    card.appendChild(colorIndicator);

    // 文本内容（截断显示）
    const textContent = document.createElement('div');
    textContent.className = 'annotation-text';
    const displayText = annotation.data.text.length > 100
      ? annotation.data.text.substring(0, 100) + '...'
      : annotation.data.text;
    textContent.textContent = displayText;
    textContent.style.cssText = `
      font-size: 14px;
      color: #333;
      line-height: 1.5;
      margin-bottom: 8px;
      word-break: break-word;
    `;
    card.appendChild(textContent);

    // 信息栏
    const infoBar = document.createElement('div');
    infoBar.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: #666;
      margin-bottom: 8px;
    `;

    const pageInfo = document.createElement('span');
    pageInfo.textContent = `页码: ${annotation.pageNumber}`;
    infoBar.appendChild(pageInfo);

    const timeInfo = document.createElement('span');
    timeInfo.textContent = annotation.getFormattedDate();
    infoBar.appendChild(timeInfo);

    card.appendChild(infoBar);

    // 操作按钮组
    const actionBar = document.createElement('div');
    actionBar.style.cssText = `
      display: flex;
      gap: 8px;
      margin-top: 8px;
    `;

    // 跳转按钮
    const jumpButton = document.createElement('button');
    jumpButton.textContent = '跳转';
    jumpButton.style.cssText = `
      flex: 1;
      padding: 6px 12px;
      background-color: #2196F3;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: background-color 0.2s ease;
    `;
    jumpButton.addEventListener('mouseenter', () => {
      jumpButton.style.backgroundColor = '#1976D2';
    });
    jumpButton.addEventListener('mouseleave', () => {
      jumpButton.style.backgroundColor = '#2196F3';
    });
    jumpButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED, {
        annotation: annotation
      });
    });
    actionBar.appendChild(jumpButton);

    // 删除按钮
    const deleteButton = document.createElement('button');
    deleteButton.textContent = '删除';
    deleteButton.style.cssText = `
      flex: 1;
      padding: 6px 12px;
      background-color: #f44336;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: background-color 0.2s ease;
    `;
    deleteButton.addEventListener('mouseenter', () => {
      deleteButton.style.backgroundColor = '#d32f2f';
    });
    deleteButton.addEventListener('mouseleave', () => {
      deleteButton.style.backgroundColor = '#f44336';
    });
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('确定要删除这个标注吗？')) {
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DELETE, {
          id: annotation.id
        });
      }
    });
    actionBar.appendChild(deleteButton);

    card.appendChild(actionBar);

    // 卡片点击跳转
    card.addEventListener('click', () => {
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED, {
        annotation: annotation
      });
    });

    return card;
  }

  // ==================== 清理方法 ====================

  /**
   * 销毁工具
   * @returns {void}
   */
  destroy() {
    // 停用工具
    if (this.#isActive) {
      this.deactivate();
    }

    // 移除事件监听器
    if (this.#eventBus) {
      this.#eventBus.off('annotation-highlight:selection:completed', this.#onTextSelectionCompletedHandler);
      this.#eventBus.off(PDF_VIEWER_EVENTS.ANNOTATION.CREATED, this.#onAnnotationCreatedHandler);
      this.#eventBus.off(PDF_VIEWER_EVENTS.ANNOTATION.UPDATED, this.#onAnnotationUpdatedHandler);
      this.#eventBus.off(PDF_VIEWER_EVENTS.ANNOTATION.DELETED, this.#onAnnotationDeletedHandler);
    }

    // 销毁子组件
    if (this.#selectionHandler) {
      this.#selectionHandler.destroy();
    }

    if (this.#highlightRenderer) {
      this.#highlightRenderer.destroy();
    }

    if (this.#floatingToolbar) {
      this.#floatingToolbar.destroy();
    }

    if (this.#actionMenu) {
      this.#actionMenu.destroy();
    }

    // 清理引用
    this.#eventBus = null;
    this.#logger = null;
    this.#pdfViewerManager = null;
    this.#selectionHandler = null;
    this.#highlightRenderer = null;
    this.#floatingToolbar = null;
    this.#actionMenu = null;
    this.#pendingSelection = null;
    this.#onTextSelectionCompletedHandler = null;
    this.#onAnnotationCreatedHandler = null;
    this.#onAnnotationUpdatedHandler = null;
    this.#onAnnotationDeletedHandler = null;
    this.#annotationHighlightRecords.clear();

    this.#logger?.info('[TextHighlightTool] Destroyed');
  }
}

export default TextHighlightTool;
