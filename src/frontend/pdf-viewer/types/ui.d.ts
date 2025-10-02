/**
 * UI模块类型定义
 * @file types/ui.d.ts
 */

import { EventBus } from './events';

/**
 * UI管理器接口
 */
export interface IUIManager {
  /**
   * 初始化UI管理器
   */
  initialize(): Promise<void>;

  /**
   * 加载PDF文档到UI
   * @param pdfDocument - PDF文档对象
   */
  loadPdfDocument(pdfDocument: any): Promise<void>;

  /**
   * 更新页码显示
   * @param current - 当前页码
   * @param total - 总页数
   */
  updatePageDisplay(current: number, total: number): void;

  /**
   * 更新缩放显示
   * @param level - 缩放级别
   */
  updateZoomDisplay(level: number): void;

  /**
   * 显示加载状态
   */
  showLoading(): void;

  /**
   * 隐藏加载状态
   */
  hideLoading(): void;

  /**
   * 显示错误
   * @param message - 错误消息
   */
  showError(message: string): void;

  /**
   * 隐藏错误
   */
  hideError(): void;

  /**
   * 销毁UI管理器
   */
  destroy(): void;
}

/**
 * 缩放控制接口
 */
export interface IZoomControls {
  /**
   * 设置缩放级别
   */
  setZoomLevel(level: number): void;

  /**
   * 获取缩放级别
   */
  getZoomLevel(): number;

  /**
   * 放大
   */
  zoomIn(): void;

  /**
   * 缩小
   */
  zoomOut(): void;
}

/**
 * 页面控制接口
 */
export interface IPageControls {
  /**
   * 跳转到指定页
   */
  goToPage(pageNumber: number): void;

  /**
   * 上一页
   */
  previousPage(): void;

  /**
   * 下一页
   */
  nextPage(): void;

  /**
   * 更新页码显示
   */
  updateDisplay(current: number, total: number): void;
}

/**
 * 布局模式
 */
export type ScrollMode = 0 | 1 | 2 | 3; // 垂直/水平/环绕/单页
export type SpreadMode = 0 | 1 | 2; // 无跨页/奇数页/偶数页

/**
 * 布局控制接口
 */
export interface ILayoutControls {
  /**
   * 设置滚动模式
   */
  setScrollMode(mode: ScrollMode): void;

  /**
   * 设置跨页模式
   */
  setSpreadMode(mode: SpreadMode): void;

  /**
   * 旋转页面
   */
  rotate(degrees: number): void;
}

/**
 * 进度/错误显示接口
 */
export interface IProgressErrorDisplay {
  /**
   * 显示进度
   */
  showProgress(message?: string): void;

  /**
   * 隐藏进度
   */
  hideProgress(): void;

  /**
   * 显示错误
   */
  showError(message: string): void;

  /**
   * 隐藏错误
   */
  hideError(): void;
}
