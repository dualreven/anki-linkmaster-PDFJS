/**
 * 适配器层类型定义
 * @file types/adapters.d.ts
 */

import { EventBus } from './events';

/**
 * WebSocket客户端接口（简化版）
 */
export interface WSClient {
  /**
   * 连接到WebSocket服务器
   */
  connect(): Promise<void>;

  /**
   * 断开连接
   */
  disconnect(): void;

  /**
   * 发送消息
   * @param message - 消息对象
   */
  send(message: { type: string; data?: any }): void;

  /**
   * 检查是否已连接
   */
  isConnected(): boolean;
}

/**
 * WebSocket适配器接口
 * @description 负责WebSocket消息与应用事件之间的双向转换
 */
export interface IWebSocketAdapter {
  /**
   * 设置消息处理器
   * 建立WebSocket消息与内部事件之间的双向桥接
   */
  setupMessageHandlers(): void;

  /**
   * 处理WebSocket消息
   * 如果未初始化，将消息加入队列；否则立即路由处理
   *
   * @param message - WebSocket消息
   */
  handleMessage(message: any): void;

  /**
   * 标记为已初始化，处理队列中的消息
   */
  onInitialized(): void;

  /**
   * 销毁适配器，清理所有监听器
   */
  destroy(): void;

  /**
   * 获取适配器状态（用于调试）
   * @returns 状态对象
   */
  getState(): {
    initialized: boolean;
    queuedMessages: number;
    activeListeners: number;
  };
}

/**
 * WebSocketAdapter类
 */
export class WebSocketAdapter implements IWebSocketAdapter {
  /**
   * 创建WebSocket适配器实例
   * @param wsClient - WebSocket客户端实例
   * @param eventBus - 事件总线实例
   */
  constructor(wsClient: WSClient, eventBus: EventBus);

  setupMessageHandlers(): void;
  handleMessage(message: any): void;
  onInitialized(): void;
  destroy(): void;
  getState(): {
    initialized: boolean;
    queuedMessages: number;
    activeListeners: number;
  };
}

/**
 * 创建WebSocket适配器实例（工厂函数）
 *
 * @param wsClient - WebSocket客户端实例
 * @param eventBus - 事件总线实例
 * @returns 适配器实例
 *
 * @example
 * import { createWebSocketAdapter } from './adapters/websocket-adapter.js';
 *
 * const adapter = createWebSocketAdapter(wsClient, eventBus);
 * adapter.setupMessageHandlers();
 */
export function createWebSocketAdapter(
  wsClient: WSClient,
  eventBus: EventBus
): WebSocketAdapter;
