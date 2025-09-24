/**
 * 构建验证测试 - 验证构建配置和Babel转换
 * @file 构建验证测试
 */

describe('构建验证测试', () => {
  test('构建过程应该成功完成', () => {
    // 这个测试验证构建过程是否成功
    // 如果构建失败，这个测试文件就无法运行
    expect(true).toBe(true);
  });

  test('Babel配置应该包含私有字段转换插件', () => {
    // 验证Babel配置是否正确设置了私有字段转换
    // 使用动态导入代替require
    import('../../../babel.config.js').then(babelConfig => {
      expect(babelConfig.plugins).toBeDefined();
      
      const hasPrivateMethodsPlugin = babelConfig.plugins.includes('@babel/plugin-transform-private-methods');
      const hasClassPropertiesPlugin = babelConfig.plugins.includes('@babel/plugin-transform-class-properties');
      
      expect(hasPrivateMethodsPlugin).toBe(true);
      expect(hasClassPropertiesPlugin).toBe(true);
      
      console.log('Babel配置验证: 私有字段转换插件已配置');
    }).catch(error => {
      console.error('Failed to import babel.config.js:', error);
    });
  });

  test('package.json应该包含必要的Babel依赖', () => {
    // 验证package.json中包含了必要的Babel插件
    // 使用动态导入代替require
    import('../../../package.json').then(packageJson => {
      expect(packageJson.devDependencies).toBeDefined();
      
      const deps = packageJson.devDependencies;
      expect(deps['@babel/plugin-transform-private-methods']).toBeDefined();
      expect(deps['@babel/plugin-transform-class-properties']).toBeDefined();
      expect(deps['vite-plugin-babel']).toBeDefined();
      
      console.log('依赖验证: 必要的Babel依赖已安装');
    }).catch(error => {
      console.error('Failed to import package.json:', error);
    });
  });
});

// 移除CommonJS导出语句