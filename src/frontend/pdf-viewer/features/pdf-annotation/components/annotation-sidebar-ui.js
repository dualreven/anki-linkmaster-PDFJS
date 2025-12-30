/**
 * 标注侧边栏UI
 * @file 标注侧边栏UI组件，显示和管理所有标注
 * @module AnnotationSidebarUI
 */

import { getLogger } from '../../../../common/utils/logger.js';
import { PDF_VIEWER_EVENTS } from '../../../../common/event/pdf-viewer-constants.js';
import { showSuccess, showError } from '../../../../common/utils/notification.js';
import { copyTextUsingHiddenTextarea } from '../../../../common/utils/copy-utils.js';
import { createSubscriptionBag } from '../../../../common/ws/ws-subscription-bag.js';
import { showAnnotationCommentDialog } from './annotation-sidebar-ui/comment-dialog.js';
import { createAnnotationCardElement } from './annotation-sidebar-ui/annotation-card.js';
import { createAnnotationSidebarToolbarController } from './annotation-sidebar-ui/toolbar-controller.js';
import { confirmDialogAsync } from './annotation-sidebar-ui/confirm-dialog.js';

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
  /** @type {{ createHeaderElement:()=>HTMLElement, updateToolbarState:()=>void }|null} */
  #toolbarController = null;
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
    this.#toolbarController = createAnnotationSidebarToolbarController({
      eventBus: this.#eventBus,
      logger: this.#logger,
      getContainer: () => this.#container,
      getActiveTool: () => this.#activeTool,
      setActiveTool: (next) => { this.#activeTool = next; },
    });
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
    this.#sidebarHeader = this.#toolbarController.createHeaderElement();
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
            this.#toolbarController.updateToolbarState();
          } else if (deactivatedTool === this.#activeTool) {
            // 指定的工具与当前激活的工具匹配，清空
            this.#logger.debug(`Tool deactivated: ${deactivatedTool} (matches active tool)`);
            this.#activeTool = null;
            this.#toolbarController.updateToolbarState();
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
    this.#toolbarController.updateToolbarState();

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

    const confirmed = await confirmDialogAsync({ message: '确定要删除该标注吗？' });
    if (!confirmed) {
      return;
    }

    this.#logger.debug(`Delete annotation requested: ${annotationId}`);
    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DELETE, { id: annotationId });
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
