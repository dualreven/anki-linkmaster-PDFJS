/**
 * 错误处理模块
 * 提供统一的错误处理机制
 */

// 导入日志模块
import Logger from "../../pdf-home/utils/logger.js";

// 导入事件常量
import {
  SYSTEM_EVENTS,
  UI_EVENTS
} from "../event/event-constants.js";

/**
 * 错误类型枚举
 */
export const ErrorType = {
  BUSINESS: "business",    // 业务错误
  NETWORK: "network",      // 网络错误
  SYSTEM: "system"         // 系统错误
};

/**
 * 自定义错误类
 */
export class AppError extends Error {
  constructor(message, type = ErrorType.SYSTEM, code = null) {
    super(message);
    this.name = "AppError";
    this.type = type;
    this.code = code;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * 错误处理器类
 */
export class ErrorHandler {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.logger = new Logger("ErrorHandler");
  }

  /**
   * 处理错误
   * @param {Error|AppError} error - 错误对象
   * @param {string} context - 错误上下文
   */
  handleError(error, context = "") {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      type: error.type || ErrorType.SYSTEM,
      code: error.code || null,
      context,
      timestamp: new Date().toISOString()
    };

    // 记录错误日志
    this.logger.error(`错误发生在 [${context}]: ${error.message}`, error);

    // 通过事件总线传播错误事件
    this.eventBus.emit(SYSTEM_EVENTS.ERROR.OCCURRED, errorInfo);

    // 显示用户友好的错误消息
    this.showUserFriendlyError(error);
  }

  /**
   * 显示用户友好的错误消息
   * @param {Error|AppError} error - 错误对象
   */
  showUserFriendlyError(error) {
    let userMessage = "操作失败，请稍后重试";

    switch (error.type) {
    case ErrorType.BUSINESS:
      userMessage = error.message || "业务逻辑错误";
      break;
    case ErrorType.NETWORK:
      userMessage = "网络连接失败，请检查网络设置";
      break;
    case ErrorType.SYSTEM:
      userMessage = "系统错误，请联系管理员";
      break;
    }

    // 通过事件总线通知UI显示错误消息
    this.eventBus.emit(UI_EVENTS.ERROR.SHOW, {
      message: userMessage,
      type: error.type
    });
  }

  /**
   * 创建业务错误
   * @param {string} message - 错误消息
   * @param {string} code - 错误代码
   * @returns {AppError} 业务错误对象
   */
  createBusinessError(message, code = null) {
    return new AppError(message, ErrorType.BUSINESS, code);
  }

  /**
   * 创建网络错误
   * @param {string} message - 错误消息
   * @param {string} code - 错误代码
   * @returns {AppError} 网络错误对象
   */
  createNetworkError(message, code = null) {
    return new AppError(message, ErrorType.NETWORK, code);
  }

  /**
   * 创建系统错误
   * @param {string} message - 错误消息
   * @param {string} code - 错误代码
   * @returns {AppError} 系统错误对象
   */
  createSystemError(message, code = null) {
    return new AppError(message, ErrorType.SYSTEM, code);
  }
}
