/**
 * 通用类型定义
 * @file types/common.d.ts
 */

/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 日志器接口
 */
export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * 事件监听器选项
 */
export interface EventOptions {
  /** 是否只触发一次 */
  once?: boolean;
  /** 优先级(数字越大优先级越高) */
  priority?: number;
  /** 订阅者ID(用于追踪) */
  subscriberId?: string;
}

/**
 * 事件元数据
 */
export interface EventMetadata {
  /** 事件发起者ID */
  actorId?: string;
  /** 时间戳 */
  timestamp?: number;
  /** 追踪ID */
  traceId?: string;
}

/**
 * 初始化配置
 */
export interface InitOptions {
  /** WebSocket URL */
  wsUrl?: string;
  /** 是否启用验证 */
  enableValidation?: boolean;
  /** 日志级别 */
  logLevel?: LogLevel;
}

/**
 * 状态快照
 */
export interface StateSnapshot {
  /** 是否已初始化 */
  initialized: boolean;
  /** 当前文件 */
  currentFile: string | null;
  /** 当前页码 */
  currentPage: number;
  /** 总页数 */
  totalPages: number;
  /** 缩放级别 */
  zoomLevel: number;
}
