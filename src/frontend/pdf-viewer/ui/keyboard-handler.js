/**
 * @file 键盘事件处理器
 * @module KeyboardHandler
 * @description 处理PDF查看器的所有键盘交互
 */

import { getLogger } from "../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";

/**
 * 键盘事件处理器类
 * 负责处理所有键盘快捷键和键盘导航
 */
export class KeyboardHandler {
  #logger;
  #eventBus;
  #enabled = true;
  #keyBindings = {};
  #domEventHub = null;
  #keydownUnsubscribe = null;
  #documentListenerAttached = false;
  #attachedDomEventHub = null;
  #handleKeyDownBound;

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("UIManager.Keyboard");
    this.#handleKeyDownBound = this.#handleKeyDown.bind(this);
    this.#initializeKeyBindings();
  }

  /**
   * 初始化默认键盘绑定
   * @private
   */
  #initializeKeyBindings() {
    // 导航快捷键
    this.#keyBindings["ArrowLeft"] = () => this.#navigatePage("previous");
    this.#keyBindings["ArrowRight"] = () => this.#navigatePage("next");
    this.#keyBindings["PageUp"] = () => this.#navigatePage("previous");
    this.#keyBindings["PageDown"] = () => this.#navigatePage("next");
    this.#keyBindings["Home"] = () => this.#navigatePage("first");
    this.#keyBindings["End"] = () => this.#navigatePage("last");

    // 缩放快捷键（需要Ctrl/Cmd）
    this.#keyBindings["ctrl+0"] = () => this.#setZoom("actual");
    this.#keyBindings["ctrl+="] = () => this.#adjustZoom("in");
    this.#keyBindings["ctrl+-"] = () => this.#adjustZoom("out");

    // 其他功能键
    this.#keyBindings["Escape"] = () => this.#exitFullscreen();
    this.#keyBindings["F11"] = () => this.#toggleFullscreen();
    this.#keyBindings["ctrl+f"] = () => this.#openSearch();
    this.#keyBindings["ctrl+p"] = () => this.#print();
  }

  /**
   * 设置键盘事件监听
   */
  setupEventListener(domEventHub) {
    if (domEventHub) {
      this.#domEventHub = domEventHub;
    }

    if (this.#domEventHub && typeof this.#domEventHub.onDocumentKeydown === "function") {
      // 幂等：同一个 DomEventHub 已注册则不重复注册
      if (this.#keydownUnsubscribe && this.#attachedDomEventHub === this.#domEventHub && !this.#documentListenerAttached) {
        return;
      }

      // 切换模式：先清理 document 监听（如果之前走 document.addEventListener）
      if (this.#documentListenerAttached) {
        document.removeEventListener("keydown", this.#handleKeyDownBound);
        this.#documentListenerAttached = false;
      }

      // 清理旧的 DomEventHub 订阅
      if (this.#keydownUnsubscribe) {
        this.#keydownUnsubscribe();
        this.#keydownUnsubscribe = null;
      }

      this.#keydownUnsubscribe = this.#domEventHub.onDocumentKeydown(this.#handleKeyDownBound);
      this.#attachedDomEventHub = this.#domEventHub;
      this.#logger.info("Keyboard event listener setup via DomEventHub");
      return;
    }

    // 使用 document：若之前走 DomEventHub，必须先解绑；重复 setup 不应重复 add
    if (this.#keydownUnsubscribe) {
      this.#keydownUnsubscribe();
      this.#keydownUnsubscribe = null;
      this.#attachedDomEventHub = null;
    }

    if (this.#documentListenerAttached) {
      return;
    }

    document.addEventListener("keydown", this.#handleKeyDownBound);
    this.#documentListenerAttached = true;
    this.#logger.info("Keyboard event listener setup");
  }

  /**
   * 移除键盘事件监听
   */
  removeEventListener() {
    if (this.#keydownUnsubscribe) {
      this.#keydownUnsubscribe();
      this.#keydownUnsubscribe = null;
      this.#attachedDomEventHub = null;
      this.#logger.info("Keyboard event listener removed via DomEventHub");
    }

    if (this.#documentListenerAttached) {
      document.removeEventListener("keydown", this.#handleKeyDownBound);
      this.#documentListenerAttached = false;
      this.#logger.info("Keyboard event listener removed");
    }
  }

  /**
   * 处理键盘按下事件
   * @param {KeyboardEvent} event - 键盘事件
   * @private
   */
  #handleKeyDown(event) {
    // 如果处理器被禁用或焦点在输入框中，不处理
    if (!this.#enabled || this.#isInputFocused(event)) {
      return;
    }

    // 构建键组合字符串
    const keyCombo = this.#buildKeyCombo(event);

    // 查找并执行对应的处理函数
    const handler = this.#keyBindings[keyCombo];
    if (handler) {
      event.preventDefault();
      handler();
      this.#logger.debug(`Handled key combo: ${keyCombo}`);
    }
  }

  /**
   * 检查焦点是否在输入框中
   * @param {KeyboardEvent} event - 键盘事件
   * @returns {boolean}
   * @private
   */
  #isInputFocused(event) {
    const target = event.target;
    return target.tagName === "INPUT" ||
           target.tagName === "TEXTAREA" ||
           target.contentEditable === "true";
  }

  /**
   * 构建键组合字符串
   * @param {KeyboardEvent} event - 键盘事件
   * @returns {string} 键组合字符串
   * @private
   */
  #buildKeyCombo(event) {
    const parts = [];

    if (event.ctrlKey || event.metaKey) {parts.push("ctrl");}
    if (event.altKey) {parts.push("alt");}
    if (event.shiftKey) {parts.push("shift");}

    // 特殊键映射
    const key = event.key === "+" ? "=" : event.key;
    parts.push(key);

    return parts.join("+");
  }

  /**
   * 页面导航
   * @param {string} direction - 导航方向
   * @private
   */
  #navigatePage(direction) {
    if (direction === "previous") {
      this.#eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.PREVIOUS, {}, { actorId: "KeyboardHandler" });
      this.#logger.info("Navigate: previous");
      return;
    }
    if (direction === "next") {
      this.#eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.NEXT, {}, { actorId: "KeyboardHandler" });
      this.#logger.info("Navigate: next");
      return;
    }
    if (direction === "first") {
      this.#eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.FIRST, {}, { actorId: "KeyboardHandler" });
      this.#logger.info("Navigate: first");
      return;
    }
    if (direction === "last") {
      this.#eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.LAST, {}, { actorId: "KeyboardHandler" });
      this.#logger.info("Navigate: last");
    }
  }

  /**
   * 调整缩放
   * @param {string} direction - in/out
   * @private
   */
  #adjustZoom(direction) {
    if (direction === "in") {
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.IN, {}, { actorId: "KeyboardHandler" });
      this.#logger.info("Zoom in");
    } else {
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.OUT, {}, { actorId: "KeyboardHandler" });
      this.#logger.info("Zoom out");
    }
  }

  /**
   * 设置缩放级别
   * @param {string} level - actual/width/height
   * @private
   */
  #setZoom(level) {
    if (level === "actual") {
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.ACTUAL_SIZE, {}, { actorId: "KeyboardHandler" });
      this.#logger.info("Set zoom: actual");
      return;
    }
    if (level === "width") {
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.FIT_WIDTH, {}, { actorId: "KeyboardHandler" });
      this.#logger.info("Set zoom: width");
      return;
    }
    if (level === "height") {
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.FIT_HEIGHT, {}, { actorId: "KeyboardHandler" });
      this.#logger.info("Set zoom: height");
    }
  }

  /**
   * 退出全屏
   * @private
   */
  #exitFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      this.#logger.info("Exit fullscreen");
    }
  }

  /**
   * 切换全屏
   * @private
   */
  #toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      this.#logger.info("Enter fullscreen");
    } else {
      document.exitFullscreen();
      this.#logger.info("Exit fullscreen");
    }
  }

  /**
   * 打开搜索
   * @private
   */
  #openSearch() {
    this.#eventBus.emit(PDF_VIEWER_EVENTS.SEARCH.UI.OPEN, {}, { actorId: "KeyboardHandler" });
    this.#logger.info("Open search");
  }

  /**
   * 打印
   * @private
   */
  #print() {
    this.#eventBus.emit(PDF_VIEWER_EVENTS.PRINT.REQUEST, {}, { actorId: "KeyboardHandler" });
    this.#logger.info("Print requested");
  }

  /**
   * 添加自定义键绑定
   * @param {string} keyCombo - 键组合
   * @param {Function} handler - 处理函数
   */
  addKeyBinding(keyCombo, handler) {
    this.#keyBindings[keyCombo] = handler;
    this.#logger.debug(`Added key binding: ${keyCombo}`);
  }

  /**
   * 移除键绑定
   * @param {string} keyCombo - 键组合
   */
  removeKeyBinding(keyCombo) {
    delete this.#keyBindings[keyCombo];
    this.#logger.debug(`Removed key binding: ${keyCombo}`);
  }

  /**
   * 启用/禁用键盘处理
   * @param {boolean} enabled - 是否启用
   */
  setEnabled(enabled) {
    this.#enabled = enabled;
    this.#logger.info(`Keyboard handler ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * 销毁处理器
   */
  destroy() {
    this.removeEventListener();
    this.#keyBindings = {};
    this.#logger.info("Keyboard handler destroyed");
  }
}
