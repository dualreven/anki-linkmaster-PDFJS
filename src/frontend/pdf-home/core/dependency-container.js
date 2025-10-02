/**
 * @file 依赖注入容器 - 增强版，支持服务注册、作用域管理、自动依赖解析
 * @module DependencyContainer
 * @description
 * 提供依赖注入（DI）容器功能，用于管理应用中的服务实例。
 *
 * 核心功能：
 * 1. 服务注册：支持单例（singleton）和瞬时（transient）作用域
 * 2. 服务获取：自动解析依赖并创建实例
 * 3. 作用域管理：支持创建子容器，实现作用域隔离
 * 4. 自动依赖解析：通过构造函数参数名自动注入依赖
 *
 * @example
 * // 创建容器
 * const container = new DependencyContainer('global');
 *
 * // 注册服务
 * container.register('logger', Logger, { scope: 'singleton' });
 * container.register('wsClient', createWSClient, { scope: 'singleton', factory: true });
 *
 * // 获取服务
 * const logger = container.get('logger');
 *
 * // 创建子作用域
 * const featureScope = container.createScope('pdf-list');
 * featureScope.register('listService', ListService);
 */

import { getLogger } from '../../common/utils/logger.js';

/**
 * 服务作用域枚举
 */
export const ServiceScope = {
  SINGLETON: 'singleton',  // 单例模式，整个容器只创建一次
  TRANSIENT: 'transient'   // 瞬时模式，每次获取都创建新实例
};

/**
 * 服务定义类
 * @private
 */
class ServiceDefinition {
  /**
   * @param {string} name - 服务名称
   * @param {Function|any} target - 服务类或工厂函数或值
   * @param {Object} options - 注册选项
   */
  constructor(name, target, options = {}) {
    this.name = name;
    this.target = target;
    this.scope = options.scope || ServiceScope.SINGLETON;
    this.factory = options.factory || false;
    this.dependencies = options.dependencies || [];
  }

  /**
   * 检查是否为单例
   * @returns {boolean}
   */
  isSingleton() {
    return this.scope === ServiceScope.SINGLETON;
  }

  /**
   * 检查是否为工厂函数
   * @returns {boolean}
   */
  isFactory() {
    return this.factory === true;
  }

  /**
   * 检查是否为类（需要 new 实例化）
   * @returns {boolean}
   */
  isClass() {
    return typeof this.target === 'function' && !this.factory;
  }
}

/**
 * 依赖注入容器类
 */
export class DependencyContainer {
  #services = new Map();      // 服务定义映射
  #instances = new Map();     // 单例实例缓存
  #parent = null;             // 父容器（用于作用域继承）
  #name = '';                 // 容器名称
  #logger = null;             // 日志记录器
  #children = new Map();      // 子容器映射

  /**
   * 创建依赖注入容器
   * @param {string} name - 容器名称
   * @param {DependencyContainer} parent - 父容器（可选）
   */
  constructor(name = 'default', parent = null) {
    this.#name = name;
    this.#parent = parent;
    this.#logger = getLogger(`DependencyContainer.${name}`);

    this.#logger.debug(`Container "${name}" created`);
  }

  /**
   * 注册服务到容器
   * @param {string} name - 服务名称（唯一标识符）
   * @param {Function|any} target - 服务类、工厂函数或值
   * @param {Object} options - 注册选项
   * @param {string} options.scope - 作用域：'singleton' | 'transient'，默认 'singleton'
   * @param {boolean} options.factory - 是否为工厂函数，默认 false
   * @param {string[]} options.dependencies - 显式声明的依赖列表（可选）
   * @throws {Error} 如果服务名称已存在
   *
   * @example
   * // 注册单例服务
   * container.register('logger', Logger);
   *
   * // 注册工厂函数
   * container.register('wsClient', createWSClient, { factory: true });
   *
   * // 注册瞬时服务
   * container.register('request', HttpRequest, { scope: 'transient' });
   */
  register(name, target, options = {}) {
    if (this.#services.has(name)) {
      throw new Error(`Service "${name}" is already registered in container "${this.#name}"`);
    }

    const definition = new ServiceDefinition(name, target, options);
    this.#services.set(name, definition);

    this.#logger.debug(`Service "${name}" registered (scope: ${definition.scope}, factory: ${definition.factory})`);
  }

  /**
   * 获取服务实例
   * @param {string} name - 服务名称
   * @returns {any} 服务实例
   * @throws {Error} 如果服务未注册
   *
   * @example
   * const logger = container.get('logger');
   * logger.info('Hello');
   */
  get(name) {
    // 先在本地查找
    const definition = this.#services.get(name);

    if (definition) {
      return this.#resolve(definition);
    }

    // 如果本地没有，尝试从父容器获取
    if (this.#parent) {
      return this.#parent.get(name);
    }

    throw new Error(`Service "${name}" is not registered in container "${this.#name}" or its parent containers`);
  }

  /**
   * 检查服务是否已注册
   * @param {string} name - 服务名称
   * @param {boolean} checkParent - 是否检查父容器，默认 true
   * @returns {boolean} 是否已注册
   */
  has(name, checkParent = true) {
    if (this.#services.has(name)) {
      return true;
    }

    if (checkParent && this.#parent) {
      return this.#parent.has(name);
    }

    return false;
  }

  /**
   * 创建子作用域容器
   * @param {string} name - 子容器名称
   * @returns {DependencyContainer} 子容器实例
   * @throws {Error} 如果同名子容器已存在
   *
   * @example
   * const featureScope = container.createScope('pdf-list');
   * featureScope.register('listService', ListService);
   * const listService = featureScope.get('listService');
   */
  createScope(name) {
    if (this.#children.has(name)) {
      this.#logger.warn(`Child container "${name}" already exists, returning existing instance`);
      return this.#children.get(name);
    }

    const childContainer = new DependencyContainer(
      `${this.#name}.${name}`,
      this
    );

    this.#children.set(name, childContainer);
    this.#logger.debug(`Child container "${name}" created`);

    return childContainer;
  }

  /**
   * 获取已存在的子作用域容器
   * @param {string} name - 子容器名称
   * @returns {DependencyContainer|null} 子容器实例，如果不存在返回 null
   */
  getScope(name) {
    return this.#children.get(name) || null;
  }

  /**
   * 获取容器名称
   * @returns {string}
   */
  getName() {
    return this.#name;
  }

  /**
   * 获取所有已注册的服务名称
   * @param {boolean} includeParent - 是否包含父容器的服务，默认 false
   * @returns {string[]}
   */
  getServiceNames(includeParent = false) {
    const names = Array.from(this.#services.keys());

    if (includeParent && this.#parent) {
      return [...names, ...this.#parent.getServiceNames(true)];
    }

    return names;
  }

  /**
   * 清空容器（移除所有服务和实例）
   * @warning 谨慎使用，会清空所有缓存的单例实例
   */
  clear() {
    this.#services.clear();
    this.#instances.clear();
    this.#children.clear();
    this.#logger.debug(`Container "${this.#name}" cleared`);
  }

  /**
   * 销毁容器
   * @description 清空所有服务和实例，并断开与父容器的连接
   */
  dispose() {
    this.clear();
    this.#parent = null;
    this.#logger.debug(`Container "${this.#name}" disposed`);
  }

  // ==================== 私有方法 ====================

  /**
   * 解析服务，返回实例
   * @param {ServiceDefinition} definition - 服务定义
   * @returns {any} 服务实例
   * @private
   */
  #resolve(definition) {
    // 如果是单例且已缓存，直接返回
    if (definition.isSingleton() && this.#instances.has(definition.name)) {
      return this.#instances.get(definition.name);
    }

    // 创建实例
    const instance = this.#createInstance(definition);

    // 如果是单例，缓存实例
    if (definition.isSingleton()) {
      this.#instances.set(definition.name, instance);
    }

    return instance;
  }

  /**
   * 创建服务实例
   * @param {ServiceDefinition} definition - 服务定义
   * @returns {any} 服务实例
   * @private
   */
  #createInstance(definition) {
    const { target, name } = definition;

    try {
      // 如果是工厂函数，直接调用
      if (definition.isFactory()) {
        this.#logger.debug(`Creating instance for "${name}" via factory function`);
        return target(this);
      }

      // 如果是类，实例化（支持自动依赖注入）
      if (definition.isClass()) {
        this.#logger.debug(`Creating instance for "${name}" via class constructor`);
        const dependencies = this.#resolveDependencies(definition);
        return new target(...dependencies);
      }

      // 否则，直接返回值
      this.#logger.debug(`Returning value for "${name}"`);
      return target;

    } catch (error) {
      this.#logger.error(`Failed to create instance for "${name}":`, error);
      throw new Error(`Failed to create instance for service "${name}": ${error.message}`);
    }
  }

  /**
   * 解析服务的依赖
   * @param {ServiceDefinition} definition - 服务定义
   * @returns {any[]} 依赖实例数组
   * @private
   */
  #resolveDependencies(definition) {
    // 如果显式声明了依赖，使用声明的依赖
    if (definition.dependencies && definition.dependencies.length > 0) {
      return definition.dependencies.map(dep => this.get(dep));
    }

    // 否则，尝试自动解析（通过函数参数名）
    // 注意：这在生产环境中可能不可靠（代码压缩会改变参数名）
    // 建议显式声明依赖
    const paramNames = this.#extractParameterNames(definition.target);

    if (paramNames.length > 0) {
      this.#logger.debug(`Auto-resolving dependencies for "${definition.name}": [${paramNames.join(', ')}]`);
      return paramNames.map(paramName => {
        if (this.has(paramName)) {
          return this.get(paramName);
        }
        // 如果依赖未注册，返回 undefined
        this.#logger.warn(`Dependency "${paramName}" not found for service "${definition.name}"`);
        return undefined;
      });
    }

    return [];
  }

  /**
   * 提取函数的参数名
   * @param {Function} func - 函数
   * @returns {string[]} 参数名数组
   * @private
   */
  #extractParameterNames(func) {
    if (typeof func !== 'function') {
      return [];
    }

    // 将函数转为字符串
    const funcStr = func.toString();

    // 提取参数列表
    // 匹配：function name(param1, param2) 或 (param1, param2) => 或 class Name { constructor(param1, param2) }
    const match = funcStr.match(/(?:constructor|function)?\s*\(([^)]*)\)/);

    if (!match || !match[1]) {
      return [];
    }

    // 解析参数名
    return match[1]
      .split(',')
      .map(param => param.trim())
      .filter(param => param.length > 0)
      .map(param => param.split('=')[0].trim()); // 移除默认值
  }
}

/**
 * 创建全局依赖注入容器的工厂函数
 * @param {string} name - 容器名称，默认 'global'
 * @returns {DependencyContainer} 容器实例
 */
export function createContainer(name = 'global') {
  return new DependencyContainer(name);
}

export default DependencyContainer;
