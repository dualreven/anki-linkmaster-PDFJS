/**
 * @file DependencyContainer 单元测试
 * @description 测试依赖注入容器的核心功能
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DependencyContainer, ServiceScope, createContainer } from '../dependency-container.js';

// 测试用的服务类
class Logger {
  constructor() {
    this.logs = [];
  }

  log(message) {
    this.logs.push(message);
  }
}

class DatabaseService {
  constructor(logger) {
    this.logger = logger;
    this.connected = false;
  }

  connect() {
    this.connected = true;
    if (this.logger) {
      this.logger.log('Database connected');
    }
  }
}

class UserService {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
  }

  getUsers() {
    if (this.logger) {
      this.logger.log('Getting users');
    }
    return [];
  }
}

// 工厂函数
function createConfig(container) {
  return {
    env: 'test',
    container: container.getName()
  };
}

describe('DependencyContainer', () => {
  let container;

  beforeEach(() => {
    container = new DependencyContainer('test');
  });

  describe('构造函数和基本属性', () => {
    it('应该创建容器实例', () => {
      expect(container).toBeInstanceOf(DependencyContainer);
      expect(container.getName()).toBe('test');
    });

    it('应该通过 createContainer 工厂函数创建容器', () => {
      const newContainer = createContainer('factory-test');
      expect(newContainer).toBeInstanceOf(DependencyContainer);
      expect(newContainer.getName()).toBe('factory-test');
    });
  });

  describe('服务注册（register）', () => {
    it('应该成功注册单例服务', () => {
      container.register('logger', Logger);
      expect(container.has('logger')).toBe(true);
    });

    it('应该成功注册瞬时服务', () => {
      container.register('logger', Logger, { scope: ServiceScope.TRANSIENT });
      expect(container.has('logger')).toBe(true);
    });

    it('应该成功注册工厂函数', () => {
      container.register('config', createConfig, { factory: true });
      expect(container.has('config')).toBe(true);
    });

    it('应该抛出错误：重复注册同名服务', () => {
      container.register('logger', Logger);
      expect(() => {
        container.register('logger', Logger);
      }).toThrow(/already registered/);
    });

    it('应该注册显式声明依赖的服务', () => {
      container.register('logger', Logger);
      container.register('database', DatabaseService, {
        dependencies: ['logger']
      });
      expect(container.has('database')).toBe(true);
    });
  });

  describe('服务获取（get）', () => {
    it('应该获取单例服务实例', () => {
      container.register('logger', Logger);
      const logger = container.get('logger');
      expect(logger).toBeInstanceOf(Logger);
    });

    it('应该单例服务多次获取返回同一实例', () => {
      container.register('logger', Logger, { scope: ServiceScope.SINGLETON });
      const logger1 = container.get('logger');
      const logger2 = container.get('logger');
      expect(logger1).toBe(logger2);
    });

    it('应该瞬时服务每次获取返回新实例', () => {
      container.register('logger', Logger, { scope: ServiceScope.TRANSIENT });
      const logger1 = container.get('logger');
      const logger2 = container.get('logger');
      expect(logger1).not.toBe(logger2);
      expect(logger1).toBeInstanceOf(Logger);
      expect(logger2).toBeInstanceOf(Logger);
    });

    it('应该通过工厂函数创建实例', () => {
      container.register('config', createConfig, { factory: true });
      const config = container.get('config');
      expect(config).toEqual({
        env: 'test',
        container: 'test'
      });
    });

    it('应该抛出错误：获取未注册的服务', () => {
      expect(() => {
        container.get('nonexistent');
      }).toThrow(/not registered/);
    });
  });

  describe('服务检查（has）', () => {
    it('应该正确检查服务是否存在', () => {
      container.register('logger', Logger);
      expect(container.has('logger')).toBe(true);
      expect(container.has('nonexistent')).toBe(false);
    });

    it('应该检查父容器中的服务', () => {
      const parent = new DependencyContainer('parent');
      parent.register('logger', Logger);

      const child = new DependencyContainer('child', parent);
      expect(child.has('logger', true)).toBe(true);
      expect(child.has('logger', false)).toBe(false);
    });
  });

  describe('作用域管理（createScope / getScope）', () => {
    it('应该创建子作用域容器', () => {
      const childScope = container.createScope('child');
      expect(childScope).toBeInstanceOf(DependencyContainer);
      expect(childScope.getName()).toBe('test.child');
    });

    it('应该子容器能访问父容器的服务', () => {
      container.register('logger', Logger);
      const childScope = container.createScope('child');

      const logger = childScope.get('logger');
      expect(logger).toBeInstanceOf(Logger);
    });

    it('应该子容器的服务不影响父容器', () => {
      const childScope = container.createScope('child');
      childScope.register('childService', Logger);

      expect(childScope.has('childService', false)).toBe(true);
      expect(container.has('childService', false)).toBe(false);
    });

    it('应该通过 getScope 获取已存在的子容器', () => {
      const childScope1 = container.createScope('child');
      const childScope2 = container.getScope('child');
      expect(childScope1).toBe(childScope2);
    });

    it('应该 getScope 返回 null：子容器不存在', () => {
      const nonexistent = container.getScope('nonexistent');
      expect(nonexistent).toBeNull();
    });

    it('应该重复创建同名子容器返回已存在的实例', () => {
      const childScope1 = container.createScope('child');
      const childScope2 = container.createScope('child');
      expect(childScope1).toBe(childScope2);
    });
  });

  describe('自动依赖解析', () => {
    it('应该自动解析构造函数依赖（参数名匹配）', () => {
      container.register('logger', Logger);
      container.register('database', DatabaseService);

      const database = container.get('database');
      expect(database).toBeInstanceOf(DatabaseService);
      expect(database.logger).toBeInstanceOf(Logger);
    });

    it('应该自动解析多个依赖', () => {
      container.register('logger', Logger);
      container.register('database', DatabaseService);
      container.register('userService', UserService);

      const userService = container.get('userService');
      expect(userService).toBeInstanceOf(UserService);
      expect(userService.logger).toBeInstanceOf(Logger);
      expect(userService.database).toBeInstanceOf(DatabaseService);
    });

    it('应该使用显式声明的依赖（优先于自动解析）', () => {
      container.register('logger', Logger);
      container.register('database', DatabaseService, {
        dependencies: ['logger']
      });

      const database = container.get('database');
      expect(database.logger).toBeInstanceOf(Logger);
    });

    it('应该依赖未注册时注入 undefined', () => {
      // DatabaseService 依赖 logger，但 logger 未注册
      container.register('database', DatabaseService);

      const database = container.get('database');
      expect(database).toBeInstanceOf(DatabaseService);
      expect(database.logger).toBeUndefined();
    });
  });

  describe('容器管理方法', () => {
    it('应该 getServiceNames 返回所有已注册的服务名称', () => {
      container.register('logger', Logger);
      container.register('database', DatabaseService);

      const names = container.getServiceNames();
      expect(names).toEqual(['logger', 'database']);
    });

    it('应该 getServiceNames 包含父容器的服务', () => {
      const parent = new DependencyContainer('parent');
      parent.register('parentService', Logger);

      const child = new DependencyContainer('child', parent);
      child.register('childService', DatabaseService);

      const names = child.getServiceNames(true);
      expect(names).toContain('childService');
      expect(names).toContain('parentService');
    });

    it('应该 clear 清空所有服务和实例', () => {
      container.register('logger', Logger);
      container.get('logger'); // 创建单例实例

      container.clear();
      expect(container.getServiceNames()).toEqual([]);
      expect(container.has('logger')).toBe(false);
    });

    it('应该 dispose 销毁容器', () => {
      container.register('logger', Logger);
      container.dispose();

      expect(container.getServiceNames()).toEqual([]);
    });
  });

  describe('复杂场景测试', () => {
    it('应该支持依赖链解析（A → B → C）', () => {
      container.register('logger', Logger);
      container.register('database', DatabaseService);
      container.register('userService', UserService);

      const userService = container.get('userService');
      const database = userService.database;
      const logger = database.logger;

      expect(userService).toBeInstanceOf(UserService);
      expect(database).toBeInstanceOf(DatabaseService);
      expect(logger).toBeInstanceOf(Logger);

      // 验证单例：userService.logger 和 database.logger 应该是同一实例
      expect(userService.logger).toBe(logger);
    });

    it('应该支持嵌套作用域（三层）', () => {
      const parent = new DependencyContainer('parent');
      parent.register('logger', Logger);

      const child = parent.createScope('child');
      child.register('database', DatabaseService);

      const grandchild = child.createScope('grandchild');
      grandchild.register('userService', UserService);

      const userService = grandchild.get('userService');
      expect(userService).toBeInstanceOf(UserService);
      expect(userService.logger).toBeInstanceOf(Logger);
      expect(userService.database).toBeInstanceOf(DatabaseService);
    });

    it('应该支持混合作用域（单例 + 瞬时）', () => {
      container.register('singletonLogger', Logger, { scope: ServiceScope.SINGLETON });
      container.register('transientLogger', Logger, { scope: ServiceScope.TRANSIENT });

      const logger1 = container.get('singletonLogger');
      const logger2 = container.get('singletonLogger');
      expect(logger1).toBe(logger2);

      const logger3 = container.get('transientLogger');
      const logger4 = container.get('transientLogger');
      expect(logger3).not.toBe(logger4);
    });

    it('应该工厂函数接收容器作为参数', () => {
      container.register('config', (c) => {
        return {
          containerName: c.getName(),
          services: c.getServiceNames()
        };
      }, { factory: true });

      container.register('logger', Logger);

      const config = container.get('config');
      expect(config.containerName).toBe('test');
      expect(config.services).toContain('logger');
    });
  });

  describe('错误处理', () => {
    it('应该捕获构造函数抛出的错误', () => {
      class FailingService {
        constructor() {
          throw new Error('Construction failed');
        }
      }

      container.register('failing', FailingService);

      expect(() => {
        container.get('failing');
      }).toThrow(/Failed to create instance/);
    });

    it('应该提供清晰的错误信息', () => {
      expect(() => {
        container.get('nonexistent');
      }).toThrow(/not registered/);
      expect(() => {
        container.get('nonexistent');
      }).toThrow(/test/); // 包含容器名称
    });
  });
});
