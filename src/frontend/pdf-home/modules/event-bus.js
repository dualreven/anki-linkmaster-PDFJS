/**
 * 事件总线模块
 * 实现事件发布和订阅功能，支持事件命名验证和调试功能
 */

// 导入日志工具
import { Logger, LogLevel } from "../utils/logger.js";

/**
 * 事件命名验证器
 * 确保事件名称符合规范: {module}:{action}:{status}
 */
class EventNameValidator {
  static validate(event) {
    if (typeof event !== "string" || !event) return false;
    const parts = event.split(":");
    return parts.length === 3 && parts.every(p => p.length > 0);
  }

  static getValidationError(event) {
    if (typeof event !== "string" || !event) {
      return `事件名称必须是非空字符串，但收到了：${event}`;
    }
    const parts = event.split(":");
    if (parts.length !== 3) {
      return `事件名称 '${event}' 格式不正确，应为 {module}:{action}:{status}`;
    }
    if (parts.some(p => p.length === 0)) {
        return `事件名称 '${event}' 的各个部分不能为空`;
    }
    return null;
  }
}

/**
 * EventBus 类，提供全局的事件发布/订阅能力。
 * @public
 */
export class EventBus {
  #events = {};
  #enableValidation = true;
  #logger;

  constructor(options = {}) {
    this.#enableValidation = options.enableValidation !== false;
    this.#logger = new Logger("EventBus");
    if (options.logLevel) {
      this.#logger.setLogLevel(options.logLevel);
    }
    this.#logger.info("事件总线已初始化", { validation: this.#enableValidation });
  }

  on(event, callback) {
    if (this.#enableValidation) {
      const error = EventNameValidator.getValidationError(event);
      if (error) {
        this.#logger.error(`事件订阅失败: ${error}`, { event });
        throw new Error(`无效的事件名称: ${error}`);
      }
    }
    if (!this.#events[event]) {
      this.#events[event] = new Set();
    }
    this.#events[event].add(callback);
    this.#logger.event(event, "订阅", { subscribers: this.#events[event].size });

    return () => this.off(event, callback);
  }

  off(event, callback) {
    const subscribers = this.#events[event];
    if (subscribers && subscribers.has(callback)) {
      subscribers.delete(callback);
      if (subscribers.size === 0) {
        delete this.#events[event];
      }
      this.#logger.event(event, "取消订阅", { remaining: subscribers.size || 0 });
    }
  }

  emit(event, data) {
    if (this.#enableValidation) {
      const error = EventNameValidator.getValidationError(event);
      if (error) {
        this.#logger.error(`事件发布被阻止: ${error}`, { event, data });
        return;
      }
    }
    const subscribers = this.#events[event];
    if (subscribers && subscribers.size > 0) {
      this.#logger.event(event, "发布", { subscriberCount: subscribers.size, data });
      subscribers.forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          this.#logger.error(`事件回调执行出错: ${err.message}`, { event, error: err });
        }
      });
    }
  }

  once(event, callback) {
    const onceWrapper = (data) => {
      this.off(event, onceWrapper);
      callback(data);
    };
    return this.on(event, onceWrapper);
  }
  
  destroy() {
    this.#logger.info("正在销毁事件总线，清除所有订阅...");
    this.#events = {};
    this.#logger.info("事件总线已销毁。");
  }
}

export default new EventBus({ enableValidation: true });
