/**
 * @file 微服务组件集成测试
 * @description 验证从common/micro-service/导入的组件能够正常工作
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// 从公共组件目录导入
import {
  DependencyContainer,
  FeatureRegistry,
  StateManager,
  FeatureFlagManager,
  ServiceScope,
  FeatureStatus
} from '../../../common/micro-service/index.js';

describe('微服务组件集成测试', () => {
  describe('导入验证', () => {
    it('应该成功导入DependencyContainer', () => {
      expect(DependencyContainer).toBeDefined();
      expect(typeof DependencyContainer).toBe('function');
    });

    it('应该成功导入FeatureRegistry', () => {
      expect(FeatureRegistry).toBeDefined();
      expect(typeof FeatureRegistry).toBe('function');
    });

    it('应该成功导入StateManager', () => {
      expect(StateManager).toBeDefined();
      expect(typeof StateManager).toBe('function');
    });

    it('应该成功导入FeatureFlagManager', () => {
      expect(FeatureFlagManager).toBeDefined();
      expect(typeof FeatureFlagManager).toBe('function');
    });

    it('应该成功导入ServiceScope枚举', () => {
      expect(ServiceScope).toBeDefined();
      expect(ServiceScope.SINGLETON).toBe('singleton');
      expect(ServiceScope.TRANSIENT).toBe('transient');
    });

    it('应该成功导入FeatureStatus枚举', () => {
      expect(FeatureStatus).toBeDefined();
      expect(FeatureStatus.REGISTERED).toBe('registered');
      expect(FeatureStatus.INSTALLED).toBe('installed');
    });
  });

  describe('基本功能验证', () => {
    let container;
    let registry;
    let stateManager;
    let flagManager;

    beforeEach(() => {
      container = new DependencyContainer('pdf-viewer-test');
      registry = new FeatureRegistry({ container });
      stateManager = new StateManager();
      flagManager = new FeatureFlagManager();
    });

    it('DependencyContainer应该能够注册和获取服务', () => {
      // 注册一个简单的服务
      const testService = { name: 'test' };
      container.register('testService', testService);

      // 获取服务
      const retrieved = container.get('testService');
      expect(retrieved).toBe(testService);
    });

    it('FeatureRegistry应该能够创建实例', () => {
      expect(registry).toBeInstanceOf(FeatureRegistry);
      expect(typeof registry.register).toBe('function');
      expect(typeof registry.installAll).toBe('function');
    });

    it('StateManager应该能够创建状态', () => {
      const state = stateManager.createState('test', {
        value: 0
      });

      expect(state.value).toBe(0);
      state.value = 1;
      expect(state.value).toBe(1);
    });

    it('FeatureFlagManager应该能够管理标志', () => {
      // 启用一个标志
      flagManager.enable('test-feature');
      expect(flagManager.isEnabled('test-feature')).toBe(true);

      // 禁用标志
      flagManager.disable('test-feature');
      expect(flagManager.isEnabled('test-feature')).toBe(false);
    });
  });

  describe('PDF-Viewer应用场景', () => {
    it('应该能够创建PDF-Viewer专用的容器', () => {
      const container = new DependencyContainer('pdf-viewer');

      // 模拟注册EventBus
      const mockEventBus = {
        on: jest.fn(),
        emit: jest.fn(),
        off: jest.fn()
      };

      container.register('eventBus', mockEventBus, {
        scope: ServiceScope.SINGLETON
      });

      const eventBus = container.get('eventBus');
      expect(eventBus).toBe(mockEventBus);
    });

    it('应该能够为PDF-Viewer功能域创建作用域', () => {
      const container = new DependencyContainer('pdf-viewer');

      // 创建功能域作用域
      const readerScope = container.createScope('pdf-reader');
      expect(readerScope).toBeDefined();
      expect(readerScope.constructor.name).toBe('DependencyContainer');
    });

    it('应该能够创建PDF-Viewer的状态', () => {
      const stateManager = new StateManager();

      // 创建PDF阅读器状态
      const readerState = stateManager.createState('pdf-reader', {
        currentPage: 1,
        totalPages: 0,
        zoomLevel: 1.0
      });

      expect(readerState.currentPage).toBe(1);
      expect(readerState.totalPages).toBe(0);
      expect(readerState.zoomLevel).toBe(1.0);

      // 修改状态
      readerState.currentPage = 2;
      expect(readerState.currentPage).toBe(2);
    });

    it('应该能够管理PDF-Viewer功能标志', () => {
      const flagManager = new FeatureFlagManager();

      // 模拟PDF-Viewer的功能标志
      flagManager.enable('pdf-bookmark');
      flagManager.enable('anki-card-maker');
      flagManager.disable('ai-assistant');

      expect(flagManager.isEnabled('pdf-bookmark')).toBe(true);
      expect(flagManager.isEnabled('anki-card-maker')).toBe(true);
      expect(flagManager.isEnabled('ai-assistant')).toBe(false);
    });
  });

  describe('组件协作', () => {
    it('应该能够将StateManager注册到DependencyContainer', () => {
      const container = new DependencyContainer('pdf-viewer');
      const stateManager = new StateManager();

      container.register('stateManager', stateManager, {
        scope: ServiceScope.SINGLETON
      });

      const retrieved = container.get('stateManager');
      expect(retrieved).toBe(stateManager);
      expect(retrieved).toBeInstanceOf(StateManager);
    });

    it('应该能够从容器中获取StateManager并创建状态', () => {
      const container = new DependencyContainer('pdf-viewer');
      const stateManager = new StateManager();
      container.register('stateManager', stateManager);

      const sm = container.get('stateManager');
      const state = sm.createState('test', { value: 42 });

      expect(state.value).toBe(42);
    });

    it('应该能够创建完整的应用架构', () => {
      // 1. 创建容器
      const container = new DependencyContainer('pdf-viewer');

      // 2. 创建核心组件
      const stateManager = new StateManager();
      const flagManager = new FeatureFlagManager();
      const registry = new FeatureRegistry({ container });

      // 3. 注册到容器
      container.register('stateManager', stateManager);
      container.register('flagManager', flagManager);
      container.register('registry', registry);

      // 4. 验证可以获取
      expect(container.get('stateManager')).toBe(stateManager);
      expect(container.get('flagManager')).toBe(flagManager);
      expect(container.get('registry')).toBe(registry);
    });
  });
});
