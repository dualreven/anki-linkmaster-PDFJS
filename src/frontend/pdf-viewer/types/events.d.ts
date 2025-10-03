/**
 * 事件类型定义
 * @file types/events.d.ts
 */

import { EventOptions, EventMetadata } from './common';

/**
 * 事件总线接口
 */
export interface EventBus {
  /**
   * 注册事件监听器
   */
  on<T = any>(
    event: string,
    callback: (data: T, metadata?: EventMetadata) => void,
    options?: EventOptions
  ): () => void;

  /**
   * 发射事件
   */
  emit<T = any>(event: string, data: T, metadata?: EventMetadata): void;

  /**
   * 移除事件监听器
   */
  off(event: string, callback?: Function): void;

  /**
   * 销毁事件总线
   */
  destroy(): void;
}

/**
 * PDF文件加载请求事件数据
 */
export interface PDFLoadRequestData {
  /** 文件路径 */
  file_path?: string;
  /** 文件名 */
  filename: string;
  /** 文件URL */
  url: string;
  /** 文件ID(兼容旧格式) */
  fileId?: string;
  /** 初始页码 */
  initialPage?: number;
}

/**
 * PDF文件加载成功事件数据
 */
export interface PDFLoadedData {
  /** PDF文档对象 */
  pdfDocument: any; // PDFDocumentProxy from pdfjs-dist
  /** 总页数 */
  totalPages: number;
  /** 文件信息 */
  fileInfo?: {
    filename: string;
    url: string;
    file_path?: string;
  };
}

/**
 * PDF页面导航事件数据
 */
export interface PageNavigateData {
  /** 目标页码 */
  pageNumber: number;
  /** 导航来源 */
  source?: 'user' | 'bookmark' | 'programmatic';
}

/**
 * PDF缩放事件数据
 */
export interface ZoomChangeData {
  /** 缩放级别 */
  level: number;
  /** 缩放来源 */
  source?: 'user' | 'fit-width' | 'fit-page' | 'programmatic';
}

/**
 * 错误事件数据
 */
export interface ErrorEventData {
  /** 错误对象 */
  error: Error;
  /** 错误上下文 */
  context: string;
  /** 严重程度 */
  severity?: 'warning' | 'error' | 'fatal';
}

/**
 * WebSocket消息类型
 */
export interface WebSocketMessage {
  /** 消息类型 */
  type: string;
  /** 消息数据 */
  data: any;
  /** 消息ID */
  id?: string;
}

/**
 * 作用域事件总线接口
 * 用于解决多人协同开发时的事件命名冲突问题
 */
export interface ScopedEventBus {
  /**
   * 注册模块内事件监听器(自动添加命名空间)
   */
  on<T = any>(
    event: string,
    callback: (data: T, metadata?: EventMetadata) => void,
    options?: EventOptions
  ): () => void;

  /**
   * 发射模块内事件(自动添加命名空间)
   */
  emit<T = any>(event: string, data: T, metadata?: EventMetadata): void;

  /**
   * 注册全局事件监听器(不添加命名空间，用于跨模块通信)
   */
  onGlobal<T = any>(
    event: string,
    callback: (data: T, metadata?: EventMetadata) => void,
    options?: EventOptions
  ): () => void;

  /**
   * 发射全局事件(不添加命名空间，用于跨模块通信)
   */
  emitGlobal<T = any>(event: string, data: T, metadata?: EventMetadata): void;

  /**
   * 移除事件监听器
   */
  off(event: string, callback?: Function): void;

  /**
   * 销毁作用域事件总线
   */
  destroy(): void;
}

/**
 * 搜索选项
 */
export interface SearchOptions {
  /** 是否区分大小写 */
  caseSensitive?: boolean;
  /** 是否全词匹配 */
  wholeWords?: boolean;
  /** 是否高亮所有结果 */
  highlightAll?: boolean;
  /** 是否启用正则表达式 */
  useRegex?: boolean;
}

/**
 * 搜索匹配项
 */
export interface SearchMatch {
  /** 匹配项所在页码 */
  pageNumber: number;
  /** 匹配项在页面中的索引 */
  matchIndex: number;
  /** 匹配的文本内容 */
  text: string;
  /** 匹配项在整个文档中的全局索引 */
  globalIndex: number;
}

/**
 * 搜索执行请求事件数据
 */
export interface SearchQueryData {
  /** 搜索关键词 */
  query: string;
  /** 搜索选项 */
  options: SearchOptions;
}

/**
 * 搜索结果事件数据
 */
export interface SearchResultData {
  /** 搜索关键词 */
  query: string;
  /** 总匹配数 */
  total: number;
  /** 当前匹配索引(从1开始) */
  current: number;
  /** 匹配结果数组 */
  matches: SearchMatch[];
}

/**
 * 搜索导航完成事件数据
 */
export interface SearchNavigateData {
  /** 跳转到的页码 */
  pageNumber: number;
  /** 匹配项索引 */
  matchIndex: number;
  /** 匹配项在整个文档中的全局索引 */
  globalIndex: number;
}

/**
 * 搜索选项改变事件数据
 */
export interface SearchOptionChangeData {
  /** 选项名称 */
  option: 'caseSensitive' | 'wholeWords' | 'highlightAll' | 'useRegex';
  /** 选项值 */
  value: boolean;
}

/**
 * 搜索进度事件数据
 */
export interface SearchProgressData {
  /** 当前搜索页数 */
  current: number;
  /** 总页数 */
  total: number;
  /** 进度百分比(0-100) */
  percentage: number;
}

/**
 * 创建作用域事件总线
 * @param globalEventBus - 全局事件总线实例
 * @param scope - 作用域名称(模块名)
 * @returns 作用域事件总线实例
 */
export function createScopedEventBus(
  globalEventBus: EventBus,
  scope: string
): ScopedEventBus;
