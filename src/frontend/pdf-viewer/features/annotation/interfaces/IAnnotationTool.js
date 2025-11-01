/**
 * IAnnotationTool - 标注工具统一接口
 * @module features/annotation/interfaces/IAnnotationTool
 * @description 所有标注工具插件必须实现此接口
 *
 * 工具类型:
 * - 截图工具 (ScreenshotTool)
 * - 文字高亮工具 (TextHighlightTool)
 * - 批注工具 (CommentTool)
 *
 * 设计原则:
 * - 工具作为独立插件，实现完整的IAnnotationTool接口
 * - 工具通过ToolRegistry注册和管理
 * - 工具之间完全解耦，可并行开发
 * - 工具通过事件总线与其他组件通信
 *
 * @interface
 */
export class IAnnotationTool {
  // ==================== 元数据属性 ====================
  // 注意: 必须使用getter方法，不能使用类字段

  /**
   * 工具唯一标识
   * @returns {string} 工具ID，如'screenshot', 'text-highlight', 'comment'
   * @example
   * get name() { return 'screenshot'; }
   */
  get name() {
    throw new Error("IAnnotationTool.name must be implemented");
  }

  /**
   * 工具显示名称
   * @returns {string} 用于UI显示的名称，如'截图', '选字', '批注'
   * @example
   * get displayName() { return '截图'; }
   */
  get displayName() {
    throw new Error("IAnnotationTool.displayName must be implemented");
  }

  /**
   * 工具图标
   * @returns {string} Emoji或图标字符，如'📷', '✏️', '📝'
   * @example
   * get icon() { return '📷'; }
   */
  get icon() {
    throw new Error("IAnnotationTool.icon must be implemented");
  }

  /**
   * 工具版本
   * @returns {string} 语义化版本号
   * @example
   * get version() { return '1.0.0'; }
   */
  get version() {
    throw new Error("IAnnotationTool.version must be implemented");
  }

  /**
   * 工具依赖
   * @returns {string[]} 依赖的服务或组件列表
   * @example
   * get dependencies() { return ['qwebchannel']; }
   */
  get dependencies() {
    throw new Error("IAnnotationTool.dependencies must be implemented");
  }

  // ==================== 生命周期方法 ====================

  /**
   * 初始化工具
   *
   * 在此方法中:
   * 1. 保存context中的依赖（eventBus, logger等）
   * 2. 创建工具所需的私有对象（如ScreenshotCapturer）
   * 3. 注册事件监听器
   * 4. 初始化状态
   *
   * @param {Object} context - 上下文对象
   * @param {EventBus} context.eventBus - 事件总线
   * @param {Logger} context.logger - 日志器
   * @param {Object} context.pdfViewerManager - PDF查看器管理器
   * @param {Object} context.container - 依赖容器
   * @returns {Promise<void>}
   *
   * @example
   * async initialize(context) {
   *   const { eventBus, logger, pdfViewerManager, container } = context;
   *   this.#eventBus = eventBus;
   *   this.#logger = logger || getLogger('ScreenshotTool');
   *   this.#pdfViewerManager = pdfViewerManager;
   *   // 创建工具特定的对象
   *   this.#capturer = new ScreenshotCapturer(pdfViewerManager);
   *   // 注册事件监听器
   *   this.#eventBus.on('annotation-tool:activate:requested', this.#handleActivate.bind(this));
   * }
   */
  async initialize(context) {
    throw new Error("IAnnotationTool.initialize must be implemented");
  }

  /**
   * 激活工具（进入工具模式）
   *
   * 在此方法中:
   * 1. 设置激活状态
   * 2. 更改鼠标指针样式
   * 3. 创建工具UI（如选择遮罩层）
   * 4. 绑定工具特定的事件处理器
   * 5. 发布工具激活事件
   *
   * @returns {void}
   *
   * @example
   * activate() {
   *   this.#isActive = true;
   *   document.body.style.cursor = 'crosshair';
   *   this.#createSelectionOverlay();
   *   this.#setupMouseEvents();
   *   this.#eventBus.emit('annotation-tool:activate:success', { tool: this.name });
   * }
   */
  activate() {
    throw new Error("IAnnotationTool.activate must be implemented");
  }

  /**
   * 停用工具（退出工具模式）
   *
   * 在此方法中:
   * 1. 清除激活状态
   * 2. 恢复鼠标指针样式
   * 3. 移除工具UI
   * 4. 解绑事件处理器
   * 5. 发布工具停用事件
   *
   * @returns {void}
   *
   * @example
   * deactivate() {
   *   this.#isActive = false;
   *   document.body.style.cursor = 'default';
   *   this.#cleanup();
   *   this.#eventBus.emit('annotation-tool:deactivate:success', { tool: this.name });
   * }
   */
  deactivate() {
    throw new Error("IAnnotationTool.deactivate must be implemented");
  }

  /**
   * 检查工具是否激活
   * @returns {boolean} true表示工具当前激活
   *
   * @example
   * isActive() {
   *   return this.#isActive;
   * }
   */
  isActive() {
    throw new Error("IAnnotationTool.isActive must be implemented");
  }

  // ==================== UI方法 ====================

  /**
   * 创建工具按钮（显示在侧边栏工具栏）
   *
   * 按钮要求:
   * 1. 包含工具图标和显示名称
   * 2. 点击时切换工具激活状态
   * 3. 激活时高亮显示
   * 4. 可访问性属性（title, aria-label等）
   *
   * @returns {HTMLElement} 工具按钮元素
   *
   * @example
   * createToolButton() {
   *   const button = document.createElement('button');
   *   button.id = `${this.name}-tool-btn`;
   *   button.textContent = `${this.icon} ${this.displayName}`;
   *   button.title = `${this.displayName}工具`;
   *   button.addEventListener('click', () => {
   *     this.#eventBus.emit('annotation-tool:activate:requested', { tool: this.name });
   *   });
   *   return button;
   * }
   */
  createToolButton() {
    throw new Error("IAnnotationTool.createToolButton must be implemented");
  }

  /**
   * 创建标注卡片（显示在标注列表）
   *
   * 卡片要求:
   * 1. 显示标注预览（截图/文本/批注内容）
   * 2. 显示页码、创建时间
   * 3. 提供操作按钮（跳转、编辑、删除）
   * 4. 支持评论功能
   * 5. 响应点击和交互事件
   *
   * @param {Annotation} annotation - 标注对象
   * @returns {HTMLElement} 标注卡片元素
   *
   * @example
   * createAnnotationCard(annotation) {
   *   const card = document.createElement('div');
   *   card.className = 'annotation-card';
   *   card.innerHTML = `
   *     <div class="thumbnail">...</div>
   *     <div class="info">
   *       <p>页码: ${annotation.pageNumber}</p>
   *       <p>时间: ${annotation.getFormattedDate()}</p>
   *     </div>
   *     <div class="actions">
   *       <button>跳转</button>
   *       <button>评论</button>
   *     </div>
   *   `;
   *   return card;
   * }
   */
  createAnnotationCard(annotation) {
    throw new Error("IAnnotationTool.createAnnotationCard must be implemented");
  }

  // ==================== 清理方法 ====================

  /**
   * 销毁工具，清理资源
   *
   * 在此方法中:
   * 1. 停用工具（如果激活）
   * 2. 移除所有事件监听器
   * 3. 清理DOM元素
   * 4. 释放对象引用
   * 5. 重置状态
   *
   * @returns {void}
   *
   * @example
   * destroy() {
   *   if (this.isActive()) {
   *     this.deactivate();
   *   }
   *   this.#eventBus.off('annotation-tool:activate:requested', this.#handleActivate);
   *   this.#cleanup();
   *   this.#eventBus = null;
   *   this.#logger = null;
   * }
   */
  destroy() {
    throw new Error("IAnnotationTool.destroy must be implemented");
  }
}

/**
 * 验证工具是否实现了IAnnotationTool接口
 * @param {Object} tool - 工具实例
 * @returns {boolean} true表示工具实现了所有必需方法
 * @throws {Error} 如果工具未实现必需方法
 */
export function validateAnnotationTool(tool) {
  const requiredMethods = [
    "name", "displayName", "icon", "version", "dependencies",
    "initialize", "activate", "deactivate", "isActive",
    "createToolButton", "createAnnotationCard", "destroy"
  ];

  for (const method of requiredMethods) {
    // 检查getter属性
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(tool), method);
    if (!descriptor || (typeof descriptor.get !== "function" && typeof tool[method] !== "function")) {
      throw new Error(`AnnotationTool '${tool.constructor.name}' must implement ${method}`);
    }
  }

  return true;
}

export default IAnnotationTool;
