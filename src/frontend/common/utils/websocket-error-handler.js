/**
 * @file WebSocket 错误处理工具
 * @description 提供统一的 WebSocket 错误监听和 Toast 显示逻辑
 * @module WebSocketErrorHandler
 *
 * ## 设计原则
 * 1. **避免重复显示**：只监听必要的事件，不重复处理
 * 2. **统一逻辑**：pdf-home 和 pdf-viewer 使用相同的错误处理代码
 * 3. **易于维护**：错误处理逻辑集中在一个文件
 *
 * ## 为什么只监听两个事件？
 * - WSClient (ws-client.js 第472-475行) 已经有通用兜底机制：
 *   所有以 `:failed` 结尾的消息都会被自动路由到 ERROR 事件
 * - 因此不需要再监听 MESSAGE.RECEIVED 并检查 `:failed` 后缀
 * - 避免双重显示问题
 *
 * ## 监听的事件
 * 1. `WEBSOCKET_EVENTS.MESSAGE.SEND_FAILED` - WebSocket 发送失败
 * 2. `WEBSOCKET_MESSAGE_EVENTS.ERROR` - 后端错误（包含所有 :failed 消息）
 */

import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_EVENTS } from "../event/event-constants.js";

/**
 * WebSocket 错误处理器类
 * 用于注册全局 WebSocket 错误事件监听器，并显示 Toast 通知
 */
export class WebSocketErrorHandler {
  /** @type {import('../event/event-bus.js').EventBus} */
  #eventBus;

  /** @type {Function} 显示错误的函数 (message: string, duration: number) => void */
  #showErrorFn;

  /** @type {Object} 日志记录器 */
  #logger;

  /** @type {string} 订阅者ID */
  #subscriberId;

  /** @type {Array<Function>} 取消订阅函数列表 */
  #unsubscribeFns = [];

  /** @type {boolean} 是否已注册 */
  #registered = false;

  /**
   * 创建错误处理器
   * @param {import('../event/event-bus.js').EventBus} eventBus - 事件总线实例
   * @param {Function} showErrorFn - 显示错误的函数 (message, duration) => void
   * @param {Object} logger - 日志记录器
   * @param {string} [subscriberId="WebSocketErrorHandler"] - 订阅者ID（用于调试）
   */
  constructor(eventBus, showErrorFn, logger, subscriberId = "WebSocketErrorHandler") {
    this.#eventBus = eventBus;
    this.#showErrorFn = showErrorFn;
    this.#logger = logger;
    this.#subscriberId = subscriberId;
  }

  /**
   * 注册错误监听器
   *
   * ⚠️ 重要：只监听两个事件，避免重复显示
   * 1. WEBSOCKET_EVENTS.MESSAGE.SEND_FAILED - 发送失败
   * 2. WEBSOCKET_MESSAGE_EVENTS.ERROR - 后端错误（已包含所有 :failed 消息）
   *
   * ❌ 不监听 WEBSOCKET_EVENTS.MESSAGE.RECEIVED 并检查 :failed 后缀
   *    原因：WSClient 已经将所有 :failed 消息路由到 ERROR 事件
   */
  register() {
    if (this.#registered) {
      this.#logger?.warn?.("WebSocketErrorHandler already registered");
      return;
    }

    try {
      const subscriberOpts = { subscriberId: this.#subscriberId };

      // ===== 监听器1：WebSocket 发送失败 =====
      // 例如：网络断开、WebSocket 未连接等
      const unsub1 = this.#eventBus.on(
        WEBSOCKET_EVENTS.MESSAGE.SEND_FAILED,
        (err) => {
          try {
            const msg = (err && (err.error_message || err.message)) || "WebSocket 消息发送失败";
            const type = err && (err.message_type || err.type);
            this.#showErrorFn(type ? `${type}: ${msg}` : msg, 5000);
          } catch (e) {
            this.#logger?.warn?.("Failed to show SEND_FAILED toast", e);
          }
        },
        subscriberOpts
      );
      this.#unsubscribeFns.push(unsub1);

      // ===== 监听器2：后端响应错误 =====
      // ⚠️ 关键：WSClient 已经将所有 :failed 消息路由到 ERROR 事件
      // 包括：
      // - client:register:failed
      // - pdf-library:search:failed
      // - pdf-library:add:failed
      // - 以及所有其他 :failed 消息
      //
      // 因此这里只需监听 ERROR，不需要再监听 MESSAGE.RECEIVED
      const unsub2 = this.#eventBus.on(
        WEBSOCKET_MESSAGE_EVENTS.ERROR,
        (payload) => {
          try {
            const type = payload && (payload.type || payload.received_type);
            const errMsg =
              (payload && (payload.message || payload.error_message)) ||
              (payload && payload.error && (payload.error.message || payload.error.code)) ||
              (payload && payload.data && payload.data.message) ||
              "操作失败";
            this.#showErrorFn(type ? `${type}: ${errMsg}` : errMsg, 6000);
          } catch (e) {
            this.#logger?.warn?.("Failed to show ERROR toast", e);
          }
        },
        subscriberOpts
      );
      this.#unsubscribeFns.push(unsub2);

      this.#registered = true;
      this.#logger?.info?.(`WebSocketErrorHandler registered (subscriberId: ${this.#subscriberId})`);
    } catch (e) {
      this.#logger?.warn?.("Failed to register WebSocketErrorHandler", e);
    }
  }

  /**
   * 注销错误监听器
   * 用于清理资源，避免内存泄漏
   */
  unregister() {
    this.#unsubscribeFns.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        this.#logger?.warn?.("Failed to unsubscribe", e);
      }
    });
    this.#unsubscribeFns = [];
    this.#registered = false;
    this.#logger?.info?.("WebSocketErrorHandler unregistered");
  }

  /**
   * 是否已注册
   * @returns {boolean}
   */
  isRegistered() {
    return this.#registered;
  }
}
