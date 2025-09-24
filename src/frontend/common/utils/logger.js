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
        return this.#deepSerialize(arg, 3);
      } catch (e) {
        return `[Object serialization failed: ${e.message}]`;
      }
    }
    
    return arg;
  }

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
    const keys = Object.keys(obj).slice(0, 20);
    
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

  debug(message, ...args) {
    this.#log(LogLevel.DEBUG, message, ...args);
  }

  info(message, ...args) {
    this.#log(LogLevel.INFO, message, ...args);
  }

  warn(message, ...args) {
    this.#log(LogLevel.WARN, message, ...args);
  }

  error(message, ...args) {
    this.#log(LogLevel.ERROR, message, ...args);
  }

  event(eventName, action, data = {}) {
    const serializedData = this.#serializeForMessage(data);
    this.info(`Event [${eventName}]: ${action} ${serializedData}`);
  }

  #serializeForMessage(obj) {
    if (obj === null || obj === undefined) {
      return String(obj);
    }
    
    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
      return String(obj);
    }
    
    if (typeof obj === 'object') {
      try {
        return this.#safeStringify(obj, 3);
      } catch (e) {
        return `[Object: ${e.message}]`;
      }
    }
    
    return String(obj);
  }

  #safeStringify(obj, maxDepth = 3) {
    const seen = new WeakSet();
    
    const replacer = (key, value) => {
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
      return result;
    } catch (e) {
      return `[Serialization Error: ${e.message}]`;
    }
  }
}

/**
 * Logger 实例缓存，用于确保同一模块名只创建一个 logger 实例
 */
const loggerInstances = new Map();

/**
 * 获取或创建指定模块名的 Logger 实例
 * @param {string} moduleName - 模块名称
 * @param {LogLevel} [initialLogLevel=LogLevel.INFO] - 初始日志级别
 * @returns {Logger} Logger 实例
 */
export function getLogger(moduleName, initialLogLevel = LogLevel.INFO) {
  if (!loggerInstances.has(moduleName)) {
    loggerInstances.set(moduleName, new Logger(moduleName, initialLogLevel));
  }
  return loggerInstances.get(moduleName);
}

/**
 * 设置全局 WebSocket 客户端（用于向后端发送日志）
 * 注意：由于我们已经重构为独立分层日志系统，此函数保留但不实际使用
 * @param {Object} wsClient - WebSocket 客户端实例
 */
export function setGlobalWebSocketClient(wsClient) {
  // 保留接口兼容性，但不实际使用
  console.info('[Logger] setGlobalWebSocketClient called but not used in new architecture');
}

export default Logger;
