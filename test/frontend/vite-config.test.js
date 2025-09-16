/**
 * 测试 Vite 配置中的 transformMixedEsModules 选项
 * @description 验证 Vite 配置是否正确设置了 transformMixedEsModules 选项
 */

import config from '../../vite.config.js';

describe('Vite 配置测试', () => {
  describe('transformMixedEsModules 配置', () => {
    test('应该包含 transformMixedEsModules 选项', () => {
      // 验证配置对象存在
      expect(config).toBeDefined();
      
      // 验证 build 配置存在
      expect(config.build).toBeDefined();
      
      // 验证 rollupOptions 配置存在
      expect(config.build.rollupOptions).toBeDefined();
      
      // 验证 transformMixedEsModules 选项存在
      expect(config.build.rollupOptions.transformMixedEsModules).toBeDefined();
    });

    test('transformMixedEsModules 应该设置为 true', () => {
      // 验证 transformMixedEsModules 值为 true
      expect(config.build.rollupOptions.transformMixedEsModules).toBe(true);
    });

    test('其他关键配置应该保持不变', () => {
      // 验证 root 配置
      expect(config.root).toBe('src/frontend/pdf-home');
      
      // 验证 plugins 配置存在
      expect(config.plugins).toBeDefined();
      expect(Array.isArray(config.plugins)).toBe(true);
      
      // 验证 optimizeDeps 配置
      expect(config.optimizeDeps).toBeDefined();
      expect(config.optimizeDeps.include).toBeDefined();
      
      // 验证 output 配置
      expect(config.build.rollupOptions.output).toBeDefined();
      expect(config.build.rollupOptions.output.format).toBe('es');
    });
  });

  describe('配置完整性测试', () => {
    test('配置应该包含所有必要的选项', () => {
      const requiredOptions = [
        'root',
        'plugins',
        'optimizeDeps',
        'build'
      ];

      requiredOptions.forEach(option => {
        expect(config).toHaveProperty(option);
      });
    });

    test('build 配置应该包含 rollupOptions', () => {
      expect(config.build).toHaveProperty('rollupOptions');
      
      const rollupOptions = config.build.rollupOptions;
      expect(rollupOptions).toHaveProperty('output');
      expect(rollupOptions).toHaveProperty('transformMixedEsModules');
    });
  });
});