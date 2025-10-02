/**
 * @file 功能域集成测试
 * @description 测试三个功能域（pdf-list, pdf-editor, pdf-sorter）的集成和交互
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FeatureRegistry } from '../../../common/micro-service/feature-registry.js';
import { DependencyContainer } from '../../../common/micro-service/dependency-container.js';
import { PDFListFeature } from '../pdf-list/index.js';
import { PDFEditorFeature } from '../pdf-editor/index.js';
import { PDFSorterFeature } from '../pdf-sorter/index.js';

describe('功能域集成测试', () => {
  let container;
  let registry;

  beforeEach(() => {
    container = new DependencyContainer('pdf-home-test');
    registry = new FeatureRegistry({ container });
  });

  describe('功能域注册', () => {
    it('应该成功注册 PDFListFeature', () => {
      const feature = new PDFListFeature();
      registry.register(feature);

      expect(registry.has('pdf-list')).toBe(true);
      expect(feature.name).toBe('pdf-list');
      expect(feature.version).toBe('2.0.0');
      expect(feature.dependencies).toEqual([]);
    });

    it('应该成功注册 PDFEditorFeature', () => {
      const feature = new PDFEditorFeature();
      registry.register(feature);

      expect(registry.has('pdf-editor')).toBe(true);
      expect(feature.name).toBe('pdf-editor');
      expect(feature.version).toBe('1.0.0');
      expect(feature.dependencies).toEqual(['pdf-list']);
    });

    it('应该成功注册 PDFSorterFeature', () => {
      const feature = new PDFSorterFeature();
      registry.register(feature);

      expect(registry.has('pdf-sorter')).toBe(true);
      expect(feature.name).toBe('pdf-sorter');
      expect(feature.version).toBe('1.0.0');
      expect(feature.dependencies).toEqual(['pdf-list']);
    });

    it('应该成功注册所有三个功能域', () => {
      registry.register(new PDFListFeature());
      registry.register(new PDFEditorFeature());
      registry.register(new PDFSorterFeature());

      expect(registry.getRegisteredFeatures()).toHaveLength(3);
      expect(registry.getRegisteredFeatures()).toContain('pdf-list');
      expect(registry.getRegisteredFeatures()).toContain('pdf-editor');
      expect(registry.getRegisteredFeatures()).toContain('pdf-sorter');
    });
  });

  describe('功能域安装', () => {
    beforeEach(() => {
      registry.register(new PDFListFeature());
      registry.register(new PDFEditorFeature());
      registry.register(new PDFSorterFeature());
    });

    it('应该成功安装 PDFListFeature（无依赖）', async () => {
      await registry.install('pdf-list');

      expect(registry.getInstalledFeatures()).toContain('pdf-list');
    });

    it('应该按正确顺序安装所有功能域', async () => {
      await registry.installAll();

      const installed = registry.getInstalledFeatures();

      // 验证所有功能都已安装
      expect(installed).toHaveLength(3);
      expect(installed).toContain('pdf-list');
      expect(installed).toContain('pdf-editor');
      expect(installed).toContain('pdf-sorter');

      // 验证 pdf-list 在 pdf-editor 和 pdf-sorter 之前安装
      const listIndex = installed.indexOf('pdf-list');
      const editorIndex = installed.indexOf('pdf-editor');
      const sorterIndex = installed.indexOf('pdf-sorter');

      expect(listIndex).toBeLessThan(editorIndex);
      expect(listIndex).toBeLessThan(sorterIndex);
    });

    it('应该抛出错误：安装 pdf-editor 但 pdf-list 未安装', async () => {
      // 只注册 pdf-editor，不注册 pdf-list
      const editorRegistry = new FeatureRegistry({ container });
      editorRegistry.register(new PDFEditorFeature());

      await expect(editorRegistry.install('pdf-editor')).rejects.toThrow(/missing dependencies/);
    });
  });

  describe('功能域卸载', () => {
    beforeEach(async () => {
      registry.register(new PDFListFeature());
      registry.register(new PDFEditorFeature());
      registry.register(new PDFSorterFeature());
      await registry.installAll();
    });

    it('应该成功卸载单个功能域', async () => {
      await registry.uninstall('pdf-editor');

      expect(registry.getInstalledFeatures()).not.toContain('pdf-editor');
      expect(registry.getInstalledFeatures()).toContain('pdf-list');
      expect(registry.getInstalledFeatures()).toContain('pdf-sorter');
    });

    it('应该成功卸载所有功能域', async () => {
      await registry.uninstall('pdf-editor');
      await registry.uninstall('pdf-sorter');
      await registry.uninstall('pdf-list');

      expect(registry.getInstalledFeatures()).toHaveLength(0);
    });
  });

  describe('功能域启用和禁用', () => {
    beforeEach(async () => {
      registry.register(new PDFListFeature());
      registry.register(new PDFEditorFeature());
      registry.register(new PDFSorterFeature());
      await registry.installAll();
    });

    it('应该成功禁用和启用 PDFEditorFeature', async () => {
      await registry.disable('pdf-editor');
      const disabledRecord = registry.get('pdf-editor');
      expect(disabledRecord.status).toBe('disabled');

      await registry.enable('pdf-editor');
      const enabledRecord = registry.get('pdf-editor');
      expect(enabledRecord.status).toBe('installed');
    });

    it('应该成功禁用和启用 PDFSorterFeature', async () => {
      await registry.disable('pdf-sorter');
      const disabledRecord = registry.get('pdf-sorter');
      expect(disabledRecord.status).toBe('disabled');

      await registry.enable('pdf-sorter');
      const enabledRecord = registry.get('pdf-sorter');
      expect(enabledRecord.status).toBe('installed');
    });
  });

  describe('功能域状态查询', () => {
    beforeEach(async () => {
      registry.register(new PDFListFeature());
      registry.register(new PDFEditorFeature());
      registry.register(new PDFSorterFeature());
      await registry.installAll();
    });

    it('应该正确返回状态摘要', () => {
      const summary = registry.getStatusSummary();

      expect(summary.total).toBe(3);
      expect(summary.installed).toBe(3);
      expect(summary.disabled).toBe(0);
      expect(summary.failed).toBe(0);

      expect(summary.features).toHaveLength(3);
      expect(summary.features.map(f => f.name)).toContain('pdf-list');
      expect(summary.features.map(f => f.name)).toContain('pdf-editor');
      expect(summary.features.map(f => f.name)).toContain('pdf-sorter');
    });

    it('应该正确返回各功能域的状态详情', () => {
      const summary = registry.getStatusSummary();

      const listFeature = summary.features.find(f => f.name === 'pdf-list');
      expect(listFeature).toMatchObject({
        name: 'pdf-list',
        version: '2.0.0',
        status: 'installed',
        dependencies: []
      });

      const editorFeature = summary.features.find(f => f.name === 'pdf-editor');
      expect(editorFeature).toMatchObject({
        name: 'pdf-editor',
        version: '1.0.0',
        status: 'installed',
        dependencies: ['pdf-list']
      });

      const sorterFeature = summary.features.find(f => f.name === 'pdf-sorter');
      expect(sorterFeature).toMatchObject({
        name: 'pdf-sorter',
        version: '1.0.0',
        status: 'installed',
        dependencies: ['pdf-list']
      });
    });
  });

  describe('完整生命周期测试', () => {
    it('应该支持完整的功能域生命周期', async () => {
      // 1. 注册
      registry.register(new PDFListFeature());
      registry.register(new PDFEditorFeature());
      registry.register(new PDFSorterFeature());

      expect(registry.getRegisteredFeatures()).toHaveLength(3);

      // 2. 安装
      await registry.installAll();
      expect(registry.getInstalledFeatures()).toHaveLength(3);

      // 3. 禁用
      await registry.disable('pdf-editor');
      expect(registry.get('pdf-editor').status).toBe('disabled');

      // 4. 启用
      await registry.enable('pdf-editor');
      expect(registry.get('pdf-editor').status).toBe('installed');

      // 5. 卸载
      await registry.uninstall('pdf-editor');
      await registry.uninstall('pdf-sorter');
      await registry.uninstall('pdf-list');

      expect(registry.getInstalledFeatures()).toHaveLength(0);
    });
  });
});
