/**
 * PDF Translator Feature - PDF翻译功能
 * @module features/pdf-translator
 * @description 提供PDF文本翻译功能，支持多翻译引擎和Anki卡片集成
 */

import { getLogger } from '../../../common/utils/logger.js';
import { TranslatorSidebarUI } from './components/TranslatorSidebarUI.js';
import { TranslationService } from './services/TranslationService.js';
import { SelectionMonitor } from './services/SelectionMonitor.js';
import { PDF_TRANSLATOR_EVENTS } from './events.js';

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

  /** @type {SelectionMonitor} */
  #selectionMonitor;

  /** @type {Object} */
  #container;

  /** @type {string} */
  #targetLanguage = 'zh'; // 默认翻译为中文

  /** @type {Array<Function>} */
  #unsubs = [];

  /**
   * Feature名称
   * @returns {string}
   */
  get name() {
    return 'pdf-translator';
  }

  /**
   * 版本号
   * @returns {string}
   */
  get version() {
    return '1.0.0';
  }

  /**
   * 依赖的Features
   * @returns {string[]}
   */
  get dependencies() {
    return ['app-core', 'ui-manager'];  // 移除 sidebar-manager 避免循环依赖
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

    this.#logger = logger || getLogger('PDFTranslatorFeature');
    this.#logger.info(`[${this.name}] Installing (v${this.version})...`);

    // 获取事件总线
    this.#eventBus = globalEventBus;
    if (!this.#eventBus) {
      throw new Error(`[${this.name}] EventBus not found in context`);
    }

    this.#container = container;

    // 1. 创建翻译服务
    this.#translationService = new TranslationService({
      defaultEngine: 'mymemory',
      cacheConfig: {
        enabled: true,
        maxSize: 1000,
        ttl: 86400000 // 24小时
      }
    });
    this.#logger.info(`[${this.name}] Translation service initialized`);

    // 2. 创建文本选择监听器
    this.#selectionMonitor = new SelectionMonitor(this.#eventBus, {
      enabled: true,
      minLength: 3,
      maxLength: 500,
      debounceDelay: 300
    });
    this.#selectionMonitor.startMonitoring();
    this.#logger.info(`[${this.name}] Selection monitor started`);

    // 3. 创建侧边栏UI
    this.#sidebarUI = new TranslatorSidebarUI(this.#eventBus);
    this.#sidebarUI.initialize();
    this.#logger.info(`[${this.name}] Sidebar UI initialized`);

    // 4. 注册到全局容器（供SidebarManager使用）
    if (this.#container) {
      this.#container.registerGlobal('translatorSidebarUI', this.#sidebarUI);
      this.#container.registerGlobal('translationService', this.#translationService);
      this.#logger.info(`[${this.name}] Services registered to global container`);
    }

    // 5. 设置事件监听
    this.#setupEventListeners();

    this.#logger.info(`[${this.name}] Installation completed`);
  }

  /**
   * 卸载Feature
   * @returns {Promise<void>}
   */
  async uninstall() {
    this.#logger.info(`[${this.name}] Uninstalling...`);

    // 取消所有事件订阅
    this.#unsubs.forEach(unsub => {
      try {
        unsub();
      } catch (error) {
        this.#logger.warn('Failed to unsubscribe:', error);
      }
    });
    this.#unsubs = [];

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

    // 销毁侧边栏UI
    if (this.#sidebarUI) {
      this.#sidebarUI.destroy();
      this.#sidebarUI = null;
    }

    // 注意：SimpleDependencyContainer 没有 unregister 方法
    // 服务会在容器 dispose 时自动清理

    this.#logger.info(`[${this.name}] Uninstalled`);
  }

  /**
   * 设置事件监听
   * @private
   */
  #setupEventListeners() {
    // 1. 监听文本选择事件 - 触发翻译
    this.#unsubs.push(
      this.#eventBus.on(
        PDF_TRANSLATOR_EVENTS.TEXT.SELECTED,
        (data) => this.#handleTextSelected(data),
        { subscriberId: 'PDFTranslatorFeature' }
      )
    );

    // 2. 监听翻译引擎切换事件
    this.#unsubs.push(
      this.#eventBus.on(
        PDF_TRANSLATOR_EVENTS.ENGINE.CHANGED,
        (data) => this.#handleEngineChanged(data),
        { subscriberId: 'PDFTranslatorFeature' }
      )
    );

    // 3. 监听翻译请求事件（手动触发）
    this.#unsubs.push(
      this.#eventBus.on(
        PDF_TRANSLATOR_EVENTS.TRANSLATE.REQUESTED,
        (data) => this.#handleTranslateRequested(data),
        { subscriberId: 'PDFTranslatorFeature' }
      )
    );

    this.#logger.info(`[${this.name}] Event listeners setup completed`);
  }

  /**
   * 处理文本选择事件
   * @private
   * @param {Object} data - 选择数据
   */
  async #handleTextSelected(data) {
    const { text, pageNumber, position, rangeData } = data;
    this.#logger.info(`Text selected on page ${pageNumber}: "${text.substring(0, 50)}..."`);

    // 自动触发翻译（传递位置信息和Range数据）
    await this.#translateText(text, null, 'auto', { pageNumber, position, rangeData });
  }

  /**
   * 处理翻译引擎切换
   * @private
   * @param {Object} data - 引擎数据
   */
  #handleEngineChanged(data) {
    const { engine } = data;
    this.#logger.info(`Switching to translation engine: ${engine}`);

    if (this.#translationService) {
      const success = this.#translationService.setEngine(engine);
      if (!success) {
        this.#logger.error(`Failed to switch to engine: ${engine}`);
        // 发送失败事件
        this.#eventBus.emit(
          PDF_TRANSLATOR_EVENTS.ENGINE.CHANGED,
          { engine, success: false, error: 'Engine not found' }
        );
      }
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

    await this.#translateText(text, targetLang, sourceLang, { pageNumber, position });
  }

  /**
   * 执行翻译
   * @private
   * @param {string} text - 要翻译的文本
   * @param {string} [targetLang] - 目标语言
   * @param {string} [sourceLang='auto'] - 源语言
   * @param {Object} [context] - 上下文信息（pageNumber, position等）
   */
  async #translateText(text, targetLang, sourceLang = 'auto', context = {}) {
    try {
      // 使用默认目标语言（如果未指定）
      const target = targetLang || this.#targetLanguage;

      // 发送翻译开始事件
      this.#eventBus.emit(
        PDF_TRANSLATOR_EVENTS.TRANSLATE.STARTED,
        { text, targetLang: target, sourceLang, ...context },
        { actorId: 'PDFTranslatorFeature' }
      );

      // 调用翻译服务
      const result = await this.#translationService.translate(text, target, sourceLang);

      // 合并上下文信息到结果中
      const resultWithContext = {
        ...result,
        ...context
      };

      // 发送翻译完成事件
      this.#eventBus.emit(
        PDF_TRANSLATOR_EVENTS.TRANSLATE.COMPLETED,
        resultWithContext,
        { actorId: 'PDFTranslatorFeature' }
      );

      this.#logger.info('Translation completed:', resultWithContext);

    } catch (error) {
      this.#logger.error('Translation failed:', error);

      // 发送翻译失败事件
      this.#eventBus.emit(
        PDF_TRANSLATOR_EVENTS.TRANSLATE.FAILED,
        {
          text,
          targetLang: targetLang || this.#targetLanguage,
          sourceLang,
          error: error.message,
          ...context
        },
        { actorId: 'PDFTranslatorFeature' }
      );
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
