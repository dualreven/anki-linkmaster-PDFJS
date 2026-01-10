/**
 * @file WebSocket 入站消息 mapping 执行器
 * @description
 * 提供一个通用的“type → handler”执行器，供各模块在适配层外通过组合方式
 * 复用 WS→领域事件桥接逻辑。
 */

/**
 * 运行一组入站消息处理器。
 *
 * @param {Object} params
 * @param {any} params.message - 原始 WebSocket 消息
 * @param {Array<{ match:(ctx:{type:string,message:any})=>boolean, handle:(ctx:{type:string,message:any,eventBus:any,wsClient:any,logger:any})=>void }>} params.handlers
 * @param {import("../event/event-bus.js").EventBus} params.eventBus
 * @param {import("../ws/ws-client.js").WSClient} params.wsClient
 * @param {import("../utils/logger.js").Logger} params.logger
 */
export function runWsInboundHandlers(params = {}) {
  const { message, handlers, eventBus, wsClient, logger, ...rest } = params || {};
  const type = String(message?.type || "");
  const baseCtx = { type, message, eventBus, wsClient, logger, ...rest };

  for (const handler of handlers || []) {
    if (!handler || typeof handler.match !== "function" || typeof handler.handle !== "function") {
      continue;
    }
    let shouldRun = false;
    try {
      shouldRun = !!handler.match(baseCtx);
    } catch (e) {
      logger.warn("[ws-inbound] handler.match failed", { type, error: e });
      continue;
    }
    if (!shouldRun) {
      continue;
    }

    try {
      handler.handle(baseCtx);
    } catch (e) {
      logger.warn("[ws-inbound] handler.handle failed", { type, error: e });
    }
  }
}
