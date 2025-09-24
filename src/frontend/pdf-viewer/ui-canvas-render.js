/**
 * @file UI Canvas渲染模块
 * @module UICanvasRender
 * @description 处理PDF页面的Canvas渲染功能
 */

import Logger from "../common/utils/logger.js";

/**
 * @class UICanvasRender
 * @description Canvas渲染类，处理PDF页面的渲染和Canvas管理
 */
export class UICanvasRender {
  #logger;
  #canvas = null;
  #ctx = null;
  #renderQueue = [];
  #isRendering = false;

  constructor() {
    this.#logger = new Logger("UICanvasRender");
  }

  /**
   * 初始化Canvas渲染器
   * @param {HTMLCanvasElement} canvas - Canvas元素
   */
  initialize(canvas) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext("2d");
    this.#logger.debug("Canvas renderer initialized");
  }

  /**
   * 渲染PDF页面
   * @param {Object} page - PDF页面对象
   * @param {Object} viewport - 视图端口配置
   * @returns {Promise<void>}
   */
  async renderPage(page, viewport) {
    try {
      this.#logger.debug(`Rendering page with viewport: ${viewport.width}x${viewport.height}`);
      
      // 设置Canvas大小
      this.#resizeCanvas(viewport.width, viewport.height);
      
      // 创建渲染任务
      const renderTask = page.render({
        canvasContext: this.#ctx,
        viewport: viewport
      });
      
      // 等待渲染完成
      await renderTask.promise;
      
      this.#logger.debug("Page rendered successfully");
      
    } catch (error) {
      this.#logger.error("Failed to render page:", error);
      throw error;
    }
  }

  /**
   * 调整Canvas大小
   * @param {number} width - 宽度
   * @param {number} height - 高度
   * @private
   */
  #resizeCanvas(width, height) {
    // 考虑设备像素比
    const dpr = window.devicePixelRatio || 1;
    
    // 设置Canvas显示大小
    this.#canvas.style.width = `${width}px`;
    this.#canvas.style.height = `${height}px`;
    
    // 设置Canvas实际大小（考虑DPI）
    this.#canvas.width = Math.floor(width * dpr);
    this.#canvas.height = Math.floor(height * dpr);
    
    // 缩放上下文以匹配DPI
    this.#ctx.scale(dpr, dpr);
    
    this.#logger.debug(`Canvas resized to ${width}x${height} (dpr: ${dpr})`);
  }

  /**
   * 添加渲染任务到队列
   * @param {Object} task - 渲染任务
   * @param {Function} task.render - 渲染函数
   * @param {number} [priority=0] - 任务优先级
   */
  addToRenderQueue(task, priority = 0) {
    this.#renderQueue.push({ task, priority });
    this.#renderQueue.sort((a, b) => b.priority - a.priority);
    this.#processRenderQueue();
  }

  /**
   * 处理渲染队列
   * @private
   */
  async #processRenderQueue() {
    if (this.#isRendering || this.#renderQueue.length === 0) {
      return;
    }

    this.#isRendering = true;
    
    try {
      while (this.#renderQueue.length > 0) {
        const { task } = this.#renderQueue.shift();
        await task.render();
      }
    } catch (error) {
      this.#logger.error("Error processing render queue:", error);
    } finally {
      this.#isRendering = false;
    }
  }

  /**
   * 清除渲染队列
   */
  clearRenderQueue() {
    this.#renderQueue = [];
    this.#logger.debug("Render queue cleared");
  }

  /**
   * 获取Canvas元素
   * @returns {HTMLCanvasElement|null} Canvas元素
   */
  getCanvas() {
    return this.#canvas;
  }

  /**
   * 获取Canvas上下文
   * @returns {CanvasRenderingContext2D|null} Canvas上下文
   */
  getContext() {
    return this.#ctx;
  }

  /**
   * 清理Canvas资源
   */
  cleanup() {
    this.#logger.info("Cleaning up Canvas resources");
    
    // 清理Canvas
    if (this.#canvas) {
      this.#canvas.width = 0;
      this.#canvas.height = 0;
    }
    
    this.#canvas = null;
    this.#ctx = null;
    this.#renderQueue = [];
    this.#isRendering = false;
  }

  /**
   * 销毁Canvas渲染器
   */
  destroy() {
    this.#logger.info("Destroying Canvas Renderer");
    this.cleanup();
  }
}