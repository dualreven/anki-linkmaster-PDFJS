/**
 * @file FeatureRegistry 单元测试
 * @description 测试功能注册中心的核心功能
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FeatureRegistry, FeatureStatus, createFeatureRegistry } from '../feature-registry.js';
import { DependencyContainer } from '../dependency-container.js';

// ==================== Mock Features ====================

/**
 * Mock 核心功能（无依赖）
 */
class MockCoreFeature {
  get name() { return 'core'; }
  get version() { return '1.0.0'; }
  get dependencies() { return []; }

  async install(context) {
    this.installed = true;
    this.context = context;
  }

  async uninstall(context) {
    this.installed = false;
  }
}

/**
 * Mock WebSocket 功能（依赖 core）
 */
class MockWebSocketFeature {
  get name() { return 'websocket'; }
  get version() { return '1.0.0'; }
  get dependencies() { return ['core']; }

  async install(context) {
    this.installed = true;
    this.context = context;
  }

  async uninstall(context) {
    this.installed = false;
  }
}

/**
 * Mock PDF 列表功能（依赖 core 和 websocket）
 */
class MockPDFListFeature {
  get name() { return 'pdf-list'; }
  get version() { return '2.0.0'; }
  get dependencies() { return ['core', 'websocket']; }

  async install(context) {
    this.installed = true;
    this.context = context;
  }

  async uninstall(context) {
    this.installed = false;
  }

  async enable() {
    this.enabled = true;
  }

  async disable() {
    this.enabled = false;
  }
}

/**
 * Mock PDF 编辑器功能（依赖 pdf-list）
 */
class MockPDFEditorFeature {
  get name() { return 'pdf-editor'; }
  get version() { return '1.0.0'; }
  get dependencies() { return ['pdf-list']; }

  async install(context) {
    this.installed = true;
    this.context = context;
  }

  async uninstall(context) {
    this.installed = false;
  }
}

/**
 * Mock 循环依赖功能 A（依赖 B）
 */
class MockCircularA {
  get name() { return 'circular-a'; }
  get version() { return '1.0.0'; }
  get dependencies() { return ['circular-b']; }

  async install() {}
  async uninstall() {}
}

/**
 * Mock 循环依赖功能 B（依赖 A）
 */
class MockCircularB {
  get name() { return 'circular-b'; }
  get version() { return '1.0.0'; }
  get dependencies() { return ['circular-a']; }

  async install() {}
  async uninstall() {}
}

/**
 * Mock 安装失败的功能
 */
class MockFailingFeature {
  get name() { return 'failing-feature'; }
  get version() { return '1.0.0'; }
  get dependencies() { return []; }

  async install() {
    throw new Error('Installation failed intentionally');
  }

  async uninstall() {}
}

/**
 * Mock 无效功能（缺少 install 方法）
 */
class MockInvalidFeature {
  get name() { return 'invalid'; }
  get version() { return '1.0.0'; }
  get dependencies() { return []; }
  // 缺少 install 和 uninstall 方法
}

// ==================== Tests ====================

describe('FeatureRegistry', () => {
  let container;
  let registry;

  beforeEach(() => {
    container = new DependencyContainer('test-app');
    registry = new FeatureRegistry({ container });
  });

  describe('构造函数和基本属性', () => {
    it('应该创建 FeatureRegistry 实例', () => {
      expect(registry).toBeInstanceOf(FeatureRegistry);
    });

    it('应该通过工厂函数创建实例', () => {
      const newRegistry = createFeatureRegistry({ container });
      expect(newRegistry).toBeInstanceOf(FeatureRegistry);
    });

    it('应该抛出错误：缺少 container', () => {
      expect(() => {
        new FeatureRegistry({});
      }).toThrow(/DependencyContainer/);
    });

    it('应该初始时没有注册任何功能', () => {
      expect(registry.getRegisteredFeatures()).toEqual([]);
      expect(registry.getInstalledFeatures()).toEqual([]);
    });
  });

  describe('功能注册', () => {
    it('应该成功注册一个功能', () => {
      const feature = new MockCoreFeature();
      registry.register(feature);

      expect(registry.has('core')).toBe(true);
      expect(registry.getRegisteredFeatures()).toContain('core');
    });

    it('应该成功注册多个功能', () => {
      registry.register(new MockCoreFeature());
      registry.register(new MockWebSocketFeature());
      registry.register(new MockPDFListFeature());

      expect(registry.getRegisteredFeatures()).toHaveLength(3);
      expect(registry.has('core')).toBe(true);
      expect(registry.has('websocket')).toBe(true);
      expect(registry.has('pdf-list')).toBe(true);
    });

    it('应该抛出错误：重复注册同名功能', () => {
      registry.register(new MockCoreFeature());

      expect(() => {
        registry.register(new MockCoreFeature());
      }).toThrow(/already registered/);
    });

    it('应该抛出错误：无效功能（缺少必需方法）', () => {
      expect(() => {
        registry.register(new MockInvalidFeature());
      }).toThrow(/missing required property: install/);
    });

    it('应该抛出错误：功能名称为空', () => {
      const invalidFeature = {
        name: '',
        version: '1.0.0',
        dependencies: [],
        install: async () => {},
        uninstall: async () => {}
      };

      expect(() => {
        registry.register(invalidFeature);
      }).toThrow(/non-empty string/);
    });

    it('应该抛出错误：dependencies 不是数组', () => {
      const invalidFeature = {
        name: 'test',
        version: '1.0.0',
        dependencies: 'core',  // 应该是数组
        install: async () => {},
        uninstall: async () => {}
      };

      expect(() => {
        registry.register(invalidFeature);
      }).toThrow(/must be an array/);
    });
  });

  describe('功能安装', () => {
    it('应该成功安装无依赖的功能', async () => {
      const feature = new MockCoreFeature();
      registry.register(feature);

      await registry.install('core');

      expect(feature.installed).toBe(true);
      expect(registry.getInstalledFeatures()).toContain('core');

      const record = registry.get('core');
      expect(record.status).toBe(FeatureStatus.INSTALLED);
    });

    it('应该成功安装有依赖的功能（依赖已安装）', async () => {
      const coreFeature = new MockCoreFeature();
      const wsFeature = new MockWebSocketFeature();

      registry.register(coreFeature);
      registry.register(wsFeature);

      await registry.install('core');
      await registry.install('websocket');

      expect(coreFeature.installed).toBe(true);
      expect(wsFeature.installed).toBe(true);
      expect(registry.getInstalledFeatures()).toEqual(['core', 'websocket']);
    });

    it('应该抛出错误：安装不存在的功能', async () => {
      await expect(registry.install('non-existent')).rejects.toThrow(/not registered/);
    });

    it('应该抛出错误：安装功能但依赖未满足', async () => {
      registry.register(new MockWebSocketFeature());

      // websocket 依赖 core，但 core 未注册
      await expect(registry.install('websocket')).rejects.toThrow(/missing dependencies/);
    });

    it('应该跳过已安装的功能', async () => {
      const feature = new MockCoreFeature();
      registry.register(feature);

      await registry.install('core');
      const firstContext = feature.context;

      // 再次安装，应该跳过
      await registry.install('core');

      // context 应该相同（没有重新安装）
      expect(feature.context).toBe(firstContext);
    });

    it('应该在安装失败时标记为 FAILED 状态', async () => {
      const feature = new MockFailingFeature();
      registry.register(feature);

      await expect(registry.install('failing-feature')).rejects.toThrow(/Installation failed/);

      const record = registry.get('failing-feature');
      expect(record.status).toBe(FeatureStatus.FAILED);
      expect(record.error).toBeTruthy();
    });

    it('应该为功能创建正确的上下文', async () => {
      const feature = new MockCoreFeature();
      registry.register(feature);

      await registry.install('core');

      expect(feature.context).toBeTruthy();
      expect(feature.context.container).toBeTruthy();
      expect(feature.context.logger).toBeTruthy();
    });
  });

  describe('安装所有功能（installAll）', () => {
    it('应该按依赖顺序安装所有功能', async () => {
      const installOrder = [];

      // 创建自定义 Feature 来记录安装顺序
      class TrackingFeature {
        constructor(name, deps) {
          this._name = name;
          this._deps = deps;
        }
        get name() { return this._name; }
        get version() { return '1.0.0'; }
        get dependencies() { return this._deps; }

        async install() {
          installOrder.push(this._name);
        }
        async uninstall() {}
      }

      registry.register(new TrackingFeature('core', []));
      registry.register(new TrackingFeature('websocket', ['core']));
      registry.register(new TrackingFeature('pdf-list', ['core', 'websocket']));
      registry.register(new TrackingFeature('pdf-editor', ['pdf-list']));

      await registry.installAll();

      // 验证安装顺序
      expect(installOrder).toEqual(['core', 'websocket', 'pdf-list', 'pdf-editor']);
      expect(registry.getInstalledFeatures()).toHaveLength(4);
    });

    it('应该继续安装其他功能，即使某个功能失败', async () => {
      registry.register(new MockCoreFeature());
      registry.register(new MockFailingFeature());
      registry.register(new MockWebSocketFeature());

      await registry.installAll();

      // core 和 websocket 应该成功安装
      expect(registry.getInstalledFeatures()).toContain('core');
      expect(registry.getInstalledFeatures()).toContain('websocket');

      // failing-feature 应该失败
      const failedRecord = registry.get('failing-feature');
      expect(failedRecord.status).toBe(FeatureStatus.FAILED);
    });
  });

  describe('依赖解析（拓扑排序）', () => {
    it('应该正确解析线性依赖链', async () => {
      const installOrder = [];

      class TrackingFeature {
        constructor(name, deps) {
          this._name = name;
          this._deps = deps;
        }
        get name() { return this._name; }
        get version() { return '1.0.0'; }
        get dependencies() { return this._deps; }

        async install() {
          installOrder.push(this._name);
        }
        async uninstall() {}
      }

      // A -> B -> C -> D
      registry.register(new TrackingFeature('d', ['c']));
      registry.register(new TrackingFeature('b', ['a']));
      registry.register(new TrackingFeature('c', ['b']));
      registry.register(new TrackingFeature('a', []));

      await registry.installAll();

      expect(installOrder).toEqual(['a', 'b', 'c', 'd']);
    });

    it('应该正确解析菱形依赖', async () => {
      const installOrder = [];

      class TrackingFeature {
        constructor(name, deps) {
          this._name = name;
          this._deps = deps;
        }
        get name() { return this._name; }
        get version() { return '1.0.0'; }
        get dependencies() { return this._deps; }

        async install() {
          installOrder.push(this._name);
        }
        async uninstall() {}
      }

      /*
       *     A
       *    / \
       *   B   C
       *    \ /
       *     D
       */
      registry.register(new TrackingFeature('a', []));
      registry.register(new TrackingFeature('b', ['a']));
      registry.register(new TrackingFeature('c', ['a']));
      registry.register(new TrackingFeature('d', ['b', 'c']));

      await registry.installAll();

      // A 必须最先安装，D 必须最后安装
      expect(installOrder[0]).toBe('a');
      expect(installOrder[3]).toBe('d');

      // B 和 C 可以任意顺序（只要在 A 之后，D 之前）
      expect(installOrder.slice(1, 3)).toContain('b');
      expect(installOrder.slice(1, 3)).toContain('c');
    });

    it('应该抛出错误：检测到循环依赖', async () => {
      registry.register(new MockCircularA());
      registry.register(new MockCircularB());

      await expect(registry.installAll()).rejects.toThrow(/Circular dependency/);
    });

    it('应该处理自依赖（循环依赖的特殊情况）', async () => {
      class SelfDependentFeature {
        get name() { return 'self-dep'; }
        get version() { return '1.0.0'; }
        get dependencies() { return ['self-dep']; }  // 自己依赖自己

        async install() {}
        async uninstall() {}
      }

      registry.register(new SelfDependentFeature());

      await expect(registry.installAll()).rejects.toThrow(/Circular dependency/);
    });
  });

  describe('功能卸载', () => {
    it('应该成功卸载已安装的功能', async () => {
      const feature = new MockCoreFeature();
      registry.register(feature);

      await registry.install('core');
      expect(feature.installed).toBe(true);

      await registry.uninstall('core');
      expect(feature.installed).toBe(false);

      const record = registry.get('core');
      expect(record.status).toBe(FeatureStatus.UNINSTALLED);
    });

    it('应该抛出错误：卸载不存在的功能', async () => {
      await expect(registry.uninstall('non-existent')).rejects.toThrow(/not registered/);
    });

    it('应该跳过未安装的功能', async () => {
      const feature = new MockCoreFeature();
      registry.register(feature);

      // 未安装，直接卸载应该跳过
      await registry.uninstall('core');

      // 不应该调用 uninstall 方法
      expect(feature.installed).toBeUndefined();
    });
  });

  describe('功能启用和禁用', () => {
    it('应该成功禁用已安装的功能', async () => {
      // 先注册并安装依赖
      registry.register(new MockCoreFeature());
      registry.register(new MockWebSocketFeature());
      const feature = new MockPDFListFeature();
      registry.register(feature);

      await registry.install('core');
      await registry.install('websocket');
      await registry.install('pdf-list');
      await registry.disable('pdf-list');

      expect(feature.enabled).toBe(false);

      const record = registry.get('pdf-list');
      expect(record.status).toBe(FeatureStatus.DISABLED);
    });

    it('应该成功启用已禁用的功能', async () => {
      // 先注册并安装依赖
      registry.register(new MockCoreFeature());
      registry.register(new MockWebSocketFeature());
      const feature = new MockPDFListFeature();
      registry.register(feature);

      await registry.install('core');
      await registry.install('websocket');
      await registry.install('pdf-list');
      await registry.disable('pdf-list');
      await registry.enable('pdf-list');

      expect(feature.enabled).toBe(true);

      const record = registry.get('pdf-list');
      expect(record.status).toBe(FeatureStatus.INSTALLED);
    });

    it('应该跳过禁用不支持 disable 的功能', async () => {
      const feature = new MockCoreFeature();  // 没有 disable 方法
      registry.register(feature);

      await registry.install('core');
      await registry.disable('core');  // 应该跳过

      const record = registry.get('core');
      expect(record.status).toBe(FeatureStatus.INSTALLED);  // 状态不变
    });
  });

  describe('状态查询和摘要', () => {
    it('应该正确返回状态摘要', async () => {
      registry.register(new MockCoreFeature());
      registry.register(new MockWebSocketFeature());
      registry.register(new MockPDFListFeature());

      await registry.install('core');

      const summary = registry.getStatusSummary();

      expect(summary.total).toBe(3);
      expect(summary.installed).toBe(1);
      expect(summary.features).toHaveLength(3);
    });

    it('应该记录安装时间', async () => {
      const feature = new MockCoreFeature();
      registry.register(feature);

      const beforeInstall = Date.now();
      await registry.install('core');
      const afterInstall = Date.now();

      const record = registry.get('core');
      expect(record.installedAt).toBeGreaterThanOrEqual(beforeInstall);
      expect(record.installedAt).toBeLessThanOrEqual(afterInstall);
    });

    it('应该返回功能的 JSON 表示', async () => {
      const feature = new MockCoreFeature();
      registry.register(feature);

      await registry.install('core');

      const record = registry.get('core');
      const json = record.toJSON();

      expect(json).toMatchObject({
        name: 'core',
        version: '1.0.0',
        status: FeatureStatus.INSTALLED,
        dependencies: [],
        error: null
      });

      expect(json.installedAt).toBeGreaterThan(0);
    });
  });

  describe('边界情况和错误处理', () => {
    it('应该处理空依赖数组', async () => {
      const feature = new MockCoreFeature();
      registry.register(feature);

      await registry.install('core');

      expect(feature.installed).toBe(true);
    });

    it('应该处理依赖于核心服务（非功能）的情况', async () => {
      // 注册核心服务到容器
      container.register('logger', { log: () => {} });

      class FeatureWithServiceDep {
        get name() { return 'test-feature'; }
        get version() { return '1.0.0'; }
        get dependencies() { return ['logger']; }  // 依赖容器中的服务

        async install() {
          this.installed = true;
        }
        async uninstall() {}
      }

      const feature = new FeatureWithServiceDep();
      registry.register(feature);

      // 应该成功安装（logger 在容器中存在）
      await registry.install('test-feature');

      expect(feature.installed).toBe(true);
    });

    it('应该记录安装失败的错误信息', async () => {
      const feature = new MockFailingFeature();
      registry.register(feature);

      await expect(registry.install('failing-feature')).rejects.toThrow();

      const record = registry.get('failing-feature');
      expect(record.error).toBeInstanceOf(Error);
      expect(record.error.message).toContain('Installation failed');
    });
  });

  describe('复杂场景', () => {
    it('应该支持完整的功能生命周期', async () => {
      // 先注册并安装依赖
      registry.register(new MockCoreFeature());
      registry.register(new MockWebSocketFeature());
      const feature = new MockPDFListFeature();
      registry.register(feature);

      await registry.install('core');
      await registry.install('websocket');

      // 安装
      await registry.install('pdf-list');
      expect(feature.installed).toBe(true);
      expect(registry.get('pdf-list').status).toBe(FeatureStatus.INSTALLED);

      // 禁用
      await registry.disable('pdf-list');
      expect(feature.enabled).toBe(false);
      expect(registry.get('pdf-list').status).toBe(FeatureStatus.DISABLED);

      // 启用
      await registry.enable('pdf-list');
      expect(feature.enabled).toBe(true);
      expect(registry.get('pdf-list').status).toBe(FeatureStatus.INSTALLED);

      // 卸载
      await registry.uninstall('pdf-list');
      expect(feature.installed).toBe(false);
      expect(registry.get('pdf-list').status).toBe(FeatureStatus.UNINSTALLED);
    });

    it('应该支持复杂的依赖树', async () => {
      const installOrder = [];

      class TrackingFeature {
        constructor(name, deps) {
          this._name = name;
          this._deps = deps;
        }
        get name() { return this._name; }
        get version() { return '1.0.0'; }
        get dependencies() { return this._deps; }

        async install() {
          installOrder.push(this._name);
        }
        async uninstall() {}
      }

      /*
       * 依赖树：
       *       A
       *      /|\
       *     B C D
       *    /|   |\
       *   E F   G H
       *         |
       *         I
       */
      registry.register(new TrackingFeature('a', []));
      registry.register(new TrackingFeature('b', ['a']));
      registry.register(new TrackingFeature('c', ['a']));
      registry.register(new TrackingFeature('d', ['a']));
      registry.register(new TrackingFeature('e', ['b']));
      registry.register(new TrackingFeature('f', ['b']));
      registry.register(new TrackingFeature('g', ['d']));
      registry.register(new TrackingFeature('h', ['d']));
      registry.register(new TrackingFeature('i', ['g']));

      await registry.installAll();

      // 验证基本约束
      expect(installOrder[0]).toBe('a');  // A 最先
      expect(installOrder.indexOf('b')).toBeGreaterThan(installOrder.indexOf('a'));
      expect(installOrder.indexOf('e')).toBeGreaterThan(installOrder.indexOf('b'));
      expect(installOrder.indexOf('i')).toBeGreaterThan(installOrder.indexOf('g'));
    });
  });
});
