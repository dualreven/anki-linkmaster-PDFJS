/**
 * Console WebSocket Bridge - 将控制台输出重定向到WebSocket
 * @module ConsoleWebSocketBridge
 * @description 拦截console输出并通过WebSocket发送到后端进行统一日志管理
 */

export class ConsoleWebSocketBridge {
  constructor(source, websocketSender) {
    this.source = source; // 'pdf-home' or 'pdf-viewer'
    this.websocketSender = websocketSender; // WebSocket消息发送函数
    this.originalConsole = {};
    this.enabled = false;

    // 保存原始console方法
    this.originalConsole.log = console.log.bind(console);
    this.originalConsole.warn = console.warn.bind(console);
    this.originalConsole.error = console.error.bind(console);
    this.originalConsole.info = console.info.bind(console);
    this.originalConsole.debug = console.debug.bind(console);
  }

  /**
   * 启动console重定向
   */
  enable() {
    if (this.enabled) return;

    this.enabled = true;

    // 重写console方法
    console.log = (...args) => this.intercept('log', args);
    console.warn = (...args) => this.intercept('warn', args);
    console.error = (...args) => this.intercept('error', args);
    console.info = (...args) => this.intercept('info', args);
    console.debug = (...args) => this.intercept('debug', args);

    this.originalConsole.info(`[${this.source}] Console WebSocket Bridge enabled`);
  }

  /**
   * 停止console重定向
   */
  disable() {
    if (!this.enabled) return;

    this.enabled = false;

    // 恢复原始console方法
    console.log = this.originalConsole.log;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    console.info = this.originalConsole.info;
    console.debug = this.originalConsole.debug;

    this.originalConsole.info(`[${this.source}] Console WebSocket Bridge disabled`);
  }

  /**
   * 拦截console输出
   * @param {string} level - 日志级别
   * @param {Array} args - console参数
   */
  intercept(level, args) {
    // 先输出到本地console（保持原有行为）
    this.originalConsole[level](...args);

    // 检查是否是WebSocket相关的日志，避免无限循环
    const messageText = args.map(arg => String(arg)).join(' ');
    if (this.shouldSkipMessage(messageText)) {
      return; // 跳过WebSocket相关的日志
    }

    // 发送到WebSocket
    this.sendToWebSocket(level, args);
  }

  /**
   * 检查是否应该跳过某些消息以避免无限循环
   * @param {string} messageText - 消息文本
   * @returns {boolean} 是否跳过
   */
  shouldSkipMessage(messageText) {
    const skipPatterns = [
      'Console log recorded successfully',
      'Handling response message',
      'WebSocket',
      'console_log',
      'request_id',
      'status.*success',
      'message.*Console log recorded',
      'data.*logged.*true'
    ];

    return skipPatterns.some(pattern => {
      const regex = new RegExp(pattern, 'i');
      return regex.test(messageText);
    });
  }

  /**
   * 发送日志到WebSocket
   * @param {string} level - 日志级别
   * @param {Array} args - console参数
   */
  sendToWebSocket(level, args) {
    try {
      // 序列化console参数
      const serializedArgs = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      });

      const message = {
        type: 'console_log',
        source: this.source,
        level: level,
        timestamp: Date.now(),
        message: serializedArgs.join(' '),
        args: serializedArgs
      };

      // 通过WebSocket发送
      if (this.websocketSender && typeof this.websocketSender === 'function') {
        this.websocketSender(message);
      }
    } catch (error) {
      // 避免递归错误，直接用原始console输出
      this.originalConsole.error(`[${this.source}] Failed to send log to WebSocket:`, error);
    }
  }

  /**
   * 手动发送日志（用于特殊情况）
   * @param {string} level - 日志级别
   * @param {string} message - 消息内容
   * @param {Object} data - 附加数据
   */
  sendLog(level, message, data = null) {
    const logMessage = {
      type: 'console_log',
      source: this.source,
      level: level,
      timestamp: Date.now(),
      message: message,
      data: data
    };

    if (this.websocketSender && typeof this.websocketSender === 'function') {
      this.websocketSender(logMessage);
    }
  }

  /**
   * 获取原始console方法（用于紧急情况）
   * @param {string} level - console级别
   * @returns {Function} 原始console方法
   */
  getOriginalConsole(level = 'log') {
    return this.originalConsole[level] || this.originalConsole.log;
  }
}

/**
 * 创建console桥接器的工厂函数
 * @param {string} source - 来源标识
 * @param {Function} websocketSender - WebSocket发送函数
 * @returns {ConsoleWebSocketBridge} 桥接器实例
 */
export function createConsoleWebSocketBridge(source, websocketSender) {
  return new ConsoleWebSocketBridge(source, websocketSender);
}