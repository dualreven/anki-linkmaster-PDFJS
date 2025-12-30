/**
 * 标注侧边栏UI
 * @file 标注侧边栏UI组件，显示和管理所有标注
 * @module AnnotationSidebarUI
 */

import { getLogger } from '../../../../common/utils/logger.js';
import { PDF_VIEWER_EVENTS } from '../../../../common/event/pdf-viewer-constants.js';
import { showSuccess, showError, showInfo } from '../../../../common/utils/notification.js';
import { AnnotationType } from '../models/index.js';
import { copyTextUsingHiddenTextarea } from '../../../../common/utils/copy-utils.js';
import { createSubscriptionBag } from '../../../../common/ws/ws-subscription-bag.js';
import { showAnnotationCommentDialog } from './annotation-sidebar-ui/comment-dialog.js';
import { createAnnotationCardElement } from './annotation-sidebar-ui/annotation-card.js';

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
  /** @type {{ add:(fn:Function)=>void, clear:()=>void, size:()=>number }|null} */
  #subscriptions = null;
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
    this.#subscriptions = createSubscriptionBag({ loggerName: 'AnnotationSidebarUI' });
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

    // 统一为所有标注卡片绑定跳转按钮的委托点击（避免各工具各自实现导致不一致）
    try {
      this.#setupCardClickDelegation();
      this.#logger.info('Card click delegation for jump initialized');
    } catch (e) {
      this.#logger.warn('Failed to setup card click delegation', e);
    }
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
      'background: #ffffff',
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
      'box-sizing: border-box',
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
   * 统一为侧边栏中的卡片绑定跳转点击（事件委托）
   * @private
   */
  #setupCardClickDelegation() {
    const root = this.#sidebarContent || this.#container;
    if (!root) {
      return;
    }

    root.addEventListener(
      'click',
      (evt) => {
        try {
          const target = /** @type {HTMLElement} */ (evt.target);
          const jumpBtn = target?.closest ? target.closest('.jump-btn') : null;
          if (!jumpBtn) {
            return;
          }

          const annId = jumpBtn.getAttribute('data-annotation-id') || jumpBtn.dataset.annotationId;
          if (!annId) {
            // 严格模式：不合规立即报错 + toast（统一使用 logger 的 toast）
            this.#logger.error(
              '[AnnotationSidebarUI] 跳转按钮缺少 data-annotation-id',
              { btn: jumpBtn },
              { toast: { type: 'error', ms: 4000 } }
            );
            return;
          }
          this.#handleCardJump(String(annId));
        } catch (e) {
          // 严格模式：异常即报错 + toast（统一使用 logger 的 toast）
          try {
            this.#logger.error('Card jump handler failed', e, {
              toast: { type: 'error', ms: 4000 },
            });
          } catch (e2) {
            void e2;
          }
        }
      },
      { passive: true }
    );
  }

  /**
   * 执行严格的跳转逻辑：仅通过“全局契约事件”发起跳转，不再走 URL 导航兜底
   * @param {string} annotationId
   * @private
   */
  #handleCardJump(annotationId) {
    try {
      const ann = (this.#annotations || []).find((a) => a?.id === annotationId);
      if (!ann) {
        // 严格模式：未找到标注即报错 + toast
        this.#logger.error(`[AnnotationSidebarUI] 未找到标注，无法跳转 id=${annotationId}`, null, {
          toast: { type: 'error', ms: 4000 },
        });
        return;
      }

      // 严格路径：仅通过“全局契约事件”通知协调者处理跳转
      this.#eventBus.emitGlobal(
        PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED,
        { annotation: ann },
        { actorId: 'AnnotationSidebarUI' }
      );

      // 通知各工具跳转成功（用于渲染标记等），尽量兼容已有监听方
      try {
        this.#eventBus.emitGlobal(
          PDF_VIEWER_EVENTS.ANNOTATION?.NAVIGATION?.JUMP_SUCCESS ||
            'annotation:navigation:jump:success',
          { annotation: ann },
          { actorId: 'AnnotationSidebarUI' }
        );
      } catch (e) {
        void e; /* logger-guard */
      }

      // 高亮对应卡片
      try {
        this.highlightAndScrollToCard(ann.id);
      } catch (e) {
        void e; /* logger-guard */
      }

      this.#logger.info(
        `[AnnotationSidebarUI] Jump requested (strict): id=${ann.id} page=${ann.pageNumber}`
      );
    } catch (e) {
      this.#logger.error('Failed to handle card jump (strict)', e, {
        toast: { type: 'error', ms: 4000 },
      });
    }
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
      'padding: 8px', // 第二期：从12px减少到8px，使工具栏更紧凑
      'border-bottom: 1px solid #eee',
      'background: #fafafa',
      'box-sizing: border-box',
      'flex-shrink: 0',
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
    toolbar.style.cssText = ['display: flex', 'gap: 4px', 'align-items: center'].join(';');

    // 工具按钮配置（第二期：新增筛选、排序和设置按钮）
    const tools = [
      { id: 'screenshot', icon: '📷', title: '截图标注' },
      { id: 'text-highlight', icon: '✏️', title: '选字高亮' },
      { id: 'comment', icon: '📝', title: '批注' },
      { id: 'filter', icon: '🔍', title: '筛选标注' },
      { id: 'sort', icon: '↕️', title: '排序标注' },
      { id: 'settings', icon: '⚙️', title: '设置' },
    ];

    tools.forEach((tool) => {
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
        'color: #666',
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
      screenshot: '📷 已启动截图模式',
      'text-highlight': '✏️ 已启动选字模式',
      comment: '📝 已启动批注模式',
    };

    const message = modeNames[toolId] || `已启动${toolId}模式`;
    showInfo(message);
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
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.FILTER_TOGGLE, {});
        showInfo('筛选功能开发中...');
        break;
      case 'sort':
        // 切换排序面板显示状态（第二期功能）
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.SORT_TOGGLE, {});
        showInfo('排序功能开发中...');
        break;
      case 'settings':
        // 打开设置面板（预留功能）
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.SETTINGS_OPEN, {});
        showInfo('设置功能开发中...');
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
    if (!this.#container) {
      return;
    }

    // 只更新标注工具按钮（不包括筛选、设置等辅助按钮）
    const buttons = this.#container.querySelectorAll('.annotation-tool-btn[data-is-tool="true"]');
    buttons.forEach((btn) => {
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
    this.#subscriptions.add(
      this.#eventBus.on(
        PDF_VIEWER_EVENTS.ANNOTATION.CREATED,
        (data) => this.addAnnotationCard(data.annotation),
        { subscriberId: 'AnnotationSidebarUI' }
      )
    );

    this.#subscriptions.add(
      this.#eventBus.on(
        PDF_VIEWER_EVENTS.ANNOTATION.UPDATED,
        (data) => this.updateAnnotationCard(data.annotation),
        { subscriberId: 'AnnotationSidebarUI' }
      )
    );

    this.#subscriptions.add(
      this.#eventBus.on(
        PDF_VIEWER_EVENTS.ANNOTATION.DELETED,
        (data) => this.removeAnnotationCard(data.id),
        { subscriberId: 'AnnotationSidebarUI' }
      )
    );

    // 监听标注加载完成
    this.#subscriptions.add(
      this.#eventBus.on(
        PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED,
        (data) => this.render(data.annotations || []),
        { subscriberId: 'AnnotationSidebarUI' }
      )
    );

    // 监听工具停用（如按ESC键或外部触发）
    this.#subscriptions.add(
      this.#eventBus.on(
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
            this.#logger.debug(
              `Tool deactivated: ${deactivatedTool}, but active tool is ${this.#activeTool}, ignoring`
            );
          }
        },
        { subscriberId: 'AnnotationSidebarUI' }
      )
    );

    // 监听标注选择事件（点击标记时）
    this.#subscriptions.add(
      this.#eventBus.on(
        PDF_VIEWER_EVENTS.ANNOTATION.SELECT,
        (data) => this.highlightAndScrollToCard(data.id),
        { subscriberId: 'AnnotationSidebarUI' }
      )
    );

    // 监听侧边栏关闭事件（第二期：关闭时停用所有工具）
    this.#subscriptions.add(
      this.#eventBus.onGlobal(
        PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.CLOSED_COMPLETED,
        (data) => this.#handleSidebarClosed(data),
        { subscriberId: 'AnnotationSidebarUI' }
      )
    );

    // 监听评论添加事件（第二期：新增）
    this.#subscriptions.add(
      this.#eventBus.on(
        PDF_VIEWER_EVENTS.ANNOTATION.COMMENT.ADDED,
        (data) => this.#handleCommentAdded(data),
        { subscriberId: 'AnnotationSidebarUI' }
      )
    );
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

    // 记录当前激活的工具（在发送停用事件前）

    // 发出工具停用请求事件（ToolRegistry会处理实际停用）
    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.DEACTIVATE, {});
    this.#logger.info('Tool deactivate requested due to sidebar close');

    // 清空本地状态
    this.#activeTool = null;
    this.#updateToolbarState();

    // 业务要求：关闭侧边栏时不再弹出任何 toast 提示（静默处理）
    this.#logger.info('Annotation sidebar closed (silent, no toast)');
  }

  /**
   * 处理评论添加事件（第二期：新增）
   * @param {Object} data - 事件数据
   * @param {string} data.annotationId - 标注ID
   * @param {string} data.content - 评论内容
   * @param {number} data.timestamp - 时间戳
   * @param {boolean} [data.skipUpdate] - 是否跳过更新（本地添加时已更新）
   * @private
   */
  #handleCommentAdded(data) {
    const { annotationId, skipUpdate } = data;

    // 如果是本地添加（已经更新），跳过处理
    if (skipUpdate) {
      this.#logger.debug('Comment already added locally, skipping update');
      return;
    }

    // 找到对应的annotation
    const annotation = this.#annotations.find((a) => a.id === annotationId);
    if (!annotation) {
      this.#logger.warn(`Annotation not found: ${annotationId}`);
      return;
    }

    // 这里可以处理来自外部的评论添加（如从后端同步）
    // 当前版本中，本地添加已在submitComment中处理，这里保留用于扩展
    this.#logger.debug(`External comment added to annotation ${annotationId}`);

    // 更新对应的卡片（刷新评论数量显示）
    this.updateAnnotationCard(annotation);
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
    const sortedAnnotations = [...this.#annotations].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    // 渲染每个标注卡片
    sortedAnnotations.forEach((annotation) => {
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
      'font-size: 14px',
    ].join(';');

    const icon = document.createElement('div');
    icon.textContent = '📝';
    icon.style.cssText = 'font-size: 48px; margin-bottom: 16px;';

    const message = document.createElement('div');
    message.textContent = '暂无标注';

    const hint = document.createElement('div');
    hint.textContent = '🖱️ 点击上方工具按钮开始标注';
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
    return createAnnotationCardElement({
      annotation,
      logger: this.#logger,
      getImageUrl: (imagePath) => this.#getImageUrl(imagePath),
      onJumpClick: (id) => this.#handleJumpClick(id),
      onDeleteClick: (id) => void this.#handleDeleteClick(id),
      onCommentClick: (id) => this.#handleCommentClick(id),
      onCopyIdClick: (id) => this.#handleCopyIdClick(id),
    });
  }

  /**
   * 添加标注卡片
   * @param {Annotation} annotation - 标注对象
   */
  addAnnotationCard(annotation) {
    this.#logger.debug(`Adding annotation card: ${annotation.id}`);

    // 去重：如果已存在相同ID的卡片，直接更新而不是新增
    if (this.#annotationCards.has(annotation.id)) {
      try {
        this.updateAnnotationCard(annotation);
      } catch (e) {
        void e; /* logger-guard */
      }
      return;
    }

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
    const index = this.#annotations.findIndex((a) => a.id === annotation.id);
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
    this.#annotations = this.#annotations.filter((a) => a.id !== annotationId);

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
    this.#logger.debug(`Jump to annotation (strict): ${annotationId}`);
    // 为避免“乐观UI创建后，AnnotationManager尚未入库”导致的跳转失败，这里携带完整对象
    const annotation = this.#annotations.find((a) => a.id === annotationId) || null;
    if (!annotation) {
      this.#logger.error(`[AnnotationSidebarUI] 未找到标注，无法跳转 id=${annotationId}`, null, {
        toast: { type: 'error', ms: 4000 },
      });
      return;
    }
    this.#eventBus.emitGlobal(
      PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED,
      {
        id: annotationId,
        annotation,
      },
      { actorId: 'AnnotationSidebarUI' }
    );
  }

  /**
   * 处理评论按钮点击
   * @param {string} annotationId - 标注ID
   * @private
   */
  async #handleDeleteClick(annotationId) {
    if (!annotationId) {
      return;
    }

    const confirmed = await this.#confirmAsync('确定要删除该标注吗？');
    if (!confirmed) {
      return;
    }

    this.#logger.debug(`Delete annotation requested: ${annotationId}`);
    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DELETE, { id: annotationId });
  }

  /**
   * 简易确认弹窗（替代 window.confirm 以通过 lint）
   * @param {string} message
   * @returns {Promise<boolean>}
   * @private
   */
  #confirmAsync(message) {
    return new Promise((resolve) => {
      try {
        const overlay = document.createElement('div');
        overlay.style.cssText =
          'position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999;';
        const dlg = document.createElement('div');
        dlg.style.cssText =
          'width:360px;background:#fff;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.25);overflow:hidden;';
        const body = document.createElement('div');
        body.style.cssText = 'padding:16px;font-size:14px;';
        body.textContent = message;
        const footer = document.createElement('div');
        footer.style.cssText =
          'display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid #eee;';
        const btnCancel = document.createElement('button');
        btnCancel.textContent = '取消';
        btnCancel.style.cssText =
          'padding:6px 12px;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer;';
        const btnOk = document.createElement('button');
        btnOk.textContent = '删除';
        btnOk.style.cssText =
          'padding:6px 12px;border:1px solid #c62828;background:#c62828;color:#fff;border-radius:4px;cursor:pointer;';
        btnCancel.addEventListener('click', () => {
          try {
            overlay.remove();
          } catch (e) {
            void e; /* logger-guard */
          }
          resolve(false);
        });
        btnOk.addEventListener('click', () => {
          try {
            overlay.remove();
          } catch (e) {
            void e; /* logger-guard */
          }
          resolve(true);
        });
        footer.appendChild(btnCancel);
        footer.appendChild(btnOk);
        dlg.appendChild(body);
        dlg.appendChild(footer);
        overlay.appendChild(dlg);
        document.body.appendChild(overlay);
      } catch (e) {
        void e; /* logger-guard */
        resolve(true); // 最小化退化为直接通过
      }
    });
  }

  #handleCommentClick(annotationId) {
    this.#logger.debug(`Comment on annotation: ${annotationId}`);
    this.#showCommentDialog(annotationId);
  }

  /**
   * 显示评论对话框（第二期：新增，支持历史评论显示）
   * @param {string} annotationId - 标注ID
   * @private
   */
  #showCommentDialog(annotationId) {
    showAnnotationCommentDialog({
      annotationId,
      annotations: this.#annotations,
      eventBus: this.#eventBus,
      logger: this.#logger,
      getImageUrl: (imagePath) => this.#getImageUrl(imagePath),
      updateAnnotationCard: (annotation) => this.updateAnnotationCard(annotation),
    });
  }

  /**
   * 处理复制ID按钮点击（第二期：新增）
   * @param {string} annotationId - 标注ID
   * @private
   */
  async #handleCopyIdClick(annotationId) {
    this.#logger.debug(`Copy annotation ID: ${annotationId}`);

    const success = copyTextUsingHiddenTextarea(String(annotationId ?? ''));

    if (success) {
      showSuccess('✓ ID已复制', 2000);
      // 发出ID复制事件（修正为3段格式）
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.ID_COPY_SUCCESS, {
        id: annotationId,
      });
    } else {
      showError('✗ 复制失败', 3000);
    }
  }

  /**
   * 显示Toast提示（第二期：通用toast方法）
   * @param {string} message - 提示消息
   * @param {string} type - 提示类型 (success|info|warning|error)
   * @private
   */
  // 已移除自定义 toast 方法，改用 frontend/common 下的公共 toast 工具

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
      block: 'center',
    });

    // 3秒后恢复正常样式
    setTimeout(() => {
      targetCard.style.background = '#fff';
      targetCard.style.borderColor = '#e0e0e0';
    }, 3000);

    this.#logger.info(`Card highlighted and scrolled: ${annotationId}`);
  }

  /**
   * 获取图片完整URL（第二期：新增）
   * @param {string} imagePath - 图片相对路径（如'/data/screenshots/abc.png'）
   * @returns {string} 完整HTTP URL
   * @private
   */
  #getImageUrl(imagePath) {
    const port = window.APP_CONFIG?.fileServerPort || 8092;
    return `http://localhost:${port}${imagePath}`;
  }

  /**
   * 销毁侧边栏
   */
  destroy() {
    // 取消所有事件订阅
    if (this.#subscriptions) {
      this.#subscriptions.clear();
      this.#subscriptions = null;
    }

    // 移除DOM
    if (this.#container) {
      this.#container.remove();
      this.#container = null;
    }

    this.#logger.info('Annotation sidebar destroyed');
  }
}

export default AnnotationSidebarUI;
