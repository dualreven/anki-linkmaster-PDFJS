/**
 * @file WebSocket 消息队列辅助工具
 * @description
 * 提供一个轻量级的消息队列，配合“初始化前暂存、初始化后统一处理”的模式使用。
 */

import { getLogger } from "../utils/logger.js";

/**
 * 创建消息队列。
 *
 * @param {{ loggerName?: string }} [options]
 * @returns {{ enqueue:(msg:any)=>void, drain:(route:(msg:any)=>void)=>void, clear:()=>void, size:()=>number }}
 */
export function createMessageQueue(options = {}) {
  const logger = getLogger(options.loggerName || "WsMessageQueue");
  /** @type {Array<any>} */
  const queue = [];

  return {
    /**
     * 将消息加入队列。
     * @param {any} message
     */
    enqueue(message) {
      queue.push(message);
    },

    /**
     * 依次取出队列中的消息并调用 route 函数。
     * @param {(message:any)=>void} route
     */
    drain(route) {
      while (queue.length > 0) {
        const msg = queue.shift();
        if (!msg) { continue; }
        try {
          route(msg);
        } catch (e) {
          logger.warn("[WsMessageQueue] failed to route message", e);
        }
      }
    },

    /**
     * 清空队列。
     */
    clear() {
      queue.length = 0;
    },

    /**
     * 获取当前队列长度。
     * @returns {number}
     */
    size() {
      return queue.length;
    }
  };
}

