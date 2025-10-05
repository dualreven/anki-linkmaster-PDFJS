/**
 * ToolRegistry - 标注工具注册表
 * @module features/annotation/core/tool-registry
 * @description 管理标注工具的注册、初始化、激活和销毁
 *
 * 职责:
 * 1. 注册工具插件
 * 2. 初始化所有工具
 * 3. 激活/停用工具（互斥激活）
 * 4. 获取工具实例
 * 5. 销毁所有工具
 *
 * 使用方式:
 * ```javascript
 * const registry = new ToolRegistry(eventBus, logger);
 *
 * // 注册工具
 * const screenshotTool = new ScreenshotTool();
 * registry.register(screenshotTool);
 *
 * // 初始化所有工具
 * await registry.initializeAll(context);
 *
 * // 激活工具
 * registry.activateTool('screenshot');
 *
 * // 停用当前工具
 * registry.deactivateCurrentTool();
 * ```
 */

import { getLogger } from '../../../../common/utils/logger.js';
import { validateAnnotationTool } from '../interfaces/IAnnotationTool.js';
import { PDF_VIEWER_EVENTS } from '../../../../common/event/pdf-viewer-constants.js';

/**
 * 工具注册表类
 * @class ToolRegistry
 */
export class ToolRegistry {
  /**
   * 工具Map: name → tool实例
   * @type {Map<string, IAnnotationTool>}
   * @private
   */
  #tools = new Map();

  /**
   * 当前激活的工具名称
   * @type {string|null}
   * @private
   */
  #activeTool = null;

  /**
   * 事件总线
   * @type {EventBus}
   * @private
   */
  #eventBus;

  /**
   * 日志器
   * @type {Logger}
   * @private
   */
  #logger;

  /**
   * 是否已初始化
   * @type {boolean}
   * @private
   */
  #initialized = false;

  /**
   * 创建工具注册表
   * @param {EventBus} eventBus - 事件总线
   * @param {Logger} [logger] - 日志器
   */
  constructor(eventBus, logger) {
    if (!eventBus) {
      throw new Error('ToolRegistry requires eventBus');
    }

    this.#eventBus = eventBus;
    this.#logger = logger || getLogger('ToolRegistry');

    // 监听工具激活/停用事件
    this.#setupEventListeners();

    this.#logger.info('[ToolRegistry] Created');
  }

  /**
   * 设置事件监听器
   * @private
   */
  #setupEventListeners() {
    // 监听工具激活请求
    this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.ACTIVATE, (data) => {
      const { tool } = data;
      this.activateTool(tool);
    }, { subscriberId: 'ToolRegistry' });

    // 监听工具停用请求
    this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.DEACTIVATE, () => {
      this.deactivateCurrentTool();
    }, { subscriberId: 'ToolRegistry' });
  }

  /**
   * 注册工具
   * @param {IAnnotationTool} tool - 工具实例
   * @throws {Error} 如果工具未实现IAnnotationTool接口
   * @throws {Error} 如果工具名称已存在
   */
  register(tool) {
    // 验证工具接口
    validateAnnotationTool(tool);

    const name = tool.name;

    // 检查重复注册
    if (this.#tools.has(name)) {
      throw new Error(`Tool '${name}' is already registered`);
    }

    this.#tools.set(name, tool);
    this.#logger.info(`[ToolRegistry] Registered tool: ${name} (${tool.displayName})`);
  }

  /**
   * 获取工具实例
   * @param {string} name - 工具名称
   * @returns {IAnnotationTool|undefined} 工具实例，不存在则返回undefined
   */
  get(name) {
    return this.#tools.get(name);
  }

  /**
   * 获取所有工具实例
   * @returns {Array<IAnnotationTool>} 工具实例数组
   */
  getAll() {
    return Array.from(this.#tools.values());
  }

  /**
   * 获取所有工具名称
   * @returns {Array<string>} 工具名称数组
   */
  getAllNames() {
    return Array.from(this.#tools.keys());
  }

  /**
   * 检查工具是否已注册
   * @param {string} name - 工具名称
   * @returns {boolean} true表示已注册
   */
  has(name) {
    return this.#tools.has(name);
  }

  /**
   * 获取工具数量
   * @returns {number} 工具数量
   */
  getCount() {
    return this.#tools.size;
  }

  /**
   * 初始化所有工具
   * @param {Object} context - 上下文对象
   * @param {EventBus} context.eventBus - 事件总线
   * @param {Logger} context.logger - 日志器
   * @param {Object} context.pdfViewerManager - PDF查看器管理器
   * @param {Object} context.container - 依赖容器
   * @returns {Promise<void>}
   */
  async initializeAll(context) {
    if (this.#initialized) {
      this.#logger.warn('[ToolRegistry] Already initialized');
      return;
    }

    this.#logger.info(`[ToolRegistry] Initializing ${this.#tools.size} tools...`);

    const promises = [];

    for (const [name, tool] of this.#tools) {
      try {
        this.#logger.info(`[ToolRegistry] Initializing tool: ${name}`);
        const promise = tool.initialize(context);
        promises.push(promise);
      } catch (error) {
        this.#logger.error(`[ToolRegistry] Failed to initialize tool '${name}':`, error);
        throw error;
      }
    }

    await Promise.all(promises);

    this.#initialized = true;
    this.#logger.info('[ToolRegistry] All tools initialized');
  }

  /**
   * 激活工具
   *
   * 规则:
   * - 同一时间只能有一个工具激活
   * - 激活新工具前会自动停用当前工具
   * - 激活已激活的工具无效果
   *
   * @param {string} name - 工具名称
   * @throws {Error} 如果工具不存在
   * @throws {Error} 如果工具未初始化
   */
  activateTool(name) {
    if (!this.#initialized) {
      throw new Error('ToolRegistry not initialized. Call initializeAll() first');
    }

    // 检查工具是否存在
    const tool = this.#tools.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }

    // 如果工具已经激活，无需重复激活
    if (this.#activeTool === name && tool.isActive()) {
      this.#logger.debug(`[ToolRegistry] Tool '${name}' is already active`);
      return;
    }

    // 停用当前工具
    if (this.#activeTool) {
      this.deactivateCurrentTool();
    }

    // 激活新工具
    try {
      this.#logger.info(`[ToolRegistry] Activating tool: ${name}`);
      tool.activate();
      this.#activeTool = name;
      this.#logger.info(`[ToolRegistry] Tool '${name}' activated`);
    } catch (error) {
      this.#logger.error(`[ToolRegistry] Failed to activate tool '${name}':`, error);
      this.#activeTool = null;
      throw error;
    }
  }

  /**
   * 停用当前激活的工具
   */
  deactivateCurrentTool() {
    if (!this.#activeTool) {
      this.#logger.debug('[ToolRegistry] No active tool to deactivate');
      return;
    }

    const tool = this.#tools.get(this.#activeTool);
    if (!tool) {
      this.#logger.warn(`[ToolRegistry] Active tool '${this.#activeTool}' not found`);
      this.#activeTool = null;
      return;
    }

    try {
      this.#logger.info(`[ToolRegistry] Deactivating tool: ${this.#activeTool}`);
      tool.deactivate();
      this.#logger.info(`[ToolRegistry] Tool '${this.#activeTool}' deactivated`);
      this.#activeTool = null;
    } catch (error) {
      this.#logger.error(`[ToolRegistry] Failed to deactivate tool '${this.#activeTool}':`, error);
      this.#activeTool = null;
      throw error;
    }
  }

  /**
   * 停用所有工具
   */
  deactivateAll() {
    this.deactivateCurrentTool();
  }

  /**
   * 获取当前激活的工具名称
   * @returns {string|null} 工具名称，无激活工具则返回null
   */
  getActiveTool() {
    return this.#activeTool;
  }

  /**
   * 检查是否有工具激活
   * @returns {boolean} true表示有工具激活
   */
  hasActiveTool() {
    return this.#activeTool !== null;
  }

  /**
   * 销毁所有工具，清理资源
   */
  destroyAll() {
    this.#logger.info('[ToolRegistry] Destroying all tools...');

    // 先停用所有工具
    this.deactivateAll();

    // 销毁每个工具
    for (const [name, tool] of this.#tools) {
      try {
        this.#logger.info(`[ToolRegistry] Destroying tool: ${name}`);
        tool.destroy();
      } catch (error) {
        this.#logger.error(`[ToolRegistry] Failed to destroy tool '${name}':`, error);
      }
    }

    // 清空注册表
    this.#tools.clear();
    this.#activeTool = null;
    this.#initialized = false;

    this.#logger.info('[ToolRegistry] All tools destroyed');
  }

  /**
   * 创建所有工具的UI按钮
   * @returns {Array<HTMLElement>} 工具按钮数组
   */
  createAllToolButtons() {
    const buttons = [];

    for (const tool of this.#tools.values()) {
      try {
        const button = tool.createToolButton();
        buttons.push(button);
      } catch (error) {
        this.#logger.error(`[ToolRegistry] Failed to create button for tool '${tool.name}':`, error);
      }
    }

    return buttons;
  }

  /**
   * 获取注册表状态信息（用于调试）
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      toolCount: this.#tools.size,
      toolNames: this.getAllNames(),
      activeTool: this.#activeTool,
      initialized: this.#initialized
    };
  }
}

export default ToolRegistry;
