/**
 * 标注侧边栏UI
 * @file 标注侧边栏UI组件，显示和管理所有标注
 * @module AnnotationSidebarUI
 */

import { getLogger } from "../../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { showSuccess, showError } from "../../../../common/utils/notification.js";
import { showInfo } from "../../../../common/utils/notification.js";
import { AnnotationType } from "../models/index.js";

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
    this.#logger = getLogger("AnnotationSidebarUI");
    this.#container = null;
  }

  /**
   * 初始化侧边栏（仅创建内容元素）
   */
  initialize() {
    this.#logger.info("Initializing annotation sidebar UI (content only)");

    // 创建内容容器
    this.#createContent();

    // 监听事件
    this.#setupEventListeners();

    // 统一为所有标注卡片绑定跳转按钮的委托点击（避免各工具各自实现导致不一致）
    try {
      this.#setupCardClickDelegation();
      this.#logger.info("Card click delegation for jump initialized");
    } catch (e) {
      this.#logger.warn("Failed to setup card click delegation", e);
    }
  }

  /**
   * 创建内容容器（包含header和content，但不包含外部容器）
   * @private
   */
  #createContent() {
    if (this.#container) {
      this.#logger.debug("Content already exists");
      return;
    }

    // 主容器（flex布局）
    const container = document.createElement("div");
    container.className = "annotation-sidebar-container";
    container.style.cssText = [
      "display: flex",
      "flex-direction: column",
      "height: 100%",
      "width: 100%",
      "overflow: hidden",
      "background: #ffffff"
    ].join(";");

    // 创建Header（包含工具栏）
    this.#sidebarHeader = this.#createHeader();
    container.appendChild(this.#sidebarHeader);

    // 创建内容区域
    const content = document.createElement("div");
    content.className = "annotation-sidebar-content";
    content.style.cssText = [
      "flex: 1",
      "overflow-y: auto",
      "padding: 12px",
      "box-sizing: border-box"
    ].join(";");
    container.appendChild(content);
    this.#sidebarContent = content;

    this.#container = container;
    this.#logger.debug("Content created");
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
    if (!root) {return;}

    root.addEventListener("click", (evt) => {
      try {
        const target = /** @type {HTMLElement} */(evt.target);
        const jumpBtn = target?.closest ? target.closest(".jump-btn") : null;
        if (!jumpBtn) {return;}

        const annId = jumpBtn.getAttribute("data-annotation-id") || jumpBtn.dataset.annotationId;
        if (!annId) {
          // 严格模式：不合规立即报错 + toast（统一使用 logger 的 toast）
          this.#logger.error("[AnnotationSidebarUI] 跳转按钮缺少 data-annotation-id", { btn: jumpBtn }, { toast: { type: "error", ms: 4000 } });
          return;
        }
        this.#handleCardJump(String(annId));
      } catch (e) {
        // 严格模式：异常即报错 + toast（统一使用 logger 的 toast）
        try { this.#logger.error("Card jump handler failed", e, { toast: { type: "error", ms: 4000 } }); } catch { /* no-op */ }
      }
    }, { passive: true });
  }

  /**
   * 执行严格的跳转逻辑：仅通过“全局契约事件”发起跳转，不再走 URL 导航兜底
   * @param {string} annotationId
   * @private
   */
  #handleCardJump(annotationId) {
    try {
      const ann = (this.#annotations || []).find(a => a?.id === annotationId);
      if (!ann) {
        // 严格模式：未找到标注即报错 + toast
        this.#logger.error(`[AnnotationSidebarUI] 未找到标注，无法跳转 id=${annotationId}`, null, { toast: { type: "error", ms: 4000 } });
        return;
      }

      // 严格路径：仅通过“全局契约事件”通知协调者处理跳转
      this.#eventBus.emitGlobal(
        PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED,
        { annotation: ann },
        { actorId: "AnnotationSidebarUI" }
      );

      // 通知各工具跳转成功（用于渲染标记等），尽量兼容已有监听方
      try {
        this.#eventBus.emitGlobal(
          PDF_VIEWER_EVENTS.ANNOTATION?.NAVIGATION?.JUMP_SUCCESS || "annotation:navigation:jump:success",
          { annotation: ann },
          { actorId: "AnnotationSidebarUI" }
        );
      } catch { }

      // 高亮对应卡片
      try { this.highlightAndScrollToCard(ann.id); } catch { }

      this.#logger.info(`[AnnotationSidebarUI] Jump requested (strict): id=${ann.id} page=${ann.pageNumber}`);
    } catch (e) {
      this.#logger.error("Failed to handle card jump (strict)", e, { toast: { type: "error", ms: 4000 } });
    }
  }

  /**
   * 创建Header部分（包含工具栏，不包含关闭按钮）
   * @returns {HTMLElement}
   * @private
   */
  #createHeader() {
    const header = document.createElement("div");
    header.className = "annotation-sidebar-header";
    header.style.cssText = [
      "padding: 8px",  // 第二期：从12px减少到8px，使工具栏更紧凑
      "border-bottom: 1px solid #eee",
      "background: #fafafa",
      "box-sizing: border-box",
      "flex-shrink: 0"
    ].join(";");

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
    const toolbar = document.createElement("div");
    toolbar.className = "annotation-toolbar";
    toolbar.style.cssText = [
      "display: flex",
      "gap: 4px",
      "align-items: center"
    ].join(";");

    // 工具按钮配置（第二期：新增筛选、排序和设置按钮）
    const tools = [
      { id: "screenshot", icon: "📷", title: "截图标注" },
      { id: "text-highlight", icon: "✏️", title: "选字高亮" },
      { id: "comment", icon: "📝", title: "批注" },
      { id: "filter", icon: "🔍", title: "筛选标注" },
      { id: "sort", icon: "↕️", title: "排序标注" },
      { id: "settings", icon: "⚙️", title: "设置" }
    ];

    tools.forEach(tool => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `annotation-tool-btn annotation-tool-${tool.id}`;
      btn.dataset.tool = tool.id;
      btn.title = tool.title; // Tooltip提示

      // 标记是否为标注工具（用于状态更新）
      const isAnnotationTool = !["filter", "sort", "settings"].includes(tool.id);
      if (isAnnotationTool) {
        btn.dataset.isTool = "true";
      }

      btn.style.cssText = [
        "display: flex",
        "align-items: center",
        "justify-content: center",
        "width: 28px",
        "height: 28px",
        "padding: 0",
        "border: 1px solid #ddd",
        "background: #fff",
        "border-radius: 4px",
        "cursor: pointer",
        "transition: all 0.2s",
        "font-size: 16px",
        "color: #666"
      ].join(";");

      // 仅图标，不显示文字
      const iconSpan = document.createElement("span");
      iconSpan.textContent = tool.icon;
      iconSpan.style.lineHeight = "1";

      btn.appendChild(iconSpan);

      // 根据按钮类型绑定不同的处理器
      if (tool.id === "filter" || tool.id === "sort" || tool.id === "settings") {
        // 筛选、排序和设置按钮的点击处理（第二期功能）
        btn.addEventListener("click", () => this.#handleUtilityButtonClick(tool.id));
      } else {
        // 标注工具按钮的点击处理
        btn.addEventListener("click", () => this.#handleToolClick(tool.id));
      }

      // 悬停效果
      btn.addEventListener("mouseenter", () => {
        if (this.#activeTool !== tool.id) {
          btn.style.background = "#f5f5f5";
          btn.style.borderColor = "#bbb";
        }
      });
      btn.addEventListener("mouseleave", () => {
        if (this.#activeTool !== tool.id) {
          btn.style.background = "#fff";
          btn.style.borderColor = "#ddd";
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
      "screenshot": "📷 已启动截图模式",
      "text-highlight": "✏️ 已启动选字模式",
      "comment": "📝 已启动批注模式"
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
    case "filter":
      // 切换筛选面板显示状态（第二期功能）
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.FILTER_TOGGLE, {});
      showInfo("筛选功能开发中...");
      break;
    case "sort":
      // 切换排序面板显示状态（第二期功能）
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.SORT_TOGGLE, {});
      showInfo("排序功能开发中...");
      break;
    case "settings":
      // 打开设置面板（预留功能）
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.SETTINGS_OPEN, {});
      showInfo("设置功能开发中...");
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
    if (!this.#container) {return;}

    // 只更新标注工具按钮（不包括筛选、设置等辅助按钮）
    const buttons = this.#container.querySelectorAll(".annotation-tool-btn[data-is-tool=\"true\"]");
    buttons.forEach(btn => {
      const toolId = btn.dataset.tool;
      if (toolId === this.#activeTool) {
        // 激活状态：蓝色高亮
        btn.style.background = "#e3f2fd";
        btn.style.borderColor = "#2196f3";
        btn.style.color = "#1976d2";
        btn.style.fontWeight = "500";
      } else {
        // 未激活状态：默认样式
        btn.style.background = "#fff";
        btn.style.borderColor = "#ddd";
        btn.style.color = "#666";
        btn.style.fontWeight = "normal";
      }
    });

    this.#logger.debug(`Toolbar state updated, active tool: ${this.#activeTool || "none"}`);
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
      { subscriberId: "AnnotationSidebarUI" }
    ));

    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.UPDATED,
      (data) => this.updateAnnotationCard(data.annotation),
      { subscriberId: "AnnotationSidebarUI" }
    ));

    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.DELETED,
      (data) => this.removeAnnotationCard(data.id),
      { subscriberId: "AnnotationSidebarUI" }
    ));

    // 监听标注加载完成
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED,
      (data) => this.render(data.annotations || []),
      { subscriberId: "AnnotationSidebarUI" }
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
          this.#logger.debug("All tools deactivated (no specific tool specified)");
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
      { subscriberId: "AnnotationSidebarUI" }
    ));

    // 监听标注选择事件（点击标记时）
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.SELECT,
      (data) => this.highlightAndScrollToCard(data.id),
      { subscriberId: "AnnotationSidebarUI" }
    ));

    // 监听侧边栏关闭事件（第二期：关闭时停用所有工具）
    this.#unsubs.push(this.#eventBus.onGlobal(
      PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.CLOSED_COMPLETED,
      (data) => this.#handleSidebarClosed(data),
      { subscriberId: "AnnotationSidebarUI" }
    ));

    // 监听评论添加事件（第二期：新增）
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.COMMENT.ADDED,
      (data) => this.#handleCommentAdded(data),
      { subscriberId: "AnnotationSidebarUI" }
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
    if (data?.sidebarId !== "annotation") {
      return;
    }

    this.#logger.info("Annotation sidebar closed, deactivating all tools");

    // 记录当前激活的工具（在发送停用事件前）

    // 发出工具停用请求事件（ToolRegistry会处理实际停用）
    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.DEACTIVATE, {});
    this.#logger.info("Tool deactivate requested due to sidebar close");

    // 清空本地状态
    this.#activeTool = null;
    this.#updateToolbarState();

    // 业务要求：关闭侧边栏时不再弹出任何 toast 提示（静默处理）
    this.#logger.info("Annotation sidebar closed (silent, no toast)");
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
      this.#logger.debug("Comment already added locally, skipping update");
      return;
    }

    // 找到对应的annotation
    const annotation = this.#annotations.find(a => a.id === annotationId);
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
      this.#logger.warn("Sidebar content not found");
      return;
    }

    // 清空现有内容
    this.#sidebarContent.innerHTML = "";
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
    this.#sidebarContent.innerHTML = "";

    const emptyDiv = document.createElement("div");
    emptyDiv.className = "annotation-empty";
    emptyDiv.style.cssText = [
      "text-align: center",
      "padding: 40px 20px",
      "color: #999",
      "font-size: 14px"
    ].join(";");

    const icon = document.createElement("div");
    icon.textContent = "📝";
    icon.style.cssText = "font-size: 48px; margin-bottom: 16px;";

    const message = document.createElement("div");
    message.textContent = "暂无标注";

    const hint = document.createElement("div");
    hint.textContent = "🖱️ 点击上方工具按钮开始标注";
    hint.style.cssText = "margin-top: 8px; font-size: 12px; color: #bbb;";

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
    const card = document.createElement("div");
    card.className = "annotation-card";
    card.dataset.annotationId = annotation.id;
    card.style.cssText = [
      "border: 1px solid #e0e0e0",
      "border-radius: 8px",
      "padding: 12px",
      "margin-bottom: 12px",
      "background: #fff",
      "transition: all 0.2s",
      "cursor: pointer"
    ].join(";");

    // 悬停效果
    card.addEventListener("mouseenter", () => {
      card.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
      card.style.borderColor = "#bbb";
    });
    card.addEventListener("mouseleave", () => {
      card.style.boxShadow = "none";
      card.style.borderColor = "#e0e0e0";
    });

    // 卡片头部（类型图标 + 页码）
    const header = document.createElement("div");
    header.style.cssText = [
      "display: flex",
      "align-items: center",
      "justify-content: space-between",
      "margin-bottom: 8px"
    ].join(";");

    const typeInfo = document.createElement("div");
    typeInfo.style.cssText = "display: flex; align-items: center; gap: 6px;";

    const typeIcon = document.createElement("span");
    typeIcon.textContent = annotation.getTypeIcon();
    typeIcon.style.fontSize = "18px";

    const pageInfo = document.createElement("span");
    pageInfo.textContent = `P.${annotation.pageNumber}`;
    pageInfo.style.cssText = "font-size: 12px; color: #666; font-weight: 500;";

    typeInfo.appendChild(typeIcon);
    typeInfo.appendChild(pageInfo);

    const actions = document.createElement("div");
    actions.style.cssText = "display: flex; align-items: center; gap: 6px;";

    const jumpBtn = document.createElement("button");
    jumpBtn.type = "button";
    jumpBtn.textContent = "🧭";
    jumpBtn.title = "跳转到标注位置";
    jumpBtn.className = "annotation-jump-btn";
    jumpBtn.style.cssText = [
      "border: 1px solid #ddd",
      "background: #fff",
      "border-radius: 4px",
      "padding: 4px 8px",
      "cursor: pointer",
      "font-size: 14px",
      "color: #666",
      "transition: all 0.2s"
    ].join(";");
    jumpBtn.addEventListener("mouseenter", () => {
      jumpBtn.style.background = "#e3f2fd";
      jumpBtn.style.borderColor = "#2196f3";
      jumpBtn.style.color = "#2196f3";
    });
    jumpBtn.addEventListener("mouseleave", () => {
      jumpBtn.style.background = "#fff";
      jumpBtn.style.borderColor = "#ddd";
      jumpBtn.style.color = "#666";
    });
    jumpBtn.setAttribute("aria-label", "跳转到标注位置");
    jumpBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.#handleJumpClick(annotation.id);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "🗑️";
    deleteBtn.title = "删除标注";
    deleteBtn.className = "annotation-delete-btn";
    deleteBtn.dataset.action = "delete";
    deleteBtn.style.cssText = [
      "border: 1px solid #f44336",
      "background: #fff",
      "border-radius: 4px",
      "padding: 4px 8px",
      "cursor: pointer",
      "font-size: 12px",
      "color: #f44336",
      "transition: all 0.2s"
    ].join(";");
    deleteBtn.addEventListener("mouseenter", () => {
      deleteBtn.style.background = "#f44336";
      deleteBtn.style.color = "#fff";
    });
    deleteBtn.addEventListener("mouseleave", () => {
      deleteBtn.style.background = "#fff";
      deleteBtn.style.color = "#f44336";
    });
    deleteBtn.setAttribute("aria-label", "删除标注");
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.#handleDeleteClick(annotation.id);
    });

    actions.appendChild(jumpBtn);
    actions.appendChild(deleteBtn);

    header.appendChild(typeInfo);
    header.appendChild(actions);

    // 卡片内容
    const content = document.createElement("div");
    content.className = "annotation-card-content";
    content.style.cssText = [
      "font-size: 14px",
      "color: #333",
      "line-height: 1.5",
      "margin-bottom: 8px",
      "word-wrap: break-word"
    ].join(";");

    // 根据类型显示不同的内容
    if (annotation.type === AnnotationType.SCREENSHOT) {
      // 截图：显示缩略图和描述
      if (annotation.data.imageData || annotation.data.imagePath) {
        const img = document.createElement("img");
        // 优先使用imageData(base64)，如果是imagePath则转换为完整URL
        img.src = annotation.data.imageData
          ? annotation.data.imageData
          : this.#getImageUrl(annotation.data.imagePath);
        img.alt = "截图";
        img.style.cssText = [
          "width: 100%",
          "height: auto",
          "border-radius: 4px",
          "margin-bottom: 8px"
        ].join(";");
        content.appendChild(img);
      }
      if (annotation.data.description) {
        const desc = document.createElement("div");
        desc.textContent = annotation.data.description;
        desc.style.color = "#666";
        content.appendChild(desc);
      }
    } else if (annotation.type === AnnotationType.TEXT_HIGHLIGHT) {
      // 选字：显示选中的文本和笔记
      const text = document.createElement("div");
      text.textContent = `"${annotation.data.selectedText}"`;
      text.style.cssText = [
        `background: ${annotation.data.highlightColor}33`,
        `border-left: 3px solid ${annotation.data.highlightColor}`,
        "padding: 6px 8px",
        "border-radius: 4px",
        "font-style: italic"
      ].join(";");
      content.appendChild(text);

      if (annotation.data.note) {
        const note = document.createElement("div");
        note.textContent = annotation.data.note;
        note.style.cssText = "margin-top: 6px; color: #666; font-size: 13px;";
        content.appendChild(note);
      }
    } else if (annotation.type === AnnotationType.COMMENT) {
      // 批注：显示内容
      const text = document.createElement("div");
      text.textContent = annotation.data.content;
      content.appendChild(text);
    }

    // 卡片底部（拷贝ID + 时间 + 评论）
    const footer = document.createElement("div");
    footer.style.cssText = [
      "display: flex",
      "align-items: center",
      "justify-content: space-between",
      "font-size: 12px",
      "color: #999",
      "padding-top: 8px",
      "border-top: 1px solid #f0f0f0",
      "gap: 8px"
    ].join(";");

    // 左侧：拷贝ID按钮
    const copyIdBtn = document.createElement("button");
    copyIdBtn.type = "button";
    copyIdBtn.textContent = "📋";
    copyIdBtn.title = `复制ID: ${annotation.id}`;
    copyIdBtn.className = "annotation-copy-id-btn";
    copyIdBtn.style.cssText = [
      "border: 1px solid #ddd",
      "background: #fff",
      "border-radius: 4px",
      "cursor: pointer",
      "font-size: 12px",
      "padding: 2px 8px",
      "color: #666",
      "transition: all 0.2s"
    ].join(";");
    copyIdBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await this.#handleCopyIdClick(annotation.id);
      } catch (error) {
        this.#logger.error("Copy click handler failed:", error);
        showError("✗ 复制失败", 3000);
      }
    });
    copyIdBtn.addEventListener("mouseenter", () => {
      copyIdBtn.style.background = "#e3f2fd";
      copyIdBtn.style.borderColor = "#2196f3";
      copyIdBtn.style.color = "#2196f3";
    });
    copyIdBtn.addEventListener("mouseleave", () => {
      copyIdBtn.style.background = "#fff";
      copyIdBtn.style.borderColor = "#ddd";
      copyIdBtn.style.color = "#666";
    });
    copyIdBtn.setAttribute("aria-label", "复制标注ID");

    // 右侧：时间 + 评论按钮
    const rightSection = document.createElement("div");
    rightSection.style.cssText = [
      "display: flex",
      "align-items: center",
      "gap: 8px",
      "margin-left: auto"
    ].join(";");

    const time = document.createElement("span");
    time.textContent = annotation.getFormattedDate();
    time.style.color = "#999";

    const commentBtn = document.createElement("button");
    commentBtn.type = "button";
    const commentCount = annotation.getCommentCount();
    commentBtn.textContent = commentCount > 0 ? `💬 ${commentCount}` : "💬";
    commentBtn.title = commentCount > 0 ? `${commentCount}条评论` : "添加评论";
    commentBtn.className = "annotation-comment-btn";
    commentBtn.style.cssText = [
      "border: 1px solid #ddd",
      "background: #fff",
      "border-radius: 4px",
      "cursor: pointer",
      "font-size: 12px",
      "padding: 2px 8px",
      "color: #666",
      "transition: all 0.2s"
    ].join(";");
    commentBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.#handleCommentClick(annotation.id);
    });
    commentBtn.addEventListener("mouseenter", () => {
      commentBtn.style.background = "#e3f2fd";
      commentBtn.style.borderColor = "#2196f3";
      commentBtn.style.color = "#2196f3";
    });
    commentBtn.addEventListener("mouseleave", () => {
      commentBtn.style.background = "#fff";
      commentBtn.style.borderColor = "#ddd";
      commentBtn.style.color = "#666";
    });
    commentBtn.setAttribute("aria-label", commentCount > 0 ? `查看评论（${commentCount}）` : "添加评论");

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

    // 去重：如果已存在相同ID的卡片，直接更新而不是新增
    if (this.#annotationCards.has(annotation.id)) {
      try {
        this.updateAnnotationCard(annotation);
      } catch { }
      return;
    }

    // 如果当前是空状态，先清空
    const empty = this.#sidebarContent.querySelector(".annotation-empty");
    if (empty) {
      this.#sidebarContent.innerHTML = "";
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
    this.#logger.debug(`Jump to annotation (strict): ${annotationId}`);
    // 为避免“乐观UI创建后，AnnotationManager尚未入库”导致的跳转失败，这里携带完整对象
    const annotation = this.#annotations.find(a => a.id === annotationId) || null;
    if (!annotation) {
      this.#logger.error(`[AnnotationSidebarUI] 未找到标注，无法跳转 id=${annotationId}`, null, { toast: { type: "error", ms: 4000 } });
      return;
    }
    this.#eventBus.emitGlobal(
      PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED,
      {
        id: annotationId,
        annotation
      },
      { actorId: "AnnotationSidebarUI" }
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

    const confirmed = await this.#confirmAsync("确定要删除该标注吗？");
    if (!confirmed) { return; }

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
        const overlay = document.createElement("div");
        overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999;";
        const dlg = document.createElement("div");
        dlg.style.cssText = "width:360px;background:#fff;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.25);overflow:hidden;";
        const body = document.createElement("div");
        body.style.cssText = "padding:16px;font-size:14px;";
        body.textContent = message;
        const footer = document.createElement("div");
        footer.style.cssText = "display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid #eee;";
        const btnCancel = document.createElement("button");
        btnCancel.textContent = "取消";
        btnCancel.style.cssText = "padding:6px 12px;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer;";
        const btnOk = document.createElement("button");
        btnOk.textContent = "删除";
        btnOk.style.cssText = "padding:6px 12px;border:1px solid #c62828;background:#c62828;color:#fff;border-radius:4px;cursor:pointer;";
        btnCancel.addEventListener("click", () => { try { overlay.remove(); } catch {} resolve(false); });
        btnOk.addEventListener("click", () => { try { overlay.remove(); } catch {} resolve(true); });
        footer.appendChild(btnCancel); footer.appendChild(btnOk);
        dlg.appendChild(body); dlg.appendChild(footer); overlay.appendChild(dlg);
        document.body.appendChild(overlay);
      } catch {
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
    // 获取标注数据
    const annotation = this.#annotations.find(a => a.id === annotationId);
    if (!annotation) {
      this.#logger.warn(`Annotation not found: ${annotationId}`);
      return;
    }

    // 创建遮罩层
    const overlay = document.createElement("div");
    overlay.style.cssText = [
      "position: fixed",
      "top: 0",
      "left: 0",
      "right: 0",
      "bottom: 0",
      "background: rgba(0, 0, 0, 0.5)",
      "display: flex",
      "align-items: center",
      "justify-content: center",
      "z-index: 10000"
    ].join(";");

    // 创建对话框
    const dialog = document.createElement("div");
    dialog.style.cssText = [
      "background: #fff",
      "border-radius: 8px",
      "padding: 20px",
      "width: 500px",
      "max-width: 90%",
      "max-height: 80vh",
      "display: flex",
      "flex-direction: column",
      "box-shadow: 0 4px 20px rgba(0,0,0,0.3)"
    ].join(";");

    // 标题
    const title = document.createElement("div");
    const commentCount = annotation.getCommentCount();
    title.textContent = commentCount > 0 ? `评论 (${commentCount})` : "添加评论";
    title.style.cssText = [
      "font-size: 16px",
      "font-weight: 500",
      "margin-bottom: 12px",
      "color: #333"
    ].join(";");

    // 标注内容显示区域（第二期：新增）
    const annotationContent = document.createElement("div");
    annotationContent.style.cssText = [
      "background: #f9f9f9",
      "border: 1px solid #e8e8e8",
      "border-radius: 6px",
      "padding: 12px",
      "margin-bottom: 12px",
      "max-height: 200px",
      "overflow-y: auto"
    ].join(";");

    // 根据标注类型显示不同内容
    const typeIcon = annotation.getTypeIcon();
    const typeLabel = document.createElement("div");
    typeLabel.style.cssText = [
      "font-size: 12px",
      "color: #666",
      "margin-bottom: 8px",
      "font-weight: 500"
    ].join(";");

    switch (annotation.type) {
    case "screenshot": {
      typeLabel.textContent = `${typeIcon} 截图标注`;
      annotationContent.appendChild(typeLabel);

      // 显示截图描述
      if (annotation.data.description) {
        const desc = document.createElement("div");
        desc.textContent = annotation.data.description;
        desc.style.cssText = [
          "font-size: 14px",
          "color: #333",
          "margin-bottom: 8px"
        ].join(";");
        annotationContent.appendChild(desc);
      }

      // 显示截图图片（如果有imagePath或imageData）
      if (annotation.data.imagePath || annotation.data.imageData) {
        const img = document.createElement("img");
        // 优先使用imageData(base64)，如果是imagePath则转换为完整URL
        img.src = annotation.data.imageData
          ? annotation.data.imageData
          : this.#getImageUrl(annotation.data.imagePath);
        img.style.cssText = [
          "max-width: 100%",
          "border-radius: 4px",
          "display: block"
        ].join(";");
        img.onerror = () => {
          // 图片加载失败时显示提示
          img.style.display = "none";
          const errorTip = document.createElement("div");
          errorTip.textContent = "图片加载失败";
          errorTip.style.cssText = [
            "color: #999",
            "font-size: 12px",
            "padding: 8px",
            "text-align: center"
          ].join(";");
          img.parentElement.appendChild(errorTip);
        };
        annotationContent.appendChild(img);
      }
      break;
    }

    case "text-highlight": {
      typeLabel.textContent = `${typeIcon} 文本高亮`;
      annotationContent.appendChild(typeLabel);

      const highlightText = document.createElement("div");
      highlightText.textContent = `"${annotation.data.selectedText}"`;
      highlightText.style.cssText = [
        "font-size: 14px",
        "color: #333",
        "line-height: 1.6",
        "font-style: italic",
        "padding: 8px",
        "background: " + (annotation.data.highlightColor || "#ffff00") + "40",
        "border-radius: 4px"
      ].join(";");
      annotationContent.appendChild(highlightText);

      // 显示笔记（如果有）
      if (annotation.data.note) {
        const note = document.createElement("div");
        note.textContent = `笔记: ${annotation.data.note}`;
        note.style.cssText = [
          "font-size: 13px",
          "color: #666",
          "margin-top: 8px",
          "padding-top: 8px",
          "border-top: 1px solid #e8e8e8"
        ].join(";");
        annotationContent.appendChild(note);
      }
      break;
    }

    case "comment": {
      typeLabel.textContent = `${typeIcon} 批注`;
      annotationContent.appendChild(typeLabel);

      const commentText = document.createElement("div");
      commentText.textContent = annotation.data.content;
      commentText.style.cssText = [
        "font-size: 14px",
        "color: #333",
        "line-height: 1.6"
      ].join(";");
      annotationContent.appendChild(commentText);
      break;
    }

    default:
      typeLabel.textContent = `${typeIcon} 标注`;
      annotationContent.appendChild(typeLabel);
    }

    // ID显示
    const idInfo = document.createElement("div");
    idInfo.textContent = `标注ID: ${annotationId}`;
    idInfo.style.cssText = [
      "font-size: 12px",
      "color: #999",
      "margin-bottom: 16px",
      "font-family: monospace"
    ].join(";");

    // 历史评论列表容器
    const commentsContainer = document.createElement("div");
    commentsContainer.style.cssText = [
      "flex: 1",
      "overflow-y: auto",
      "margin-bottom: 16px",
      "border: 1px solid #f0f0f0",
      "border-radius: 4px",
      "max-height: 300px"
    ].join(";");

    // 显示历史评论
    if (annotation.comments && annotation.comments.length > 0) {
      annotation.comments.forEach(comment => {
        const commentItem = document.createElement("div");
        commentItem.style.cssText = [
          "padding: 12px",
          "border-bottom: 1px solid #f0f0f0",
          "background: #fafafa"
        ].join(";");

        const commentContent = document.createElement("div");
        commentContent.textContent = comment.content;
        commentContent.style.cssText = [
          "font-size: 14px",
          "color: #333",
          "margin-bottom: 8px",
          "word-wrap: break-word"
        ].join(";");

        const commentTime = document.createElement("div");
        commentTime.textContent = comment.getFormattedDate();
        commentTime.style.cssText = [
          "font-size: 12px",
          "color: #999"
        ].join(";");

        commentItem.appendChild(commentContent);
        commentItem.appendChild(commentTime);
        commentsContainer.appendChild(commentItem);
      });
    } else {
      const emptyTip = document.createElement("div");
      emptyTip.textContent = "暂无评论";
      emptyTip.style.cssText = [
        "padding: 20px",
        "text-align: center",
        "color: #999",
        "font-size: 14px"
      ].join(";");
      commentsContainer.appendChild(emptyTip);
    }

    // 输入框
    const textarea = document.createElement("textarea");
    textarea.placeholder = "请输入新评论...";
    textarea.style.cssText = [
      "width: 100%",
      "min-height: 80px",
      "padding: 8px",
      "border: 1px solid #ddd",
      "border-radius: 4px",
      "font-size: 14px",
      "font-family: inherit",
      "resize: vertical",
      "margin-bottom: 16px",
      "box-sizing: border-box"
    ].join(";");

    // 按钮容器
    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = [
      "display: flex",
      "justify-content: flex-end",
      "gap: 8px"
    ].join(";");

    // 取消按钮
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "✖️";
    cancelBtn.setAttribute("aria-label", "取消");
    cancelBtn.style.cssText = [
      "padding: 6px 16px",
      "border: 1px solid #ddd",
      "background: #fff",
      "border-radius: 4px",
      "cursor: pointer",
      "font-size: 14px",
      "color: #666"
    ].join(";");

    // 确定按钮
    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.textContent = "✅";
    confirmBtn.setAttribute("aria-label", "确定");
    confirmBtn.style.cssText = [
      "padding: 6px 16px",
      "border: none",
      "background: #2196f3",
      "border-radius: 4px",
      "cursor: pointer",
      "font-size: 14px",
      "color: #fff"
    ].join(";");

    // 关闭对话框函数
    const closeDialog = () => {
      overlay.remove();
    };

    // 刷新历史评论列表
    const refreshComments = () => {
      // 清空现有评论
      commentsContainer.innerHTML = "";

      // 重新显示历史评论
      if (annotation.comments && annotation.comments.length > 0) {
        annotation.comments.forEach(comment => {
          const commentItem = document.createElement("div");
          commentItem.style.cssText = [
            "padding: 12px",
            "border-bottom: 1px solid #f0f0f0",
            "background: #fafafa"
          ].join(";");

          const commentContent = document.createElement("div");
          commentContent.textContent = comment.content;
          commentContent.style.cssText = [
            "font-size: 14px",
            "color: #333",
            "margin-bottom: 8px",
            "word-wrap: break-word"
          ].join(";");

          const commentTime = document.createElement("div");
          commentTime.textContent = comment.getFormattedDate();
          commentTime.style.cssText = [
            "font-size: 12px",
            "color: #999"
          ].join(";");

          commentItem.appendChild(commentContent);
          commentItem.appendChild(commentTime);
          commentsContainer.appendChild(commentItem);
        });
      } else {
        const emptyTip = document.createElement("div");
        emptyTip.textContent = "暂无评论";
        emptyTip.style.cssText = [
          "padding: 20px",
          "text-align: center",
          "color: #999",
          "font-size: 14px"
        ].join(";");
        commentsContainer.appendChild(emptyTip);
      }

      // 更新标题显示评论数量
      const commentCount = annotation.getCommentCount();
      title.textContent = commentCount > 0 ? `评论 (${commentCount})` : "添加评论";
    };

    // 提交评论函数
    const submitComment = () => {
      const content = textarea.value.trim();
      if (!content) {
        this.#logger.warn("请输入评论内容", { toast: { type: "warn", ms: 3000 } });
        return;
      }

      // 直接添加评论到annotation对象
      annotation.addComment({
        content,
        createdAt: new Date().toISOString()
      });

      // 发出评论事件（用于持久化等后续处理）
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.COMMENT.ADDED, {
        annotationId,
        content,
        timestamp: Date.now(),
        skipUpdate: true  // 本地已更新，跳过事件处理器的更新
      });

      // 刷新历史评论列表
      refreshComments();

      // 清空输入框
      textarea.value = "";

      // 显示成功提示
      showSuccess("✓ 评论已添加", 2000);

      // 更新卡片显示（刷新评论数量）
      this.updateAnnotationCard(annotation);

      // 重新聚焦输入框，方便继续添加评论
      textarea.focus();
    };

    // 事件监听
    cancelBtn.addEventListener("click", closeDialog);
    confirmBtn.addEventListener("click", submitComment);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeDialog();
      }
    });

    // Enter键提交（Ctrl+Enter或Shift+Enter换行）
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        submitComment();
      }
    });

    // 组装对话框
    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(confirmBtn);
    dialog.appendChild(title);
    dialog.appendChild(annotationContent);  // 标注内容（第二期：新增）
    dialog.appendChild(idInfo);
    dialog.appendChild(commentsContainer);
    dialog.appendChild(textarea);
    dialog.appendChild(buttonContainer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // 自动聚焦输入框
    textarea.focus();
  }

  /**
   * 处理复制ID按钮点击（第二期：新增）
   * @param {string} annotationId - 标注ID
   * @private
   */
  async #handleCopyIdClick(annotationId) {
    this.#logger.debug(`Copy annotation ID: ${annotationId}`);

    let success = false;

    // 直接使用 execCommand 方法（PyQt WebEngine中Clipboard API不可用）
    try {
      const textarea = document.createElement("textarea");
      textarea.value = annotationId;
      textarea.style.cssText = [
        "position: fixed",
        "top: 0",
        "left: 0",
        "width: 2em",
        "height: 2em",
        "padding: 0",
        "border: none",
        "outline: none",
        "boxShadow: none",
        "background: transparent",
        "opacity: 0",
        "pointer-events: none"
      ].join(";");

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);

      if (successful) {
        success = true;
        this.#logger.debug("Copied using execCommand");
      } else {
        this.#logger.error("execCommand returned false");
      }
    } catch (error) {
      this.#logger.error("Copy failed:", error);
    }

    // 显示结果
    if (success) {
      showSuccess("✓ ID已复制", 2000);
      // 发出ID复制事件（修正为3段格式）
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.ID_COPY_SUCCESS, { id: annotationId });
    } else {
      showError("✗ 复制失败", 3000);
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
      card.style.background = "#fff";
      card.style.borderColor = "#e0e0e0";
    });

    // 高亮目标卡片
    targetCard.style.background = "#fff3cd";
    targetCard.style.borderColor = "#ffc107";

    // 滚动到目标卡片
    targetCard.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    // 3秒后恢复正常样式
    setTimeout(() => {
      targetCard.style.background = "#fff";
      targetCard.style.borderColor = "#e0e0e0";
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
    this.#unsubs.forEach(unsub => unsub());
    this.#unsubs = [];

    // 移除DOM
    if (this.#container) {
      this.#container.remove();
      this.#container = null;
    }

    this.#logger.info("Annotation sidebar destroyed");
  }
}

export default AnnotationSidebarUI;

