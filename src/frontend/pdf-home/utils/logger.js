/**
 * @file 日志记录器模块，提供分级、分类的日志记录功能。
 * @module Logger
 */

/**
 * @enum {string}
 * @description 定义日志的严重性级别。
 */
export const LogLevel = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
};

/**
 * @class Logger
 * @description 一个灵活的日志记录器，支持模块化、日志级别和上下文数据。
 *
 * @param {string} [moduleName="App"] - 当前日志记录器实例所属的模块名。
 * @param {LogLevel} [initialLogLevel=LogLevel.INFO] - 该实例的初始日志级别。
 */
export class Logger {
  #moduleName;
  #logLevel;

  constructor(moduleName = "App", initialLogLevel = LogLevel.INFO) {
    this.#moduleName = moduleName;
    this.#logLevel = initialLogLevel;
  }

  /**
   * 设置当前日志实例的日志级别。
   * @param {LogLevel} level - 新的日志级别。
   */
  setLogLevel(level) {
    if (Object.values(LogLevel).includes(level)) {
      this.#logLevel = level;
    } else {
      console.error(`[Logger] Invalid log level: ${level}`);
    }
  }

  /**
   * 获取当前日志实例的日志级别。
   * @returns {LogLevel} 当前的日志级别。
   */
  getLogLevel() {
    return this.#logLevel;
  }

  #log(level, message, ...args) {
    const levelOrder = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    if (levelOrder.indexOf(level) < levelOrder.indexOf(this.#logLevel)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.#moduleName}] [${level.toUpperCase()}]`;

    const consoleMethod = console[level] || console.log;
    
    if (args.length > 0) {
        consoleMethod(prefix, message, ...args);
    } else {
        consoleMethod(prefix, message);
    }
  }

  /**
   * 记录一条调试信息。
   * @param {string} message - 日志消息。
   * @param {...any} args - 附加的日志数据。
   */
  debug(message, ...args) {
    this.#log(LogLevel.DEBUG, message, ...args);
  }

  /**
   * 记录一条普通信息。
   * @param {string} message - 日志消息。
   * @param {...any} args - 附加的日志数据。
   */
  info(message, ...args) {
    this.#log(LogLevel.INFO, message, ...args);
  }

  /**
   * 记录一条警告信息。
   * @param {string} message - 日志消息。
   * @param {...any} args - 附加的日志数据。
   */
  warn(message, ...args) {
    this.#log(LogLevel.WARN, message, ...args);
  }

  /**
   * 记录一条错误信息。
   * @param {string} message - 日志消息。
   * @param {...any} args - 附加的日志数据，通常是Error对象。
   */
  error(message, ...args) {
    this.#log(LogLevel.ERROR, message, ...args);
  }

  /**
   * 记录一个事件相关的日志。
   * @param {string} eventName - 事件名称。
   * @param {string} action - 动作（如 "订阅", "发布"）。
   * @param {object} [data={}] - 与事件相关的数据。
   */
  event(eventName, action, data = {}) {
    this.info(`Event [${eventName}]: ${action}`, data);
  }
}

export default Logger;
