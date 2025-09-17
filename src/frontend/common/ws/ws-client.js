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
  }

  connect() {
    try {
      this.#logger.info(`Connecting to WebSocket server: ${this.#url}`);
      this.#socket = new WebSocket(this.#url);
      this.#attachSocketHandlers();
    } catch (error) {
      this.#logger.error("Failed to initiate WebSocket connection.", error);
      this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.FAILED, error, {
        actorId: "WSClient",
      });
    }
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

  send({ type, data = {} }) {
    const message = { type, data, timestamp: Date.now() };
    if (this.isConnected()) {
      try {
        this.#socket.send(JSON.stringify(message));
        this.#logger.debug(`Sent message: ${type}`);
      } catch (error) {
        this.#logger.error(`Failed to send message: ${type}`, error);
        this.#eventBus.emit(
          WEBSOCKET_EVENTS.MESSAGE.SEND_FAILED,
          { type, error },
          { actorId: "WSClient" }
        );
      }
    } else {
      this.#messageQueue.push(message);
      this.#logger.debug(`Message queued, connection not available: ${type}`);
    }
  }

  #attachSocketHandlers() {
    this.#socket.onopen = () => {
      this.#logger.info("WebSocket connection established.");
      this.#isConnectedFlag = true;
      this.#reconnectAttempts = 0;
      this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED, undefined, {
        actorId: "WSClient",
      });
      this.#flushMessageQueue();
    };

    this.#socket.onmessage = (event) => this.#handleMessage(event.data);

    this.#socket.onclose = () => {
      this.#logger.warn("WebSocket connection closed.");
      this.#isConnectedFlag = false;
      this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.CLOSED, undefined, {
        actorId: "WSClient",
      });
      this.#attemptReconnect();
    };

    this.#socket.onerror = (error) => {
      this.#logger.error("WebSocket connection error.", error);
      this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.ERROR, error, {
        actorId: "WSClient",
      });
    };
  }

  #handleMessage(rawData) {
    try {
      const message = JSON.parse(rawData);
      this.#logger.debug(`Received message: ${message.type}`, message);
      let targetEvent = null;
      switch (message.type) {
        case "pdf_list_updated":
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.PDF_LIST_UPDATED;
          break;
        case "pdf_list":
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.PDF_LIST;
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
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.ERROR;
          break;
        case "response":
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
          break;
        default:
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.UNKNOWN;
          this.#logger.warn(`Unknown message type: ${message.type}`);
      }

      if (targetEvent) {
        this.#logger.debug(`Routing message to event: ${targetEvent}`);
        this.#eventBus.emit(targetEvent, message, { actorId: "WSClient" });
      } else {
        this.#logger.warn(`No target event found for message type: ${message.type}`);
      }
    } catch (error) {
      this.#logger.error("Failed to parse incoming WebSocket message.", error);
    }
  }

  /**
   * 生成唯一的请求ID
   * @returns {string} 唯一的请求ID
   */
  _generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

  /**
   * 处理PDF详情响应
   * @param {object} message - 响应消息
   * @private
   */
  _handlePDFDetailResponse(message) {
    const { request_id, data, error } = message;
    
    if (this.#pendingRequests.has(request_id)) {
      const { resolve, reject } = this.#pendingRequests.get(request_id);
      this.#pendingRequests.delete(request_id);
      this.#requestRetries.delete(request_id);
      
      if (error) {
        reject(new Error(error.message || 'PDF详情请求失败'));
      } else {
        resolve(data);
      }
    }
  }

  /**
   * 发送PDF详情请求
   * @param {string} pdfId - PDF文件ID
   * @param {number} timeout - 超时时间（毫秒），默认5000
   * @param {number} maxRetries - 最大重试次数，默认3
   * @returns {Promise<object>} PDF详情数据
   */
  async sendPDFDetailRequest(pdfId, timeout = 5000, maxRetries = 3) {
    const requestId = this._generateRequestId();
    const message = this._buildPDFDetailRequestMessage(pdfId, requestId);
    
    return new Promise((resolve, reject) => {
      let retryCount = 0;
      
      const executeRequest = () => {
        if (!this.isConnected()) {
          handleError(new Error('WebSocket连接未建立'));
          return;
        }

        // 设置超时
        const timeoutId = setTimeout(() => {
          handleError(new Error('PDF详情请求超时'));
        }, timeout);

        // 保存请求信息
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

        // 发送请求
        try {
          this.#socket.send(JSON.stringify(message));
          this.#logger.debug(`PDF详情请求已发送: ${requestId}`, message);
        } catch (error) {
          clearTimeout(timeoutId);
          handleError(error);
        }
      };

      const handleError = (error) => {
        if (retryCount < maxRetries) {
          retryCount++;
          this.#requestRetries.set(requestId, retryCount);
          this.#logger.warn(`PDF详情请求失败，第${retryCount}次重试: ${error.message}`);
          
          setTimeout(() => {
            executeRequest();
          }, 1000 * retryCount); // 指数退避
        } else {
          this.#pendingRequests.delete(requestId);
          this.#requestRetries.delete(requestId);
          reject(new Error(`PDF详情请求失败，已重试${maxRetries}次: ${error.message}`));
        }
      };

      executeRequest();
    });
  }

  #attemptReconnect() {
    if (this.#reconnectAttempts >= this.#maxReconnectAttempts) {
      this.#logger.error("Max WebSocket reconnect attempts reached.");
      this.#eventBus.emit(WEBSOCKET_EVENTS.RECONNECT.FAILED, undefined, {
        actorId: "WSClient",
      });
      return;
    }
    this.#reconnectAttempts++;
    this.#logger.info(
      `Attempting to reconnect (${this.#reconnectAttempts}/${
        this.#maxReconnectAttempts
      })...`
    );
    setTimeout(
      () => this.connect(),
      this.#reconnectDelay * this.#reconnectAttempts
    );
  }

  #flushMessageQueue() {
    this.#logger.info(`Flushing ${this.#messageQueue.length} queued messages.`);
    while (this.#messageQueue.length > 0) {
      const message = this.#messageQueue.shift();
      this.send({ type: message.type, data: message.data });
    }
  }
}

export default WSClient;
