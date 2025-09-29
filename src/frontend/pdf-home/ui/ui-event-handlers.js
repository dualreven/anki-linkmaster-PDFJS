/**
 * @file UI事件处理器集合，基于组合模式重构
 * @module UIEventHandlers
 * @description 使用专门的事件处理器模块来管理不同类型的UI事件
 */

import { getLogger } from "../../common/utils/logger.js";
import { ButtonEventHandler } from "./handlers/button-event-handler.js";
import { KeyboardEventHandler } from "./handlers/keyboard-event-handler.js";
import { TableEventHandler } from "./handlers/table-event-handler.js";
import { QWebChannelEventHandler } from "./handlers/qwebchannel-event-handler.js";
import { UIResponseHandler } from "./handlers/ui-response-handler.js";

/**
 * UI事件处理器类 - 组合模式
 * @class UIEventHandlers
 * @description 整合多个专门的事件处理器，提供统一的接口
 */
export class UIEventHandlers {
  #eventBus;
  #logger;
  #elements;
  #stateManager;

  // 专门的事件处理器
  #buttonHandler;
  #keyboardHandler;
  #tableHandler;
  #qwebchannelHandler;
  #uiResponseHandler;

  constructor(eventBus, elements, stateManager) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("UIEventHandlers");
    this.#elements = elements;
    this.#stateManager = stateManager;

    // 初始化各个专门的处理器
    this.#initializeHandlers();
  }

  /**
   * 初始化各个专门的处理器
   * @private
   */
  #initializeHandlers() {
    this.#buttonHandler = new ButtonEventHandler(this.#eventBus, this.#elements, this.#stateManager);
    this.#keyboardHandler = new KeyboardEventHandler(this.#eventBus, this.#elements);
    this.#tableHandler = new TableEventHandler(this.#eventBus, this.#elements);
    this.#qwebchannelHandler = new QWebChannelEventHandler(this.#eventBus);
    this.#uiResponseHandler = new UIResponseHandler(this.#eventBus, this.#stateManager);

    this.#logger.info("All event handlers initialized with modular architecture");
  }

  /**
   * 设置所有事件监听器
   */
  setupEventListeners() {
    this.#logger.info("Setting up all event listeners using modular handlers");

    this.#buttonHandler.setupEventListeners();
    this.#keyboardHandler.setupEventListeners();
    this.#tableHandler.setupEventListeners();
    this.#qwebchannelHandler.setupEventListeners();
    this.#uiResponseHandler.setupEventListeners();

    this.#logger.info("All event listeners setup completed");
  }

  /**
   * 清理所有事件监听器
   */
  destroy() {
    this.#logger.info("Destroying UIEventHandlers and all sub-handlers.");

    // 销毁所有专门的处理器
    if (this.#buttonHandler) {
      this.#buttonHandler.destroy();
      this.#buttonHandler = null;
    }
    if (this.#keyboardHandler) {
      this.#keyboardHandler.destroy();
      this.#keyboardHandler = null;
    }
    if (this.#tableHandler) {
      this.#tableHandler.destroy();
      this.#tableHandler = null;
    }
    if (this.#qwebchannelHandler) {
      this.#qwebchannelHandler.destroy();
      this.#qwebchannelHandler = null;
    }
    if (this.#uiResponseHandler) {
      this.#uiResponseHandler.destroy();
      this.#uiResponseHandler = null;
    }

    this.#logger.info("All event handlers destroyed successfully");
  }

  /**
   * 获取处理器状态信息（用于调试）
   * @returns {Object} 处理器状态
   */
  getHandlerStatus() {
    return {
      buttonHandler: this.#buttonHandler !== null,
      keyboardHandler: this.#keyboardHandler !== null,
      tableHandler: this.#tableHandler !== null,
      qwebchannelHandler: this.#qwebchannelHandler !== null,
      uiResponseHandler: this.#uiResponseHandler !== null,
      totalHandlers: 5,
      architecture: 'modular-composition'
    };
  }
}