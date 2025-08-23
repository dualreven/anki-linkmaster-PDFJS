/**
 * 日志管理器模块
 * 实现详细日志输出功能，支持上下文信息、性能监控和日志分类
 */

/**
 * 日志级别枚举
 */
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

/**
 * 日志分类枚举
 */
export const LogCategory = {
  SYSTEM: 'system',      // 系统日志
  BUSINESS: 'business',  // 业务流程日志
  PERFORMANCE: 'performance', // 性能日志
  NETWORK: 'network',    // 网络通信日志
  UI: 'ui',             // 用户界面日志
  ERROR: 'error'        // 错误日志
};

/**
 * 日志管理器类
 */
export class Logger {
  constructor(moduleName = 'App') {
    this.moduleName = moduleName;
    this.logLevel = LogLevel.DEBUG; // debug, info, warn, error
    this.logFile = 'debug-console.log';
    this.enabledCategories = new Set(Object.values(LogCategory));
    this.performanceMetrics = new Map();
    this.contextData = new Map();
  }

  /**
   * 设置启用的日志分类
   * @param {Array<string>} categories - 要启用的分类列表
   */
  setEnabledCategories(categories) {
    this.enabledCategories = new Set(categories);
  }

  /**
   * 检查分类是否启用
   * @param {string} category - 日志分类
   * @returns {boolean} 是否启用
   */
  isCategoryEnabled(category) {
    return this.enabledCategories.has(category);
  }

  /**
   * 添加上下文数据
   * @param {string} key - 键
   * @param {any} value - 值
   */
  addContext(key, value) {
    this.contextData.set(key, value);
  }

  /**
   * 移除上下文数据
   * @param {string} key - 键
   */
  removeContext(key) {
    this.contextData.delete(key);
  }

  /**
   * 清除所有上下文数据
   */
  clearContext() {
    this.contextData.clear();
  }

  /**
   * 获取函数调用栈
   * @returns {string} 格式化的调用栈
   */
  getCallStack() {
    const stack = new Error().stack;
    if (!stack) return '';
    
    // 解析调用栈，跳过前几行（Logger内部调用）
    const stackLines = stack.split('\n').slice(3, 8); // 取5层调用栈
    return stackLines.map(line => {
      // 提取函数名和位置
      const match = line.match(/at\s+([^\s]+)\s+\((.*)\)/);
      if (match) {
        return `${match[1]} (${match[2]})`;
      }
      return line.trim();
    }).join(' <- ');
  }

  /**
   * 开始性能测量
   * @param {string} metricName - 指标名称
   */
  startPerformanceMeasure(metricName) {
    this.performanceMetrics.set(metricName, {
      startTime: performance.now(),
      memoryStart: performance.memory ? performance.memory.usedJSHeapSize : null
    });
  }

  /**
   * 结束性能测量并记录日志
   * @param {string} metricName - 指标名称
   * @param {string} message - 附加消息
   */
  endPerformanceMeasure(metricName, message = '') {
    const metric = this.performanceMetrics.get(metricName);
    if (!metric) {
      this.warn(`性能指标 ${metricName} 未找到开始记录`);
      return;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;
    const memoryEnd = performance.memory ? performance.memory.usedJSHeapSize : null;
    const memoryUsed = memoryEnd && metric.memoryStart ? memoryEnd - metric.memoryStart : null;

    const perfMessage = `性能指标 [${metricName}] 耗时: ${duration.toFixed(2)}ms` +
      (memoryUsed ? `, 内存使用: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB` : '') +
      (message ? ` - ${message}` : '');

    this.logWithCategory(LogCategory.PERFORMANCE, LogLevel.INFO, perfMessage);
    this.performanceMetrics.delete(metricName);
  }

  /**
   * 格式化日志消息
   * @param {string} level - 日志级别
   * @param {string} category - 日志分类
   * @param {string} message - 消息内容
   * @param {Object} options - 附加选项
   * @returns {string} 格式化后的日志消息
   */
  formatMessage(level, category, message, options = {}) {
    const timestamp = new Date().toISOString();
    const { includeStack = false, context = {}, error = null, data = null } = options;
    
    let formattedMessage = `[${timestamp}] [${this.moduleName}] [${level.toUpperCase()}] [${category}] ${message}`;
    
    // 添加上下文信息
    const allContext = { ...Object.fromEntries(this.contextData), ...context };
    if (Object.keys(allContext).length > 0) {
      formattedMessage += ` | 上下文: ${JSON.stringify(allContext)}`;
    }
    
    // 添加数据内容
    if (data !== null && data !== undefined) {
      formattedMessage += ` | 数据: ${JSON.stringify(data)}`;
    }
    
    // 添加调用栈
    if (includeStack) {
      const stack = this.getCallStack();
      if (stack) {
        formattedMessage += ` | 调用栈: ${stack}`;
      }
    }
    
    // 添加错误信息
    if (error) {
      formattedMessage += ` | 错误: ${error.message}`;
      if (error.stack) {
        formattedMessage += ` | 堆栈: ${error.stack.split('\n').slice(0, 5).join('; ')}`;
      }
    }
    
    return formattedMessage;
  }

  /**
   * 带分类的日志记录
   * @param {string} category - 日志分类
   * @param {string} level - 日志级别
   * @param {string} message - 消息内容
   * @param {Object} options - 附加选项
   */
  logWithCategory(category, level, message, options = {}) {
    if (!this.isCategoryEnabled(category)) {
      return;
    }
    
    // 检查日志级别
    const levelOrder = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levelOrder.indexOf(this.logLevel);
    const messageLevelIndex = levelOrder.indexOf(level);
    
    if (currentLevelIndex > messageLevelIndex) {
      return;
    }
    
    const formattedMessage = this.formatMessage(level, category, message, options);
    
    // 输出到控制台
    console[level](formattedMessage);
    
    // 写入文件（模拟）
    this.simulateFileWrite(formattedMessage);
  }

  /**
   * 模拟文件写入（在实际应用中应替换为真实的文件写入）
   * @param {string} message - 日志消息
   */
  simulateFileWrite(message) {
    if (typeof window !== 'undefined') {
      // 存储到localStorage用于调试
      const logs = JSON.parse(localStorage.getItem('appLogs') || '[]');
      logs.push(message);
      
      // 限制日志数量，避免存储过多
      if (logs.length > 1000) {
        logs.shift();
      }
      
      localStorage.setItem('appLogs', JSON.stringify(logs));
    }
  }

  /**
   * 调试级别日志
   * @param {string} message - 消息内容
   * @param {Object} options - 附加选项
   */
  debug(message, options = {}) {
    this.logWithCategory(LogCategory.SYSTEM, LogLevel.DEBUG, message, options);
  }

  /**
   * 信息级别日志
   * @param {string} message - 消息内容
   * @param {Object} options - 附加选项
   */
  info(message, options = {}) {
    this.logWithCategory(LogCategory.SYSTEM, LogLevel.INFO, message, options);
  }

  /**
   * 警告级别日志
   * @param {string} message - 消息内容
   * @param {Object} options - 附加选项
   */
  warn(message, options = {}) {
    this.logWithCategory(LogCategory.SYSTEM, LogLevel.WARN, message, options);
  }

  /**
   * 错误级别日志
   * @param {string} message - 消息内容
   * @param {Error} error - 错误对象（可选）
   * @param {Object} options - 附加选项
   */
  error(message, error = null, options = {}) {
    this.logWithCategory(LogCategory.ERROR, LogLevel.ERROR, message, { ...options, error, includeStack: true });
  }

  /**
   * 业务流程日志
   * @param {string} action - 业务动作
   * @param {string} status - 状态
   * @param {Object} data - 相关数据
   * @param {Object} options - 附加选项
   */
  business(action, status, data = {}, options = {}) {
    const message = `业务流程: ${action} - 状态: ${status}`;
    this.logWithCategory(LogCategory.BUSINESS, LogLevel.INFO, message, { ...options, data });
  }

  /**
   * 网络通信日志
   * @param {string} direction - 发送/接收
   * @param {string} type - 消息类型
   * @param {Object} data - 消息数据
   * @param {Object} options - 附加选项
   */
  network(direction, type, data = {}, options = {}) {
    const message = `网络通信: ${direction} - 类型: ${type}`;
    this.logWithCategory(LogCategory.NETWORK, LogLevel.INFO, message, { ...options, data });
  }

  /**
   * UI交互日志
   * @param {string} component - 组件名称
   * @param {string} action - 交互动作
   * @param {Object} data - 相关数据
   * @param {Object} options - 附加选项
   */
  ui(component, action, data = {}, options = {}) {
    const message = `UI交互: ${component} - 动作: ${action}`;
    this.logWithCategory(LogCategory.UI, LogLevel.INFO, message, { ...options, data });
  }

  /**
   * 事件日志
   * @param {string} eventName - 事件名称
   * @param {string} action - 事件动作（发布/订阅）
   * @param {Object} data - 事件数据
   * @param {Object} options - 附加选项
   */
  event(eventName, action, data = {}, options = {}) {
    const message = `事件: ${action} - 名称: ${eventName}`;
    this.logWithCategory(LogCategory.SYSTEM, LogLevel.DEBUG, message, { ...options, data });
  }

  /**
   * 设置日志级别
   * @param {string} level - 日志级别
   */
  setLogLevel(level) {
    if (Object.values(LogLevel).includes(level)) {
      this.logLevel = level;
    }
  }

  /**
   * 获取日志级别
   * @returns {string} 日志级别
   */
  getLogLevel() {
    return this.logLevel;
  }

  /**
   * 获取所有日志
   * @param {string} category - 可选，按分类过滤
   * @param {string} level - 可选，按级别过滤
   * @returns {Array<string>} 日志列表
   */
  getLogs(category = null, level = null) {
    if (typeof window === 'undefined') {
      return [];
    }
    
    const logs = JSON.parse(localStorage.getItem('appLogs') || '[]');
    
    return logs.filter(log => {
      if (category && !log.includes(`[${category}]`)) {
        return false;
      }
      if (level && !log.includes(`[${level.toUpperCase()}]`)) {
        return false;
      }
      return true;
    });
  }

  /**
   * 清除日志
   */
  clearLogs() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('appLogs');
    }
  }
}

// 默认导出Logger类
export default Logger;