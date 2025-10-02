/**
 * @file 统一状态管理器 - State Manager
 * @module StateManager
 * @description
 * 基于 Proxy 实现的响应式状态管理器，为功能域提供状态管理能力。
 *
 * 核心功能：
 * 1. 响应式状态：使用 Proxy 拦截对象的 get/set 操作
 * 2. 订阅机制：状态变化时自动触发订阅的回调
 * 3. 计算属性：基于状态的派生数据，自动更新
 * 4. 状态快照：保存状态的某个时刻的副本
 * 5. 状态恢复：从快照恢复状态
 * 6. 命名空间隔离：不同功能域的状态互不干扰
 *
 * @example
 * // 创建状态管理器
 * const stateManager = new StateManager();
 *
 * // 创建功能域状态
 * const state = stateManager.createState('pdf-list', {
 *   records: [],
 *   selectedIds: [],
 *   filters: {}
 * });
 *
 * // 订阅状态变化
 * state.subscribe('records', (newVal, oldVal) => {
 *   console.log('Records changed:', newVal);
 * });
 *
 * // 修改状态（自动触发订阅）
 * state.records = [...state.records, newRecord];
 *
 * // 定义计算属性
 * state.defineComputed('selectedRecords', () => {
 *   return state.records.filter(r => state.selectedIds.includes(r.id));
 * });
 *
 * // 状态快照
 * const snapshot = state.snapshot();
 * state.restore(snapshot);
 */

import { getLogger } from '../../common/utils/logger.js';

/**
 * 状态变化记录
 * @typedef {Object} StateChange
 * @property {string} path - 变化的路径（如 'records', 'filters.name'）
 * @property {any} oldValue - 旧值
 * @property {any} newValue - 新值
 * @property {number} timestamp - 时间戳
 */

/**
 * 订阅回调函数类型
 * @typedef {Function} SubscribeCallback
 * @param {any} newValue - 新值
 * @param {any} oldValue - 旧值
 * @param {StateChange} change - 变化记录
 */

/**
 * 计算属性定义
 * @typedef {Object} ComputedProperty
 * @property {Function} getter - 获取函数
 * @property {any} value - 缓存的值
 * @property {Set<string>} dependencies - 依赖的属性集合
 * @property {boolean} dirty - 是否需要重新计算
 */

// ==================== 响应式状态类 ====================

/**
 * 响应式状态类
 * @class ReactiveState
 * @private
 */
class ReactiveState {
  /** @type {string} */
  #namespace = '';

  /** @type {Object} */
  #data = {};

  /** @type {Proxy} */
  #proxy = null;

  /** @type {Map<string, Set<SubscribeCallback>>} */
  #subscribers = new Map();

  /** @type {Map<string, ComputedProperty>} */
  #computed = new Map();

  /** @type {import('../../common/utils/logger.js').Logger} */
  #logger = null;

  /** @type {StateChange[]} */
  #history = [];

  /** @type {number} */
  #maxHistorySize = 100;

  /**
   * @param {string} namespace - 命名空间
   * @param {Object} initialData - 初始数据
   * @param {import('../../common/utils/logger.js').Logger} logger - 日志记录器
   */
  constructor(namespace, initialData = {}, logger) {
    this.#namespace = namespace;
    this.#data = this.#deepClone(initialData);
    this.#logger = logger || getLogger(`StateManager.${namespace}`);

    // 创建响应式代理
    this.#proxy = this.#createProxy(this.#data);
  }

  /**
   * 获取代理对象
   * @returns {Proxy}
   */
  getProxy() {
    return this.#proxy;
  }

  /**
   * 订阅属性变化
   * @param {string} path - 属性路径（支持嵌套，如 'filters.name'）
   * @param {SubscribeCallback} callback - 回调函数
   * @returns {Function} 取消订阅函数
   */
  subscribe(path, callback) {
    if (!this.#subscribers.has(path)) {
      this.#subscribers.set(path, new Set());
    }

    this.#subscribers.get(path).add(callback);
    this.#logger.debug(`Subscribed to "${path}"`);

    // 返回取消订阅函数
    return () => {
      const subscribers = this.#subscribers.get(path);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.#subscribers.delete(path);
        }
      }
      this.#logger.debug(`Unsubscribed from "${path}"`);
    };
  }

  /**
   * 定义计算属性
   * @param {string} name - 计算属性名称
   * @param {Function} getter - 获取函数
   */
  defineComputed(name, getter) {
    if (this.#computed.has(name)) {
      throw new Error(`Computed property "${name}" already exists`);
    }

    const computed = {
      getter,
      value: undefined,
      dependencies: new Set(),
      dirty: true
    };

    this.#computed.set(name, computed);

    // 在 proxy 上定义 getter
    Object.defineProperty(this.#proxy, name, {
      get: () => {
        if (computed.dirty) {
          // 重新计算
          computed.value = getter();
          computed.dirty = false;
          this.#logger.debug(`Computed property "${name}" recalculated`);
        }
        return computed.value;
      },
      enumerable: false,
      configurable: true
    });

    this.#logger.debug(`Defined computed property "${name}"`);
  }

  /**
   * 生成状态快照
   * @returns {Object} 状态快照
   */
  snapshot() {
    return {
      namespace: this.#namespace,
      data: this.#deepClone(this.#data),
      timestamp: Date.now()
    };
  }

  /**
   * 从快照恢复状态
   * @param {Object} snapshot - 状态快照
   */
  restore(snapshot) {
    if (snapshot.namespace !== this.#namespace) {
      throw new Error(`Snapshot namespace mismatch: expected "${this.#namespace}", got "${snapshot.namespace}"`);
    }

    // 保存旧数据用于触发变化通知
    const oldData = this.#deepClone(this.#data);

    // 直接修改原始数据对象，而不是创建新对象
    // 这样可以保持 proxy 引用不变

    // 清空现有属性
    for (const key in this.#data) {
      if (Object.prototype.hasOwnProperty.call(this.#data, key)) {
        delete this.#data[key];
      }
    }

    // 复制快照数据到原始对象
    const restoredData = this.#deepClone(snapshot.data);
    for (const key in restoredData) {
      if (Object.prototype.hasOwnProperty.call(restoredData, key)) {
        this.#data[key] = restoredData[key];
      }
    }

    // 标记所有计算属性为脏
    this.#computed.forEach(computed => {
      computed.dirty = true;
    });

    // 触发所有订阅（因为整个状态都可能改变）
    this.#notifyAll(oldData, this.#data);

    this.#logger.info(`State restored from snapshot (timestamp: ${snapshot.timestamp})`);
  }

  /**
   * 获取变化历史
   * @param {number} [limit=10] - 返回的最大记录数
   * @returns {StateChange[]}
   */
  getHistory(limit = 10) {
    return this.#history.slice(-limit);
  }

  /**
   * 清除变化历史
   */
  clearHistory() {
    this.#history = [];
    this.#logger.debug('History cleared');
  }

  // ==================== 私有方法 ====================

  /**
   * 创建响应式代理
   * @param {Object} target - 目标对象
   * @param {string} [basePath=''] - 基础路径
   * @returns {Proxy}
   * @private
   */
  #createProxy(target, basePath = '') {
    const self = this;

    return new Proxy(target, {
      get(obj, prop) {
        const value = obj[prop];

        // 如果是对象，递归创建代理
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          const path = basePath ? `${basePath}.${String(prop)}` : String(prop);
          return self.#createProxy(value, path);
        }

        return value;
      },

      set(obj, prop, value) {
        const path = basePath ? `${basePath}.${String(prop)}` : String(prop);
        const oldValue = obj[prop];

        // 值没有变化，直接返回
        if (oldValue === value) {
          return true;
        }

        // 设置新值
        obj[prop] = value;

        // 记录变化
        const change = {
          path,
          oldValue: self.#deepClone(oldValue),
          newValue: self.#deepClone(value),
          timestamp: Date.now()
        };

        self.#history.push(change);

        // 限制历史记录大小
        if (self.#history.length > self.#maxHistorySize) {
          self.#history.shift();
        }

        // 触发订阅
        self.#notify(path, value, oldValue, change);

        // 标记依赖此属性的计算属性为脏
        self.#markComputedDirty(path);

        return true;
      }
    });
  }

  /**
   * 通知订阅者
   * @param {string} path - 变化的路径
   * @param {any} newValue - 新值
   * @param {any} oldValue - 旧值
   * @param {StateChange} change - 变化记录
   * @private
   */
  #notify(path, newValue, oldValue, change) {
    // 精确匹配的订阅
    const exactSubscribers = this.#subscribers.get(path);
    if (exactSubscribers) {
      exactSubscribers.forEach(callback => {
        try {
          callback(newValue, oldValue, change);
        } catch (error) {
          this.#logger.error(`Error in subscriber for "${path}":`, error);
        }
      });
    }

    // 父路径的订阅（如 'filters' 应该在 'filters.name' 变化时触发）
    const pathParts = path.split('.');
    for (let i = pathParts.length - 1; i > 0; i--) {
      const parentPath = pathParts.slice(0, i).join('.');
      const parentSubscribers = this.#subscribers.get(parentPath);

      if (parentSubscribers) {
        parentSubscribers.forEach(callback => {
          try {
            // 获取父对象的新旧值
            const parentNewValue = this.#getValueByPath(this.#data, parentPath);
            const parentOldValue = parentNewValue; // 简化处理
            callback(parentNewValue, parentOldValue, change);
          } catch (error) {
            this.#logger.error(`Error in parent subscriber for "${parentPath}":`, error);
          }
        });
      }
    }
  }

  /**
   * 通知所有订阅者（用于状态恢复）
   * @param {Object} oldData - 旧数据
   * @param {Object} newData - 新数据
   * @private
   */
  #notifyAll(oldData, newData) {
    this.#subscribers.forEach((callbacks, path) => {
      const oldValue = this.#getValueByPath(oldData, path);
      const newValue = this.#getValueByPath(newData, path);

      if (oldValue !== newValue) {
        const change = {
          path,
          oldValue,
          newValue,
          timestamp: Date.now()
        };

        callbacks.forEach(callback => {
          try {
            callback(newValue, oldValue, change);
          } catch (error) {
            this.#logger.error(`Error in subscriber for "${path}":`, error);
          }
        });
      }
    });
  }

  /**
   * 标记依赖某个属性的计算属性为脏
   * @param {string} path - 变化的路径
   * @private
   */
  #markComputedDirty(path) {
    this.#computed.forEach((computed, name) => {
      // 简化实现：标记所有计算属性为脏
      // TODO: 实现更精确的依赖追踪
      computed.dirty = true;
    });
  }

  /**
   * 根据路径获取值
   * @param {Object} obj - 对象
   * @param {string} path - 路径（如 'filters.name'）
   * @returns {any}
   * @private
   */
  #getValueByPath(obj, path) {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * 深度克隆对象
   * @param {any} obj - 要克隆的对象
   * @returns {any}
   * @private
   */
  #deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.#deepClone(item));
    }

    const cloned = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = this.#deepClone(obj[key]);
      }
    }

    return cloned;
  }
}

// ==================== 状态管理器 ====================

/**
 * 状态管理器类
 * @class StateManager
 */
export class StateManager {
  /** @type {Map<string, ReactiveState>} */
  #states = new Map();

  /** @type {import('../../common/utils/logger.js').Logger} */
  #logger = null;

  /**
   * 创建状态管理器
   * @param {Object} [options] - 配置选项
   * @param {import('../../common/utils/logger.js').Logger} [options.logger] - 日志记录器
   */
  constructor(options = {}) {
    this.#logger = options.logger || getLogger('StateManager');
    this.#logger.debug('StateManager created');
  }

  /**
   * 创建功能域状态
   * @param {string} namespace - 命名空间（功能域名称）
   * @param {Object} initialData - 初始数据
   * @returns {Proxy} 响应式状态对象
   *
   * @example
   * const state = stateManager.createState('pdf-list', {
   *   records: [],
   *   selectedIds: []
   * });
   */
  createState(namespace, initialData = {}) {
    if (this.#states.has(namespace)) {
      throw new Error(`State for namespace "${namespace}" already exists`);
    }

    const reactiveState = new ReactiveState(namespace, initialData, this.#logger);
    this.#states.set(namespace, reactiveState);

    this.#logger.info(`State created for namespace: ${namespace}`);

    // 返回代理对象，并附加辅助方法
    const proxy = reactiveState.getProxy();

    // 将辅助方法添加到代理对象（不可枚举）
    Object.defineProperties(proxy, {
      subscribe: {
        value: reactiveState.subscribe.bind(reactiveState),
        writable: false,
        enumerable: false
      },
      defineComputed: {
        value: reactiveState.defineComputed.bind(reactiveState),
        writable: false,
        enumerable: false
      },
      snapshot: {
        value: reactiveState.snapshot.bind(reactiveState),
        writable: false,
        enumerable: false
      },
      restore: {
        value: reactiveState.restore.bind(reactiveState),
        writable: false,
        enumerable: false
      },
      getHistory: {
        value: reactiveState.getHistory.bind(reactiveState),
        writable: false,
        enumerable: false
      },
      clearHistory: {
        value: reactiveState.clearHistory.bind(reactiveState),
        writable: false,
        enumerable: false
      }
    });

    return proxy;
  }

  /**
   * 获取功能域状态
   * @param {string} namespace - 命名空间
   * @returns {Proxy|null}
   */
  getState(namespace) {
    const reactiveState = this.#states.get(namespace);
    return reactiveState ? reactiveState.getProxy() : null;
  }

  /**
   * 检查功能域状态是否存在
   * @param {string} namespace - 命名空间
   * @returns {boolean}
   */
  hasState(namespace) {
    return this.#states.has(namespace);
  }

  /**
   * 删除功能域状态
   * @param {string} namespace - 命名空间
   */
  deleteState(namespace) {
    if (this.#states.delete(namespace)) {
      this.#logger.info(`State deleted for namespace: ${namespace}`);
    }
  }

  /**
   * 销毁功能域状态（deleteState 的别名）
   * @param {string} namespace - 命名空间
   */
  destroyState(namespace) {
    this.deleteState(namespace);
  }

  /**
   * 获取所有命名空间
   * @returns {string[]}
   */
  getAllNamespaces() {
    return Array.from(this.#states.keys());
  }

  /**
   * 清除所有状态
   */
  clear() {
    this.#states.clear();
    this.#logger.info('All states cleared');
  }

  /**
   * 生成所有功能域的全局快照
   * @returns {Object} 全局快照对象
   */
  snapshot() {
    const snapshots = {};

    for (const [namespace, reactiveState] of this.#states.entries()) {
      snapshots[namespace] = reactiveState.snapshot();
    }

    return {
      states: snapshots,
      timestamp: Date.now()
    };
  }

  /**
   * 从全局快照恢复所有功能域状态
   * @param {Object} globalSnapshot - 全局快照对象
   */
  restore(globalSnapshot) {
    if (!globalSnapshot || !globalSnapshot.states) {
      throw new Error('Invalid snapshot format');
    }

    for (const [namespace, snapshot] of Object.entries(globalSnapshot.states)) {
      const reactiveState = this.#states.get(namespace);
      if (reactiveState) {
        reactiveState.restore(snapshot);
      } else {
        this.#logger.warn(`Namespace "${namespace}" not found, skipping restore`);
      }
    }

    this.#logger.info(`Restored state from global snapshot (timestamp: ${globalSnapshot.timestamp})`);
  }
}

/**
 * 创建状态管理器的工厂函数
 * @param {Object} [options] - 配置选项
 * @returns {StateManager}
 */
export function createStateManager(options) {
  return new StateManager(options);
}

export default StateManager;
