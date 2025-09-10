/**

 * 错误处理模块 (moved)

 */

import Logger from "../utils/logger.js";

import { SYSTEM_EVENTS, UI_EVENTS } from "../event/event-constants.js";



export const ErrorType = { BUSINESS: "business", NETWORK: "network", SYSTEM: "system" };



export class AppError extends Error { constructor(message, type = ErrorType.SYSTEM, code = null) { super(message); this.name = "AppError"; this.type = type; this.code = code; this.timestamp = new Date().toISOString(); } }



export class ErrorHandler { constructor(eventBus) { this.eventBus = eventBus; this.logger = new Logger("ErrorHandler"); }

  handleError(error, context = "") {

    const errorInfo = { message: error.message, stack: error.stack, type: error.type || ErrorType.SYSTEM, code: error.code || null, context, timestamp: new Date().toISOString() };

    this.logger.error(`错误发生在 [${context}]: ${error.message}`, error);

    this.eventBus.emit(SYSTEM_EVENTS.ERROR.OCCURRED, errorInfo);

    this.showUserFriendlyError(error);

  }

  showUserFriendlyError(error) { 
    let userMessage = "操作失败，请稍后重试"; 
    let errorType = error.type || ErrorType.SYSTEM;
    
    switch (errorType) { 
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
    
    this.eventBus.emit(UI_EVENTS.ERROR.SHOW, { message: userMessage, type: errorType }); 
  }

  createBusinessError(message, code = null) { return new AppError(message, ErrorType.BUSINESS, code); }

  createNetworkError(message, code = null) { return new AppError(message, ErrorType.NETWORK, code); }

  createSystemError(message, code = null) { return new AppError(message, ErrorType.SYSTEM, code); }

}

