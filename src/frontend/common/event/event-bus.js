/**
 * @file 事件总线（含追踪/校验/白名单）
 * 详细说明见：docs/standards/event-bus.md
 */

import { getLogger } from "../utils/logger.js";
import { MessageTracer } from "./message-tracer.js";

import { EventNameValidator } from "./event-name-validator.js";
import { eventBusEmit } from "./event-bus-emitter.js";
import { eventBusOn, eventBusOff } from "./event-bus-subscriptions.js";

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

/**
 * 事件总线（发布/订阅 + 可选追踪）。细节见：docs/standards/event-bus.md
 */
export class EventBus {
  /** @type {Object<string, Map<string, Function>>} 事件名到订阅者映射 */
  #events = {};

  /** @type {boolean} 是否启用事件名称验证 */
  #enableValidation = true;

  /** @type {Logger|null} 日志记录器 */
  #logger;

  /** @type {number} 下一个订阅者ID */
  #nextSubscriberId = 1;

  /** @type {string} 模块名称 */
  #moduleName;

  /** @type {Array} 早期日志缓存（Logger注入前） */
  #earlyLogQueue = [];

  /** @type {MessageTracer|null} 消息追踪器 */
  #messageTracer = null;

  /** @type {boolean} 是否启用消息追踪 */
  #enableTracing = false;

  // ========== 事件负载（payload）契约校验（可选） ==========
  /** @type {boolean} 是否启用负载校验 */
  #payloadValidationEnabled = false;
  /**
   * @type {(event:string, data:any)=>({valid:boolean, errors?:any})|null}
   * 负载校验函数（返回 { valid:false, errors } 时阻止发布）
   */
  #payloadValidateFn = null;

  /**
   * 创建事件总线实例
   * @param {Object} [options={}] - 配置选项
   * @param {string} [options.moduleName='EventBus'] - 模块名称
   * @param {boolean} [options.enableValidation=true] - 是否启用事件名称验证
   * @param {boolean} [options.enableTracing=false] - 是否启用消息追踪
   * @param {Logger} [options.logger] - 日志记录器（可选，支持延迟注入）
   * @param {number} [options.maxTraceSize=1000] - 追踪记录最大数量
   * @param {boolean} [options.enablePerformanceTracking=true] - 是否启用性能追踪
   *
   * @example
   * const eventBus = new EventBus({
   *   moduleName: 'PDFViewer',
   *   enableValidation: true,
   *   enableTracing: true,
   *   maxTraceSize: 500
   * });
   */
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
    if (!this.#logger || this.#earlyLogQueue.length === 0) {return;}

    this.#earlyLogQueue.forEach(entry => {
      const { level, message, args } = entry;
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
        // 跳过 event-bus.js 和 scoped-event-bus.js，找到真正的调用者
        if (!/event-bus\.js|scoped-event-bus\.js|EventBus\.|ScopedEventBus\./i.test(line)) {
          const m =
            line.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)$/) ||
            line.match(/at\s+(.*):(\d+):(\d+)$/);
          if (m) {
            const func = m[1];
            const lineNo = m[3] || m[2];
            return `${func}:${lineNo}`;
          }
          return line;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /** 订阅事件：返回取消函数（详见 docs/standards/event-bus.md） */
  on(event, callback, options = {}) {
    // 提前推断订阅者/执行者ID（保持错误日志定位一致）
    const inferredSubscriberId = this.#inferActorId();
    const inferredActorId = this.#inferActorId();

    return eventBusOn({
      event,
      callback,
      options,
      events: this.#events,
      enableValidation: this.#enableValidation,
      inferredSubscriberId,
      inferredActorId,
      nextSubscriberId: () => `sub_${this.#nextSubscriberId++}`,
      log: (...args) => this.#log(...args),
      off: (ev, cbOrId) => this.off(ev, cbOrId),
    });
  }

  /** 取消订阅：传回调或 subscriberId（详见 docs/standards/event-bus.md） */
  off(event, callbackOrId) {
    return eventBusOff({
      event,
      callbackOrId,
      events: this.#events,
      log: (...args) => this.#log(...args),
    });
  }

  /** 发布事件（可选追踪/负载校验/白名单约束），详见 docs/standards/event-bus.md */
  emit(event, data, options = {}) {
    return eventBusEmit({
      event,
      data,
      options,
      events: this.#events,
      enableValidation: this.#enableValidation,
      actorId: options.actorId || this.#inferActorId(),
      payloadValidationEnabled: this.#payloadValidationEnabled,
      payloadValidateFn: this.#payloadValidateFn,
      moduleName: this.#moduleName,
      enableTracing: this.#enableTracing,
      messageTracer: this.#messageTracer,
      log: (...args) => this.#log(...args),
    });
  }

  /** 仅触发一次：触发后自动 off（详见 docs/standards/event-bus.md） */
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
    this.#log("info", `消息追踪${enable ? "已启用" : "已禁用"}`);
  }

  /**
   * 获取消息追踪信息 - 规格要求的接口2
   * @param {string} messageId - 消息ID
   * @returns {Object|null} 消息追踪对象
   */
  getMessageTrace(messageId) {
    if (!this.#messageTracer) {return null;}
    return this.#messageTracer.getTrace(messageId);
  }

  /**
   * 获取调用链树 - 规格要求的接口3
   * @param {string} traceId - 调用链ID
   * @returns {Object|null} 调用链树
   */
  getTraceTree(traceId) {
    if (!this.#messageTracer) {return null;}
    return this.#messageTracer.buildTraceTree(traceId);
  }

  /**
   * 清理追踪数据 - 规格要求的接口4
   * @param {number} olderThan - 时间戳
   * @returns {number} 清理的记录数
   */
  clearTraceData(olderThan) {
    if (!this.#messageTracer) {return 0;}
    return this.#messageTracer.clearTraceData(olderThan);
  }

  /**
   * 获取性能统计信息
   * @param {string} [event] - 可选的事件名称过滤
   * @returns {Object} 性能统计
   */
  getStats(event = null) {
    if (!this.#messageTracer) {return null;}
    return this.#messageTracer.getStats(event);
  }

  /**
   * 获取所有调用链ID
   * @returns {Array<string>} 调用链ID数组
   */
  getAllTraceIds() {
    if (!this.#messageTracer) {return [];}
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

  /** 清理订阅与追踪数据（用于测试/卸载） */
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

  /**
   * 启用或禁用事件负载校验
   * @param {boolean} enable - 是否启用
   * @param {(event:string, data:any)=>({valid:boolean, errors?:any})} [validateFn] - 校验函数
   */
  setPayloadValidation(enable, validateFn) {
    this.#payloadValidationEnabled = !!enable;
    if (typeof validateFn === "function") {
      this.#payloadValidateFn = validateFn;
    }
  }

  /**
   * 获取负载校验开关状态
   * @returns {boolean}
   */
  getPayloadValidationStatus() {
    return this.#payloadValidationEnabled === true;
  }
}

export { EventNameValidator };

// 为保持向后兼容性，导出默认的EventBus实例
// 但推荐使用 getEventBus() 函数获取模块特定的实例
export default getEventBus("App", { enableValidation: true });

