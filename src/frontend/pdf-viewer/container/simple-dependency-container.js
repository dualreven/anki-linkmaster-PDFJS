/**
 * @file 简化的依赖注入容器
 * @module SimpleDependencyContainer
 * @description 为 pdf-viewer 提供最小化的 DependencyContainer 实现
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

  /**
   * @param {string} name - 容器名称
   */
  constructor(name = 'default') {
    this.#name = name;
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
   * 获取服务
   * @param {string} name - 服务名称
   * @returns {any}
   */
  get(name) {
    const service = this.#services.get(name);
    if (!service) {
      this.#logger.warn(`Service not found: ${name}`);
    }
    return service;
  }

  /**
   * 检查服务是否存在
   * @param {string} name - 服务名称
   * @returns {boolean}
   */
  has(name) {
    return this.#services.has(name);
  }

  /**
   * 创建子作用域（简化版）
   * @param {string} scopeName - 作用域名称
   * @returns {SimpleDependencyContainer}
   */
  createScope(scopeName) {
    const childContainer = new SimpleDependencyContainer(`${this.#name}.${scopeName}`);

    // 复制父容器的所有服务到子容器
    for (const [name, service] of this.#services.entries()) {
      childContainer.register(name, service);
    }

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
