/**
 * PDF Translator Feature - PDF翻译功能
 * @module features/pdf-translator
 * @description 提供PDF文本翻译功能，支持多翻译引擎和Anki卡片集成
 */

import { getLogger } from "../../../common/utils/logger.js";
import { TranslatorSidebarUI } from "./components/TranslatorSidebarUI.js";
import { TranslationService } from "./services/TranslationService.js";
import { SelectionMonitor } from "./services/SelectionMonitor.js";
import { TranslatorManager } from "./core/translator-manager.js";
import { PDF_TRANSLATOR_EVENTS } from "./events.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { createSubscriptionBag } from "../../../common/event/subscription-bag.js";

/**
 * PDF翻译功能Feature
 * @class PDFTranslatorFeature
 * @implements {IFeature}
 */
export class PDFTranslatorFeature {
  /** @type {Logger} */
  #logger;

  /** @type {EventBus} */
  #eventBus;

  /** @type {TranslatorSidebarUI} */
  #sidebarUI;

  /** @type {TranslationService} */
  #translationService;

  /** @type {TranslatorManager} */
  #translatorManager;

  /** @type {SelectionMonitor} */
  #selectionMonitor;

  /** @type {Object} */
  #container;

  /** @type {string} */
  #targetLanguage = "zh"; // 默认翻译为中文

  #subscriptions = createSubscriptionBag({ loggerName: "PDFTranslatorFeature" });

  /**
   * Feature名称
   * @returns {string}
   */
  get name() {
    return "pdf-translator";
  }

  /**
   * 版本号
   * @returns {string}
   */
  get version() {
    return "1.0.0";
  }

  /**
   * 依赖的Features
   * @returns {string[]}
   */
  get dependencies() {
    return ["infra-app", "infra-ui"];  // 移除 sidebar-manager 避免循环依赖
  }

  /**
   * 安装Feature
   * @param {Object} context - Feature上下文
   * @param {EventBus} context.globalEventBus - 全局事件总线
   * @param {Logger} context.logger - 日志记录器
   * @param {Object} context.container - 依赖容器
   * @returns {Promise<void>}
   */
  async install(context) {
    const { globalEventBus, logger, container } = context;

    this.#logger = logger || getLogger("PDFTranslatorFeature");
    this.#logger.info(`[${this.name}] Installing (v${this.version})...`);

    // 获取事件总线
    this.#eventBus = globalEventBus;
    if (!this.#eventBus) {
      throw new Error(`[${this.name}] EventBus not found in context`);
    }

    this.#container = container;

    // 1. 创建翻译服务
    this.#translationService = new TranslationService({
      defaultEngine: "mymemory",
      cacheConfig: {
        enabled: true,
        maxSize: 1000,
        ttl: 86400000 // 24小时
      }
    });
    this.#logger.info(`[${this.name}] Translation service initialized`);

    // 2. 创建文本选择监听器（传入container以使用依赖注入）
    this.#selectionMonitor = new SelectionMonitor(this.#eventBus, this.#container, {
      // 默认关闭自动翻译：仅在“翻译侧边栏打开”或“点击翻译按钮”时触发
      enabled: false,
      minLength: 3,
      maxLength: 500,
      debounceDelay: 300
    });
    // 不在安装阶段启动监听器；由侧边栏开/关事件控制
    this.#logger.info(`[${this.name}] Selection monitor initialized (disabled by default)`);

    // 3. 创建侧边栏UI
    this.#translatorManager = new TranslatorManager({
      eventBus: this.#eventBus,
      logger: this.#logger,
      translationService: this.#translationService,
      targetLanguage: this.#targetLanguage
    });

    this.#sidebarUI = new TranslatorSidebarUI(this.#eventBus, {
      manager: this.#translatorManager,
      getCurrentPageNumber: () => {
        const mgr = this.#container?.get?.("pdfViewerManager");
        const n = mgr?.currentPageNumber;
        if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) {
          throw new Error("[PDFTranslatorFeature] pdfViewerManager.currentPageNumber is invalid");
        }
        return n;
      }
    });
    this.#sidebarUI.initialize();
    this.#logger.info(`[${this.name}] Sidebar UI initialized`);

    // 4. 注册到全局容器（供SidebarManager使用）
    if (this.#container) {
      this.#container.registerGlobal("translatorSidebarUI", this.#sidebarUI);
      this.#container.registerGlobal("translationService", this.#translationService);
      this.#container.registerGlobal("translatorManager", this.#translatorManager);
      this.#logger.info(`[${this.name}] Services registered to global container`);
    }

    // 5. 设置事件监听
    this.#setupEventListeners();

    // 6. 绑定侧边栏开关与自动翻译启停
    this.#bindSidebarAutoTranslateToggle();

    this.#logger.info(`[${this.name}] Installation completed`);
  }

  /**
   * 卸载Feature
   * @returns {Promise<void>}
   */
  async uninstall() {
    this.#logger.info(`[${this.name}] Uninstalling...`);

    // 取消所有事件订阅
    this.#subscriptions.clear();

    // 停止文本选择监听
    if (this.#selectionMonitor) {
      this.#selectionMonitor.destroy();
      this.#selectionMonitor = null;
    }

    // 销毁翻译服务
    if (this.#translationService) {
      this.#translationService.destroy();
      this.#translationService = null;
    }

    if (this.#translatorManager) {
      this.#translatorManager.destroy();
      this.#translatorManager = null;
    }

    // 销毁侧边栏UI
    if (this.#sidebarUI) {
      this.#sidebarUI.destroy();
      this.#sidebarUI = null;
    }

    // 注意：DependencyContainer 没有 unregister 方法
    // 服务会在容器 dispose 时自动清理

    this.#logger.info(`[${this.name}] Uninstalled`);
  }

  /**
   * 设置事件监听
   * @private
   */
  #setupEventListeners() {
    // 1. 监听文本选择事件 - 触发翻译
    this.#subscriptions.add(this.#eventBus.on(
      PDF_TRANSLATOR_EVENTS.TEXT.SELECTED,
      (data) => this.#handleTextSelected(data),
      { subscriberId: "PDFTranslatorFeature" }
    ));

    // 2. 监听翻译引擎切换事件
    this.#subscriptions.add(this.#eventBus.on(
      PDF_TRANSLATOR_EVENTS.ENGINE.CHANGED,
      (data) => this.#handleEngineChanged(data),
      { subscriberId: "PDFTranslatorFeature" }
    ));

    // 3. 监听翻译请求事件（手动触发）
    this.#subscriptions.add(this.#eventBus.on(
      PDF_TRANSLATOR_EVENTS.TRANSLATE.REQUESTED,
      (data) => this.#handleTranslateRequested(data),
      { subscriberId: "PDFTranslatorFeature" }
    ));

    this.#logger.info(`[${this.name}] Event listeners setup completed`);
  }

  /**
   * 绑定侧边栏开关与自动翻译启停（仅当翻译侧边栏打开时，才允许“划词自动翻译”）
   * 同时发布领域内的 OPENED/CLOSED 事件，便于其他组件感知。
   * @private
   */
  #bindSidebarAutoTranslateToggle() {
    // 侧边栏打开 -> 启用 SelectionMonitor
    this.#subscriptions.add(this.#eventBus.on(
      PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPENED_COMPLETED,
      ({ sidebarId }) => {
        if (sidebarId === "translate") {
          try {
            this.#selectionMonitor?.setEnabled(true);
            // 避免复用上一次选择导致的误触发
            this.#selectionMonitor?.clearLastSelection?.();
            this.#translatorManager?.setAutoEnabled(true);
            // 广播领域事件
            this.#eventBus.emitGlobal(PDF_TRANSLATOR_EVENTS.SIDEBAR.OPENED, { sidebarId: "translate" }, { actorId: "PDFTranslatorFeature" });
            this.#logger.info("[PDFTranslator] Auto-translate enabled because translate sidebar opened");
          } catch (e) {
            this.#logger.warn("[PDFTranslator] Failed to enable SelectionMonitor on sidebar open", e);
          }
        }
      },
      { subscriberId: "PDFTranslatorFeature" }
    ));

    // 侧边栏关闭 -> 禁用 SelectionMonitor
    this.#subscriptions.add(this.#eventBus.on(
      PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.CLOSED_COMPLETED,
      ({ sidebarId }) => {
        if (sidebarId === "translate") {
          try {
            this.#selectionMonitor?.setEnabled(false);
            this.#selectionMonitor?.clearLastSelection?.();
            this.#translatorManager?.setAutoEnabled(false);
            this.#eventBus.emitGlobal(PDF_TRANSLATOR_EVENTS.SIDEBAR.CLOSED, { sidebarId: "translate" }, { actorId: "PDFTranslatorFeature" });
            this.#logger.info("[PDFTranslator] Auto-translate disabled because translate sidebar closed");
          } catch (e) {
            this.#logger.warn("[PDFTranslator] Failed to disable SelectionMonitor on sidebar close", e);
          }
        }
      },
      { subscriberId: "PDFTranslatorFeature" }
    ));
  }

  /**
   * 处理文本选择事件
   * @private
   * @param {Object} data - 选择数据
   */
  async #handleTextSelected(data) {
    const { text, pageNumber, position, rangeData, source } = data || {};

    // 仅在以下两种场景触发翻译：
    // 1) 用户显式点击了“翻译”动作（来源：quick-actions 或 text-highlight）
    // 2) 翻译侧边栏已打开（SelectionMonitor 启用状态）
    const isExplicitUserAction = source === "quick-actions" || source === "text-highlight";
    const isAutoModeEnabled = !!this.#selectionMonitor?.isEnabled?.();
    if (!isExplicitUserAction && !isAutoModeEnabled) {
      this.#logger.info("[PDFTranslator] Ignore TEXT.SELECTED because auto-translate is disabled and no explicit user action");
      return;
    }

    this.#logger.info(`Text selected on page ${pageNumber}: "${(text || "").substring(0, 50)}..."`, {
      source: source || "unknown",
      autoEnabled: isAutoModeEnabled
    });

    // 自动触发翻译（传递位置信息和Range数据）
    try {
      await this.#translatorManager.translateText(text, null, "auto", { pageNumber, position, rangeData });
    } catch {
      // 错误已由 manager 写入 store 并 emit FAILED；这里仅防止未处理 Promise
    }
  }

  /**
   * 处理翻译引擎切换
   * @private
   * @param {Object} data - 引擎数据
   */
  #handleEngineChanged(data) {
    const { engine } = data;
    this.#logger.info(`Switching to translation engine: ${engine}`);

    const ok = this.#translatorManager?.setEngine(engine);
    if (!ok) {
      this.#logger.error(`Failed to switch to engine: ${engine}`);
    }
  }

  /**
   * 处理手动翻译请求
   * @private
   * @param {Object} data - 翻译请求数据
   */
  async #handleTranslateRequested(data) {
    const { text, targetLang, sourceLang, pageNumber, position } = data;
    this.#logger.info(`Manual translation requested: "${text.substring(0, 50)}..."`);

    try {
      await this.#translatorManager.translateText(text, targetLang, sourceLang, { pageNumber, position });
    } catch {
      // 错误已由 manager 写入 store 并 emit FAILED；这里仅防止未处理 Promise
    }
  }

  /**
   * 获取侧边栏UI实例
   * @returns {TranslatorSidebarUI}
   */
  getSidebarUI() {
    return this.#sidebarUI;
  }
}
