/**
 * 翻译侧边栏UI组件
 * @file 渲染翻译侧边栏界面，显示翻译结果和历史记录
 * @module TranslatorSidebarUI
 * 详细说明：`docs/standards/pdf-translator-sidebar.md`
 */

import { getLogger } from "../../../../common/utils/logger.js";
import { createSubscriptionBag } from "../../../../common/ws/ws-subscription-bag.js";
import { createSidebarRoot } from "../../../shared/sidebar-shell.js";
import { showError } from "../../../../common/utils/notification.js";

import { PDF_TRANSLATOR_EVENTS } from "../events.js";

import { prependTranslationHistory } from "./translator-history.js";
import { createTranslatorSidebarActions } from "./translator-sidebar-actions.js";
import { bindTranslatorSidebarDom } from "./translator-sidebar-dom-bindings.js";
import { renderTranslatorError, renderTranslatorSidebar } from "./translator-sidebar-renderer.js";

/**
 * 翻译侧边栏UI类
 * @class TranslatorSidebarUI
 */
export class TranslatorSidebarUI {
  #eventBus;
  #logger;
  #contentElement;
  #currentTranslation = null;
  #translationHistory = [];
  #subscriptions;
  #actions;
  #domBindTimerId = null;

  /**
   * 构造函数
   * @param {EventBus} eventBus - 事件总线
   * @param {Object} options - 配置选项
   */
  constructor(eventBus, options = {}) {
    if (!eventBus) {
      throw new Error("[TranslatorSidebarUI] constructor: eventBus is required");
    }

    this.#eventBus = eventBus;
    this.#logger = getLogger("TranslatorSidebarUI");
    this.#contentElement = null;
    this.#subscriptions = createSubscriptionBag({ loggerName: "TranslatorSidebarUI" });
    this.#actions = createTranslatorSidebarActions({ eventBus: this.#eventBus, logger: this.#logger });
  }

  /**
   * 初始化侧边栏
   */
  initialize() {
    this.#logger.info("Initializing TranslatorSidebarUI...");

    this.#contentElement = createSidebarRoot({
      className: "translator-sidebar-content",
      extraStyle: [
        "overflow-y:auto",
        "padding:16px",
        "font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif"
      ].join(";")
    });

    this.#render();
    this.#setupEventListeners();

    this.#logger.info("TranslatorSidebarUI initialized");
  }

  /**
   * 获取内容元素（供SidebarManager使用）
   * @returns {HTMLElement} 内容元素
   */
  getContentElement() {
    return this.#contentElement;
  }

  /**
   * 销毁组件
   */
  destroy() {
    this.#logger.info("Destroying TranslatorSidebarUI...");

    if (this.#domBindTimerId !== null) {
      clearTimeout(this.#domBindTimerId);
      this.#domBindTimerId = null;
    }

    this.#subscriptions?.clear();

    if (this.#contentElement?.parentNode) {
      this.#contentElement.parentNode.removeChild(this.#contentElement);
    }

    this.#contentElement = null;
    this.#currentTranslation = null;
    this.#translationHistory = [];
    this.#actions = null;

    this.#logger.info("TranslatorSidebarUI destroyed");
  }

  #setupEventListeners() {
    this.#subscriptions.add(
      this.#eventBus.on(
        PDF_TRANSLATOR_EVENTS.TRANSLATE.COMPLETED,
        (data) => this.#handleTranslationCompleted(data),
        { subscriberId: "TranslatorSidebarUI" }
      )
    );

    this.#subscriptions.add(
      this.#eventBus.on(
        PDF_TRANSLATOR_EVENTS.TRANSLATE.FAILED,
        (data) => this.#handleTranslationFailed(data),
        { subscriberId: "TranslatorSidebarUI" }
      )
    );
  }

  #render() {
    if (!this.#contentElement) {
      throw new Error("[TranslatorSidebarUI] render: content element is not initialized");
    }

    renderTranslatorSidebar({
      rootElement: this.#contentElement,
      translationHistory: this.#translationHistory,
      currentTranslation: this.#currentTranslation,
      onEngineChanged: (engine) => this.#handleEngineChanged(engine)
    });

    this.#scheduleDomBindings();
  }

  #scheduleDomBindings() {
    if (!this.#contentElement) {return;}

    if (this.#domBindTimerId !== null) {
      clearTimeout(this.#domBindTimerId);
    }

    this.#domBindTimerId = setTimeout(() => {
      this.#domBindTimerId = null;
      if (!this.#contentElement) {return;}

      bindTranslatorSidebarDom({
        rootElement: this.#contentElement,
        currentTranslation: this.#currentTranslation,
        translationHistory: this.#translationHistory,
        actions: this.#actions,
        onSelectHistoryIndex: (index) => this.#selectHistoryIndex(index)
      });
    }, 0);
  }

  #selectHistoryIndex(index) {
    const item = this.#translationHistory[index];
    if (!item) {return;}
    this.#currentTranslation = item;
    this.#render();
  }

  #handleEngineChanged(engine) {
    this.#eventBus.emit(PDF_TRANSLATOR_EVENTS.ENGINE.CHANGED, { engine });
    this.#logger.info(`Translation engine changed to: ${engine}`);
  }

  #handleTranslationCompleted(data) {
    this.#logger.info("Translation completed:", data);

    const result = prependTranslationHistory(this.#translationHistory, data);
    this.#currentTranslation = result.currentTranslation;
    this.#translationHistory = result.history;

    this.#render();
  }

  #handleTranslationFailed(data) {
    this.#logger.error("Translation failed:", data);
    if (!this.#contentElement) {return;}

    const errorMessage =
      typeof data?.error === "string"
        ? data.error
        : (data?.error ? String(data.error) : "未知错误");

    showError(errorMessage);

    renderTranslatorError({
      rootElement: this.#contentElement,
      errorMessage
    });
  }
}
