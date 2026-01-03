import { WEBSOCKET_MESSAGE_TYPES } from "../event/event-constants.js";

export function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * @param {{
 *  message: any,
 *  pendingRequests: Map<string, any>,
 *  requestRetries: Map<string, any>,
 *  error?: any,
 *  data?: any,
 * }} ctx
 * @returns {boolean}
 */
export function settlePendingRequest({ message, pendingRequests, requestRetries, error = null, data = undefined }) {
  const requestId = message?.request_id;
  if (!requestId || !pendingRequests.has(requestId)) {
    return false;
  }

  const handlers = pendingRequests.get(requestId);
  pendingRequests.delete(requestId);
  requestRetries.delete(requestId);

  if (error) {
    const err = error instanceof Error
      ? error
      : new Error(typeof error === "string" ? error : (error?.message || "WebSocket请求失败"));
    handlers.reject(err);
  } else {
    handlers.resolve(data !== undefined ? data : message?.data);
  }
  return true;
}

/**
 * WSClient.request 实现（抽离以减少 ws-client.js 体积）
 *
 * @param {{
 *  messageType: string,
 *  payload?: any,
 *  options?: any,
 *  logger: any,
 *  isConnected: () => boolean,
 *  getSocket: () => any,
 *  getReadyStateName: () => string,
 *  messageQueue: any[],
 *  pendingRequests: Map<string, any>,
 *  requestRetries: Map<string, any>,
 *  allowedOutboundTypes: Set<string>,
 * }} ctx
 * @returns {Promise<any>}
 */
export function requestWsClientMessage(ctx) {
  const {
    messageType,
    payload = {},
    options = {},
    logger,
    isConnected,
    getSocket,
    getReadyStateName,
    messageQueue,
    pendingRequests,
    requestRetries,
    allowedOutboundTypes,
  } = ctx;

  if (!allowedOutboundTypes.has(messageType)) {
    const err = new Error(`未注册的请求消息类型：${messageType}. 请使用 event-constants.js 中的 WEBSOCKET_MESSAGE_TYPES 或先合入契约文档`);
    logger?.error?.("❌ WS 请求被拒绝（未注册类型）", { messageType });
    throw err;
  }

  const { timeout = 5000, maxRetries = 0, metadata = undefined } = options;
  const requestId = generateRequestId();

  const message = {
    type: messageType,
    request_id: requestId,
    timestamp: Date.now(),
    data: payload
  };
  if (metadata) { message.metadata = metadata; }

  // ========== 自动添加 to 字段（新协议：2025-01-16）==========
  // 规则：注册/取消注册消息禁止包含 to，其他请求消息自动添加 to: "backend"
  const REGISTER_MESSAGES = [
    WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_REQUESTED,
    WEBSOCKET_MESSAGE_TYPES.CLIENT_UNREGISTER_REQUESTED,
    WEBSOCKET_MESSAGE_TYPES.VIEWER_REGISTER_REQUESTED
  ];
  if (!message.to && !REGISTER_MESSAGES.includes(messageType)) {
    message.to = "backend";
    logger?.debug?.(`[WSClient] request() 自动添加 to: "backend" (type=${messageType})`);
  }

  return new Promise((resolve, reject) => {
    let retryCount = 0;

    const doRegisterPending = () => {
      // timeout 仅在消息“实际发送”时才开始计时（见 send()/flush 的 startTimeout）
      const timeoutRef = { id: null };

      const startTimeout = () => {
        if (timeoutRef.id) { return; }
        timeoutRef.id = setTimeout(() => {
          pendingRequests.delete(requestId);
          requestRetries.delete(requestId);
          reject(new Error("请求超时"));
        }, timeout);
      };

      pendingRequests.set(requestId, {
        startTimeout,
        resolve: (data) => {
          if (timeoutRef.id) { clearTimeout(timeoutRef.id); }
          resolve(data);
        },
        reject: (error) => {
          if (timeoutRef.id) { clearTimeout(timeoutRef.id); }
          reject(error);
        }
      });
    };

    const sendOnce = () => {
      if (!isConnected()) {
        doRegisterPending();
        messageQueue.push(message);
        logger?.debug?.(`📥 请求已排队（连接未建立）: ${messageType}`, {
          request_id: requestId,
          queue_length: messageQueue.length,
          ready_state_name: getReadyStateName()
        });
        return;
      }

      doRegisterPending();
      try {
        const h = pendingRequests.get(requestId);
        if (h && typeof h.startTimeout === "function") {
          h.startTimeout();
        }
      } catch (e) { logger?.debug?.("[WSClient] startTimeout failed", e); }

      try {
        message.timestamp = Date.now();
        const socket = getSocket();
        socket.send(JSON.stringify(message));
        logger?.debug?.(`WS request sent: ${messageType}`, message);
      } catch (error) {
        if (retryCount < maxRetries) {
          retryCount += 1;
          requestRetries.set(requestId, retryCount);
          logger?.warn?.(`WS请求发送失败，第${retryCount}次重试: ${error.message}`);
          setTimeout(() => sendOnce(), 1000 * retryCount);
        } else {
          pendingRequests.delete(requestId);
          requestRetries.delete(requestId);
          const err = error instanceof Error ? error : new Error(error?.message || "WebSocket请求失败");
          reject(err);
        }
      }
    };

    sendOnce();
  });
}

