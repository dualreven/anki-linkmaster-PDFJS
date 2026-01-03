/**
 * 统一状态管理器（入口）
 * 详细说明：`docs/standards/state-manager.md`
 */

import { getLogger } from "../utils/logger.js";
import { ReactiveState } from "./state-manager-reactive-state.js";

/**
 * 状态管理器类（命名空间隔离）
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
    this.#logger = options.logger || getLogger("StateManager");
    this.#logger.debug("StateManager created");
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
    this.#logger.info("All states cleared");
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
      throw new Error("Invalid snapshot format");
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
