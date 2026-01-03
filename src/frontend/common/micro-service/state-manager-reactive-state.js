/**
 * 说明（详细）：`docs/standards/state-manager.md`
 */

import { getLogger } from "../utils/logger.js";

/**
 * 状态变化记录
 * @typedef {Object} StateChange
 * @property {string} path
 * @property {any} oldValue
 * @property {any} newValue
 * @property {number} timestamp
 */

/**
 * @typedef {(newValue:any, oldValue:any, change:StateChange)=>void} SubscribeCallback
 */

/**
 * @typedef {Object} ComputedProperty
 * @property {Function} getter
 * @property {any} value
 * @property {Set<string>} dependencies
 * @property {boolean} dirty
 */

/**
 * 响应式状态（Proxy + subscribe + computed + snapshot/restore + history）
 * @private
 */
export class ReactiveState {
  /** @type {string} */
  #namespace = "";

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
   * @param {string} namespace
   * @param {Object} initialData
   * @param {import('../../common/utils/logger.js').Logger} logger
   */
  constructor(namespace, initialData = {}, logger) {
    this.#namespace = namespace;
    this.#data = this.#deepClone(initialData);
    this.#logger = logger || getLogger(`StateManager.${namespace}`);
    this.#proxy = this.#createProxy(this.#data);
  }

  /** @returns {Proxy} */
  getProxy() {
    return this.#proxy;
  }

  /**
   * @param {string} path
   * @param {SubscribeCallback} callback
   * @returns {Function}
   */
  subscribe(path, callback) {
    if (!this.#subscribers.has(path)) {
      this.#subscribers.set(path, new Set());
    }

    this.#subscribers.get(path).add(callback);
    this.#logger.debug(`Subscribed to "${path}"`);

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
   * @param {string} name
   * @param {Function} getter
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

    Object.defineProperty(this.#proxy, name, {
      get: () => {
        if (computed.dirty) {
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

  /** @returns {{namespace:string,data:Object,timestamp:number}} */
  snapshot() {
    return {
      namespace: this.#namespace,
      data: this.#deepClone(this.#data),
      timestamp: Date.now()
    };
  }

  /** @param {{namespace:string,data:Object,timestamp:number}} snapshot */
  restore(snapshot) {
    if (snapshot.namespace !== this.#namespace) {
      throw new Error(`Snapshot namespace mismatch: expected "${this.#namespace}", got "${snapshot.namespace}"`);
    }

    const oldData = this.#deepClone(this.#data);

    for (const key in this.#data) {
      if (Object.prototype.hasOwnProperty.call(this.#data, key)) {
        delete this.#data[key];
      }
    }

    const restoredData = this.#deepClone(snapshot.data);
    for (const key in restoredData) {
      if (Object.prototype.hasOwnProperty.call(restoredData, key)) {
        this.#data[key] = restoredData[key];
      }
    }

    this.#computed.forEach(computed => {
      computed.dirty = true;
    });

    this.#notifyAll(oldData, this.#data);
    this.#logger.info(`State restored from snapshot (timestamp: ${snapshot.timestamp})`);
  }

  /** @param {number} [limit=10] @returns {StateChange[]} */
  getHistory(limit = 10) {
    return this.#history.slice(-limit);
  }

  clearHistory() {
    this.#history = [];
    this.#logger.debug("History cleared");
  }

  #createProxy(target, basePath = "") {
    const self = this;

    return new Proxy(target, {
      get(obj, prop) {
        const value = obj[prop];
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          const path = basePath ? `${basePath}.${String(prop)}` : String(prop);
          return self.#createProxy(value, path);
        }
        return value;
      },

      set(obj, prop, value) {
        const path = basePath ? `${basePath}.${String(prop)}` : String(prop);
        const oldValue = obj[prop];

        if (oldValue === value) {
          return true;
        }

        obj[prop] = value;

        const change = {
          path,
          oldValue: self.#deepClone(oldValue),
          newValue: self.#deepClone(value),
          timestamp: Date.now()
        };

        self.#history.push(change);
        if (self.#history.length > self.#maxHistorySize) {
          self.#history.shift();
        }

        self.#notify(path, value, oldValue, change);
        self.#markComputedDirty(path);

        return true;
      }
    });
  }

  #notify(path, newValue, oldValue, change) {
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

    const pathParts = path.split(".");
    for (let i = pathParts.length - 1; i > 0; i--) {
      const parentPath = pathParts.slice(0, i).join(".");
      const parentSubscribers = this.#subscribers.get(parentPath);

      if (parentSubscribers) {
        parentSubscribers.forEach(callback => {
          try {
            const parentNewValue = this.#getValueByPath(this.#data, parentPath);
            const parentOldValue = parentNewValue;
            callback(parentNewValue, parentOldValue, change);
          } catch (error) {
            this.#logger.error(`Error in parent subscriber for "${parentPath}":`, error);
          }
        });
      }
    }
  }

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

  #markComputedDirty(path) {
    this.#computed.forEach(computed => {
      computed.dirty = true;
    });
  }

  #getValueByPath(obj, path) {
    const parts = path.split(".");
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  #deepClone(obj) {
    if (obj === null || typeof obj !== "object") {
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

