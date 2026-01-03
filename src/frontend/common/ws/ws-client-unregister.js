import { WEBSOCKET_MESSAGE_TYPES } from "../event/event-constants.js";

/**
 * 发送客户端取消注册消息（窗口关闭时调用）
 * @param {{
 *  identity: { client_id?: string|null, client_name?: string|null } | null,
 *  request: (messageType:string, payload:any, options:any)=>Promise<any>,
 *  logger: any,
 *  reason?: string,
 * }} ctx
 * @returns {Promise<void>}
 */
export async function sendWsClientUnregister(ctx) {
  const { identity, request, logger, reason = "window_closing" } = ctx;
  const ident = identity || {};
  const clientId = ident.client_id;
  const clientName = ident.client_name;

  if (!clientId && !clientName) {
    logger?.debug?.("[WSClient] 跳过取消注册：缺少 client_id 和 client_name");
    return;
  }

  if (!WEBSOCKET_MESSAGE_TYPES.CLIENT_UNREGISTER_REQUESTED) {
    logger?.debug?.("[WSClient] CLIENT_UNREGISTER_REQUESTED 未在常量集中注册，跳过取消注册");
    return;
  }

  const unregisterTasks = [];

  if (clientId) {
    logger?.info?.(`[WSClient] 注销旧协议 client_id: ${clientId}, reason=${reason}`);
    unregisterTasks.push(
      request(
        WEBSOCKET_MESSAGE_TYPES.CLIENT_UNREGISTER_REQUESTED,
        { client_id: clientId, reason },
        { timeout: 500 }
      ).then(() => {
        logger?.info?.(`[WSClient] ✅ 旧协议注销成功: ${clientId}`);
      }).catch((error) => {
        logger?.warn?.(`[WSClient] ⚠️ 旧协议注销失败（忽略）: ${clientId}, error=${error.message}`);
      })
    );
  }

  if (clientName && clientName !== clientId) {
    logger?.info?.(`[WSClient] 注销新协议 client_name: ${clientName}, reason=${reason}`);
    unregisterTasks.push(
      request(
        WEBSOCKET_MESSAGE_TYPES.CLIENT_UNREGISTER_REQUESTED,
        { client_id: clientName, reason },
        { timeout: 500 }
      ).then(() => {
        logger?.info?.(`[WSClient] ✅ 新协议注销成功: ${clientName}`);
      }).catch((error) => {
        logger?.warn?.(`[WSClient] ⚠️ 新协议注销失败（忽略）: ${clientName}, error=${error.message}`);
      })
    );
  }

  try {
    await Promise.allSettled(unregisterTasks);
    logger?.info?.("[WSClient] 取消注册完成（新旧协议均已尝试）");
  } catch (error) {
    logger?.warn?.(`[WSClient] 取消注册异常（忽略）: ${error.message}`);
  }
}

