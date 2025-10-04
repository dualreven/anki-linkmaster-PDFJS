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
 * @description 管理标注侧边栏的显示和交互（仅负责内容，不负责容器）
 */
export class AnnotationSidebarUI {
  /** @type {EventBus} */
  #eventBus;
  /** @type {Logger} */
  #logger;
  /** @type {HTMLElement} */
  #container;
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
   */
  constructor(eventBus, options = {}) {
    this.#eventBus = eventBus;
    this.#logger = getLogger('AnnotationSidebarUI');
    this.#container = null;
  }

  /**
   * 初始化侧边栏（仅创建内容元素）
   */
  initialize() {
    this.#logger.info('Initializing annotation sidebar UI (content only)');

    // 创建内容容器
    this.#createContent();

    // 监听事件
    this.#setupEventListeners();
  }

  /**
   * 创建内容容器（包含header和content，但不包含外部容器）
   * @private
   */
  #createContent() {
    if (this.#container) {
      this.#logger.debug('Content already exists');
      return;
    }

    // 主容器（flex布局）
    const container = document.createElement('div');
    container.className = 'annotation-sidebar-container';
    container.style.cssText = [
      'display: flex',
      'flex-direction: column',
      'height: 100%',
      'width: 100%',
      'overflow: hidden',
      'background: #ffffff'
    ].join(';');

    // 创建Header（包含工具栏）
    this.#sidebarHeader = this.#createHeader();
    container.appendChild(this.#sidebarHeader);

    // 创建内容区域
    const content = document.createElement('div');
    content.className = 'annotation-sidebar-content';
    content.style.cssText = [
      'flex: 1',
      'overflow-y: auto',
      'padding: 12px',
      'box-sizing: border-box'
    ].join(';');
    container.appendChild(content);
    this.#sidebarContent = content;

    this.#container = container;
    this.#logger.debug('Content created');
  }

  /**
   * 获取内容元素（供SidebarManager使用）
   * @returns {HTMLElement} 内容元素
   */
  getContentElement() {
    if (!this.#container) {
      this.#createContent();
    }
    return this.#container;
  }

  /**
   * 创建Header部分（包含工具栏，不包含关闭按钮）
   * @returns {HTMLElement}
   * @private
   */
  #createHeader() {
    const header = document.createElement('div');
    header.className = 'annotation-sidebar-header';
    header.style.cssText = [
      'padding: 8px',  // 第二期：从12px减少到8px，使工具栏更紧凑
      'border-bottom: 1px solid #eee',
      'background: #fafafa',
      'box-sizing: border-box',
      'flex-shrink: 0'
    ].join(';');

    // 工具栏
    const toolbar = this.#createToolbar();
    header.appendChild(toolbar);

    return header;
  }

  /**
   * 创建工具栏（第二期：优化按钮尺寸）
   * @returns {HTMLElement}
   * @private
   */
  #createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'annotation-toolbar';
    toolbar.style.cssText = [
      'display: flex',
      'gap: 4px',
      'align-items: center'
    ].join(';');

    // 工具按钮配置（第二期：新增筛选、排序和设置按钮）
    const tools = [
      { id: 'screenshot', icon: '📷', title: '截图标注' },
      { id: 'text-highlight', icon: '✏️', title: '选字高亮' },
      { id: 'comment', icon: '📝', title: '批注' },
      { id: 'filter', icon: '🔍', title: '筛选标注' },
      { id: 'sort', icon: '↕️', title: '排序标注' },
      { id: 'settings', icon: '⚙️', title: '设置' }
    ];

    tools.forEach(tool => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `annotation-tool-btn annotation-tool-${tool.id}`;
      btn.dataset.tool = tool.id;
      btn.title = tool.title; // Tooltip提示

      // 标记是否为标注工具（用于状态更新）
      const isAnnotationTool = !['filter', 'sort', 'settings'].includes(tool.id);
      if (isAnnotationTool) {
        btn.dataset.isTool = 'true';
      }

      btn.style.cssText = [
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'width: 28px',
        'height: 28px',
        'padding: 0',
        'border: 1px solid #ddd',
        'background: #fff',
        'border-radius: 4px',
        'cursor: pointer',
        'transition: all 0.2s',
        'font-size: 16px',
        'color: #666'
      ].join(';');

      // 仅图标，不显示文字
      const iconSpan = document.createElement('span');
      iconSpan.textContent = tool.icon;
      iconSpan.style.lineHeight = '1';

      btn.appendChild(iconSpan);

      // 根据按钮类型绑定不同的处理器
      if (tool.id === 'filter' || tool.id === 'sort' || tool.id === 'settings') {
        // 筛选、排序和设置按钮的点击处理（第二期功能）
        btn.addEventListener('click', () => this.#handleUtilityButtonClick(tool.id));
      } else {
        // 标注工具按钮的点击处理
        btn.addEventListener('click', () => this.#handleToolClick(tool.id));
      }

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
    this.#logger.debug(`Tool clicked: ${toolId}, current active: ${this.#activeTool}`);

    // 切换工具状态
    if (this.#activeTool === toolId) {
      // 点击当前激活的工具 - 停用它
      const oldTool = this.#activeTool;
      this.#activeTool = null;
      this.#updateToolbarState();
      this.#logger.info(`Tool deactivated: ${oldTool}`);
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.DEACTIVATE, { tool: oldTool });
    } else {
      // 切换到新工具
      const oldTool = this.#activeTool;

      // 先停用旧工具（如果有）
      if (oldTool) {
        this.#logger.debug(`Switching from ${oldTool} to ${toolId}`);
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.DEACTIVATE, { tool: oldTool });
      }

      // 激活新工具
      this.#activeTool = toolId;
      this.#updateToolbarState();
      this.#logger.info(`Tool activated: ${toolId}`);
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.ACTIVATE, { tool: toolId });

      // 显示模式切换提示
      this.#showModeToast(toolId);
    }
  }

  /**
   * 显示模式切换提示（第二期：新增）
   * @param {string} toolId - 工具ID
   * @private
   */
  #showModeToast(toolId) {
    const modeNames = {
      'screenshot': '📷 已启动截图模式',
      'text-highlight': '✏️ 已启动选字模式',
      'comment': '📝 已启动批注模式'
    };

    const message = modeNames[toolId] || `已启动${toolId}模式`;
    this.#showToast(message, 'info');
  }

  /**
   * 处理辅助按钮点击（筛选、排序、设置等）
   * @param {string} buttonId - 按钮ID
   * @private
   */
  #handleUtilityButtonClick(buttonId) {
    this.#logger.debug(`Utility button clicked: ${buttonId}`);

    // 根据按钮类型执行不同操作
    switch (buttonId) {
      case 'filter':
        // 切换筛选面板显示状态（第二期功能）
        this.#eventBus.emit('pdf-viewer:annotation:filter:toggle', {});
        this.#showToast('筛选功能开发中...', 'info');
        break;
      case 'sort':
        // 切换排序面板显示状态（第二期功能）
        this.#eventBus.emit('pdf-viewer:annotation:sort:toggle', {});
        this.#showToast('排序功能开发中...', 'info');
        break;
      case 'settings':
        // 打开设置面板（预留功能）
        this.#eventBus.emit('pdf-viewer:annotation:settings:open', {});
        this.#showToast('设置功能开发中...', 'info');
        break;
      default:
        this.#logger.warn(`Unknown utility button: ${buttonId}`);
    }
  }

  /**
   * 更新工具栏状态（高亮当前激活的工具）
   * @private
   */
  #updateToolbarState() {
    if (!this.#container) return;

    // 只更新标注工具按钮（不包括筛选、设置等辅助按钮）
    const buttons = this.#container.querySelectorAll('.annotation-tool-btn[data-is-tool="true"]');
    buttons.forEach(btn => {
      const toolId = btn.dataset.tool;
      if (toolId === this.#activeTool) {
        // 激活状态：蓝色高亮
        btn.style.background = '#e3f2fd';
        btn.style.borderColor = '#2196f3';
        btn.style.color = '#1976d2';
        btn.style.fontWeight = '500';
      } else {
        // 未激活状态：默认样式
        btn.style.background = '#fff';
        btn.style.borderColor = '#ddd';
        btn.style.color = '#666';
        btn.style.fontWeight = 'normal';
      }
    });

    this.#logger.debug(`Toolbar state updated, active tool: ${this.#activeTool || 'none'}`);
  }

  /**
   * 设置事件监听
   * @private
   */
  #setupEventListeners() {
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

    // 监听工具停用（如按ESC键或外部触发）
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.TOOL.DEACTIVATED,
      (data) => {
        // 只有在事件数据中的工具与当前激活的工具匹配时，或者没有指定工具时才清空
        // 这样可以防止工具切换时误清空新激活的工具
        const deactivatedTool = data?.tool;

        if (!deactivatedTool) {
          // 没有指定工具，清空所有（如按ESC键全局停用）
          this.#logger.debug('All tools deactivated (no specific tool specified)');
          this.#activeTool = null;
          this.#updateToolbarState();
        } else if (deactivatedTool === this.#activeTool) {
          // 指定的工具与当前激活的工具匹配，清空
          this.#logger.debug(`Tool deactivated: ${deactivatedTool} (matches active tool)`);
          this.#activeTool = null;
          this.#updateToolbarState();
        } else {
          // 停用的工具不是当前激活的工具，忽略
          this.#logger.debug(`Tool deactivated: ${deactivatedTool}, but active tool is ${this.#activeTool}, ignoring`);
        }
      },
      { subscriberId: 'AnnotationSidebarUI' }
    ));

    // 监听标注选择事件（点击标记时）
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.SELECT,
      (data) => this.highlightAndScrollToCard(data.id),
      { subscriberId: 'AnnotationSidebarUI' }
    ));

    // 监听侧边栏关闭事件（第二期：关闭时停用所有工具）
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.CLOSED_COMPLETED,
      (data) => this.#handleSidebarClosed(data),
      { subscriberId: 'AnnotationSidebarUI' }
    ));
  }

  /**
   * 处理侧边栏关闭事件（第二期：新增）
   * @param {Object} data - 事件数据
   * @param {string} data.sidebarId - 关闭的侧边栏ID
   * @private
   */
  #handleSidebarClosed(data) {
    // 只处理annotation侧边栏关闭事件
    if (data?.sidebarId !== 'annotation') {
      return;
    }

    this.#logger.info('Annotation sidebar closed, deactivating all tools');

    // 如果有激活的工具，停用它
    if (this.#activeTool) {
      const deactivatedTool = this.#activeTool;
      this.#activeTool = null;
      this.#updateToolbarState();

      // 发出工具停用事件
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.DEACTIVATE, { tool: deactivatedTool });
      this.#logger.info(`Tool deactivated due to sidebar close: ${deactivatedTool}`);

      // 显示提示
      const modeNames = {
        'screenshot': '截图模式',
        'text-highlight': '选字模式',
        'comment': '批注模式'
      };
      const modeName = modeNames[deactivatedTool] || '标注模式';
      this.#showToast(`${modeName}已关闭`, 'info');
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

    // 卡片底部（拷贝ID + 时间 + 评论）
    const footer = document.createElement('div');
    footer.style.cssText = [
      'display: flex',
      'align-items: center',
      'justify-content: space-between',
      'font-size: 12px',
      'color: #999',
      'padding-top: 8px',
      'border-top: 1px solid #f0f0f0',
      'gap: 8px'
    ].join(';');

    // 左侧：拷贝ID按钮
    const copyIdBtn = document.createElement('button');
    copyIdBtn.type = 'button';
    copyIdBtn.textContent = '拷贝ID';
    copyIdBtn.title = `复制ID: ${annotation.id}`;
    copyIdBtn.className = 'annotation-copy-id-btn';
    copyIdBtn.style.cssText = [
      'border: 1px solid #ddd',
      'background: #fff',
      'border-radius: 4px',
      'cursor: pointer',
      'font-size: 12px',
      'padding: 2px 8px',
      'color: #666',
      'transition: all 0.2s'
    ].join(';');
    copyIdBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.#handleCopyIdClick(annotation.id);
    });
    copyIdBtn.addEventListener('mouseenter', () => {
      copyIdBtn.style.background = '#e3f2fd';
      copyIdBtn.style.borderColor = '#2196f3';
      copyIdBtn.style.color = '#2196f3';
    });
    copyIdBtn.addEventListener('mouseleave', () => {
      copyIdBtn.style.background = '#fff';
      copyIdBtn.style.borderColor = '#ddd';
      copyIdBtn.style.color = '#666';
    });

    // 右侧：时间 + 评论按钮
    const rightSection = document.createElement('div');
    rightSection.style.cssText = [
      'display: flex',
      'align-items: center',
      'gap: 8px',
      'margin-left: auto'
    ].join(';');

    const time = document.createElement('span');
    time.textContent = annotation.getFormattedDate();
    time.style.color = '#999';

    const commentBtn = document.createElement('button');
    commentBtn.type = 'button';
    const commentCount = annotation.getCommentCount();
    commentBtn.textContent = commentCount > 0 ? `评论(${commentCount})` : '评论';
    commentBtn.title = commentCount > 0 ? `${commentCount}条评论` : '添加评论';
    commentBtn.className = 'annotation-comment-btn';
    commentBtn.style.cssText = [
      'border: 1px solid #ddd',
      'background: #fff',
      'border-radius: 4px',
      'cursor: pointer',
      'font-size: 12px',
      'padding: 2px 8px',
      'color: #666',
      'transition: all 0.2s'
    ].join(';');
    commentBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#handleCommentClick(annotation.id);
    });
    commentBtn.addEventListener('mouseenter', () => {
      commentBtn.style.background = '#e3f2fd';
      commentBtn.style.borderColor = '#2196f3';
      commentBtn.style.color = '#2196f3';
    });
    commentBtn.addEventListener('mouseleave', () => {
      commentBtn.style.background = '#fff';
      commentBtn.style.borderColor = '#ddd';
      commentBtn.style.color = '#666';
    });

    rightSection.appendChild(time);
    rightSection.appendChild(commentBtn);

    footer.appendChild(copyIdBtn);
    footer.appendChild(rightSection);

    // 组装卡片（第二期：ID移至左下角，移除整体点击事件）
    card.appendChild(header);
    card.appendChild(content);
    card.appendChild(footer);

    // 注意：移除了整个卡片的点击事件，改为使用右上角的跳转按钮→

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
   * 处理复制ID按钮点击（第二期：新增）
   * @param {string} annotationId - 标注ID
   * @private
   */
  async #handleCopyIdClick(annotationId) {
    this.#logger.debug(`Copy annotation ID: ${annotationId}`);

    try {
      // 使用Clipboard API复制文本
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(annotationId);
        this.#showCopyToast('✓ ID已复制');
      } else {
        // 降级方案：使用传统方法
        const textarea = document.createElement('textarea');
        textarea.value = annotationId;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        this.#showCopyToast('✓ ID已复制');
      }

      // 发出ID复制事件
      this.#eventBus.emit('pdf-viewer:annotation:id:copied', { id: annotationId });
    } catch (error) {
      this.#logger.error('Failed to copy ID:', error);
      this.#showCopyToast('✗ 复制失败');
    }
  }

  /**
   * 显示Toast提示（第二期：通用toast方法）
   * @param {string} message - 提示消息
   * @param {string} type - 提示类型 (success|info|warning|error)
   * @private
   */
  #showToast(message, type = 'success') {
    // 根据类型选择背景色
    const typeStyles = {
      success: 'background: rgba(76, 175, 80, 0.9);', // 绿色
      info: 'background: rgba(33, 150, 243, 0.9);',    // 蓝色
      warning: 'background: rgba(255, 152, 0, 0.9);',  // 橙色
      error: 'background: rgba(244, 67, 54, 0.9);'     // 红色
    };

    // 创建Toast提示
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = [
      'position: fixed',
      'top: 20px',
      'left: 50%',
      'transform: translateX(-50%)',
      typeStyles[type] || typeStyles.success,
      'color: #fff',
      'padding: 10px 20px',
      'border-radius: 4px',
      'font-size: 14px',
      'font-weight: 500',
      'box-shadow: 0 2px 8px rgba(0,0,0,0.2)',
      'z-index: 10000',
      'animation: fadeInOut 2.5s ease-in-out'
    ].join(';');

    // 添加动画样式
    if (!document.querySelector('#annotation-toast-animation')) {
      const style = document.createElement('style');
      style.id = 'annotation-toast-animation';
      style.textContent = `
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          10% { opacity: 1; transform: translateX(-50%) translateY(0); }
          85% { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // 2.5秒后移除
    setTimeout(() => {
      toast.remove();
    }, 2500);
  }

  /**
   * 显示复制提示（第二期：调用通用toast方法）
   * @param {string} message - 提示消息
   * @private
   */
  #showCopyToast(message) {
    const isSuccess = message.includes('✓');
    this.#showToast(message, isSuccess ? 'success' : 'error');
  }

  /**
   * 高亮并滚动到指定的标注卡片
   * @param {string} annotationId - 标注ID
   */
  highlightAndScrollToCard(annotationId) {
    this.#logger.debug(`Highlighting and scrolling to card: ${annotationId}`);

    // 获取目标卡片
    const targetCard = this.#annotationCards.get(annotationId);
    if (!targetCard) {
      this.#logger.warn(`Card not found: ${annotationId}`);
      return;
    }

    // 移除所有卡片的高亮状态
    this.#annotationCards.forEach((card) => {
      card.style.background = '#fff';
      card.style.borderColor = '#e0e0e0';
    });

    // 高亮目标卡片
    targetCard.style.background = '#fff3cd';
    targetCard.style.borderColor = '#ffc107';

    // 滚动到目标卡片
    targetCard.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    // 3秒后恢复正常样式
    setTimeout(() => {
      targetCard.style.background = '#fff';
      targetCard.style.borderColor = '#e0e0e0';
    }, 3000);

    this.#logger.info(`Card highlighted and scrolled: ${annotationId}`);
  }

  /**
   * 销毁侧边栏
   */
  destroy() {
    // 取消所有事件订阅
    this.#unsubs.forEach(unsub => unsub());
    this.#unsubs = [];

    // 移除DOM
    if (this.#container) {
      this.#container.remove();
      this.#container = null;
    }

    this.#logger.info('Annotation sidebar destroyed');
  }
}

export default AnnotationSidebarUI;
