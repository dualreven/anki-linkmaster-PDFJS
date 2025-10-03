/**
 * 截图捕获器
 * 使用Canvas API捕获PDF指定区域
 */
import { getLogger } from '../../../../../common/utils/logger.js';

export class ScreenshotCapturer {
  #pdfViewerManager;
  #logger;

  constructor(pdfViewerManager) {
    this.#pdfViewerManager = pdfViewerManager;
    this.#logger = getLogger('ScreenshotCapturer');
  }

  /**
   * 捕获PDF指定区域的截图
   * @param {number} pageNumber - 页码
   * @param {Object} rect - 区域 { x, y, width, height }
   * @returns {Promise<string>} base64图片数据 (格式: data:image/png;base64,...)
   *
   * @example
   * const base64Image = await capturer.capture(1, { x: 100, y: 100, width: 300, height: 200 });
   */
  async capture(pageNumber, rect) {
    try {
      // 1. 验证输入参数
      this.#validateCaptureParams(pageNumber, rect);

      // 2. 获取页面Canvas
      const canvas = this.#getPageCanvas(pageNumber);

      if (!canvas) {
        throw new Error(`Cannot find canvas for page ${pageNumber}`);
      }

      // 3. 提取指定区域
      const regionCanvas = this.#extractRegion(canvas, rect);

      // 4. 转换为base64
      const base64 = this.#toBase64(regionCanvas);

      this.#logger.info(`[Capturer] Captured ${rect.width}x${rect.height} at page ${pageNumber}`);

      return base64;

    } catch (error) {
      this.#logger.error('[Capturer] Capture failed:', error);
      throw error;
    }
  }

  /**
   * 验证捕获参数
   * @private
   */
  #validateCaptureParams(pageNumber, rect) {
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      throw new Error('Page number must be a positive integer');
    }

    if (!rect || typeof rect !== 'object') {
      throw new Error('Rect must be an object');
    }

    const requiredProps = ['x', 'y', 'width', 'height'];
    for (const prop of requiredProps) {
      if (typeof rect[prop] !== 'number' || rect[prop] < 0) {
        throw new Error(`Rect.${prop} must be a non-negative number`);
      }
    }

    if (rect.width === 0 || rect.height === 0) {
      throw new Error('Rect width and height must be greater than 0');
    }
  }

  /**
   * 获取PDF页面的Canvas元素
   * @private
   * @param {number} pageNumber - 页码
   * @returns {HTMLCanvasElement|null}
   */
  #getPageCanvas(pageNumber) {
    // 尝试多种选择器（兼容不同的PDF.js渲染器）
    const selectors = [
      // PDF.js 默认选择器
      `[data-page-number="${pageNumber}"] canvas`,
      // 自定义选择器
      `.page[data-page-number="${pageNumber}"] canvas`,
      // ID选择器
      `#page-${pageNumber} canvas`,
      // 通用选择器
      `.pdf-page-${pageNumber} canvas`
    ];

    for (const selector of selectors) {
      const canvas = document.querySelector(selector);
      if (canvas && canvas instanceof HTMLCanvasElement) {
        return canvas;
      }
    }

    this.#logger.warn(`[Capturer] Canvas not found for page ${pageNumber}`);
    return null;
  }

  /**
   * 从完整Canvas中提取指定区域
   * @private
   * @param {HTMLCanvasElement} sourceCanvas - 源Canvas
   * @param {Object} rect - 区域坐标
   * @returns {HTMLCanvasElement}
   */
  #extractRegion(sourceCanvas, rect) {
    // 创建新的Canvas用于存储截取区域
    const regionCanvas = document.createElement('canvas');
    regionCanvas.width = rect.width;
    regionCanvas.height = rect.height;

    const ctx = regionCanvas.getContext('2d');

    if (!ctx) {
      throw new Error('Cannot get 2D context from canvas');
    }

    // 确保rect不超出源Canvas边界
    const clampedRect = this.#clampRect(rect, sourceCanvas.width, sourceCanvas.height);

    // 从源Canvas提取区域
    ctx.drawImage(
      sourceCanvas,
      clampedRect.x, clampedRect.y, clampedRect.width, clampedRect.height,  // 源区域
      0, 0, clampedRect.width, clampedRect.height                            // 目标区域
    );

    return regionCanvas;
  }

  /**
   * 限制rect在canvas边界内
   * @private
   */
  #clampRect(rect, canvasWidth, canvasHeight) {
    const x = Math.max(0, Math.min(rect.x, canvasWidth - 1));
    const y = Math.max(0, Math.min(rect.y, canvasHeight - 1));
    const width = Math.min(rect.width, canvasWidth - x);
    const height = Math.min(rect.height, canvasHeight - y);

    return { x, y, width, height };
  }

  /**
   * 将Canvas转换为base64字符串
   * @private
   * @param {HTMLCanvasElement} canvas
   * @returns {string} base64图片数据 (格式: data:image/png;base64,...)
   */
  #toBase64(canvas) {
    try {
      // PNG格式，质量1.0（无损）
      return canvas.toDataURL('image/png', 1.0);
    } catch (error) {
      this.#logger.error('[Capturer] toDataURL failed:', error);
      throw new Error('Failed to convert canvas to base64: ' + error.message);
    }
  }
}
