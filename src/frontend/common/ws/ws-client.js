/**
 *
 * WSClient（面条治理版：主文件仅保留装配/连接管理）
 *
 * 详细说明见：docs/standards/ws-client.md
 *
 */

import Logger from "../utils/logger.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../event/event-constants.js";

import { WS_CLIENT_VALID_MESSAGE_TYPES, buildAllowedOutboundTypes } from "./ws-client-contract.js";
import { resolveWsClientIdentity } from "./ws-client-identity.js";
import { requestWsClientMessage, settlePendingRequest } from "./ws-client-requests.js";
import { sendWsClientUnregister } from "./ws-client-unregister.js";
import { handleWsClientInboundRawMessage } from "./ws-client-inbound-router.js";

export class WSClient {
  #url;
  #eventBus;
  #logger;
  #socket = null;
  #isConnectedFlag = false;
  #reconnectAttempts = 0;
  #maxReconnectAttempts = 5;
  #reconnectDelay = 1000;
  #messageQueue = [];
  #pendingRequests = new Map();
  #requestRetries = new Map();
  #lastError = null;
  #connectionHistory = [];
  #identity = null;

  static VALID_MESSAGE_TYPES = WS_CLIENT_VALID_MESSAGE_TYPES;
  static ALLOWED_OUTBOUND_TYPES = buildAllowedOutboundTypes(WEBSOCKET_MESSAGE_TYPES);

  constructor(url, eventBus, identityOptions = null) {
    this.#url = url;
    this.#eventBus = eventBus;
    this.#logger = new Logger("WSClient");
    const location = (typeof window !== "undefined" && window.location) ? window.location : null;
    this.#identity = resolveWsClientIdentity(identityOptions, { logger: this.#logger, location });
    this.#setupEventListeners();
  }

  #setupEventListeners() {
    this.#eventBus.on(
      WEBSOCKET_EVENTS.MESSAGE.SEND,
      (message) => {
        this.#logger.info(
          `Received request to send message: ${JSON.stringify(message, null, 2)}`
        );
        this.send(message);
      },
      { subscriberId: "WSClient" }
    );

    this.#eventBus.on(
      WEBSOCKET_EVENTS.MSG_CENTER.STATUS.REQUEST,
      () => {
        const statusData = {
          connected: this.isConnected(),
          url: this.#url,
          readyState: this.#socket?.readyState || null,
          reconnectAttempts: this.#reconnectAttempts
        };
        this.#logger.info(`Status requested, responding with: ${JSON.stringify(statusData)}`);
        this.#eventBus.emit(WEBSOCKET_EVENTS.MSG_CENTER.STATUS.RESPONSE, statusData, {
          actorId: "WSClient"
        });
      },
      { subscriberId: "WSClient" }
    );
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.#logger.info(`Connecting to WebSocket server: ${this.#url}`);
        this.#socket = new WebSocket(this.#url);

        const onOpen = () => {
          cleanup();
          resolve();
        };

        const onError = (error) => {
          cleanup();
          this.#logger.error("Failed to initiate WebSocket connection.", error);
          this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.FAILED, error, {
            actorId: "WSClient",
          });
          reject(error);
        };

        const cleanup = () => {
          try { this.#socket.removeEventListener("open", onOpen); } catch (e) { this.#logger.debug("[WSClient] cleanup removeEventListener(open) failed", e); }
          try { this.#socket.removeEventListener("error", onError); } catch (e) { this.#logger.debug("[WSClient] cleanup removeEventListener(error) failed", e); }
        };

        this.#socket.addEventListener("open", onOpen);
        this.#socket.addEventListener("error", onError);

        this.#attachSocketHandlers();
      } catch (error) {
        this.#logger.error("Failed to create WebSocket object.", error);
        this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.FAILED, error, {
          actorId: "WSClient",
        });
        reject(error);
      }
    });
  }

  async disconnect() {
    if (!this.#socket) { return; }

    this.#logger.info("Disconnecting WebSocket.");

    if (this.isConnected()) {
      try {
        await this.#sendClientUnregister("manual_disconnect");
      } catch (error) {
        this.#logger.debug("[WSClient] 取消注册失败，继续断开", error);
      }
    }

    this.#socket.close(1000, "Client initiated disconnect.");
    this.#socket = null;
    this.#isConnectedFlag = false;
  }

  isConnected() {
    return this.#isConnectedFlag && this.#socket?.readyState === WebSocket.OPEN;
  }

  send(messageInput) {
    const type = messageInput.type;
    const data = messageInput.data || {};

    const message = {
      ...messageInput,
      timestamp: messageInput.timestamp || Date.now()
    };

    const REGISTER_MESSAGES = [
      WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_REQUESTED,
      WEBSOCKET_MESSAGE_TYPES.CLIENT_UNREGISTER_REQUESTED,
      WEBSOCKET_MESSAGE_TYPES.VIEWER_REGISTER_REQUESTED
    ];

    if (!message.to && !REGISTER_MESSAGES.includes(type)) {
      message.to = "backend";
      this.#logger.debug(`[WSClient] 自动添加 to: "backend" (type=${type})`);
    }

    if (this.isConnected()) {
      try {
        try {
          const rid = message.request_id;
          if (rid && this.#pendingRequests.has(rid)) {
            const h = this.#pendingRequests.get(rid);
            if (h && typeof h.startTimeout === "function") {
              h.startTimeout();
            }
          }
        } catch { /* ignore */ }

        this.#socket.send(JSON.stringify(message));
        this.#logger.debug(`✉️ 已发送消息: ${type}`, {
          type,
          data,
          request_id: message.request_id || "none"
        });
      } catch (error) {
        const errorInfo = {
          error_code: "MESSAGE_SEND_ERROR",
          message_type: type,
          error_name: error.name,
          error_message: error.message,
          ready_state: this.#socket?.readyState,
          ready_state_name: this.#getReadyStateName(),
          queued_messages: this.#messageQueue.length,
          diagnostic: "消息发送失败，可能是连接已断开或消息格式错误"
        };

        this.#logger.error(`❌ 消息发送失败: ${type}`, JSON.stringify(errorInfo, null, 2));
        this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND_FAILED, errorInfo, { actorId: "WSClient" });
        this.#messageQueue.push(message);
        this.#logger.info(`📥 消息已加入队列，等待重连后发送: ${type}`);
      }
    } else {
      this.#messageQueue.push(message);
      this.#logger.debug(`📥 消息已排队（连接未建立）: ${type}`, {
        queue_length: this.#messageQueue.length,
        ready_state: this.#socket?.readyState,
        ready_state_name: this.#getReadyStateName()
      });
    }
  }

  #attachSocketHandlers() {
    this.#socket.onopen = () => {
      const connectionInfo = {
        url: this.#url,
        timestamp: Date.now(),
        reconnect_attempts: this.#reconnectAttempts
      };

      this.#connectionHistory.push({ event: "connected", ...connectionInfo });
      this.#logger.info("✅ WebSocket连接已建立", JSON.stringify(connectionInfo, null, 2));
      this.#isConnectedFlag = true;
      this.#reconnectAttempts = 0;
      this.#lastError = null;

      this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED, connectionInfo, { actorId: "WSClient" });
      this.#flushMessageQueue();
    };

    this.#socket.onmessage = (event) => this.#handleMessage(event.data);

    this.#socket.onclose = (event) => {
      const closeInfo = {
        code: event.code,
        reason: event.reason || "未提供原因",
        wasClean: event.wasClean,
        url: this.#url,
        timestamp: Date.now(),
        queued_messages: this.#messageQueue.length
      };

      this.#connectionHistory.push({ event: "closed", ...closeInfo });
      this.#logger.warn("⚠️ WebSocket连接已关闭", JSON.stringify(closeInfo, null, 2));
      this.#isConnectedFlag = false;

      this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.CLOSED, closeInfo, { actorId: "WSClient" });
      this.#attemptReconnect();
    };

    this.#socket.onerror = (error) => {
      const errorInfo = {
        error_code: "CONNECTION_ERROR",
        url: this.#url,
        ready_state: this.#socket?.readyState,
        ready_state_name: this.#getReadyStateName(),
        reconnect_attempts: this.#reconnectAttempts,
        max_reconnect_attempts: this.#maxReconnectAttempts,
        timestamp: Date.now(),
        error
      };

      this.#lastError = errorInfo;
      this.#connectionHistory.push({ event: "error", ...errorInfo });
      this.#logger.error("❌ WebSocket连接错误", JSON.stringify(errorInfo, null, 2));
      this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.ERROR, errorInfo, { actorId: "WSClient" });
    };
  }

  #handleMessage(rawData) {
    handleWsClientInboundRawMessage({
      rawData,
      eventBus: this.#eventBus,
      logger: this.#logger,
      validMessageTypes: WSClient.VALID_MESSAGE_TYPES,
      pendingRequests: this.#pendingRequests,
      settlePendingRequest: (message, options = {}) => this._settlePendingRequest(message, options),
    });
  }

  _settlePendingRequest(message, { error = null, data = undefined } = {}) {
    return settlePendingRequest({
      message,
      pendingRequests: this.#pendingRequests,
      requestRetries: this.#requestRetries,
      error,
      data,
    });
  }

  async #sendClientUnregister(reason = "window_closing") {
    await sendWsClientUnregister({
      identity: this.#identity,
      request: this.request.bind(this),
      logger: this.#logger,
      reason,
    });
  }

  request(messageType, payload = {}, options = {}) {
    return requestWsClientMessage({
      messageType,
      payload,
      options,
      logger: this.#logger,
      isConnected: () => this.isConnected(),
      getSocket: () => this.#socket,
      getReadyStateName: () => this.#getReadyStateName(),
      messageQueue: this.#messageQueue,
      pendingRequests: this.#pendingRequests,
      requestRetries: this.#requestRetries,
      allowedOutboundTypes: WSClient.ALLOWED_OUTBOUND_TYPES,
    });
  }

  async sendPDFDetailRequest(pdfId, timeout = 5000, maxRetries = 3) {
    return this.request(
      WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_REQUEST,
      { pdf_id: pdfId },
      { timeout, maxRetries, metadata: { version: "1.0.0" } }
    );
  }

  async sendHeartbeat(timeout = 4000) {
    return this.request(
      WEBSOCKET_MESSAGE_TYPES.HEARTBEAT_REQUESTED,
      {},
      { timeout, metadata: { version: "1.0.0" } }
    );
  }

  #attemptReconnect() {
    if (this.#reconnectAttempts >= this.#maxReconnectAttempts) {
      const failureInfo = {
        error_code: "MAX_RECONNECT_ATTEMPTS",
        url: this.#url,
        attempts: this.#reconnectAttempts,
        max_attempts: this.#maxReconnectAttempts,
        queued_messages: this.#messageQueue.length,
        last_error: this.#lastError,
        connection_history: this.#connectionHistory.slice(-5)
      };

      this.#logger.error("❌ WebSocket重连失败：已达最大重试次数", JSON.stringify(failureInfo, null, 2));
      this.#eventBus.emit(WEBSOCKET_EVENTS.RECONNECT.FAILED, failureInfo, { actorId: "WSClient" });
      return;
    }

    this.#reconnectAttempts++;
    const delay = this.#reconnectDelay * this.#reconnectAttempts;

    this.#logger.info(
      `🔄 尝试重新连接 (${this.#reconnectAttempts}/${this.#maxReconnectAttempts})`,
      JSON.stringify({
        url: this.#url,
        delay_ms: delay,
        queued_messages: this.#messageQueue.length
      }, null, 2)
    );

    setTimeout(() => this.connect(), delay);
  }

  #flushMessageQueue() {
    const queueLength = this.#messageQueue.length;
    if (queueLength === 0) { return; }

    this.#logger.info("📤 开始发送队列中的消息", JSON.stringify({
      queue_length: queueLength,
      messages: this.#messageQueue.map(m => m.type)
    }, null, 2));

    let successCount = 0;
    let failCount = 0;

    while (this.#messageQueue.length > 0) {
      const message = this.#messageQueue.shift();
      try {
        this.send(message);
        successCount++;
      } catch (error) {
        failCount++;
        this.#logger.error(`队列消息发送失败: ${message.type}`, error);
      }
    }

    this.#logger.info("✅ 队列消息发送完成", JSON.stringify({
      total: queueLength,
      success: successCount,
      failed: failCount
    }, null, 2));
  }

  #getReadyStateName() {
    if (!this.#socket) { return "NO_SOCKET"; }
    const states = {
      [WebSocket.CONNECTING]: "CONNECTING",
      [WebSocket.OPEN]: "OPEN",
      [WebSocket.CLOSING]: "CLOSING",
      [WebSocket.CLOSED]: "CLOSED"
    };
    return states[this.#socket.readyState] || "UNKNOWN";
  }

  getConnectionHistory() {
    return [...this.#connectionHistory];
  }

  getLastError() {
    return this.#lastError;
  }

  getDebugInfo() {
    return {
      url: this.#url,
      connected: this.#isConnectedFlag,
      ready_state: this.#socket?.readyState,
      ready_state_name: this.#getReadyStateName(),
      reconnect_attempts: this.#reconnectAttempts,
      max_reconnect_attempts: this.#maxReconnectAttempts,
      queued_messages: this.#messageQueue.length,
      pending_requests: this.#pendingRequests.size,
      last_error: this.#lastError,
      connection_history: this.#connectionHistory.slice(-10)
    };
  }

  getIdentity() {
    return this.#identity ? { ...this.#identity } : null;
  }

  getClientName() {
    return this.#identity?.client_name || null;
  }
}

export default WSClient;

