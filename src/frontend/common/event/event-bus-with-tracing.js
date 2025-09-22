/**
 * @file 事件总线模块（带消息追踪功能），提供模块化的事件管理功能。
 * @module EventBusWithTracing
 * @version 1.1 - 添加消息调用链追踪功能
 */

import { getLogger } from "../utils/logger.js";
import { MessageTracer } from "./message-tracer.js";

class EventNameValidator {
  static validate(event) {
    if (typeof event !== "string" || !event) return false;

    const parts = event.split(":");

    return parts.length === 3 && parts.every((p) => p.length > 0);
  }

  static getValidationError(event, context = {}) {
    if (typeof event !== "string" || !event)
      return `事件名称必须是非空字符串，但收到了：${event}${this.#formatContext(context)}`;

    const parts = event.split(":");

    if (parts.length !== 3)
      return `事件名称 '${event}' 格式不正确，应为 {module}:{action}:{status}${this.#formatContext(context)}`;

    if (parts.some((p) => p.length === 0))
      return `事件名称 '${event}' 的各个部分不能为空${this.#formatContext(context)}`;

    return null;
  }

  static #formatContext(context) {
    const { subscriberId, actorId } = context;
    const parts = [];
    
    if (subscriberId) parts.push(`订阅者ID: ${subscriberId}`);
    if (actorId) parts.push(`执行者ID: ${actorId}`);
    
    return parts.length > 0 ? ` [${parts.join(', ')}]` : '';
  }
}

// 全局EventBus单例管理器
class EventBusManager {
  #globalLogger = null;
  #eventBuses = new Map();
  #globalValidation = true;

  /**
   * 设置全局Logger实例
   * @param {Logger} logger - Logger实例
   */
  setGlobalLogger(logger) {
    this.#globalLogger = logger;
    // 更新所有已存在的EventBus实例
    this.#eventBuses.forEach(eventBus => {
      eventBus.setLogger(logger);
    });
  }

  /**
   * 设置全局验证模式
   * @param {boolean} enableValidation - 是否启用验证
   */
  setGlobalValidation(enableValidation) {
    this.#globalValidation = enableValidation;
    // 更新所有已存在的EventBus实例
    this.#eventBuses.forEach(eventBus => {
      eventBus.setValidation(enableValidation);
    });
  }

  /**
   * 获取模块EventBus实例（单例）
   * @param {string} moduleName - 模块名称
   * @param {object} options - 配置选项
   * @returns {EventBus} EventBus实例
   */
  getEventBus(moduleName = "App", options = {}) {
    if (!this.#eventBuses.has(moduleName)) {
      const logger = this.#globalLogger || getLogger(moduleName);
      const eventBus = new EventBus({
        ...options,
        enableValidation: options.enableValidation !== undefined ? options.enableValidation : this.#globalValidation,
        logger: logger,
        moduleName: moduleName
      });
      this.#eventBuses.set(moduleName, eventBus);
    }
    return this.#eventBuses.get(moduleName);
  }

  /**
   * 获取所有EventBus实例信息
   * @returns {Array} EventBus列表
   */
  getAllEventBuses() {
    return Array.from(this.#eventBuses.entries()).map(([moduleName, eventBus]) => ({
      moduleName,
      enableValidation: eventBus.getValidationStatus(),
      eventCount: eventBus.getEventCount()
    }));
  }

  /**
   * 清理所有EventBus实例（用于测试）
   */
  clearAllEventBuses() {
    this.#eventBuses.forEach(eventBus => eventBus.destroy());
    this.#eventBuses.clear();
  }
}

// 全局EventBus管理器实例
const eventBusManager = new EventBusManager();

// 导出便捷函数
export const setGlobalEventBusLogger = (logger) => {
  eventBusManager.setGlobalLogger(logger);
};

export const setGlobalEventBusValidation = (enableValidation) => {
  eventBusManager.setGlobalValidation(enableValidation);
};

export const getEventBus = (moduleName, options) => {
  return eventBusManager.getEventBus(moduleName, options);
};

export const getAllEventBuses = () => {
  return eventBusManager.getAllEventBuses();
};

export class EventBus {
  #events = {};
  #enableValidation = true;
  #logger;
  #nextSubscriberId = 1;
  #moduleName;
  #earlyLogQueue = []; // 早期日志缓存
  #messageTracer = null; // 消息追踪器
  #enableTracing = false; // 是否启用追踪

  constructor(options = {}) {
    this.#enableValidation = options.enableValidation !== false;
    this.#moduleName = options.moduleName || "EventBus";
    this.#enableTracing = options.enableTracing === true; // 默认关闭追踪，避免性能影响

    // 支持延迟Logger注入
    if (options.logger) {
      this.#logger = options.logger;
    } else {
      // 不立即创建Logger，等待外部注入
      this.#logger = null;
    }

    // 如果启用追踪，创建MessageTracer实例
    if (this.#enableTracing) {
      this.#messageTracer = new MessageTracer({
        maxTraceSize: options.maxTraceSize || 1000,
        enablePerformanceTracking: options.enablePerformanceTracking !== false
      });
    }

    this.#log("info", `事件总线已初始化，模块: ${this.#moduleName}, 验证模式: ${this.#enableValidation}, 追踪模式: ${this.#enableTracing}`);
  }

  /**
   * 设置Logger实例（打破循环依赖）
   * @param {Logger} logger - Logger实例
   */
  setLogger(logger) {
    this.#logger = logger;
    // 处理缓存的早期日志
    this.#flushEarlyLogQueue();
  }

  /**
   * 刷新早期日志队列
   */
  #flushEarlyLogQueue() {
    if (!this.#logger || this.#earlyLogQueue.length === 0) return;

    this.#earlyLogQueue.forEach(entry => {
      const { level, message, args, timestamp } = entry;
      this.#logger[level](message, ...args);
    });
    this.#earlyLogQueue = [];
  }

  /**
   * 临时日志方法，支持早期日志缓存
   */
  #log(level, message, ...args) {
    if (this.#logger) {
      this.#logger[level](message, ...args);
    } else {
      // 缓存早期日志
      this.#earlyLogQueue.push({ level, message, args, timestamp: Date.now() });
    }
  }

  /**
   * 设置验证模式
   * @param {boolean} enableValidation - 是否启用验证
   */
  setValidation(enableValidation) {
    this.#enableValidation = enableValidation;
  }

  /**
   * 获取验证状态
   * @returns {boolean} 验证状态
   */
  getValidationStatus() {
    return this.#enableValidation;
  }

  /**
   * 获取事件数量
   * @returns {number} 事件数量
   */
  getEventCount() {
    return Object.keys(this.#events).length;
  }

  #inferActorId() {
    try {
      const err = new Error();
      const stack = err.stack || "";
      const lines = stack
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!/event-bus\.js|EventBus\./i.test(line)) {
          const m =
            line.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)$/) ||
            line.match(/at\s+(.*):(\d+):(\d+)$/);
          if (m) {
            const func = m[1];
            const file = m[2] || m[1];
            const lineNo = m[3] || m[2];
            return `${func}:${lineNo}`;
          }
          return line;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  on(event, callback, options = {}) {
    const subscriberId = options.subscriberId || this.#inferActorId() || `sub_${this.#nextSubscriberId++}`;
    const actorId = options.actorId || this.#inferActorId();
    
    if (this.#enableValidation) {
      const error = EventNameValidator.getValidationError(event, { subscriberId, actorId });

      if (error) {
        this.#log("error", `事件订阅失败: ${error}, 事件名: ${event}`);

        throw new Error(`无效的事件名称: ${error}`);
      }
    }

    if (!this.#events[event]) this.#events[event] = new Map();

    this.#events[event].set(subscriberId, callback);

    this.#log("event", `${event}`, `订阅`, {
      subscriberId,
      actorId,
    });

    return () => this.off(event, subscriberId);
  }

  off(event, callbackOrId) {
    const subscribers = this.#events[event];
    if (!subscribers) return;
    let removedId = null;
    if (typeof callbackOrId === "function") {
      for (const [id, cb] of subscribers.entries()) {
        if (cb === callbackOrId) {
          subscribers.delete(id);
          removedId = id;
          break;
        }
      }
    } else {
      if (subscribers.has(callbackOrId)) {
        subscribers.delete(callbackOrId);
        removedId = callbackOrId;
      }
    }
    if (removedId !== null) {
      if (subscribers.size === 0) delete this.#events[event];
      this.#log("event", `${event} (取消订阅 by ${removedId})`);
    }
  }

  emit(event, data, options = {}) {
    const actorId = options.actorId || this.#inferActorId();

    if (this.#enableValidation) {
      const error = EventNameValidator.getValidationError(event, { actorId });

      if (error) {
        this.#log("error", `事件发布被阻止: ${error}`, { event, data });

        return;
      }
    }

    const subscribers = this.#events[event];

    // 消息追踪功能 - 即使没有订阅者也要生成追踪信息
    let messageTrace = null;
    let messageId = null;
    let traceId = null;
    const startTime = Date.now();

    // 如果启用追踪，总是创建追踪记录
    if (this.#enableTracing && this.#messageTracer) {
      messageId = this.#messageTracer.generateMessageId();
      traceId = options.parentTraceId || messageId; // 级联事件继承traceId

      messageTrace = {
        messageId,
        traceId,
        event,
        publisher: actorId || "unknown",
        subscribers: subscribers ? Array.from(subscribers.keys()) : [],
        timestamp: startTime,
        parentMessageId: options.parentMessageId,
        data: JSON.stringify(data).substring(0, 500), // 限制数据长度
        executionResults: []
      };
    }

    if (subscribers && subscribers.size > 0) {
      this.#log("event", `${event} (发布 by ${actorId || "unknown"})`, "发布", {
        actorId,
        subscriberCount: subscribers.size,
        data,
        messageId, // 添加追踪信息到日志
        traceId
      });

      // 执行所有订阅者回调
      for (const [id, callback] of subscribers.entries()) {
        const callbackStartTime = Date.now();

        try {
          // 向后兼容：如果回调接受两个参数，传递追踪信息
          if (this.#enableTracing && callback.length >= 2) {
            callback(data, {
              messageId,
              traceId,
              parentMessageId: messageId // 供级联事件使用
            });
          } else {
            // 原有行为：只传递数据
            callback(data);
          }

          // 记录成功执行
          if (messageTrace) {
            messageTrace.executionResults.push({
              subscriberId: id,
              success: true,
              executionTime: Date.now() - callbackStartTime
            });
          }
        } catch (err) {
          // 记录执行错误
          if (messageTrace) {
            messageTrace.executionResults.push({
              subscriberId: id,
              success: false,
              error: err.message,
              executionTime: Date.now() - callbackStartTime
            });
          }

          this.#log("error", `事件回调执行出错: ${err.message}`, {
            event,
            subscriberId: id,
            actorId,
            error: err,
            messageId,
            traceId
          });
        }
      }
    } else {
      // 没有订阅者时也要记录日志
      this.#log("event", `${event} (发布 by ${actorId || "unknown"}) - 无订阅者`, "发布", {
        actorId,
        subscriberCount: 0,
        data,
        messageId,
        traceId
      });
    }

    // 完成追踪记录
    if (messageTrace) {
      messageTrace.totalExecutionTime = Date.now() - startTime;
      this.#messageTracer.recordMessage(messageTrace);
    }

    // 返回追踪信息（可选）
    if (this.#enableTracing && messageId) {
      return {
        messageId,
        traceId,
        timestamp: Date.now()
      };
    }
  }

  once(event, callback, options = {}) {
    const onceWrapper = (data) => {
      this.off(event, onceWrapper);
      callback(data);
    };

    return this.on(event, onceWrapper, options);
  }

  /**
   * 启用或禁用消息追踪
   * @param {boolean} enable - 是否启用追踪
   * @param {Object} [options] - 追踪选项
   */
  setTracing(enable, options = {}) {
    if (enable && !this.#messageTracer) {
      this.#messageTracer = new MessageTracer({
        maxTraceSize: options.maxTraceSize || 1000,
        enablePerformanceTracking: options.enablePerformanceTracking !== false
      });
    }

    this.#enableTracing = enable;
    this.#log("info", `消息追踪${enable ? '已启用' : '已禁用'}`);
  }

  /**
   * 获取消息追踪信息 - 规格要求的接口2
   * @param {string} messageId - 消息ID
   * @returns {Object|null} 消息追踪对象
   */
  getMessageTrace(messageId) {
    if (!this.#messageTracer) return null;
    return this.#messageTracer.getTrace(messageId);
  }

  /**
   * 获取调用链树 - 规格要求的接口3
   * @param {string} traceId - 调用链ID
   * @returns {Object|null} 调用链树
   */
  getTraceTree(traceId) {
    if (!this.#messageTracer) return null;
    return this.#messageTracer.buildTraceTree(traceId);
  }

  /**
   * 清理追踪数据 - 规格要求的接口4
   * @param {number} olderThan - 时间戳
   * @returns {number} 清理的记录数
   */
  clearTraceData(olderThan) {
    if (!this.#messageTracer) return 0;
    return this.#messageTracer.clearTraceData(olderThan);
  }

  /**
   * 获取性能统计信息
   * @param {string} [event] - 可选的事件名称过滤
   * @returns {Object} 性能统计
   */
  getStats(event = null) {
    if (!this.#messageTracer) return null;
    return this.#messageTracer.getStats(event);
  }

  /**
   * 获取所有调用链ID
   * @returns {Array<string>} 调用链ID数组
   */
  getAllTraceIds() {
    if (!this.#messageTracer) return [];
    return this.#messageTracer.getAllTraceIds();
  }

  /**
   * 获取追踪器状态
   * @returns {Object} 状态信息
   */
  getTracingStatus() {
    return {
      enabled: this.#enableTracing,
      hasTracer: !!this.#messageTracer,
      ...((this.#messageTracer && this.#messageTracer.getStatus()) || {})
    };
  }

  destroy() {
    this.#log("info", `正在销毁事件总线 [${this.#moduleName}]，清除所有订阅...`);
    this.#events = {};

    // 销毁追踪器
    if (this.#messageTracer) {
      this.#messageTracer.destroy();
      this.#messageTracer = null;
    }

    this.#log("info", `事件总线 [${this.#moduleName}] 已销毁。`);
  }
}

export { EventNameValidator };

// 为保持向后兼容性，导出默认的EventBus实例
// 但推荐使用 getEventBus() 函数获取模块特定的实例
export default getEventBus("App", { enableValidation: true });
