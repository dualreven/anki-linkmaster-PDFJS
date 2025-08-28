/**
 * @file WebSocket 客户端模块，负责与后端服务器进行实时双向通信。
 * @module WSClient
 */

import Logger from "../utils/logger.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_EVENTS } from "./event-constants.js";

/**
 * @class WSClient
 * @description 管理WebSocket连接、消息收发、自动重连和消息队列。
 *
 * @param {string} url - WebSocket服务器的URL。
 * @param {EventBus} eventBus - 用于在应用内部广播WebSocket事件的事件总线实例。
 */
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

  constructor(url, eventBus) {
    this.#url = url;
    this.#eventBus = eventBus;
    this.#logger = new Logger("WSClient");
  }

  /**
   * 建立到WebSocket服务器的连接。
   */
  connect() {
    try {
      this.#logger.info(`Connecting to WebSocket server: ${this.#url}`);
      this.#socket = new WebSocket(this.#url);
      this.#attachSocketHandlers();
    } catch (error) {
      this.#logger.error("Failed to initiate WebSocket connection.", error);
      this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.FAILED, error);
    }
  }

  /**
   * 主动断开WebSocket连接。
   */
  disconnect() {
    if (this.#socket) {
      this.#logger.info("Disconnecting WebSocket.");
      this.#socket.close(1000, "Client initiated disconnect."); // 1000 is a normal closure
      this.#socket = null;
      this.#isConnectedFlag = false;
    }
  }

  /**
   * 检查当前是否已连接。
   * @returns {boolean} 如果连接已建立，则返回 true。
   */
  isConnected() {
    return this.#isConnectedFlag && this.#socket?.readyState === WebSocket.OPEN;
  }

  /**
   * 发送消息到服务器。
   * @param {object} payload - 包含消息类型和数据的对象。
   * @param {string} payload.type - 消息的类型标识符。
   * @param {object} [payload.data={}] - 附加的消息数据。
   */
  send({ type, data = {} }) {
    const message = { type, data, timestamp: new Date().toISOString() };
    if (this.isConnected()) {
      try {
        this.#socket.send(JSON.stringify(message));
        this.#logger.debug(`Sent message: ${type}`);
      } catch (error) {
        this.#logger.error(`Failed to send message: ${type}`, error);
        this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND_FAILED, { type, error });
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
      this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED);
      this.#flushMessageQueue();
    };

    this.#socket.onmessage = (event) => this.#handleMessage(event.data);

    this.#socket.onclose = () => {
      this.#logger.warn("WebSocket connection closed.");
      this.#isConnectedFlag = false;
      this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.CLOSED);
      this.#attemptReconnect();
    };

    this.#socket.onerror = (error) => {
      this.#logger.error("WebSocket connection error.", error);
      this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.ERROR, error);
    };
  }

  #handleMessage(rawData) {
    try {
      const message = JSON.parse(rawData);
      this.#logger.debug(`Received message: ${message.type}`, message);
      
      this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, message);

      const eventType = Object.keys(WEBSOCKET_MESSAGE_EVENTS).find(
        key => WEBSOCKET_MESSAGE_EVENTS[key].endsWith(message.type)
      );

      if (eventType) {
        this.#eventBus.emit(WEBSOCKET_MESSAGE_EVENTS[eventType], message);
      } else {
        this.#eventBus.emit(WEBSOCKET_MESSAGE_EVENTS.UNKNOWN, message);
      }
    } catch (error) {
      this.#logger.error("Failed to parse incoming WebSocket message.", error);
    }
  }
  
  #attemptReconnect() {
    if (this.#reconnectAttempts >= this.#maxReconnectAttempts) {
      this.#logger.error("Max WebSocket reconnect attempts reached.");
      this.#eventBus.emit(WEBSOCKET_EVENTS.RECONNECT.FAILED);
      return;
    }
    this.#reconnectAttempts++;
    this.#logger.info(`Attempting to reconnect (${this.#reconnectAttempts}/${this.#maxReconnectAttempts})...`);
    setTimeout(() => this.connect(), this.#reconnectDelay * this.#reconnectAttempts);
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
