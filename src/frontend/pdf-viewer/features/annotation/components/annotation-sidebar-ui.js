/**
 * 标注侧边栏UI
 * @file 标注侧边栏UI组件，显示和管理所有标注
 * @module AnnotationSidebarUI
 */

import { getLogger } from "../../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { AnnotationType } from '../models/index.js';

/**
 * 标注侧边栏UI类
 * @class AnnotationSidebarUI
 * @description 管理标注侧边栏的显示和交互
 */
export class AnnotationSidebarUI {
  /** @type {EventBus} */
  #eventBus;
  /** @type {Logger} */
  #logger;
  /** @type {HTMLElement} */
  #container;
  /** @type {HTMLElement} */
  #sidebar;
  /** @type {HTMLElement} */
  #sidebarHeader;
  /** @type {HTMLElement} */
  #sidebarContent;
  /** @type {Array<Annotation>} */
  #annotations = [];
  /** @type {Array<Function>} */
  #unsubs = [];
  /** @type {string|null} */
  #activeTool = null;
  /** @type {Map<string, HTMLElement>} */
  #annotationCards = new Map();

  /**
   * 创建AnnotationSidebarUI实例
   * @param {EventBus} eventBus - 事件总线
   * @param {Object} [options={}] - 配置选项
   * @param {HTMLElement} [options.container] - 容器元素
   */
  constructor(eventBus, options = {}) {
    this.#eventBus = eventBus;
    this.#logger = getLogger('AnnotationSidebarUI');
    this.#container = options.container || document.querySelector('main');
    this.#sidebar = null;
  }

  /**
   * 初始化侧边栏
   */
  initialize() {
    this.#logger.info('Initializing annotation sidebar UI');

    // 创建侧边栏DOM
    this.#createSidebar();

    // 监听事件
    this.#setupEventListeners();
  }

  /**
   * 创建侧边栏DOM结构
   * @private
   */
  #createSidebar() {
    if (!this.#container) {
      this.#logger.warn('Container not found');
      return;
    }
    if (this.#sidebar && this.#sidebar.parentNode) {
      this.#logger.debug('Sidebar already exists');
      return;
    }

    // 主侧边栏容器
    const sidebar = document.createElement('div');
    sidebar.id = 'annotation-sidebar';
    sidebar.className = 'annotation-sidebar';
    sidebar.style.cssText = [
      'position: absolute',
      'left: 0',
      'top: 0',
      'bottom: 0',
      'width: 350px',
      'overflow: hidden',
      'background: #ffffff',
      'border-right: 1px solid #ccc',
      'box-shadow: 2px 0 8px rgba(0,0,0,0.15)',
      'padding: 0',
      'box-sizing: border-box',
      'display: none',
      'z-index: 1001',
      'flex-direction: column'
    ].join(';');

    this.#container.style.position = this.#container.style.position || 'relative';
    this.#container.appendChild(sidebar);
    this.#sidebar = sidebar;

    // 创建Header
    this.#sidebarHeader = this.#createHeader();
    sidebar.appendChild(this.#sidebarHeader);

    // 创建内容区域
    const content = document.createElement('div');
    content.className = 'annotation-sidebar-content';
    content.style.cssText = [
      'flex: 1',
      'overflow-y: auto',
      'padding: 12px',
      'box-sizing: border-box'
    ].join(';');
    sidebar.appendChild(content);
    this.#sidebarContent = content;

    this.#logger.debug('Sidebar created');
  }

  /**
   * 创建Header部分（包含工具栏和关闭按钮）
   * @returns {HTMLElement}
   * @private
   */
  #createHeader() {
    const header = document.createElement('div');
    header.className = 'annotation-sidebar-header';
    header.style.cssText = [
      'padding: 12px',
      'border-bottom: 1px solid #eee',
      'background: #fafafa',
      'box-sizing: border-box'
    ].join(';');

    // 标题行
    const titleRow = document.createElement('div');
    titleRow.style.cssText = [
      'display: flex',
      'align-items: center',
      'justify-content: space-between',
      'margin-bottom: 12px'
    ].join(';');

    const title = document.createElement('div');
    title.textContent = '标注';
    title.style.cssText = 'font-weight: 600; color: #333; font-size: 16px;';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.title = '关闭标注';
    closeBtn.className = 'annotation-close-btn';
    closeBtn.style.cssText = [
      'border: none',
      'background: transparent',
      'font-size: 20px',
      'cursor: pointer',
      'line-height: 1',
      'color: #666',
      'padding: 0',
      'width: 24px',
      'height: 24px'
    ].join(';');
    closeBtn.addEventListener('click', () => this.hide());

    titleRow.appendChild(title);
    titleRow.appendChild(closeBtn);

    // 工具栏
    const toolbar = this.#createToolbar();

    header.appendChild(titleRow);
    header.appendChild(toolbar);

    return header;
  }

  /**
   * 创建工具栏
   * @returns {HTMLElement}
   * @private
   */
  #createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'annotation-toolbar';
    toolbar.style.cssText = [
      'display: flex',
      'gap: 8px',
      'align-items: center'
    ].join(';');

    // 工具按钮配置
    const tools = [
      { id: 'screenshot', icon: '📷', label: '截图', title: '截图标注' },
      { id: 'text-highlight', icon: '✏️', label: '选字', title: '选字高亮' },
      { id: 'comment', icon: '📝', label: '批注', title: '批注' }
    ];

    tools.forEach(tool => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `annotation-tool-btn annotation-tool-${tool.id}`;
      btn.dataset.tool = tool.id;
      btn.title = tool.title;
      btn.style.cssText = [
        'display: flex',
        'flex-direction: column',
        'align-items: center',
        'gap: 4px',
        'padding: 8px 12px',
        'border: 1px solid #ddd',
        'background: #fff',
        'border-radius: 4px',
        'cursor: pointer',
        'transition: all 0.2s',
        'flex: 1',
        'font-size: 12px',
        'color: #666'
      ].join(';');

      const iconSpan = document.createElement('span');
      iconSpan.textContent = tool.icon;
      iconSpan.style.fontSize = '20px';

      const labelSpan = document.createElement('span');
      labelSpan.textContent = tool.label;

      btn.appendChild(iconSpan);
      btn.appendChild(labelSpan);

      btn.addEventListener('click', () => this.#handleToolClick(tool.id));

      // 悬停效果
      btn.addEventListener('mouseenter', () => {
        if (this.#activeTool !== tool.id) {
          btn.style.background = '#f5f5f5';
          btn.style.borderColor = '#bbb';
        }
      });
      btn.addEventListener('mouseleave', () => {
        if (this.#activeTool !== tool.id) {
          btn.style.background = '#fff';
          btn.style.borderColor = '#ddd';
        }
      });

      toolbar.appendChild(btn);
    });

    return toolbar;
  }

  /**
   * 处理工具按钮点击
   * @param {string} toolId - 工具ID
   * @private
   */
  #handleToolClick(toolId) {
    this.#logger.debug(`Tool clicked: ${toolId}`);

    // 切换工具状态
    if (this.#activeTool === toolId) {
      // 停用当前工具
      this.#activeTool = null;
      this.#updateToolbarState();
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.DEACTIVATE, {});
    } else {
      // 激活新工具
      this.#activeTool = toolId;
      this.#updateToolbarState();
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.ACTIVATE, { tool: toolId });
    }
  }

  /**
   * 更新工具栏状态（高亮当前激活的工具）
   * @private
   */
  #updateToolbarState() {
    const buttons = this.#sidebar.querySelectorAll('.annotation-tool-btn');
    buttons.forEach(btn => {
      const toolId = btn.dataset.tool;
      if (toolId === this.#activeTool) {
        btn.style.background = '#e3f2fd';
        btn.style.borderColor = '#2196f3';
        btn.style.color = '#1976d2';
      } else {
        btn.style.background = '#fff';
        btn.style.borderColor = '#ddd';
        btn.style.color = '#666';
      }
    });
  }

  /**
   * 设置事件监听
   * @private
   */
  #setupEventListeners() {
    // 监听侧边栏切换
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.TOGGLE,
      () => this.toggle(),
      { subscriberId: 'AnnotationSidebarUI' }
    ));

    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.OPEN,
      () => this.show(),
      { subscriberId: 'AnnotationSidebarUI' }
    ));

    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.CLOSE,
      () => this.hide(),
      { subscriberId: 'AnnotationSidebarUI' }
    ));

    // 监听标注CRUD事件
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.CREATED,
      (data) => this.addAnnotationCard(data.annotation),
      { subscriberId: 'AnnotationSidebarUI' }
    ));

    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.UPDATED,
      (data) => this.updateAnnotationCard(data.annotation),
      { subscriberId: 'AnnotationSidebarUI' }
    ));

    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.DELETED,
      (data) => this.removeAnnotationCard(data.id),
      { subscriberId: 'AnnotationSidebarUI' }
    ));

    // 监听标注加载完成
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED,
      (data) => this.render(data.annotations || []),
      { subscriberId: 'AnnotationSidebarUI' }
    ));

    // 监听工具停用（如按ESC键）
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.TOOL.DEACTIVATED,
      () => {
        this.#activeTool = null;
        this.#updateToolbarState();
      },
      { subscriberId: 'AnnotationSidebarUI' }
    ));
  }

  /**
   * 显示侧边栏
   */
  show() {
    if (!this.#sidebar) {
      this.#createSidebar();
    }
    this.#sidebar.style.display = 'flex';
    this.#logger.info('Annotation sidebar shown');
    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.OPENED, {});
  }

  /**
   * 隐藏侧边栏
   */
  hide() {
    if (this.#sidebar) {
      this.#sidebar.style.display = 'none';
      // 停用当前工具
      if (this.#activeTool) {
        this.#activeTool = null;
        this.#updateToolbarState();
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.DEACTIVATE, {});
      }
    }
    this.#logger.info('Annotation sidebar hidden');
    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.CLOSED, {});
  }

  /**
   * 切换侧边栏显示
   */
  toggle() {
    if (!this.#sidebar || this.#sidebar.style.display === 'none') {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * 渲染标注列表
   * @param {Array<Annotation>} annotations - 标注数组
   */
  render(annotations) {
    this.#annotations = annotations || [];
    this.#logger.debug(`Rendering ${this.#annotations.length} annotations`);

    if (!this.#sidebarContent) {
      this.#logger.warn('Sidebar content not found');
      return;
    }

    // 清空现有内容
    this.#sidebarContent.innerHTML = '';
    this.#annotationCards.clear();

    if (this.#annotations.length === 0) {
      this.#renderEmpty();
      return;
    }

    // 按创建时间倒序排列（最新的在上）
    const sortedAnnotations = [...this.#annotations].sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    // 渲染每个标注卡片
    sortedAnnotations.forEach(annotation => {
      const card = this.#createAnnotationCard(annotation);
      this.#sidebarContent.appendChild(card);
      this.#annotationCards.set(annotation.id, card);
    });
  }

  /**
   * 渲染空状态
   * @private
   */
  #renderEmpty() {
    this.#sidebarContent.innerHTML = '';

    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'annotation-empty';
    emptyDiv.style.cssText = [
      'text-align: center',
      'padding: 40px 20px',
      'color: #999',
      'font-size: 14px'
    ].join(';');

    const icon = document.createElement('div');
    icon.textContent = '📝';
    icon.style.cssText = 'font-size: 48px; margin-bottom: 16px;';

    const message = document.createElement('div');
    message.textContent = '暂无标注';

    const hint = document.createElement('div');
    hint.textContent = '点击上方工具按钮开始标注';
    hint.style.cssText = 'margin-top: 8px; font-size: 12px; color: #bbb;';

    emptyDiv.appendChild(icon);
    emptyDiv.appendChild(message);
    emptyDiv.appendChild(hint);

    this.#sidebarContent.appendChild(emptyDiv);
  }

  /**
   * 创建标注卡片
   * @param {Annotation} annotation - 标注对象
   * @returns {HTMLElement}
   * @private
   */
  #createAnnotationCard(annotation) {
    const card = document.createElement('div');
    card.className = 'annotation-card';
    card.dataset.annotationId = annotation.id;
    card.style.cssText = [
      'border: 1px solid #e0e0e0',
      'border-radius: 8px',
      'padding: 12px',
      'margin-bottom: 12px',
      'background: #fff',
      'transition: all 0.2s',
      'cursor: pointer'
    ].join(';');

    // 悬停效果
    card.addEventListener('mouseenter', () => {
      card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      card.style.borderColor = '#bbb';
    });
    card.addEventListener('mouseleave', () => {
      card.style.boxShadow = 'none';
      card.style.borderColor = '#e0e0e0';
    });

    // 卡片头部（类型图标 + 页码）
    const header = document.createElement('div');
    header.style.cssText = [
      'display: flex',
      'align-items: center',
      'justify-content: space-between',
      'margin-bottom: 8px'
    ].join(';');

    const typeInfo = document.createElement('div');
    typeInfo.style.cssText = 'display: flex; align-items: center; gap: 6px;';

    const typeIcon = document.createElement('span');
    typeIcon.textContent = annotation.getTypeIcon();
    typeIcon.style.fontSize = '18px';

    const pageInfo = document.createElement('span');
    pageInfo.textContent = `P.${annotation.pageNumber}`;
    pageInfo.style.cssText = 'font-size: 12px; color: #666; font-weight: 500;';

    typeInfo.appendChild(typeIcon);
    typeInfo.appendChild(pageInfo);

    // 跳转按钮
    const jumpBtn = document.createElement('button');
    jumpBtn.type = 'button';
    jumpBtn.textContent = '→';
    jumpBtn.title = '跳转到标注位置';
    jumpBtn.className = 'annotation-jump-btn';
    jumpBtn.style.cssText = [
      'border: 1px solid #ddd',
      'background: #fff',
      'border-radius: 4px',
      'padding: 4px 8px',
      'cursor: pointer',
      'font-size: 14px',
      'color: #666'
    ].join(';');
    jumpBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#handleJumpClick(annotation.id);
    });

    header.appendChild(typeInfo);
    header.appendChild(jumpBtn);

    // 卡片内容
    const content = document.createElement('div');
    content.className = 'annotation-card-content';
    content.style.cssText = [
      'font-size: 14px',
      'color: #333',
      'line-height: 1.5',
      'margin-bottom: 8px',
      'word-wrap: break-word'
    ].join(';');

    // 根据类型显示不同的内容
    if (annotation.type === AnnotationType.SCREENSHOT) {
      // 截图：显示缩略图和描述
      if (annotation.data.imageData) {
        const img = document.createElement('img');
        img.src = annotation.data.imageData;
        img.alt = '截图';
        img.style.cssText = [
          'width: 100%',
          'height: auto',
          'border-radius: 4px',
          'margin-bottom: 8px'
        ].join(';');
        content.appendChild(img);
      }
      if (annotation.data.description) {
        const desc = document.createElement('div');
        desc.textContent = annotation.data.description;
        desc.style.color = '#666';
        content.appendChild(desc);
      }
    } else if (annotation.type === AnnotationType.TEXT_HIGHLIGHT) {
      // 选字：显示选中的文本和笔记
      const text = document.createElement('div');
      text.textContent = `"${annotation.data.selectedText}"`;
      text.style.cssText = [
        `background: ${annotation.data.highlightColor}33`,
        `border-left: 3px solid ${annotation.data.highlightColor}`,
        'padding: 6px 8px',
        'border-radius: 4px',
        'font-style: italic'
      ].join(';');
      content.appendChild(text);

      if (annotation.data.note) {
        const note = document.createElement('div');
        note.textContent = annotation.data.note;
        note.style.cssText = 'margin-top: 6px; color: #666; font-size: 13px;';
        content.appendChild(note);
      }
    } else if (annotation.type === AnnotationType.COMMENT) {
      // 批注：显示内容
      const text = document.createElement('div');
      text.textContent = annotation.data.content;
      content.appendChild(text);
    }

    // 卡片底部（时间 + 评论数）
    const footer = document.createElement('div');
    footer.style.cssText = [
      'display: flex',
      'align-items: center',
      'justify-content: space-between',
      'font-size: 12px',
      'color: #999',
      'padding-top: 8px',
      'border-top: 1px solid #f0f0f0'
    ].join(';');

    const time = document.createElement('span');
    time.textContent = annotation.getFormattedDate();

    const commentInfo = document.createElement('span');
    const commentCount = annotation.getCommentCount();
    commentInfo.textContent = commentCount > 0 ? `💬 ${commentCount}条评论` : '💬 添加评论';
    commentInfo.style.cssText = 'cursor: pointer; color: #666;';
    commentInfo.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#handleCommentClick(annotation.id);
    });

    footer.appendChild(time);
    footer.appendChild(commentInfo);

    // 组装卡片
    card.appendChild(header);
    card.appendChild(content);
    card.appendChild(footer);

    // 点击卡片跳转
    card.addEventListener('click', () => {
      this.#handleJumpClick(annotation.id);
    });

    return card;
  }

  /**
   * 添加标注卡片
   * @param {Annotation} annotation - 标注对象
   */
  addAnnotationCard(annotation) {
    this.#logger.debug(`Adding annotation card: ${annotation.id}`);

    // 如果当前是空状态，先清空
    const empty = this.#sidebarContent.querySelector('.annotation-empty');
    if (empty) {
      this.#sidebarContent.innerHTML = '';
    }

    // 创建新卡片并插入到开头（最新的在上）
    const card = this.#createAnnotationCard(annotation);
    this.#sidebarContent.insertBefore(card, this.#sidebarContent.firstChild);
    this.#annotationCards.set(annotation.id, card);

    // 更新内部数组
    this.#annotations.unshift(annotation);
  }

  /**
   * 更新标注卡片
   * @param {Annotation} annotation - 标注对象
   */
  updateAnnotationCard(annotation) {
    this.#logger.debug(`Updating annotation card: ${annotation.id}`);

    const oldCard = this.#annotationCards.get(annotation.id);
    if (!oldCard) {
      this.#logger.warn(`Card not found: ${annotation.id}`);
      return;
    }

    // 创建新卡片并替换
    const newCard = this.#createAnnotationCard(annotation);
    oldCard.replaceWith(newCard);
    this.#annotationCards.set(annotation.id, newCard);

    // 更新内部数组
    const index = this.#annotations.findIndex(a => a.id === annotation.id);
    if (index !== -1) {
      this.#annotations[index] = annotation;
    }
  }

  /**
   * 移除标注卡片
   * @param {string} annotationId - 标注ID
   */
  removeAnnotationCard(annotationId) {
    this.#logger.debug(`Removing annotation card: ${annotationId}`);

    const card = this.#annotationCards.get(annotationId);
    if (card) {
      card.remove();
      this.#annotationCards.delete(annotationId);
    }

    // 更新内部数组
    this.#annotations = this.#annotations.filter(a => a.id !== annotationId);

    // 如果没有标注了，显示空状态
    if (this.#annotations.length === 0) {
      this.#renderEmpty();
    }
  }

  /**
   * 处理跳转按钮点击
   * @param {string} annotationId - 标注ID
   * @private
   */
  #handleJumpClick(annotationId) {
    this.#logger.debug(`Jump to annotation: ${annotationId}`);
    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.JUMP_TO, { id: annotationId });
  }

  /**
   * 处理评论按钮点击
   * @param {string} annotationId - 标注ID
   * @private
   */
  #handleCommentClick(annotationId) {
    this.#logger.debug(`Comment on annotation: ${annotationId}`);
    // 这里可以展开评论输入区域或打开评论对话框
    // 暂时只发出事件
    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SELECT, { id: annotationId });
  }

  /**
   * 销毁侧边栏
   */
  destroy() {
    // 取消所有事件订阅
    this.#unsubs.forEach(unsub => unsub());
    this.#unsubs = [];

    // 移除DOM
    if (this.#sidebar) {
      this.#sidebar.remove();
      this.#sidebar = null;
    }

    this.#logger.info('Annotation sidebar destroyed');
  }
}

export default AnnotationSidebarUI;
