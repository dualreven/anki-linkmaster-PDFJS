/**
 * WebSocket Client Module
 * 负责与后端服务器的WebSocket通信
 */

// 导入日志模块
import Logger, { LogLevel } from '../utils/logger.js';

// 导入事件常量
import {
  WEBSOCKET_EVENTS,
  WEBSOCKET_MESSAGE_EVENTS
} from './event-constants.js';

class WSClient {
  constructor(url, eventBus) {
    this.url = url;
    this.eventBus = eventBus;
    this.logger = new Logger('WSClient');
    this.socket = null;
    this.isConnectedFlag = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.messageQueue = [];
  }

  /**
   * 连接WebSocket服务器
   */
  connect() {
    try {
      this.logger.info(`正在连接到WebSocket服务器: ${this.url}`);
      
      this.socket = new WebSocket(this.url);
      
      this.socket.onopen = () => {
        this.logger.info('WebSocket连接已建立');
        this.isConnectedFlag = true;
        this.reconnectAttempts = 0;
        
        // 通过事件总线通知连接已建立
        if (this.eventBus) {
          this.eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED);
        }
        
        // 发送队列中的消息
        this.flushMessageQueue();
      };
      
      this.socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };
      
      this.socket.onclose = () => {
        this.logger.warn('WebSocket连接已关闭');
        this.isConnectedFlag = false;
        
        // 通过事件总线通知连接已关闭
        if (this.eventBus) {
          this.eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.CLOSED);
        }
        
        // 尝试重新连接
        this.attemptReconnect();
      };
      
      this.socket.onerror = (error) => {
        this.logger.error('WebSocket连接错误', error);
        
        // 通过事件总线通知连接错误
        if (this.eventBus) {
          this.eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.ERROR, error);
        }
      };
      
    } catch (error) {
      this.logger.error('WebSocket连接失败', error);
      
      // 通过事件总线通知连接失败
      if (this.eventBus) {
        this.eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.FAILED, error);
      }
    }
  }

  /**
   * 断开WebSocket连接
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.isConnectedFlag = false;
    }
  }

  /**
   * 检查是否已连接
   * @returns {boolean} 是否已连接
   */
  isConnected() {
    return this.isConnectedFlag;
  }

  /**
   * 发送消息
   * @param {string} type - 消息类型
   * @param {Object} data - 消息数据
   */
  send(type, data = {}) {
    const message = {
      type,
      data,
      timestamp: new Date().toISOString()
    };
    
    if (this.isConnected()) {
      try {
        this.socket.send(JSON.stringify(message));
        this.logger.debug(`发送消息: ${type}`);
      } catch (error) {
        this.logger.error(`发送消息失败: ${type}`, error);
        
        // 通过事件总线通知发送失败
        if (this.eventBus) {
          this.eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND_FAILED, { type, error });
        }
      }
    } else {
      // 将消息加入队列，等待连接建立后发送
      this.messageQueue.push(message);
      this.logger.debug(`消息已加入队列: ${type}`);
    }
  }

  /**
   * 处理接收到的消息
   * @param {string} rawData - 原始消息数据
   */
  handleMessage(rawData) {
    try {
      const message = JSON.parse(rawData);
      this.logger.debug(`收到消息: ${message.type}`, message);
      
      // 通过事件总线分发消息，使用标准事件常量
      if (this.eventBus) {
        // 首先分发通用的消息接收事件
        this.eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, message);
        
        // 根据消息类型分发特定事件
        switch (message.type) {
          case 'pdf_list_updated':
            this.eventBus.emit(WEBSOCKET_MESSAGE_EVENTS.PDF_LIST_UPDATED, message);
            break;
          case 'pdf_list':
            this.eventBus.emit(WEBSOCKET_MESSAGE_EVENTS.PDF_LIST, message);
            break;
          case 'success':
            this.eventBus.emit(WEBSOCKET_MESSAGE_EVENTS.SUCCESS, message);
            break;
          case 'error':
            this.eventBus.emit(WEBSOCKET_MESSAGE_EVENTS.ERROR, message);
            break;
          default:
            // 对于未知消息类型，使用标准格式的事件名称
            const eventName = `websocket:message:${message.type}`;
            this.eventBus.emit(eventName, message);
            break;
        }
      }
      
    } catch (error) {
      this.logger.error('解析WebSocket消息失败', error);
    }
  }

  /**
   * 尝试重新连接
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('WebSocket重连次数已达上限');
      
      // 通过事件总线通知重连失败
      if (this.eventBus) {
        this.eventBus.emit(WEBSOCKET_EVENTS.RECONNECT.FAILED);
      }
      
      return;
    }
    
    this.reconnectAttempts++;
    this.logger.info(`尝试重新连接WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  /**
   * 发送队列中的消息
   */
  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      try {
        this.socket.send(JSON.stringify(message));
        this.logger.debug(`发送队列消息: ${message.type}`);
      } catch (error) {
        this.logger.error(`发送队列消息失败: ${message.type}`, error);
        // 将消息重新加入队列
        this.messageQueue.unshift(message);
        break;
      }
    }
  }

  /**
   * 获取连接状态（为了向后兼容）
   * @returns {boolean}
   */
  getConnectedStatus() {
    return this.isConnected();
  }
}

// 导出WSClient类
export default WSClient;