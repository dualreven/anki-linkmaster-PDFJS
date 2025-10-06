import { getLogger } from './logger.js';
/**
 * @file WebGL检测工具
 * @description 用于检测WebGL支持状态和动态禁用WebGL
 */

/**
 * WebGL支持检测类
 */
export class WebGLDetector {
  /**
   * 检测WebGL支持状态
   * @returns {Object} WebGL支持状态信息
   */
  static detectWebGLSupport() {
    const result = {
      supported: false,
      version: null,
      renderer: null,
      vendor: null,
      hasWebGL1: false,
      hasWebGL2: false,
      disabledByConfig: false,
      error: null
    };

    try {
      // 检测WebGL1支持
      const canvas = document.createElement('canvas');
      const gl1 = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (gl1) {
        result.hasWebGL1 = true;
        result.supported = true;
        result.version = gl1.getParameter(gl1.VERSION);
        result.renderer = gl1.getParameter(gl1.RENDERER);
        result.vendor = gl1.getParameter(gl1.VENDOR);
      }

      // 检测WebGL2支持
      const gl2 = canvas.getContext('webgl2');
      if (gl2) {
        result.hasWebGL2 = true;
        result.supported = true;
        if (!result.version) {
          result.version = gl2.getParameter(gl2.VERSION);
          result.renderer = gl2.getParameter(gl2.RENDERER);
          result.vendor = gl2.getParameter(gl2.VENDOR);
        }
      }

      // 检查是否被配置禁用
      result.disabledByConfig = this.isWebGLDisabledByConfig();

    } catch (error) {
      result.error = error.message;
      result.supported = false;
    }

    return result;
  }

  /**
   * 检查WebGL是否被配置禁用
   * @returns {boolean} 是否被禁用
   */
  static isWebGLDisabledByConfig() {
    // 检查浏览器标志
    if (navigator.webdriver) {
      return true; // 自动化测试环境通常禁用WebGL
    }

    // 检查QtWebEngine特定标志
    if (typeof Qt !== 'undefined' && Qt.WebEngine) {
      // QtWebEngine环境，可能需要禁用WebGL
      return true;
    }

    // 检查用户代理字符串
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('qtwebengine') || userAgent.includes('qt')) {
      return true;
    }

    return false;
  }

  /**
   * 动态禁用WebGL
   * @returns {boolean} 是否成功禁用
   */
  static disableWebGL() {
    try {
      // 方法1: 重写getContext方法
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      
      HTMLCanvasElement.prototype.getContext = function(contextType, contextAttributes) {
        if (contextType && contextType.toLowerCase().includes('webgl')) {
          logger.warn('WebGL is disabled by configuration');
          return null;
        }
        return originalGetContext.call(this, contextType, contextAttributes);
      };

      // 方法2: 设置全局标志（如果PDF.js检查这个标志）
      window.WEBGL_DISABLED = true;

      // 方法3: 重写WebGL相关构造函数
      if (typeof WebGLRenderingContext !== 'undefined') {
        window.OriginalWebGLRenderingContext = WebGLRenderingContext;
        window.WebGLRenderingContext = function() {
          throw new Error('WebGL is disabled');
        };
      }

      if (typeof WebGL2RenderingContext !== 'undefined') {
        window.OriginalWebGL2RenderingContext = WebGL2RenderingContext;
        window.WebGL2RenderingContext = function() {
          throw new Error('WebGL2 is disabled');
        };
      }

      return true;
    } catch (error) {
      logger.error('Failed to disable WebGL:', error);
      return false;
    }
  }

  /**
   * 检查PDF.js是否使用WebGL渲染
   * @param {Object} pdfjsLib - PDF.js库实例
   * @returns {boolean} 是否使用WebGL
   */
  static checkPDFJSWebGLUsage(pdfjsLib) {
    if (!pdfjsLib || !pdfjsLib.GlobalWorkerOptions) {
      return false;
    }

    // 检查PDF.js版本和配置
    const version = pdfjsLib.version;
    logger.info(`PDF.js version: ${version}`);

    // PDF.js 3.x版本默认使用Canvas渲染，但某些功能可能使用WebGL
    // 检查是否有WebGL相关的配置选项
    const hasWebGLOptions = 
      pdfjsLib.GlobalWorkerOptions.hasOwnProperty('enableWebGL') ||
      pdfjsLib.GlobalWorkerOptions.hasOwnProperty('disableWebGL');

    return hasWebGLOptions;
  }

  /**
   * 配置PDF.js禁用WebGL
   * @param {Object} pdfjsLib - PDF.js库实例
   * @returns {boolean} 是否成功配置
   */
  static configurePDFJSForCanvas(pdfjsLib) {
    if (!pdfjsLib) {
      return false;
    }

    try {
      // 设置PDF.js使用Canvas渲染
      if (pdfjsLib.GlobalWorkerOptions) {
        // 禁用WebGL相关功能
        pdfjsLib.GlobalWorkerOptions.disableWebGL = true;
        pdfjsLib.GlobalWorkerOptions.enableWebGL = false;
        
        // 强制使用Canvas渲染
        if (pdfjsLib.GlobalWorkerOptions.renderingQueue) {
          pdfjsLib.GlobalWorkerOptions.renderingQueue.useCanvas = true;
        }
      }

      // 设置渲染器偏好为Canvas
      if (pdfjsLib.setPreferences) {
        pdfjsLib.setPreferences({
          'renderer': 'canvas',
          'enableWebGL': false
        });
      }

      return true;
    } catch (error) {
      logger.error('Failed to configure PDF.js for Canvas:', error);
      return false;
    }
  }
}

/**
 * WebGL状态管理器
 */
export class WebGLStateManager {
  static #webglEnabled = true;
  static #detectionResult = null;

  /**
   * 初始化WebGL状态检测
   */
  static initialize() {
    this.#detectionResult = WebGLDetector.detectWebGLSupport();
    this.#webglEnabled = this.#detectionResult.supported && 
                         !this.#detectionResult.disabledByConfig;

    logger.info('WebGL State:', {
      supported: this.#detectionResult.supported,
      disabledByConfig: this.#detectionResult.disabledByConfig,
      enabled: this.#webglEnabled
    });

    // 如果被配置禁用，则动态禁用WebGL
    if (this.#detectionResult.disabledByConfig && this.#detectionResult.supported) {
      this.disableWebGL();
    }
  }

  /**
   * 禁用WebGL
   */
  static disableWebGL() {
    if (this.#webglEnabled) {
      const success = WebGLDetector.disableWebGL();
      if (success) {
        this.#webglEnabled = false;
        logger.info('WebGL has been disabled');
      }
    }
  }

  /**
   * 获取WebGL状态
   * @returns {Object} WebGL状态信息
   */
  static getWebGLState() {
    return {
      enabled: this.#webglEnabled,
      detection: this.#detectionResult,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 检查是否应该使用Canvas回退
   * @returns {boolean} 是否应该回退到Canvas
   */
  static shouldUseCanvasFallback() {
    return !this.#webglEnabled || this.#detectionResult.disabledByConfig;
  }
}

// 自动初始化
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    WebGLStateManager.initialize();
  });
}

