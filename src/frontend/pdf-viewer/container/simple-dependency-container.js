/**
 * @file 简化的依赖注入容器
 * @module SimpleDependencyContainer
 * @description 为 pdf-viewer 提供最小化的 DependencyContainer 实现
 * @version 1.0.1
 */

import { getLogger } from '../../common/utils/logger.js';

/**
 * 简化的依赖注入容器
 * @class SimpleDependencyContainer
 */
export class SimpleDependencyContainer {
  #services = new Map();
  #logger;
  #name;
  #parent = null;  // 父容器引用

  /**
   * @param {string} name - 容器名称
   * @param {SimpleDependencyContainer} parent - 父容器（可选）
   */
  constructor(name = 'default', parent = null) {
    this.#name = name;
    this.#parent = parent;
    this.#logger = getLogger(`Container.${name}`);
  }

  /**
   * 注册服务
   * @param {string} name - 服务名称
   * @param {any} instance - 服务实例
   */
  register(name, instance) {
    this.#services.set(name, instance);
    this.#logger.debug(`Service registered: ${name}`);
  }

  /**
   * 注册服务到根容器（全局共享）
   * @param {string} name - 服务名称
   * @param {any} instance - 服务实例
   */
  registerGlobal(name, instance) {
    // 找到根容器
    let root = this;
    while (root.#parent) {
      root = root.#parent;
    }

    // 在根容器注册
    root.register(name, instance);
    this.#logger.debug(`Service registered globally: ${name}`);
  }

  /**
   * 获取服务（支持父容器查找）
   * @param {string} name - 服务名称
   * @returns {any}
   */
  get(name) {
    // 先在当前容器查找
    if (this.#services.has(name)) {
      return this.#services.get(name);
    }

    // 如果当前容器没有，尝试从父容器获取
    if (this.#parent) {
      return this.#parent.get(name);
    }

    // 都找不到，记录警告
    this.#logger.warn(`Service not found: ${name}`);
    return null;
  }

  /**
   * 解析服务（get的别名，用于依赖注入标准API）
   * @param {string} name - 服务名称
   * @returns {any}
   */
  resolve(name) {
    return this.get(name);
  }

  /**
   * 检查服务是否存在（支持父容器查找）
   * @param {string} name - 服务名称
   * @returns {boolean}
   */
  has(name) {
    // 先检查当前容器
    if (this.#services.has(name)) {
      return true;
    }

    // 再检查父容器
    if (this.#parent) {
      return this.#parent.has(name);
    }

    return false;
  }

  /**
   * 创建子作用域（支持父容器链）
   * @param {string} scopeName - 作用域名称
   * @returns {SimpleDependencyContainer}
   */
  createScope(scopeName) {
    // 创建子容器，传递父容器引用
    const childContainer = new SimpleDependencyContainer(`${this.#name}.${scopeName}`, this);

    // 不再复制服务，通过父容器引用自动继承
    // 子容器可以注册自己的服务，不会影响父容器

    return childContainer;
  }

  /**
   * 销毁容器
   */
  dispose() {
    this.#services.clear();
    this.#logger.debug('Container disposed');
  }
}
