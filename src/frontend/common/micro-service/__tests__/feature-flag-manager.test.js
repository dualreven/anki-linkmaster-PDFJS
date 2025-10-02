/**
 * @file FeatureFlagManager 单元测试
 * @description 测试特性标志管理器的所有功能
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FeatureFlagManager } from '../feature-flag-manager.js';

describe('FeatureFlagManager', () => {
  let flagManager;

  beforeEach(() => {
    flagManager = new FeatureFlagManager();
  });

  describe('基本功能', () => {
    it('应该创建 FeatureFlagManager 实例', () => {
      expect(flagManager).toBeInstanceOf(FeatureFlagManager);
    });

    it('应该返回默认启用状态为 false', () => {
      expect(flagManager.isEnabled('nonexistent-feature')).toBe(false);
    });

    it('应该支持自定义默认启用状态', () => {
      const customManager = new FeatureFlagManager({ defaultEnabled: true });
      expect(customManager.isEnabled('nonexistent-feature')).toBe(true);
    });

    it('应该返回正确的环境', () => {
      const customManager = new FeatureFlagManager({ environment: 'development' });
      expect(customManager.getEnvironment()).toBe('development');
    });

    it('应该返回正确的当前用户', () => {
      const customManager = new FeatureFlagManager({ currentUser: 'test@example.com' });
      expect(customManager.getCurrentUser()).toBe('test@example.com');
    });
  });

  describe('配置加载', () => {
    it('应该从对象加载配置', () => {
      const config = {
        'feature-a': { enabled: true },
        'feature-b': { enabled: false }
      };

      flagManager.loadFromObject(config);

      expect(flagManager.isEnabled('feature-a')).toBe(true);
      expect(flagManager.isEnabled('feature-b')).toBe(false);
    });

    it('应该抛出错误：无效的配置对象', () => {
      expect(() => {
        flagManager.loadFromObject(null);
      }).toThrow(TypeError);

      expect(() => {
        flagManager.loadFromObject('invalid');
      }).toThrow(TypeError);
    });

    it('应该跳过无效的标志配置', () => {
      const config = {
        'valid-feature': { enabled: true },
        'invalid-feature': { enabled: 'not-boolean' }
      };

      flagManager.loadFromObject(config);

      // 有效的功能应该加载
      expect(flagManager.isEnabled('valid-feature')).toBe(true);
      // 无效的功能应该使用默认值
      expect(flagManager.isEnabled('invalid-feature')).toBe(false);
    });

    it('应该验证配置格式', () => {
      const invalidConfigs = [
        { enabled: 'not-boolean' },
        { enabled: true, conditions: { percentage: 150 } },
        { enabled: true, conditions: { percentage: -10 } },
        { enabled: true, conditions: { percentage: 'invalid' } }
      ];

      invalidConfigs.forEach(config => {
        expect(() => {
          flagManager.setFlag('test-feature', config);
        }).toThrow(TypeError);
      });
    });
  });

  describe('环境条件', () => {
    beforeEach(() => {
      flagManager = new FeatureFlagManager({ environment: 'development' });
    });

    it('应该启用：环境匹配', () => {
      flagManager.setFlag('dev-feature', {
        enabled: true,
        conditions: { environment: 'development' }
      });

      expect(flagManager.isEnabled('dev-feature')).toBe(true);
    });

    it('应该禁用：环境不匹配', () => {
      flagManager.setFlag('prod-feature', {
        enabled: true,
        conditions: { environment: 'production' }
      });

      expect(flagManager.isEnabled('prod-feature')).toBe(false);
    });

    it('应该支持运行时修改环境', () => {
      flagManager.setFlag('env-feature', {
        enabled: true,
        conditions: { environment: 'production' }
      });

      expect(flagManager.isEnabled('env-feature')).toBe(false);

      flagManager.setEnvironment('production');
      expect(flagManager.isEnabled('env-feature')).toBe(true);
    });
  });

  describe('用户白名单', () => {
    beforeEach(() => {
      flagManager = new FeatureFlagManager({ currentUser: 'alice@example.com' });
    });

    it('应该启用：用户在白名单中', () => {
      flagManager.setFlag('vip-feature', {
        enabled: true,
        conditions: {
          users: ['alice@example.com', 'bob@example.com']
        }
      });

      expect(flagManager.isEnabled('vip-feature')).toBe(true);
    });

    it('应该禁用：用户不在白名单中', () => {
      flagManager.setFlag('vip-feature', {
        enabled: true,
        conditions: {
          users: ['bob@example.com', 'charlie@example.com']
        }
      });

      expect(flagManager.isEnabled('vip-feature')).toBe(false);
    });

    it('应该支持通过上下文传入用户', () => {
      flagManager.setFlag('vip-feature', {
        enabled: true,
        conditions: {
          users: ['david@example.com']
        }
      });

      expect(flagManager.isEnabled('vip-feature', { user: 'david@example.com' })).toBe(true);
      expect(flagManager.isEnabled('vip-feature', { user: 'eve@example.com' })).toBe(false);
    });

    it('应该禁用：没有设置当前用户', () => {
      const noUserManager = new FeatureFlagManager();
      noUserManager.setFlag('user-feature', {
        enabled: true,
        conditions: {
          users: ['alice@example.com']
        }
      });

      expect(noUserManager.isEnabled('user-feature')).toBe(false);
    });
  });

  describe('角色白名单', () => {
    beforeEach(() => {
      flagManager = new FeatureFlagManager({
        currentUser: 'alice@example.com',
        currentUserRoles: ['admin', 'editor']
      });
    });

    it('应该启用：用户角色在白名单中', () => {
      flagManager.setFlag('admin-feature', {
        enabled: true,
        conditions: {
          roles: ['admin']
        }
      });

      expect(flagManager.isEnabled('admin-feature')).toBe(true);
    });

    it('应该禁用：用户角色不在白名单中', () => {
      flagManager.setFlag('super-admin-feature', {
        enabled: true,
        conditions: {
          roles: ['super-admin']
        }
      });

      expect(flagManager.isEnabled('super-admin-feature')).toBe(false);
    });

    it('应该支持通过上下文传入角色', () => {
      flagManager.setFlag('viewer-feature', {
        enabled: true,
        conditions: {
          roles: ['viewer']
        }
      });

      expect(flagManager.isEnabled('viewer-feature', { roles: ['viewer'] })).toBe(true);
      expect(flagManager.isEnabled('viewer-feature', { roles: ['guest'] })).toBe(false);
    });

    it('应该启用：用户有多个角色中的一个', () => {
      flagManager.setFlag('editor-feature', {
        enabled: true,
        conditions: {
          roles: ['editor', 'writer']
        }
      });

      expect(flagManager.isEnabled('editor-feature')).toBe(true);
    });
  });

  describe('百分比灰度发布', () => {
    it('应该启用：percentage 为 100', () => {
      flagManager.setFlag('full-rollout', {
        enabled: true,
        conditions: { percentage: 100 }
      });

      // 测试多次以确保稳定性
      for (let i = 0; i < 10; i++) {
        expect(flagManager.isEnabled('full-rollout')).toBe(true);
      }
    });

    it('应该禁用：percentage 为 0', () => {
      flagManager.setFlag('no-rollout', {
        enabled: true,
        conditions: { percentage: 0 }
      });

      // 测试多次以确保稳定性
      for (let i = 0; i < 10; i++) {
        expect(flagManager.isEnabled('no-rollout')).toBe(false);
      }
    });

    it('应该部分启用：percentage 为 50', () => {
      flagManager.setFlag('half-rollout', {
        enabled: true,
        conditions: { percentage: 50 }
      });

      // 测试多次，期望大约一半启用
      let enabledCount = 0;
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        if (flagManager.isEnabled('half-rollout')) {
          enabledCount++;
        }
      }

      // 期望在 30-70% 之间（允许随机性波动）
      expect(enabledCount).toBeGreaterThan(iterations * 0.3);
      expect(enabledCount).toBeLessThan(iterations * 0.7);
    });
  });

  describe('组合条件', () => {
    beforeEach(() => {
      flagManager = new FeatureFlagManager({
        environment: 'development',
        currentUser: 'alice@example.com',
        currentUserRoles: ['admin']
      });
    });

    it('应该启用：所有条件都满足', () => {
      flagManager.setFlag('complex-feature', {
        enabled: true,
        conditions: {
          environment: 'development',
          users: ['alice@example.com'],
          roles: ['admin']
        }
      });

      expect(flagManager.isEnabled('complex-feature')).toBe(true);
    });

    it('应该禁用：任一条件不满足（环境）', () => {
      flagManager.setFlag('complex-feature', {
        enabled: true,
        conditions: {
          environment: 'production',
          users: ['alice@example.com'],
          roles: ['admin']
        }
      });

      expect(flagManager.isEnabled('complex-feature')).toBe(false);
    });

    it('应该禁用：任一条件不满足（用户）', () => {
      flagManager.setFlag('complex-feature', {
        enabled: true,
        conditions: {
          environment: 'development',
          users: ['bob@example.com'],
          roles: ['admin']
        }
      });

      expect(flagManager.isEnabled('complex-feature')).toBe(false);
    });

    it('应该禁用：任一条件不满足（角色）', () => {
      flagManager.setFlag('complex-feature', {
        enabled: true,
        conditions: {
          environment: 'development',
          users: ['alice@example.com'],
          roles: ['super-admin']
        }
      });

      expect(flagManager.isEnabled('complex-feature')).toBe(false);
    });
  });

  describe('运行时控制', () => {
    it('应该支持 setFlag 设置标志', () => {
      flagManager.setFlag('test-feature', { enabled: true });
      expect(flagManager.isEnabled('test-feature')).toBe(true);

      flagManager.setFlag('test-feature', { enabled: false });
      expect(flagManager.isEnabled('test-feature')).toBe(false);
    });

    it('应该支持 enable 方法', () => {
      flagManager.setFlag('test-feature', { enabled: false });
      expect(flagManager.isEnabled('test-feature')).toBe(false);

      flagManager.enable('test-feature');
      expect(flagManager.isEnabled('test-feature')).toBe(true);
    });

    it('应该支持 disable 方法', () => {
      flagManager.setFlag('test-feature', { enabled: true });
      expect(flagManager.isEnabled('test-feature')).toBe(true);

      flagManager.disable('test-feature');
      expect(flagManager.isEnabled('test-feature')).toBe(false);
    });

    it('应该保留条件配置', () => {
      flagManager = new FeatureFlagManager({ environment: 'development' });

      flagManager.setFlag('test-feature', {
        enabled: true,
        conditions: { environment: 'development' }
      });

      expect(flagManager.isEnabled('test-feature')).toBe(true);

      // 禁用后再启用
      flagManager.disable('test-feature');
      expect(flagManager.isEnabled('test-feature')).toBe(false);

      flagManager.enable('test-feature');
      expect(flagManager.isEnabled('test-feature')).toBe(true);
    });
  });

  describe('标志管理', () => {
    it('应该获取标志配置', () => {
      const config = { enabled: true, description: 'Test feature' };
      flagManager.setFlag('test-feature', config);

      const retrieved = flagManager.getFlag('test-feature');
      expect(retrieved).toEqual(config);
    });

    it('应该返回 null：标志不存在', () => {
      expect(flagManager.getFlag('nonexistent')).toBeNull();
    });

    it('应该获取所有标志', () => {
      flagManager.setFlag('feature-a', { enabled: true });
      flagManager.setFlag('feature-b', { enabled: false });

      const allFlags = flagManager.getAllFlags();
      expect(allFlags).toEqual({
        'feature-a': { enabled: true },
        'feature-b': { enabled: false }
      });
    });

    it('应该删除标志', () => {
      flagManager.setFlag('test-feature', { enabled: true });
      expect(flagManager.isEnabled('test-feature')).toBe(true);

      const deleted = flagManager.removeFlag('test-feature');
      expect(deleted).toBe(true);
      expect(flagManager.isEnabled('test-feature')).toBe(false);
    });

    it('应该返回 false：删除不存在的标志', () => {
      const deleted = flagManager.removeFlag('nonexistent');
      expect(deleted).toBe(false);
    });

    it('应该清空所有标志', () => {
      flagManager.setFlag('feature-a', { enabled: true });
      flagManager.setFlag('feature-b', { enabled: true });

      flagManager.clear();

      expect(flagManager.getAllFlags()).toEqual({});
      expect(flagManager.isEnabled('feature-a')).toBe(false);
      expect(flagManager.isEnabled('feature-b')).toBe(false);
    });
  });

  describe('标志变更监听', () => {
    it('应该触发 onChange 回调', () => {
      const callback = jest.fn();
      flagManager.onChange('test-feature', callback);

      const newConfig = { enabled: true };
      flagManager.setFlag('test-feature', newConfig);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(newConfig, undefined);
    });

    it('应该传递旧配置', () => {
      const callback = jest.fn();

      const oldConfig = { enabled: false };
      flagManager.setFlag('test-feature', oldConfig);

      flagManager.onChange('test-feature', callback);

      const newConfig = { enabled: true };
      flagManager.setFlag('test-feature', newConfig);

      expect(callback).toHaveBeenCalledWith(newConfig, oldConfig);
    });

    it('应该支持取消监听', () => {
      const callback = jest.fn();
      const unsubscribe = flagManager.onChange('test-feature', callback);

      flagManager.setFlag('test-feature', { enabled: true });
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      flagManager.setFlag('test-feature', { enabled: false });
      expect(callback).toHaveBeenCalledTimes(1); // 仍然是 1 次
    });

    it('应该支持多个监听器', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      flagManager.onChange('test-feature', callback1);
      flagManager.onChange('test-feature', callback2);

      flagManager.setFlag('test-feature', { enabled: true });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('应该在删除标志时触发监听器', () => {
      const callback = jest.fn();

      flagManager.setFlag('test-feature', { enabled: true });
      flagManager.onChange('test-feature', callback);

      flagManager.removeFlag('test-feature');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(null, expect.anything());
    });
  });

  describe('导出和统计', () => {
    it('应该导出为 JSON', () => {
      flagManager.setFlag('feature-a', { enabled: true });
      flagManager.setFlag('feature-b', { enabled: false });

      const json = flagManager.exportToJSON();
      const parsed = JSON.parse(json);

      expect(parsed).toEqual({
        'feature-a': { enabled: true },
        'feature-b': { enabled: false }
      });
    });

    it('应该返回统计信息', () => {
      flagManager.setFlag('feature-a', { enabled: true });
      flagManager.setFlag('feature-b', { enabled: false });
      flagManager.setFlag('feature-c', {
        enabled: true,
        conditions: { environment: 'development' }
      });

      const stats = flagManager.getStats();

      expect(stats).toEqual({
        total: 3,
        enabled: 2,
        disabled: 1,
        conditional: 1,
        unconditional: 2
      });
    });

    it('应该返回正确的统计：空标志', () => {
      const stats = flagManager.getStats();

      expect(stats).toEqual({
        total: 0,
        enabled: 0,
        disabled: 0,
        conditional: 0,
        unconditional: 0
      });
    });
  });

  describe('用户和环境管理', () => {
    it('应该设置当前用户', () => {
      flagManager.setCurrentUser('alice@example.com', ['admin']);

      expect(flagManager.getCurrentUser()).toBe('alice@example.com');
    });

    it('应该设置环境', () => {
      flagManager.setEnvironment('staging');

      expect(flagManager.getEnvironment()).toBe('staging');
    });
  });

  describe('集成场景', () => {
    it('应该支持复杂的功能标志配置', () => {
      flagManager = new FeatureFlagManager({
        environment: 'development',
        currentUser: 'alice@example.com',
        currentUserRoles: ['admin']
      });

      const config = {
        'pdf-list': {
          enabled: true,
          description: 'PDF 列表功能'
        },
        'pdf-editor': {
          enabled: true,
          description: 'PDF 编辑功能',
          conditions: {
            environment: 'development'
          }
        },
        'pdf-sorter': {
          enabled: true,
          description: 'PDF 排序功能',
          conditions: {
            roles: ['admin', 'editor']
          }
        },
        'experimental-feature': {
          enabled: true,
          description: '实验性功能',
          conditions: {
            environment: 'development',
            users: ['alice@example.com'],
            percentage: 50
          }
        },
        'disabled-feature': {
          enabled: false,
          description: '已禁用功能'
        }
      };

      flagManager.loadFromObject(config);

      // pdf-list: 无条件启用
      expect(flagManager.isEnabled('pdf-list')).toBe(true);

      // pdf-editor: 环境匹配，启用
      expect(flagManager.isEnabled('pdf-editor')).toBe(true);

      // pdf-sorter: 角色匹配，启用
      expect(flagManager.isEnabled('pdf-sorter')).toBe(true);

      // experimental-feature: 所有条件匹配 + 50% 概率（不确定）
      const enabled = flagManager.isEnabled('experimental-feature');
      expect(typeof enabled).toBe('boolean');

      // disabled-feature: 禁用
      expect(flagManager.isEnabled('disabled-feature')).toBe(false);
    });

    it('应该支持生产环境配置', () => {
      flagManager = new FeatureFlagManager({
        environment: 'production',
        currentUser: 'user@example.com',
        currentUserRoles: ['user']
      });

      const config = {
        'stable-feature': {
          enabled: true
        },
        'beta-feature': {
          enabled: true,
          conditions: {
            environment: 'development'
          }
        }
      };

      flagManager.loadFromObject(config);

      // 稳定功能在生产环境启用
      expect(flagManager.isEnabled('stable-feature')).toBe(true);

      // Beta 功能仅在开发环境启用
      expect(flagManager.isEnabled('beta-feature')).toBe(false);
    });
  });
});
