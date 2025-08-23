/**
 * 事件总线模块
 * 实现事件发布和订阅功能，支持事件命名验证和调试功能
 */

// 导入日志工具
import { Logger, LogLevel, LogCategory } from '../utils/logger.js';

/**
 * 事件命名验证器
 * 确保事件名称符合规范: {module}:{action}:{status}
 */
class EventNameValidator {
  /**
   * 验证事件名称格式
   * @param {string} event - 事件名称
   * @returns {boolean} 是否有效
   */
  static validate(event) {
    if (!event || typeof event !== 'string') {
      return false;
    }
    
    // 检查格式: {module}:{action}:{status}
    const parts = event.split(':');
    if (parts.length !== 3) {
      return false;
    }
    
    // 检查每个部分是否非空
    const [module, action, status] = parts;
    return module && action && status;
  }
  
  /**
   * 获取事件名称验证错误信息
   * @param {string} event - 事件名称
   * @returns {string|null} 错误信息，如果有效则返回null
   */
  static getValidationError(event) {
    if (!event) {
      return '事件名称不能为空';
    }
    
    if (typeof event !== 'string') {
      return '事件名称必须是字符串';
    }
    
    const parts = event.split(':');
    if (parts.length !== 3) {
      return '事件名称格式必须为 {module}:{action}:{status}';
    }
    
    const [module, action, status] = parts;
    if (!module) {
      return '事件名称中的模块部分不能为空';
    }
    
    if (!action) {
      return '事件名称中的动作部分不能为空';
    }
    
    if (!status) {
      return '事件名称中的状态部分不能为空';
    }
    
    return null;
  }
}

/**
 * 事件总线类
 * 实现事件发布和订阅功能
 */
class EventBus {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {boolean} options.enableValidation - 是否启用事件名称验证
   * @param {boolean} options.enableDebug - 是否启用调试功能
   * @param {string} options.logLevel - 日志级别
   */
  constructor(options = {}) {
    this.events = {};
    this.enableValidation = options.enableValidation !== false;
    this.enableDebug = options.enableDebug !== false;
    this.debugPrefix = '[EventBus]';
    
    // 初始化日志记录器
    this.logger = new Logger('EventBus');
    if (options.logLevel && Object.values(LogLevel).includes(options.logLevel)) {
      this.logger.setLogLevel(options.logLevel);
    }
    
    this.logger.info('事件总线初始化完成', {
      enableValidation: this.enableValidation,
      enableDebug: this.enableDebug,
      logLevel: this.logger.getLogLevel()
    });
  }
  
  /**
   * 格式化数据摘要
   * @param {*} data - 要格式化的数据
   * @param {number} maxLength - 最大长度
   * @returns {string} 格式化后的数据摘要
   */
  formatDataSummary(data, maxLength = 100) {
    if (data === null || data === undefined) {
      return 'null';
    }
    
    if (typeof data === 'string') {
      return data.length > maxLength ? data.substring(0, maxLength) + '...' : data;
    }
    
    if (typeof data === 'object') {
      try {
        const jsonString = JSON.stringify(data);
        return jsonString.length > maxLength ?
          jsonString.substring(0, maxLength) + '...' :
          jsonString;
      } catch (e) {
        return '[Object]';
      }
    }
    
    return String(data);
  }
  
  /**
   * 格式化回调函数信息
   * @param {Function} callback - 回调函数
   * @returns {string} 格式化后的函数信息
   */
  formatCallbackInfo(callback) {
    if (!callback) return 'null';
    
    if (callback.name) {
      return `Function:${callback.name}`;
    }
    
    // 尝试从函数字符串中提取信息
    const funcString = callback.toString();
    const match = funcString.match(/^function\s*([^\s(]+)/);
    if (match && match[1]) {
      return `Function:${match[1]}`;
    }
    
    // 如果是箭头函数
    if (funcString.includes('=>')) {
      return 'ArrowFunction';
    }
    
    return 'AnonymousFunction';
  }
  
  /**
   * 订阅事件
   * @param {string} event - 事件名称，格式为 {module}:{action}:{status}
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消订阅的函数
   */
  on(event, callback) {
    // 验证事件名称
    if (this.enableValidation) {
      const validationError = EventNameValidator.getValidationError(event);
      if (validationError) {
        this.logger.error(`事件订阅失败: ${validationError}`, { event });
        throw new Error(`事件名称无效: ${validationError}`);
      }
    }
    
    if (!this.events[event]) {
      this.events[event] = [];
    }
    
    this.events[event].push(callback);
    const callbackInfo = this.formatCallbackInfo(callback);
    const subscriberCount = this.events[event].length;
    
    this.logger.event(event, '订阅', {
      callback: callbackInfo,
      subscriberCount,
      totalSubscribers: Object.keys(this.events).reduce((sum, e) => sum + this.events[e].length, 0)
    });
    
    // 返回取消订阅的函数
    return () => {
      this.off(event, callback);
    };
  }
  
  /**
   * 取消订阅事件
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  off(event, callback) {
    if (!this.events[event]) {
      this.logger.warn(`取消订阅失败: 事件不存在`, { event });
      return;
    }
    
    const initialLength = this.events[event].length;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
    const removedCount = initialLength - this.events[event].length;
    const callbackInfo = this.formatCallbackInfo(callback);
    
    this.logger.event(event, '取消订阅', {
      callback: callbackInfo,
      removedCount,
      remainingCount: this.events[event].length
    });
    
    // 如果没有订阅者了，删除事件
    if (this.events[event].length === 0) {
      delete this.events[event];
      this.logger.debug(`事件已删除（无订阅者）`, { event });
    }
  }
  
  /**
   * 发布事件
   * @param {string} event - 事件名称
   * @param {*} data - 事件数据
   */
  emit(event, data) {
    // 验证事件名称
    if (this.enableValidation) {
      const validationError = EventNameValidator.getValidationError(event);
      if (validationError) {
        this.logger.error(`事件发布失败: ${validationError}`, { event });
        throw new Error(`事件名称无效: ${validationError}`);
      }
    }
    
    if (!this.events[event]) {
      this.logger.debug(`事件发布: 无订阅者`, { event, dataSummary: this.formatDataSummary(data) });
      return;
    }
    
    const subscriberCount = this.events[event].length;
    const dataSummary = this.formatDataSummary(data);
    const startTime = performance.now();
    
    this.logger.event(event, '发布开始', {
      data: data,
      dataSummary,
      subscriberCount
    });
    
    let errorCount = 0;
    let successCount = 0;
    
    this.events[event].forEach(callback => {
      try {
        callback(data);
        successCount++;
      } catch (error) {
        errorCount++;
        const callbackInfo = this.formatCallbackInfo(callback);
        this.logger.error(`事件处理错误`, {
          event,
          callback: callbackInfo,
          error: error.message,
          stack: error.stack
        });
      }
    });
    
    const endTime = performance.now();
    const processingTime = (endTime - startTime).toFixed(2);
    
    this.logger.event(event, '发布完成', {
      subscriberCount,
      successCount,
      errorCount,
      processingTime: `${processingTime}ms`,
      eventData: data
    });
  }
  
  /**
   * 一次性订阅事件
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  once(event, callback) {
    // 验证事件名称
    if (this.enableValidation) {
      const validationError = EventNameValidator.getValidationError(event);
      if (validationError) {
        this.logger.error(`一次性订阅失败: ${validationError}`, {
          event,
          callback: this.formatCallbackInfo(callback),
          timestamp: new Date().toISOString()
        });
        throw new Error(`事件名称无效: ${validationError}`);
      }
    }
    
    const onceWrapper = (data) => {
      try {
        callback(data);
      } catch (error) {
        const callbackInfo = this.formatCallbackInfo(callback);
        this.logger.error(`一次性订阅回调执行错误`, {
          event,
          callback: callbackInfo,
          error: error.message,
          stack: error.stack,
          dataSummary: this.formatDataSummary(data),
          timestamp: new Date().toISOString()
        });
      } finally {
        this.off(event, onceWrapper);
      }
    };
    
    this.on(event, onceWrapper);
    const callbackInfo = this.formatCallbackInfo(callback);
    
    this.logger.info(`一次性订阅成功`, {
      event,
      originalCallback: callbackInfo,
      wrapperCallback: this.formatCallbackInfo(onceWrapper),
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * 获取所有事件名称
   * @returns {Array<string>} 事件名称列表
   */
  getEventNames() {
    return Object.keys(this.events);
  }
  
  /**
   * 获取指定事件的订阅者数量
   * @param {string} event - 事件名称
   * @returns {number} 订阅者数量
   */
  getSubscriberCount(event) {
    return this.events[event] ? this.events[event].length : 0;
  }
  
  /**
   * 清除所有事件
   */
  clearAllEvents() {
    const eventCount = Object.keys(this.events).length;
    const totalSubscribers = Object.values(this.events).reduce((sum, subscribers) => sum + subscribers.length, 0);
    const eventNames = Object.keys(this.events);
    
    this.events = {};
    
    this.logger.info(`清除所有事件完成`, {
      eventCount,
      totalSubscribers,
      clearedEvents: eventNames,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * 清除指定事件
   * @param {string} event - 事件名称
   */
  clearEvent(event) {
    if (this.events[event]) {
      const subscriberCount = this.events[event].length;
      delete this.events[event];
      
      this.logger.info(`清除事件完成`, {
        event,
        removedSubscribers: subscriberCount,
        timestamp: new Date().toISOString()
      });
    } else {
      this.logger.warn(`清除事件失败: 事件不存在`, {
        event,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 检查事件是否存在
   * @param {string} event - 事件名称
   * @returns {boolean} 是否存在
   */
  hasEvent(event) {
    return !!this.events[event];
  }
}

// 导出EventBus类和EventNameValidator工具类
export { EventBus, EventNameValidator };

// 默认导出EventBus类
export default EventBus;