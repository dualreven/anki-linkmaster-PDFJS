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

import { createTranslatorSidebarActions } from "./translator-sidebar-actions.js";
import { bindTranslatorSidebarDom } from "./translator-sidebar-dom-bindings.js";
import { renderTranslatorError, renderTranslatorSidebar } from "./translator-sidebar-renderer.js";

/**
 * 翻译侧边栏UI类
 * @class TranslatorSidebarUI
 */
export class TranslatorSidebarUI {
  #eventBus;
  #manager;
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
    if (!options?.manager || typeof options.manager !== "object") {
      throw new Error("[TranslatorSidebarUI] constructor: options.manager is required");
    }
    if (!options.manager.store || typeof options.manager.store.subscribe !== "function" || typeof options.manager.store.get !== "function") {
      throw new Error("[TranslatorSidebarUI] constructor: manager.store is required");
    }
    if (typeof options.getCurrentPageNumber !== "function") {
      throw new Error("[TranslatorSidebarUI] constructor: options.getCurrentPageNumber is required");
    }

    this.#eventBus = eventBus;
    this.#manager = options.manager;
    this.#logger = getLogger("TranslatorSidebarUI");
    this.#contentElement = null;
    this.#subscriptions = createSubscriptionBag({ loggerName: "TranslatorSidebarUI" });
    this.#actions = createTranslatorSidebarActions({
      eventBus: this.#eventBus,
      logger: this.#logger,
      getCurrentPageNumber: options.getCurrentPageNumber
    });
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

    // Subscribe store -> UI (Manager + Store pattern)
    this.#subscriptions.add(this.#manager.store.subscribe((state, oldState) => {
      this.#currentTranslation = state.currentTranslation ?? null;
      this.#translationHistory = Array.isArray(state.translationHistory) ? state.translationHistory : [];

      if (!oldState || state.error !== oldState.error) {
        if (state.error) {
          showError(String(state.error));
        }
      }

      this.#render(state);
    }, { fireImmediately: true }));

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
    this.#manager = null;

    this.#logger.info("TranslatorSidebarUI destroyed");
  }

  #render(state = null) {
    if (!this.#contentElement) {
      throw new Error("[TranslatorSidebarUI] render: content element is not initialized");
    }

    renderTranslatorSidebar({
      rootElement: this.#contentElement,
      translationHistory: this.#translationHistory,
      currentTranslation: this.#currentTranslation,
      onEngineChanged: (engine) => this.#handleEngineChanged(engine)
    });

    if (state?.error) {
      renderTranslatorError({
        rootElement: this.#contentElement,
        errorMessage: String(state.error)
      });
    }

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
}
