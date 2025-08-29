/**
 * 事件总线模块 (moved)
 */
import { Logger, LogLevel } from "../../pdf-home/utils/logger.js";

class EventNameValidator {
  static validate(event) {
    if (typeof event !== "string" || !event) return false;
    const parts = event.split(":");
    return parts.length === 3 && parts.every(p => p.length > 0);
  }
  static getValidationError(event) {
    if (typeof event !== "string" || !event) return `事件名称必须是非空字符串，但收到了：${event}`;
    const parts = event.split(":");
    if (parts.length !== 3) return `事件名称 '${event}' 格式不正确，应为 {module}:{action}:{status}`;
    if (parts.some(p => p.length === 0)) return `事件名称 '${event}' 的各个部分不能为空`;
    return null;
  }
}

export class EventBus {
  #events = {};
  #enableValidation = true;
  #logger;
  #nextSubscriberId = 1;

  constructor(options = {}) {
    this.#enableValidation = options.enableValidation !== false;
    this.#logger = new Logger("EventBus");
    if (options.logLevel) this.#logger.setLogLevel(options.logLevel);
    this.#logger.info(`事件总线已初始化，验证模式: ${this.#enableValidation}, 日志级别: ${options.logLevel || 'INFO'}`);
  }

  #inferActorId() { try { const err = new Error(); const stack = err.stack || ''; const lines = stack.split('\n').map(l => l.trim()).filter(Boolean); for (let i = 1; i < lines.length; i++) { const line = lines[i]; if (!/event-bus\.js|EventBus\./i.test(line)) { const m = line.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)$/) || line.match(/at\s+(.*):(\d+):(\d+)$/); if (m) { const func = m[1]; const file = m[2] || m[1]; const lineNo = m[3] || m[2]; return `${func}:${lineNo}`; } return line; } } return null; } catch (e) { return null; } }

  on(event, callback, options = {}) {
    if (this.#enableValidation) {
      const error = EventNameValidator.getValidationError(event);
      if (error) {
        this.#logger.error(`事件订阅失败: ${error}, 事件名: ${event}`);
        throw new Error(`无效的事件名称: ${error}`);
      }
    }
    if (!this.#events[event]) this.#events[event] = new Map();
    const subscriberId = options.subscriberId || this.#inferActorId() || `sub_${this.#nextSubscriberId++}`;
    this.#events[event].set(subscriberId, callback);
    this.#logger.event(`${event}`,`订阅`, { subscriberId, actorId: this.#inferActorId()});
    return () => this.off(event, subscriberId);
  }

  off(event, callbackOrId) {
    const subscribers = this.#events[event]; if (!subscribers) return; let removedId = null; if (typeof callbackOrId === 'function') { for (const [id, cb] of subscribers.entries()) { if (cb === callbackOrId) { subscribers.delete(id); removedId = id; break; } } } else { if (subscribers.has(callbackOrId)) { subscribers.delete(callbackOrId); removedId = callbackOrId; } } if (removedId !== null) { if (subscribers.size === 0) delete this.#events[event]; this.#logger.event(`${event} (取消订阅 by ${removedId})`); } }

  emit(event, data, options = {}) {
    if (this.#enableValidation) {
      const error = EventNameValidator.getValidationError(event);
      if (error) {
        this.#logger.error(`事件发布被阻止: ${error}`, { event, data });
        return;
      }
    }
    const subscribers = this.#events[event];
    if (subscribers && subscribers.size > 0) {
      const actorId = options.actorId || this.#inferActorId();
      this.#logger.event(`${event} (发布 by ${actorId || 'unknown'})`, "发布", { actorId, subscriberCount: subscribers.size, data });
      for (const [id, callback] of subscribers.entries()) {
        try { callback(data); } catch (err) { this.#logger.error(`事件回调执行出错: ${err.message}`, { event, subscriberId: id, actorId, error: err }); }
      }
    }
  }

  once(event, callback, options = {}) {
    const onceWrapper = (data) => { this.off(event, onceWrapper); callback(data); };
    return this.on(event, onceWrapper, options);
  }
  
  destroy() { this.#logger.info("正在销毁事件总线，清除所有订阅..."); this.#events = {}; this.#logger.info("事件总线已销毁。"); }
}

export default new EventBus({ enableValidation: true });