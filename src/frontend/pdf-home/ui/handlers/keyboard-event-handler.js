/**
 * @file 键盘事件处理器
 * @module KeyboardEventHandler
 * @description 专门处理键盘快捷键事件
 */

import { DOMUtils } from "../../../common/utils/dom-utils.js";
import { PDF_MANAGEMENT_EVENTS } from "../../../common/event/event-constants.js";
import { getLogger } from "../../../common/utils/logger.js";

/**
 * 键盘事件处理器类
 * @class KeyboardEventHandler
 */
export class KeyboardEventHandler {
  #eventBus;
  #logger;
  #elements;
  #unsubscribeFunctions = [];

  /**
   * 构造函数
   * @param {Object} eventBus - 事件总线
   * @param {Object} elements - DOM元素引用
   */
  constructor(eventBus, elements) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("KeyboardEventHandler");
    this.#elements = elements;
  }

  /**
   * 设置键盘事件监听器
   */
  setupEventListeners() {
    this.#setupGlobalKeyboardShortcuts();
  }

  /**
   * 清理所有事件监听器
   */
  destroy() {
    this.#logger.info("Destroying KeyboardEventHandler and cleaning up listeners.");
    this.#unsubscribeFunctions.forEach((unsub) => unsub());
    this.#unsubscribeFunctions = [];
  }

  /**
   * 设置全局键盘快捷键
   * @private
   */
  #setupGlobalKeyboardShortcuts() {
    const handleKeyDown = (event) => {
      // Ctrl+D：切换调试状态
      if (event.ctrlKey && event.key === "d") {
        event.preventDefault();
        this.#toggleDebugStatus();
      }
      // Ctrl+N：添加新PDF
      if (event.ctrlKey && event.key === "n") {
        event.preventDefault();
        this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, undefined, {
          actorId: 'KeyboardEventHandler'
        });
      }
    };

    DOMUtils.addEventListener(document, "keydown", handleKeyDown);
    this.#unsubscribeFunctions.push(() =>
      DOMUtils.removeEventListener(document, "keydown", handleKeyDown)
    );
  }

  /**
   * 切换调试状态显示
   * @private
   */
  #toggleDebugStatus() {
    if (this.#elements.debugStatus) {
      const isVisible = DOMUtils.isVisible(this.#elements.debugStatus);
      if (isVisible) {
        DOMUtils.hide(this.#elements.debugStatus);
      } else {
        DOMUtils.show(this.#elements.debugStatus);
        // 触发调试状态更新事件
        this.#eventBus.emit('ui:debug:toggle', { visible: true }, {
          actorId: 'KeyboardEventHandler'
        });
      }
    }
  }
}