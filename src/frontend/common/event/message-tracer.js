/**
 * @file EventBus消息追踪器 - 实现消息调用链追踪功能
 * @module MessageTracer
 * @author AI-Assistant
 * @version 1.0
 * @date 2025-09-23
 */

/**
 * 消息追踪记录结构
 * @typedef {Object} MessageTrace
 * @property {string} messageId - 消息唯一标识
 * @property {string} traceId - 调用链标识
 * @property {string} event - 事件名称
 * @property {string} publisher - 发布者标识
 * @property {Array<string>} subscribers - 订阅者列表
 * @property {number} timestamp - 发布时间戳
 * @property {string} [parentMessageId] - 父消息ID（级联事件）
 * @property {string} [data] - 消息数据（截取后）
 * @property {Array<ExecutionResult>} executionResults - 执行结果
 * @property {number} totalExecutionTime - 总执行时间（毫秒）
 */

/**
 * 执行结果结构
 * @typedef {Object} ExecutionResult
 * @property {string} subscriberId - 订阅者ID
 * @property {boolean} success - 执行是否成功
 * @property {number} executionTime - 执行时间（毫秒）
 * @property {string} [error] - 错误信息（如果失败）
 */

/**
 * 调用链树结构
 * @typedef {Object} TraceTree
 * @property {string} traceId - 调用链ID
 * @property {number} startTime - 开始时间戳
 * @property {number} totalDuration - 总耗时
 * @property {Array<TraceNode>} messages - 消息节点列表
 */

/**
 * 消息追踪管理器
 * 负责追踪数据的存储、查询和分析
 */
export class MessageTracer {
  /**
   * 创建MessageTracer实例
   * @param {Object} options - 配置选项
   * @param {number} [options.maxTraceSize=1000] - 最大追踪记录数
   * @param {boolean} [options.enablePerformanceTracking=true] - 是否启用性能追踪
   */
  constructor(options = {}) {
    this.#messageTraces = new Map();
    this.#maxTraceSize = options.maxTraceSize || 1000;
    this.#enablePerformanceTracking = options.enablePerformanceTracking !== false;
    this.#idCounter = 1;

    this.#log('info', `MessageTracer已初始化，最大记录数: ${this.#maxTraceSize}`);
  }

  // 私有属性
  #messageTraces = new Map();
  #maxTraceSize = 1000;
  #enablePerformanceTracking = true;
  #idCounter = 1;

  /**
   * 生成唯一的消息ID
   * @returns {string} 消息ID
   */
  generateMessageId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const counter = this.#idCounter++;

    return `msg_${timestamp}_${counter}_${random}`;
  }

  /**
   * 记录消息追踪信息
   * @param {MessageTrace} messageTrace - 消息追踪记录
   */
  recordMessage(messageTrace) {
    if (!messageTrace || !messageTrace.messageId) {
      this.#log('warn', '无效的消息追踪记录，忽略', messageTrace);
      return;
    }

    // 确保必要字段存在
    const trace = {
      messageId: messageTrace.messageId,
      traceId: messageTrace.traceId || messageTrace.messageId,
      event: messageTrace.event || 'unknown:event:occurred',
      publisher: messageTrace.publisher || 'unknown',
      subscribers: messageTrace.subscribers || [],
      timestamp: messageTrace.timestamp || Date.now(),
      parentMessageId: messageTrace.parentMessageId,
      data: messageTrace.data ? messageTrace.data.substring(0, 500) : '', // 限制数据长度
      executionResults: messageTrace.executionResults || [],
      totalExecutionTime: messageTrace.totalExecutionTime || 0
    };

    this.#messageTraces.set(trace.messageId, trace);

    // 内存管理：删除最老的记录
    if (this.#messageTraces.size > this.#maxTraceSize) {
      const firstKey = this.#messageTraces.keys().next().value;
      this.#messageTraces.delete(firstKey);
      this.#log('debug', `删除最老的追踪记录: ${firstKey}`);
    }

    this.#log('debug', `记录消息追踪: ${trace.event} (${trace.messageId})`);
  }

  /**
   * 获取指定消息的追踪信息
   * @param {string} messageId - 消息ID
   * @returns {MessageTrace|null} 消息追踪记录
   */
  getTrace(messageId) {
    const trace = this.#messageTraces.get(messageId);
    if (!trace) {
      this.#log('warn', `未找到消息追踪记录: ${messageId}`);
      return null;
    }

    // 返回副本，防止外部修改
    return { ...trace };
  }

  /**
   * 构建调用链树
   * @param {string} traceId - 调用链ID
   * @returns {TraceTree} 调用链树
   */
  buildTraceTree(traceId) {
    // 1. 找到所有属于该调用链的消息
    const traceMessages = Array.from(this.#messageTraces.values())
      .filter(trace => trace.traceId === traceId)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (traceMessages.length === 0) {
      this.#log('warn', `未找到调用链: ${traceId}`);
      return null;
    }

    // 2. 创建调用链树
    const tree = {
      traceId,
      startTime: traceMessages[0].timestamp,
      totalDuration: 0,
      messages: []
    };

    const messageMap = new Map();
    const rootMessages = [];

    // 3. 创建消息节点
    traceMessages.forEach(trace => {
      const node = {
        messageId: trace.messageId,
        event: trace.event,
        publisher: trace.publisher,
        timestamp: trace.timestamp,
        executionTime: trace.totalExecutionTime,
        subscribers: trace.subscribers,
        children: [],
        errors: trace.executionResults.filter(r => !r.success),
        hasErrors: trace.executionResults.some(r => !r.success)
      };

      messageMap.set(trace.messageId, node);

      // 如果有父消息，稍后处理
      if (trace.parentMessageId) {
        node.parentMessageId = trace.parentMessageId;
      } else {
        rootMessages.push(node);
      }
    });

    // 4. 建立父子关系
    messageMap.forEach(node => {
      if (node.parentMessageId && messageMap.has(node.parentMessageId)) {
        const parent = messageMap.get(node.parentMessageId);
        parent.children.push(node);
      } else if (!node.parentMessageId) {
        tree.messages.push(node);
      }
    });

    // 5. 计算总耗时
    const lastMessage = traceMessages[traceMessages.length - 1];
    tree.totalDuration = lastMessage.timestamp + lastMessage.totalExecutionTime - tree.startTime;

    this.#log('debug', `构建调用链树: ${traceId}，包含 ${traceMessages.length} 个消息`);

    return tree;
  }

  /**
   * 获取性能统计信息
   * @param {string} [event] - 可选的事件名称过滤
   * @returns {Object} 性能统计
   */
  getStats(event = null) {
    let traces = Array.from(this.#messageTraces.values());

    if (event) {
      traces = traces.filter(trace => trace.event === event);
    }

    if (traces.length === 0) {
      return {
        totalMessages: 0,
        averageExecutionTime: 0,
        maxExecutionTime: 0,
        minExecutionTime: 0,
        errorRate: 0
      };
    }

    const executionTimes = traces.map(t => t.totalExecutionTime);
    const totalErrors = traces.reduce((sum, trace) =>
      sum + trace.executionResults.filter(r => !r.success).length, 0);
    const totalExecutions = traces.reduce((sum, trace) =>
      sum + trace.executionResults.length, 0);

    return {
      totalMessages: traces.length,
      averageExecutionTime: executionTimes.reduce((sum, time) => sum + time, 0) / traces.length,
      maxExecutionTime: Math.max(...executionTimes),
      minExecutionTime: Math.min(...executionTimes),
      errorRate: totalExecutions > 0 ? (totalErrors / totalExecutions) : 0,
      totalErrors,
      totalExecutions
    };
  }

  /**
   * 清理指定时间之前的追踪数据
   * @param {number} olderThan - 时间戳，删除此时间之前的记录
   * @returns {number} 清理的记录数
   */
  clearTraceData(olderThan) {
    let deletedCount = 0;

    for (const [messageId, trace] of this.#messageTraces.entries()) {
      if (trace.timestamp < olderThan) {
        this.#messageTraces.delete(messageId);
        deletedCount++;
      }
    }

    this.#log('info', `清理了 ${deletedCount} 条追踪记录，早于 ${new Date(olderThan).toISOString()}`);

    return deletedCount;
  }

  /**
   * 获取所有调用链ID列表
   * @returns {Array<string>} 调用链ID数组
   */
  getAllTraceIds() {
    const traceIds = new Set();

    this.#messageTraces.forEach(trace => {
      traceIds.add(trace.traceId);
    });

    return Array.from(traceIds);
  }

  /**
   * 获取追踪器状态信息
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      totalMessages: this.#messageTraces.size,
      maxTraceSize: this.#maxTraceSize,
      enablePerformanceTracking: this.#enablePerformanceTracking,
      memoryUsage: `${this.#messageTraces.size}/${this.#maxTraceSize}`,
      uniqueTraces: this.getAllTraceIds().length
    };
  }

  /**
   * 简单的内部日志方法
   * @private
   */
  #log(level, message, ...args) {
    if (typeof console !== 'undefined' && console[level]) {
      console[level](`[MessageTracer] ${message}`, ...args);
    }
  }

  /**
   * 销毁追踪器，清理所有数据
   */
  destroy() {
    const messageCount = this.#messageTraces.size;
    this.#messageTraces.clear();
    this.#log('info', `MessageTracer已销毁，清理了 ${messageCount} 条记录`);
  }
}

// 全局便捷函数 - 规格要求的接口
let globalTracer = null;

/**
 * 生成消息ID - 规格要求的接口1
 * @returns {string} 唯一消息ID
 */
export function generateMessageId() {
  if (!globalTracer) {
    globalTracer = new MessageTracer();
  }
  return globalTracer.generateMessageId();
}

/**
 * 获取消息追踪 - 规格要求的接口2
 * @param {string} messageId - 消息ID
 * @returns {Object} 消息追踪对象
 */
export function getMessageTrace(messageId) {
  if (!globalTracer) {
    return null;
  }
  return globalTracer.getTrace(messageId);
}

/**
 * 获取调用链树 - 规格要求的接口3
 * @param {string} traceId - 调用链ID
 * @returns {Object} 调用链树
 */
export function getTraceTree(traceId) {
  if (!globalTracer) {
    return null;
  }
  return globalTracer.buildTraceTree(traceId);
}

/**
 * 清理追踪数据 - 规格要求的接口4
 * @param {number} olderThan - 时间戳
 * @returns {number} 清理的记录数
 */
export function clearTraceData(olderThan) {
  if (!globalTracer) {
    return 0;
  }
  return globalTracer.clearTraceData(olderThan);
}

/**
 * 设置全局追踪器实例
 * @param {MessageTracer} tracer - 追踪器实例
 */
export function setGlobalTracer(tracer) {
  globalTracer = tracer;
}

/**
 * 获取全局追踪器实例
 * @returns {MessageTracer} 追踪器实例
 */
export function getGlobalTracer() {
  if (!globalTracer) {
    globalTracer = new MessageTracer();
  }
  return globalTracer;
}