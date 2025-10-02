/**
 * PDF模块类型定义
 * @file types/pdf.d.ts
 */

import { EventBus } from './events';

/**
 * PDF加载选项
 */
export interface LoadOptions {
  /** CMap URL路径 */
  cMapUrl?: string;
  /** CMap是否已打包 */
  cMapPacked?: boolean;
  /** 是否携带凭证 */
  withCredentials?: boolean;
  /** 密码(如果PDF加密) */
  password?: string;
}

/**
 * PDF管理器接口
 */
export interface IPDFManager {
  /**
   * 初始化PDF管理器
   */
  initialize(): Promise<void>;

  /**
   * 加载PDF文件
   * @param url - 文件URL或路径
   * @param options - 加载选项
   * @returns PDF文档对象
   */
  loadPDF(url: string, options?: LoadOptions): Promise<any>;

  /**
   * 获取当前页码
   */
  getCurrentPage(): number;

  /**
   * 设置当前页码
   * @param pageNumber - 页码(从1开始)
   */
  setCurrentPage(pageNumber: number): void;

  /**
   * 获取总页数
   */
  getTotalPages(): number;

  /**
   * 销毁PDF管理器
   */
  destroy(): void;
}

/**
 * PDF加载器接口
 */
export interface IPDFLoader {
  /**
   * 加载PDF文档
   * @param url - 文件URL
   * @param options - 加载选项
   */
  load(url: string, options?: LoadOptions): Promise<any>;

  /**
   * 取消加载
   */
  cancel(): void;

  /**
   * 获取加载进度
   */
  getProgress(): number;
}

/**
 * PDF文档缓存接口
 */
export interface IPDFCacheManager {
  /**
   * 缓存PDF文档
   */
  set(key: string, document: any): void;

  /**
   * 获取缓存的PDF文档
   */
  get(key: string): any | null;

  /**
   * 清除缓存
   */
  clear(): void;

  /**
   * 检查缓存是否存在
   */
  has(key: string): boolean;
}

/**
 * PDF配置
 */
export interface PDFConfig {
  /** Worker源路径 */
  workerSrc?: string;
  /** CMap URL */
  cMapUrl?: string;
  /** 标准字体URL */
  standardFontDataUrl?: string;
  /** 最大图片大小 */
  maxImageSize?: number;
  /** 是否禁用字体 */
  disableFontFace?: boolean;
}
