/**
 * @file 事件总线模块（带消息追踪功能），提供模块化的事件管理功能。
 * @module EventBusWithTracing
 * @version 1.1 - 添加消息调用链追踪功能
 */

import { getLogger } from "../utils/logger.js";
import { MessageTracer } from "./message-tracer.js";

const SUPPRESSED_EVENT_LOGS = new Set(['pdf-viewer:file:load-progress']);

class EventNameValidator {
  static validate(event) {
    if (typeof event !== "string" || !event) return false;

    const parts = event.split(":");

    return parts.length === 3 && parts.every((p) => p.length > 0);
  }

  static getValidationError(event, context = {}) {
    if (typeof event !== "string" || !event) {
      return this.#buildError(
        `事件名称必须是非空字符串，但收到了：${typeof event} (${event})`,
        null,
        context
      );
    }

    const parts = event.split(":");

    if (parts.length !== 3) {
      return this.#buildError(
        `事件名称 '${event}' 格式不正确`,
        this.#suggestFix(event, parts),
        context
      );
    }

    if (parts.some((p) => p.length === 0)) {
      return this.#buildError(
        `事件名称 '${event}' 的各个部分不能为空`,
        `确保格式为 {module}:{action}:{status}，每部分都有内容`,
        context
      );
    }

    return null;
  }

  /**
   * 构建详细的错误信息
   */
  static #buildError(mainMessage, suggestion, context) {
    const lines = [];

    lines.push('❌ 事件名称验证失败！');
    lines.push('');
    lines.push(`错误：${mainMessage}`);
    lines.push('');
    lines.push('📋 正确格式：{module}:{action}:{status} (必须正好3段，用冒号分隔)');
    lines.push('');
    lines.push('✅ 正确示例：');
    lines.push('  - pdf:load:completed');
    lines.push('  - bookmark:toggle:requested');
    lines.push('  - sidebar:open:success');
    lines.push('');
    lines.push('❌ 错误示例：');
    lines.push('  - loadData (缺少冒号)');
    lines.push('  - pdf:list:data:loaded (超过3段)');
    lines.push('  - pdf_list_updated (使用下划线)');
    lines.push('  - onButtonClick (非事件格式)');

    if (suggestion) {
      lines.push('');
      lines.push(`💡 建议修复：${suggestion}`);
    }

    if (context.actorId || context.subscriberId) {
      lines.push('');
      lines.push(this.#formatContext(context));
    }

    lines.push('');
    lines.push('⚠️ 此事件发布/订阅已被阻止！请立即修复事件名称。');

    return lines.join('\n');
  }

  /**
   * 根据常见错误模式提供修复建议
   */
  static #suggestFix(event, parts) {
    // 检测下划线命名（应该用连字符）
    if (event.includes('_')) {
      const fixed = event.replace(/_/g, '-');
      return `检测到下划线命名，请使用连字符：'${fixed}'`;
    }

    // 检测驼峰命名
    if (/[a-z][A-Z]/.test(event)) {
      return `检测到驼峰命名，事件名应该使用小写+连字符格式`;
    }

    // 检测段数错误
    if (parts.length === 1) {
      return `事件名缺少冒号，应该分为3段：模块名:动作名:状态`;
    }

    if (parts.length === 2) {
      return `事件名只有2段，缺少第3段状态（如：requested/completed/failed）`;
    }

    if (parts.length > 3) {
      return `事件名超过3段 (${parts.length}段)，请合并为：{${parts.slice(0, -2).join('-')}}:{${parts[parts.length-2]}}:{${parts[parts.length-1]}}`;
    }

    return `使用格式：{module}:{action}:{status}`;
  }

  static #formatContext(context) {
    const { subscriberId, actorId } = context;
    const parts = [];

    if (subscriberId) parts.push(`订阅者ID: ${subscriberId}`);
    if (actorId) parts.push(`执行者ID: ${actorId}`);

    return parts.length > 0 ? `📍 位置信息：${parts.join(', ')}` : '';
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

/**
 * 事件总线类
 * @class EventBus
 * @description
 * 提供模块化的发布-订阅（Pub-Sub）模式事件管理功能
 *
 * 核心功能：
 * 1. 事件订阅与发布：on(), emit(), once(), off()
 * 2. 事件名称验证：确保事件名符合 {module}:{action}:{status} 格式
 * 3. 消息追踪：支持调用链追踪和性能分析（可选）
 * 4. 自动推断执行者：通过调用栈自动识别发布者和订阅者
 * 5. 错误隔离：订阅者回调错误不影响其他订阅者
 *
 * @example
 * // 创建事件总线
 * const eventBus = new EventBus({
 *   moduleName: 'PDFViewer',
 *   enableValidation: true,
 *   enableTracing: false
 * });
 *
 * // 订阅事件
 * eventBus.on('pdf:file:loaded', (data) => {
 *   console.log('PDF loaded:', data.filename);
 * });
 *
 * // 发布事件
 * eventBus.emit('pdf:file:loaded', { filename: 'test.pdf' });
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
        // 跳过 event-bus.js 和 scoped-event-bus.js，找到真正的调用者
        if (!/event-bus\.js|scoped-event-bus\.js|EventBus\.|ScopedEventBus\./i.test(line)) {
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

  /**
   * 订阅事件
   * @param {string} event - 事件名称，格式：{module}:{action}:{status}
   * @param {Function} callback - 事件回调函数
   * @param {Object} [options={}] - 订阅选项
   * @param {string} [options.subscriberId] - 订阅者ID（可选，未指定时自动推断）
   * @param {string} [options.actorId] - 执行者ID（可选，未指定时自动推断）
   * @returns {Function} 取消订阅函数
   * @throws {Error} 如果事件名称格式不正确且启用验证
   *
   * @description
   * 订阅指定事件，当事件触发时调用回调函数
   * 返回一个取消订阅函数，调用后将移除该订阅
   *
   * @example
   * // 基本订阅
   * const unsubscribe = eventBus.on('pdf:file:loaded', (data) => {
   *   console.log('PDF loaded:', data);
   * });
   *
   * // 带追踪信息的订阅
   * eventBus.on('pdf:file:loaded', (data, traceInfo) => {
   *   console.log('PDF loaded:', data, 'Message ID:', traceInfo.messageId);
   * });
   *
   * // 取消订阅
   * unsubscribe();
   */
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

    // 检查是否重复订阅（同一 subscriberId 订阅同一事件）
    if (this.#events[event].has(subscriberId)) {
      const errorMsg = [
        `❌ 重复订阅检测！`,
        ``,
        `事件名称: "${event}"`,
        `订阅者ID: "${subscriberId}"`,
        ``,
        `💡 可能原因:`,
        `1. 同一个组件多次调用 eventBus.on() 订阅同一事件`,
        `2. 组件未正确清理旧订阅（调用 unsubscribe()）`,
        `3. 多个组件使用了相同的 subscriberId（如多次实例化同一组件）`,
        ``,
        `🔧 解决方法:`,
        `1. 确保组件销毁时调用 unsubscribe() 清理订阅`,
        `2. 或传递唯一的 subscriberId: eventBus.on(event, callback, { subscriberId: 'unique-id' })`,
        `3. 或使用 off() 手动移除旧订阅后再重新订阅`,
        `4. 检查是否有组件被错误地多次实例化`,
      ].join('\n');

      this.#log("error", errorMsg);
      throw new Error(`重复订阅: 事件 "${event}" 已被 "${subscriberId}" 订阅`);
    }

    this.#events[event].set(subscriberId, callback);

    this.#log("event", `${event}`, `订阅`, {
      subscriberId,
      actorId,
    });

    return () => this.off(event, subscriberId);
  }

  /**
   * 取消订阅事件
   * @param {string} event - 事件名称
   * @param {Function|string} callbackOrId - 回调函数或订阅者ID
   * @description
   * 取消指定事件的订阅
   * 可以通过回调函数或订阅者ID来匹配要取消的订阅
   *
   * @example
   * // 通过回调函数取消订阅
   * const callback = (data) => console.log(data);
   * eventBus.on('pdf:file:loaded', callback);
   * eventBus.off('pdf:file:loaded', callback);
   *
   * // 通过订阅者ID取消订阅
   * eventBus.off('pdf:file:loaded', 'sub_123');
   *
   * // 推荐使用返回的取消订阅函数
   * const unsubscribe = eventBus.on('pdf:file:loaded', callback);
   * unsubscribe(); // 更简洁
   */
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

  /**
   * 发布事件
   * @param {string} event - 事件名称，格式：{module}:{action}:{status}
   * @param {any} data - 事件数据
   * @param {Object} [options={}] - 发布选项
   * @param {string} [options.actorId] - 执行者ID（可选，未指定时自动推断）
   * @param {string} [options.parentTraceId] - 父调用链ID（用于级联事件追踪）
   * @param {string} [options.parentMessageId] - 父消息ID（用于级联事件追踪）
   * @returns {Object|undefined} 如果启用追踪，返回 { messageId, traceId, timestamp }
   * @description
   * 向所有订阅者发布事件
   * - 如果启用验证且事件名称不符合格式，事件不会发布
   * - 如果启用追踪，会记录消息追踪信息并返回追踪元数据
   * - 订阅者回调执行错误不会中断其他订阅者的执行
   * - 高频事件（如进度更新）的日志会被抑制
   *
   * @example
   * // 基本发布
   * eventBus.emit('pdf:file:loaded', { filename: 'test.pdf' });
   *
   * // 带执行者ID
   * eventBus.emit('pdf:file:loaded', { filename: 'test.pdf' }, {
   *   actorId: 'PDFManager'
   * });
   *
   * // 启用追踪时
   * const traceInfo = eventBus.emit('pdf:file:loaded', data);
   * console.log('Message ID:', traceInfo.messageId);
   *
   * // 级联事件
   * eventBus.on('pdf:file:loaded', (data, traceInfo) => {
   *   eventBus.emit('pdf:processing:started', data, {
   *     parentTraceId: traceInfo.traceId,
   *     parentMessageId: traceInfo.messageId
   *   });
   * });
   */
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
      if (!SUPPRESSED_EVENT_LOGS.has(event)) {
        // 安全地截断data到200字符以减少日志输出
        let truncatedData;
        try {
          const dataStr = JSON.stringify(data);
          truncatedData = dataStr.length > 200 ? dataStr.substring(0, 200) + '...' : dataStr;
        } catch (err) {
          // JSON.stringify可能失败（循环引用等），使用原始data
          truncatedData = data;
        }

        this.#log("event", `${event} (发布 by ${actorId || "unknown"})`, "发布", {
          actorId,
          subscriberCount: subscribers.size,
          data: truncatedData,
          messageId, // 添加追踪信息到日志
          traceId
        });
      }

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
      if (!SUPPRESSED_EVENT_LOGS.has(event)) {
        // 安全地截断data到200字符以减少日志输出
        let truncatedData;
        try {
          const dataStr = JSON.stringify(data);
          truncatedData = dataStr.length > 200 ? dataStr.substring(0, 200) + '...' : dataStr;
        } catch (err) {
          // JSON.stringify可能失败（循环引用等），使用原始data
          truncatedData = data;
        }

        // 没有订阅者时也要记录日志
        this.#log("event", `${event} (发布 by ${actorId || "unknown"}) - 无订阅者`, "发布", {
          actorId,
          subscriberCount: 0,
          data: truncatedData,
          messageId,
          traceId
        });
      }
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

  /**
   * 订阅事件（仅触发一次）
   * @param {string} event - 事件名称，格式：{module}:{action}:{status}
   * @param {Function} callback - 事件回调函数
   * @param {Object} [options={}] - 订阅选项
   * @param {string} [options.subscriberId] - 订阅者ID（可选）
   * @param {string} [options.actorId] - 执行者ID（可选）
   * @returns {Function} 取消订阅函数
   * @description
   * 订阅指定事件，但回调只会执行一次
   * 事件触发后会自动取消订阅
   *
   * @example
   * // 仅在首次加载时执行
   * eventBus.once('pdf:file:loaded', (data) => {
   *   console.log('First PDF loaded:', data);
   * });
   *
   * // 可以提前取消订阅
   * const unsubscribe = eventBus.once('pdf:file:loaded', callback);
   * unsubscribe(); // 如果在触发前取消，回调不会执行
   */
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

  /**
   * 销毁事件总线
   * @description
   * 清除所有事件订阅和追踪数据，释放资源
   * 调用后该 EventBus 实例将不可用
   *
   * 销毁操作包括：
   * 1. 清除所有事件订阅
   * 2. 销毁消息追踪器（如果启用）
   * 3. 清空追踪数据
   *
   * @example
   * // 在模块卸载时销毁事件总线
   * async uninstall(context) {
   *   context.globalEventBus.destroy();
   * }
   *
   * // 在测试清理时销毁
   * afterEach(() => {
   *   eventBus.destroy();
   * });
   */
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
