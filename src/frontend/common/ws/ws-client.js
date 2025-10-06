/**
 
 * WSClient (moved)
 
 */

import Logger from "../utils/logger.js";

import {
  WEBSOCKET_EVENTS,
  WEBSOCKET_MESSAGE_EVENTS,
  WEBSOCKET_MESSAGE_TYPES,
} from "../event/event-constants.js";

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

  static VALID_MESSAGE_TYPES = [
    'pdf_list_updated',
    'pdf_list',
    'list',  // 后端广播列表更新时使用的类型
    'load_pdf_file',
    'pdf_detail_response',
    'success',
    'error',
    'response',
    'system_status'
  ];

  constructor(url, eventBus) {
    this.#url = url;
    this.#eventBus = eventBus;
    this.#logger = new Logger("WSClient");
    this.#setupEventListeners();
  }

  #setupEventListeners() {
    this.#eventBus.on(
      WEBSOCKET_EVENTS.MESSAGE.SEND,
      (message) => {
        this.#logger.info(
          `Received request to send message: ${JSON.stringify(
            message,
            null,
            2
          )}`
        );
        this.send(message);
      },
      { subscriberId: "WSClient" }
    );

    // 添加状态查询响应
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
          this.#socket.removeEventListener('open', onOpen);
          this.#socket.removeEventListener('error', onError);
        };

        this.#socket.addEventListener('open', onOpen);
        this.#socket.addEventListener('error', onError);

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

  disconnect() {
    if (this.#socket) {
      this.#logger.info("Disconnecting WebSocket.");
      this.#socket.close(1000, "Client initiated disconnect.");
      this.#socket = null;
      this.#isConnectedFlag = false;
    }
  }

  isConnected() {
    return this.#isConnectedFlag && this.#socket?.readyState === WebSocket.OPEN;
  }

  send(messageInput) {
    // 支持两种调用方式:
    // 1. send({ type, data }) - 传统方式，自动添加timestamp
    // 2. send({ type, request_id, data, ... }) - 完整消息，保留所有字段
    const type = messageInput.type;
    const data = messageInput.data || {};

    // 保留原始消息的所有字段（如 request_id），并添加 timestamp（如果没有）
    const message = {
      ...messageInput,  // 保留所有原始字段
      timestamp: messageInput.timestamp || Date.now()  // 添加时间戳（如果没有）
    };

    if (this.isConnected()) {
      try {
        this.#socket.send(JSON.stringify(message));
        this.#logger.debug(`✉️ 已发送消息: ${type}`, {
          type,
          data,
          request_id: message.request_id || 'none'
        });
      } catch (error) {
        const errorInfo = {
          error_code: 'MESSAGE_SEND_ERROR',
          message_type: type,
          error_name: error.name,
          error_message: error.message,
          ready_state: this.#socket?.readyState,
          ready_state_name: this.#getReadyStateName(),
          queued_messages: this.#messageQueue.length,
          diagnostic: '消息发送失败，可能是连接已断开或消息格式错误'
        };

        this.#logger.error(`❌ 消息发送失败: ${type}`, JSON.stringify(errorInfo, null, 2));

        this.#eventBus.emit(
          WEBSOCKET_EVENTS.MESSAGE.SEND_FAILED,
          errorInfo,
          { actorId: "WSClient" }
        );

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

      this.#connectionHistory.push({
        event: 'connected',
        ...connectionInfo
      });

      this.#logger.info('✅ WebSocket连接已建立', JSON.stringify(connectionInfo, null, 2));
      this.#isConnectedFlag = true;
      this.#reconnectAttempts = 0;
      this.#lastError = null;

      this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED, connectionInfo, {
        actorId: "WSClient",
      });
      this.#flushMessageQueue();
    };

    this.#socket.onmessage = (event) => this.#handleMessage(event.data);

    this.#socket.onclose = (event) => {
      const closeInfo = {
        code: event.code,
        reason: event.reason || '未提供原因',
        wasClean: event.wasClean,
        url: this.#url,
        timestamp: Date.now(),
        queued_messages: this.#messageQueue.length
      };

      this.#connectionHistory.push({
        event: 'closed',
        ...closeInfo
      });

      this.#logger.warn('⚠️ WebSocket连接已关闭', JSON.stringify(closeInfo, null, 2));
      this.#isConnectedFlag = false;

      this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.CLOSED, closeInfo, {
        actorId: "WSClient",
      });
      this.#attemptReconnect();
    };

    this.#socket.onerror = (error) => {
      const errorInfo = {
        error_code: 'CONNECTION_ERROR',
        url: this.#url,
        ready_state: this.#socket?.readyState,
        ready_state_name: this.#getReadyStateName(),
        reconnect_attempts: this.#reconnectAttempts,
        max_reconnect_attempts: this.#maxReconnectAttempts,
        timestamp: Date.now(),
        error
      };

      this.#lastError = errorInfo;
      this.#connectionHistory.push({
        event: 'error',
        ...errorInfo
      });

      this.#logger.error('❌ WebSocket连接错误', JSON.stringify(errorInfo, null, 2));

      this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.ERROR, errorInfo, {
        actorId: "WSClient",
      });
    };
  }

  #handleMessage(rawData) {
    try {
      const message = JSON.parse(rawData);
      this.#logger.debug(`Received message: ${message.type}`, JSON.stringify(message, null, 2));

      if (!message.type) {
        this.#logger.error('❌ WebSocket消息缺少type字段', {
          rawData: rawData.substring(0, 200),
          message,
          diagnostic: '后端消息必须包含type字段，请检查消息格式'
        });
        this.#eventBus.emit(WEBSOCKET_MESSAGE_EVENTS.ERROR, {
          error_code: 'MISSING_MESSAGE_TYPE',
          message: '消息缺少type字段',
          raw_message: message
        }, { actorId: 'WSClient' });
        return;
      }

      // 发出通用的 websocket:message:received 事件（所有消息都会发出）
      // 这允许任何 Feature 监听所有 WebSocket 消息并自行过滤
      this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, message, {
        actorId: 'WSClient'
      });

      if (!WSClient.VALID_MESSAGE_TYPES.includes(message.type)) {
        this.#logger.warn(`⚠️ 未知WebSocket消息类型: ${message.type}`, JSON.stringify({
          receivedType: message.type,
          validTypes: WSClient.VALID_MESSAGE_TYPES,
          message,
          diagnostic: {
            suggestion: '请检查后端消息协议是否更新，或前端VALID_MESSAGE_TYPES是否需要添加新类型',
            action: '如果这是预期的新消息类型，请在WSClient.VALID_MESSAGE_TYPES中添加'
          }
        }, null, 2));
        this.#eventBus.emit(WEBSOCKET_MESSAGE_EVENTS.UNKNOWN, {
          error_code: 'UNKNOWN_MESSAGE_TYPE',
          received_type: message.type,
          valid_types: WSClient.VALID_MESSAGE_TYPES,
          message
        }, { actorId: 'WSClient' });
      }

      let targetEvent = null;
      switch (message.type) {
        case "pdf_list_updated":
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.PDF_LIST_UPDATED;
          break;
        case "pdf_list":
        case "list":  // 后端广播列表更新使用 'list' 类型
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.PDF_LIST;
          break;
        case "bookmark/list":
          this._settlePendingRequest(message);
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.BOOKMARK_LIST;
          break;
        case "bookmark/save":
          this._settlePendingRequest(message);
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.BOOKMARK_SAVE;
          break;
        case "load_pdf_file":
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.LOAD_PDF_FILE;
          break;
        case "pdf_detail_response":
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
          this._handlePDFDetailResponse(message);
          break;
        case "success":
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.SUCCESS;
          break;
        case "error":
          this._settlePendingRequest(message, { error: message?.error || message?.data });
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.ERROR;
          break;
        case "response":
          // Treat generic "response" messages as ACK: settle pending request and do not emit
          this._settlePendingRequest(message);
          return;
        case "system_status":
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.SYSTEM_STATUS;
          break;
        default:
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.UNKNOWN;
      }

      if (targetEvent) {
        this.#logger.debug(`Routing message to event: ${targetEvent}`);
        this.#eventBus.emit(targetEvent, message, { actorId: "WSClient" });
      }
    } catch (error) {
      const errorContext = {
        error_code: 'MESSAGE_PARSE_ERROR',
        error_name: error.name,
        error_message: error.message,
        stack: error.stack,
        raw_data_preview: rawData.substring(0, 200),
        raw_data_length: rawData.length,
        diagnostic: '消息解析失败，可能是JSON格式错误或包含非法字符'
      };

      this.#logger.error('❌ WebSocket消息解析失败', JSON.stringify(errorContext, null, 2));

      this.#eventBus.emit(WEBSOCKET_MESSAGE_EVENTS.ERROR, errorContext, {
        actorId: 'WSClient'
      });
    }
  }

  /**
   * 检测是否是日志确认响应（静默处理，避免无订阅者警告）
   * @param {object} message - WebSocket消息
   * @returns {boolean} 是否是日志确认响应
   */
  #isLogConfirmationResponse(message) {
    // 检测特征：
    // 1. type: "response"
    // 2. message: "Console log recorded successfully"
    // 3. data.logged: true
    return (
      message.type === 'response' &&
      message.message === 'Console log recorded successfully' &&
      message.data?.logged === true
    );
  }

  /**
   * 生成唯一的请求ID
   * @returns {string} 唯一的请求ID
   */
  _generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  _settlePendingRequest(message, { error = null, data = undefined } = {}) {
    const requestId = message?.request_id;
    if (!requestId || !this.#pendingRequests.has(requestId)) {
      return false;
    }

    const handlers = this.#pendingRequests.get(requestId);
    this.#pendingRequests.delete(requestId);
    this.#requestRetries.delete(requestId);

    if (error) {
      const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : (error?.message || 'WebSocket请求失败'));
      handlers.reject(err);
    } else {
      handlers.resolve(data !== undefined ? data : message?.data);
    }
    return true;
  }


  /**
   * 构建符合标准协议的PDF详情请求消息
   * @param {string} pdfId - PDF文件ID
   * @param {string} requestId - 请求ID
   * @returns {object} 标准格式的消息
   */
  _buildPDFDetailRequestMessage(pdfId, requestId) {
    return {
      type: WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_REQUEST,
      request_id: requestId,
      timestamp: Date.now(),
      data: {
        pdf_id: pdfId
      }
    };
  }

  async request(messageType, payload = {}, options = {}) {
    const { timeout = 5000, maxRetries = 0 } = options;
    const requestId = this._generateRequestId();
    const message = {
      type: messageType,
      request_id: requestId,
      timestamp: Date.now(),
      data: payload,
    };

    return new Promise((resolve, reject) => {
      let retryCount = 0;

      const sendOnce = () => {
        if (!this.isConnected()) {
          handleError(new Error('WebSocket连接未建立'));
          return;
        }

        const timeoutId = setTimeout(() => {
          handleError(new Error('请求超时'));
        }, timeout);

        this.#pendingRequests.set(requestId, {
          resolve: (data) => {
            clearTimeout(timeoutId);
            resolve(data);
          },
          reject: (error) => {
            clearTimeout(timeoutId);
            reject(error);
          }
        });

        try {
          message.timestamp = Date.now();
          this.#socket.send(JSON.stringify(message));
          this.#logger.debug(`WS request sent: ${messageType}`, message);
        } catch (error) {
          clearTimeout(timeoutId);
          handleError(error);
        }
      };

      const handleError = (error) => {
        if (retryCount < maxRetries) {
          retryCount += 1;
          this.#requestRetries.set(requestId, retryCount);
          this.#logger.warn(`WS请求失败，第${retryCount}次重试: ${error.message}`);
          setTimeout(() => {
            sendOnce();
          }, 1000 * retryCount);
        } else {
          this.#pendingRequests.delete(requestId);
          this.#requestRetries.delete(requestId);
          const err = error instanceof Error ? error : new Error(error?.message || 'WebSocket请求失败');
          reject(err);
        }
      };

      sendOnce();
    });
  }

  /**
   * 处理PDF详情响应
   * @param {object} message - 响应消息
   * @private
   */
  _handlePDFDetailResponse(message) {
    const { data, error } = message || {};
    const err = error ? new Error(error.message || 'PDF详情请求失败') : null;
    this._settlePendingRequest(message || {}, { error: err, data });
  }

  /**
   * 发送PDF详情请求
   * @param {string} pdfId - PDF文件ID
   * @param {number} timeout - 超时时间（毫秒），默认5000
   * @param {number} maxRetries - 最大重试次数，默认3
   * @returns {Promise<object>} PDF详情数据
   */
  async sendPDFDetailRequest(pdfId, timeout = 5000, maxRetries = 3) {
    return this.request(
      WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_REQUEST,
      { pdf_id: pdfId },
      { timeout, maxRetries }
    );
  }
#attemptReconnect() {
    if (this.#reconnectAttempts >= this.#maxReconnectAttempts) {
      const failureInfo = {
        error_code: 'MAX_RECONNECT_ATTEMPTS',
        url: this.#url,
        attempts: this.#reconnectAttempts,
        max_attempts: this.#maxReconnectAttempts,
        queued_messages: this.#messageQueue.length,
        last_error: this.#lastError,
        connection_history: this.#connectionHistory.slice(-5)
      };

      this.#logger.error('❌ WebSocket重连失败：已达最大重试次数', JSON.stringify(failureInfo, null, 2));

      this.#eventBus.emit(WEBSOCKET_EVENTS.RECONNECT.FAILED, failureInfo, {
        actorId: "WSClient",
      });
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

    setTimeout(
      () => this.connect(),
      delay
    );
  }

  #flushMessageQueue() {
    const queueLength = this.#messageQueue.length;
    if (queueLength === 0) {
      return;
    }

    this.#logger.info(`📤 开始发送队列中的消息`, JSON.stringify({
      queue_length: queueLength,
      messages: this.#messageQueue.map(m => m.type)
    }, null, 2));

    let successCount = 0;
    let failCount = 0;

    while (this.#messageQueue.length > 0) {
      const message = this.#messageQueue.shift();
      try {
        // 保留原始消息（包含 request_id 等字段），避免丢失请求关联
        this.send(message);
        successCount++;
      } catch (error) {
        failCount++;
        this.#logger.error(`队列消息发送失败: ${message.type}`, error);
      }
    }

    this.#logger.info('✅ 队列消息发送完成', JSON.stringify({
      total: queueLength,
      success: successCount,
      failed: failCount
    }, null, 2));
  }

  #getReadyStateName() {
    if (!this.#socket) return 'NO_SOCKET';
    const states = {
      [WebSocket.CONNECTING]: 'CONNECTING',
      [WebSocket.OPEN]: 'OPEN',
      [WebSocket.CLOSING]: 'CLOSING',
      [WebSocket.CLOSED]: 'CLOSED'
    };
    return states[this.#socket.readyState] || 'UNKNOWN';
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
}

export default WSClient;





