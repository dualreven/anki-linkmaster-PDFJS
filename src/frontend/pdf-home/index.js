/**
 * PDF主页轻量级引导文件 v3
 * 负责模块导入、应用初始化和协调各模块之间的交互
 */

// 导入事件总线模块
import { EventBus } from './modules/event-bus.js';

// 导入事件常量
import {
  APP_EVENTS,
  SYSTEM_EVENTS,
  WEBSOCKET_EVENTS,
  PDF_MANAGEMENT_EVENTS,
  UI_EVENTS,
  WEBSOCKET_MESSAGE_EVENTS
} from './modules/event-constants.js';

// 导入日志模块
import Logger, { LogLevel } from './utils/logger.js';

// 导入错误处理模块
import { ErrorHandler } from './modules/error-handler.js';

// 导入UI管理器模块
import { UIManager } from './modules/ui-manager.js';

// 导入PDF管理器模块
import PDFManager from './modules/pdf-manager.js';

// 导入WebSocket客户端模块
import WSClient from './modules/ws-client.js';

// ===== 主应用类 =====
/**
 * PDF主页应用类
 * 负责协调各模块之间的交互
 */
class PDFHomeApp {
  constructor() {
    this.logger = new Logger('PDFHomeApp');
    this.eventBus = new EventBus({
      enableValidation: true,  // 启用事件名称验证
      enableDebug: true,       // 启用调试功能
      logLevel: LogLevel.DEBUG  // 设置日志级别为DEBUG，以便查看详细日志
    });
    this.errorHandler = new ErrorHandler(this.eventBus);
    this.websocketManager = new WSClient('ws://localhost:8765', this.eventBus);
    this.pdfManager = new PDFManager(this.eventBus, this.websocketManager);
    this.uiManager = new UIManager(this.eventBus);
    
    this.initialized = false;
  }

  /**
   * 初始化应用
   */
  async initialize() {
    try {
      this.logger.info('正在初始化PDF主页应用');
      
      // 初始化各组件
      this.pdfManager.initialize();
      
      // 连接WebSocket
      this.websocketManager.connect();
      
      // 设置全局错误处理
      this.setupGlobalErrorHandling();
      
      // 设置完成标志
      this.initialized = true;
      
      this.logger.info('PDF主页应用初始化完成');
      
      // 触发初始化完成事件
      this.eventBus.emit(APP_EVENTS.INITIALIZATION.COMPLETED);
      
    } catch (error) {
      this.logger.error('应用初始化失败', error);
      this.errorHandler.handleError(error, 'App.initialize');
    }
  }

  /**
   * 设置全局错误处理
   */
  setupGlobalErrorHandling() {
    // 捕获未处理的Promise rejection
    window.addEventListener('unhandledrejection', (event) => {
      this.logger.error('未处理的Promise rejection:', event.reason);
      this.errorHandler.handleError(event.reason, 'UnhandledPromiseRejection');
      event.preventDefault();
    });
    
    // 捕获全局错误
    window.addEventListener('error', (event) => {
      this.logger.error('全局错误:', event.error);
      this.errorHandler.handleError(event.error, 'GlobalError');
      event.preventDefault();
    });
  }

  /**
   * 获取应用状态
   * @returns {Object} 应用状态
   */
  getState() {
    return {
      initialized: this.initialized,
      websocketConnected: this.websocketManager.isConnected(),
      pdfCount: this.pdfManager.getPDFs().length
    };
  }

  /**
   * 获取诊断信息
   * @returns {Object} 诊断信息
   */
  getDiagnostics() {
    return {
      timestamp: new Date().toISOString(),
      app: this.getState(),
      logs: JSON.parse(localStorage.getItem('appLogs') || '[]').slice(-10)
    };
  }
}

// ===== 应用启动 =====
/**
 * 启动应用
 */
document.addEventListener('DOMContentLoaded', () => {
  const app = new PDFHomeApp();
  app.initialize().then(() => {
    // 挂到全局方便调试
    window.app = app;
    window.eventBus = app.eventBus;
    
    console.log('PDF主页应用已启动');
  }).catch(error => {
    console.error('PDF主页应用启动失败:', error);
  });
});