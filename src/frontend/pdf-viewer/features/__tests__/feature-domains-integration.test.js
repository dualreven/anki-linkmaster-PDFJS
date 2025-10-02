/**
 * @file 功能域集成测试
 * @description 验证4个功能域可以正确注册和安装
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DependencyContainer, FeatureRegistry } from '../../../common/micro-service/index.js';

// 导入4个功能域
import { PDFReaderFeature } from '../pdf-reader/index.js';
import { PDFUIFeature } from '../pdf-ui/index.js';
import { PDFBookmarkFeature } from '../pdf-bookmark/index.js';
import { WebSocketAdapterFeature } from '../websocket-adapter/index.js';

describe('功能域集成测试', () => {
  let container;
  let registry;

  beforeEach(() => {
    container = new DependencyContainer('pdf-viewer-test');
    registry = new FeatureRegistry({ container });
  });

  describe('功能域注册', () => {
    it('应该成功注册pdf-reader功能', () => {
      const feature = new PDFReaderFeature();

      expect(() => {
        registry.register(feature);
      }).not.toThrow();

      expect(feature.name).toBe('pdf-reader');
      expect(feature.version).toBe('1.0.0');
      expect(feature.dependencies).toEqual([]);
    });

    it('应该成功注册pdf-ui功能', () => {
      const feature = new PDFUIFeature();

      expect(() => {
        registry.register(feature);
      }).not.toThrow();

      expect(feature.name).toBe('pdf-ui');
      expect(feature.dependencies).toContain('pdf-reader');
    });

    it('应该成功注册pdf-bookmark功能', () => {
      const feature = new PDFBookmarkFeature();

      expect(() => {
        registry.register(feature);
      }).not.toThrow();

      expect(feature.name).toBe('pdf-bookmark');
      expect(feature.dependencies).toEqual(['pdf-reader', 'pdf-ui']);
    });

    it('应该成功注册websocket-adapter功能', () => {
      const feature = new WebSocketAdapterFeature();

      expect(() => {
        registry.register(feature);
      }).not.toThrow();

      expect(feature.name).toBe('websocket-adapter');
    });

    it('应该一次性注册所有4个功能', () => {
      expect(() => {
        registry.register(new PDFReaderFeature());
        registry.register(new PDFUIFeature());
        registry.register(new PDFBookmarkFeature());
        registry.register(new WebSocketAdapterFeature());
      }).not.toThrow();
    });
  });

  describe('依赖关系验证', () => {
    it('pdf-ui应该依赖pdf-reader', () => {
      const feature = new PDFUIFeature();
      expect(feature.dependencies).toContain('pdf-reader');
    });

    it('pdf-bookmark应该依赖pdf-reader和pdf-ui', () => {
      const feature = new PDFBookmarkFeature();
      expect(feature.dependencies).toContain('pdf-reader');
      expect(feature.dependencies).toContain('pdf-ui');
    });

    it('websocket-adapter应该无依赖', () => {
      const feature = new WebSocketAdapterFeature();
      expect(feature.dependencies).toEqual([]);
    });

    it('pdf-reader应该无依赖', () => {
      const feature = new PDFReaderFeature();
      expect(feature.dependencies).toEqual([]);
    });
  });

  describe('生命周期钩子', () => {
    beforeEach(() => {
      // 注册StateManager
      const mockStateManager = {
        createState: jest.fn(() => ({})),
        destroyState: jest.fn()
      };
      container.register('stateManager', mockStateManager);
    });

    it('pdf-reader应该能够安装和卸载', async () => {
      const feature = new PDFReaderFeature();
      registry.register(feature);

      expect(feature.isEnabled()).toBe(false);

      await registry.install('pdf-reader');
      expect(feature.isEnabled()).toBe(true);

      await registry.uninstall('pdf-reader');
      expect(feature.isEnabled()).toBe(false);
    });

    it('pdf-ui应该能够安装和卸载', async () => {
      const feature = new PDFUIFeature();
      registry.register(feature);

      await registry.install('pdf-ui');
      expect(feature.isEnabled()).toBe(true);

      await registry.uninstall('pdf-ui');
      expect(feature.isEnabled()).toBe(false);
    });

    it('应该按依赖顺序安装功能', async () => {
      // 注册所有功能（注意：故意乱序）
      registry.register(new PDFBookmarkFeature());
      registry.register(new PDFUIFeature());
      registry.register(new PDFReaderFeature());

      // 安装所有功能
      await registry.installAll();

      // 验证都已安装
      expect(registry.getStatus('pdf-reader')).toBe('installed');
      expect(registry.getStatus('pdf-ui')).toBe('installed');
      expect(registry.getStatus('pdf-bookmark')).toBe('installed');
    });
  });

  describe('PDF-Viewer应用场景', () => {
    it('应该能够构建完整的PDF-Viewer应用', async () => {
      // 注册StateManager
      const mockStateManager = {
        createState: jest.fn(() => ({})),
        destroyState: jest.fn()
      };
      container.register('stateManager', mockStateManager);

      // 注册所有功能域
      registry.register(new PDFReaderFeature());
      registry.register(new PDFUIFeature());
      registry.register(new PDFBookmarkFeature());
      registry.register(new WebSocketAdapterFeature());

      // 安装所有功能
      await registry.installAll();

      // 验证都已安装
      expect(registry.getStatus('pdf-reader')).toBe('installed');
      expect(registry.getStatus('pdf-ui')).toBe('installed');
      expect(registry.getStatus('pdf-bookmark')).toBe('installed');
      expect(registry.getStatus('websocket-adapter')).toBe('installed');
    });

    it('应该能够选择性安装功能', async () => {
      const mockStateManager = {
        createState: jest.fn(() => ({})),
        destroyState: jest.fn()
      };
      container.register('stateManager', mockStateManager);

      // 注册所有功能
      registry.register(new PDFReaderFeature());
      registry.register(new PDFUIFeature());
      registry.register(new PDFBookmarkFeature());
      registry.register(new WebSocketAdapterFeature());

      // 只安装核心功能
      await registry.install('pdf-reader');
      await registry.install('pdf-ui');

      // 验证
      expect(registry.getStatus('pdf-reader')).toBe('installed');
      expect(registry.getStatus('pdf-ui')).toBe('installed');
      expect(registry.getStatus('pdf-bookmark')).toBe('registered'); // 未安装
      expect(registry.getStatus('websocket-adapter')).toBe('registered'); // 未安装
    });
  });
});
