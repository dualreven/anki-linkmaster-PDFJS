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
        // 序列化对象以便更好地查看内容
        const serializedArgs = args.map(arg => this.#serializeArg(arg));
        consoleMethod(prefix, message, ...serializedArgs);
    } else {
        consoleMethod(prefix, message);
    }
  }

  /**
   * 序列化参数以便更好地在日志中显示
   * @param {any} arg - 要序列化的参数
   * @returns {any} 序列化后的参数
   */
  #serializeArg(arg) {
    if (arg === null || arg === undefined) {
      return arg;
    }
    
    if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
      return arg;
    }
    
    if (arg instanceof Error) {
      return {
        name: arg.name,
        message: arg.message,
        stack: arg.stack
      };
    }
    
    if (typeof arg === 'object') {
      try {
        // 限制对象深度以避免循环引用
        return this.#deepSerialize(arg, 3);
      } catch (e) {
        return `[Object serialization failed: ${e.message}]`;
      }
    }
    
    return arg;
  }

  /**
   * 深度序列化对象，限制深度以避免循环引用
   * @param {any} obj - 要序列化的对象
   * @param {number} maxDepth - 最大深度
   * @param {Set} seen - 已访问的对象集合
   * @returns {any} 序列化后的对象
   */
  #deepSerialize(obj, maxDepth, seen = new Set()) {
    if (maxDepth <= 0) {
      return '[Max depth reached]';
    }
    
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (typeof obj !== 'object') {
      return obj;
    }
    
    if (seen.has(obj)) {
      return '[Circular reference]';
    }
    
    seen.add(obj);
    
    if (Array.isArray(obj)) {
      const result = obj.slice(0, 10).map(item => this.#deepSerialize(item, maxDepth - 1, seen));
      if (obj.length > 10) {
        result.push(`[... and ${obj.length - 10} more items]`);
      }
      seen.delete(obj);
      return result;
    }
    
    const result = {};
    const keys = Object.keys(obj).slice(0, 20); // 限制显示的键数量
    
    for (const key of keys) {
      try {
        result[key] = this.#deepSerialize(obj[key], maxDepth - 1, seen);
      } catch (e) {
        result[key] = `[Error serializing: ${e.message}]`;
      }
    }
    
    const totalKeys = Object.keys(obj).length;
    if (totalKeys > 20) {
      result['...'] = `[and ${totalKeys - 20} more properties]`;
    }
    
    seen.delete(obj);
    return result;
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
    // 将对象内容直接包含在消息中，以确保在控制台捕获工具中可见
    const serializedData = this.#serializeForMessage(data);
    this.info(`Event [${eventName}]: ${action} ${serializedData}`);
  }

  /**
   * 将对象序列化为字符串格式，用于消息内容
   * @param {any} obj - 要序列化的对象
   * @returns {string} 序列化后的字符串
   */
  #serializeForMessage(obj) {
    if (obj === null || obj === undefined) {
      return String(obj);
    }
    
    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
      return String(obj);
    }
    
    if (typeof obj === 'object') {
      try {
        // 使用简化的序列化，避免循环引用
        return this.#safeStringify(obj, 3);
      } catch (e) {
        return `[Object: ${e.message}]`;
      }
    }
    
    return String(obj);
  }

  /**
   * 安全的 JSON 字符串化，处理循环引用和深度限制
   * @param {any} obj - 要序列化的对象
   * @param {number} maxDepth - 最大深度
   * @returns {string} 序列化后的字符串
   */
  #safeStringify(obj, maxDepth = 3) {
    const seen = new WeakSet();
    
    const replacer = (key, value) => {
      // 跳过内部属性
      if (key.startsWith('_') || key.startsWith('#')) {
        return '[Internal Property]';
      }
      
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message
        };
      }
      
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      
      return value;
    };
    
    try {
      const result = JSON.stringify(obj, replacer, 2);
      // 限制输出长度
      // if (result.length > 100) {
      //   return result.substring(0, 100) + '...[Truncated]';
      // }
      return result;
    } catch (e) {
      return `[Serialization Error: ${e.message}]`;
    }
  }
}

export default Logger;
