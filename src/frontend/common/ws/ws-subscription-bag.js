/**
 * @file WebSocket 订阅管理辅助工具
 * @description
 * 提供一个小型“订阅袋”，用于集中存放 unsubscribe 函数，并在 destroy 阶段统一清理。
 * 适合 WebSocket 适配器等长期存在的对象按组合方式复用，避免在各类中重复维护数组逻辑。
 */

import { getLogger } from "../utils/logger.js";

/**
 * 创建订阅袋。
 *
 * @param {{ loggerName?: string }} [options]
 * @returns {{ add:(fn:Function)=>void, clear:()=>void, size:()=>number }}
 */
export function createSubscriptionBag(options = {}) {
  const internalLogger = getLogger(options.loggerName || "WsSubscriptionBag");
  /** @type {Array<Function>} */
  const subs = [];

  return {
    /**
     * 添加一个取消订阅函数。
     * @param {Function} fn
     */
    add(fn) {
      if (typeof fn === "function") {
        subs.push(fn);
      }
    },

    /**
     * 依次调用内部所有取消订阅函数，并清空列表。
     */
    clear() {
      while (subs.length > 0) {
        const fn = subs.pop();
        if (!fn) { continue; }
        try {
          fn();
        } catch (e) {
          internalLogger.warn("[WsSubscriptionBag] failed to unsubscribe", e);
        }
      }
    },

    /**
     * 获取当前已登记的订阅数量。
     * @returns {number}
     */
    size() {
      return subs.length;
    }
  };
}

