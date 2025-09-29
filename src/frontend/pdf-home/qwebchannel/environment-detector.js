/**
 * @file QWebChannel环境检测器
 * @module EnvironmentDetector
 */

import { getLogger } from "../../common/utils/logger.js";

/**
 * QWebChannel环境检测器类
 */
export class EnvironmentDetector {
  #logger;

  constructor() {
    this.#logger = getLogger("EnvironmentDetector");
  }

  /**
   * 检测运行环境
   * @returns {Object} 环境信息对象
   */
  detectEnvironment() {
    const userAgent = navigator.userAgent || '';
    const isElectron = /electron/i.test(userAgent);
    const isQtWebEngine = /qtwebengine/i.test(userAgent);
    const isChrome = /chrome/i.test(userAgent) && !isElectron;
    const isFirefox = /firefox/i.test(userAgent);
    const hasQt = typeof qt !== 'undefined';

    if (isQtWebEngine && hasQt) {
      return {
        type: 'qt-webengine-with-bridge',
        description: 'PyQt WebEngine with qt bridge available',
        recommendation: 'this should work normally',
        fallbackMessage: 'qt bridge may not be properly configured'
      };
    } else if (isQtWebEngine) {
      return {
        type: 'qt-webengine-no-bridge',
        description: 'PyQt WebEngine without qt bridge',
        recommendation: 'qt bridge not available, check PyQt setup',
        fallbackMessage: 'qt bridge initialization may be pending'
      };
    } else if (isElectron) {
      return {
        type: 'electron',
        description: 'Electron application',
        recommendation: 'QWebChannel not supported in Electron',
        fallbackMessage: 'use Electron IPC instead'
      };
    } else if (isChrome || isFirefox) {
      return {
        type: 'browser',
        description: `Standard web browser (${isChrome ? 'Chrome' : 'Firefox'})`,
        recommendation: 'QWebChannel not available in browser environment',
        fallbackMessage: 'this is expected behavior for web browsers'
      };
    } else {
      return {
        type: 'unknown',
        description: 'Unknown runtime environment',
        recommendation: 'environment not recognized',
        fallbackMessage: 'try running in a supported environment'
      };
    }
  }

  /**
   * 根据环境获取等待配置
   * @param {Object} environment - 环境信息对象
   * @returns {Object} 等待配置
   */
  getWaitConfig(environment) {
    switch (environment.type) {
      case 'qt-webengine-with-bridge':
        return { timeout: 2000, interval: 100 }; // Qt环境，较短等待时间
      case 'qt-webengine-no-bridge':
        return { timeout: 5000, interval: 100 }; // Qt环境但无bridge，稍长等待
      case 'browser':
      case 'electron':
        return { timeout: 500, interval: 100 };  // 浏览器环境，快速失败
      default:
        return { timeout: 3000, interval: 100 }; // 未知环境，中等等待时间
    }
  }

  /**
   * 根据错误消息确定日志级别
   * @param {string} errorMessage - 错误消息
   * @returns {string} 日志级别
   */
  getErrorSeverity(errorMessage) {
    if (errorMessage.includes('not loaded') || errorMessage.includes('not available')) {
      return 'info'; // 浏览器环境中这是正常的
    } else if (errorMessage.includes('Timed out')) {
      return 'warn'; // 可能的配置问题
    } else {
      return 'error'; // 真正的错误
    }
  }
}