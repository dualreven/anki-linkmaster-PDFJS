module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          browsers: '> 0.25%, not dead'
        },
        useBuiltIns: 'usage',
        corejs: 3,
        debug: false,
        modules: 'auto' // 改为 'auto' 以便在测试环境中自动处理模块
      }
    ]
  ],
  plugins: [
    // 移除了重复的proposal插件，只保留transform版本
    '@babel/plugin-transform-private-methods',
    '@babel/plugin-transform-class-properties',
    // 保留必要的插件
    '@babel/plugin-syntax-dynamic-import',
    // 添加新的有用插件（使用transform版本而不是proposal版本）
    '@babel/plugin-transform-optional-chaining',
    '@babel/plugin-transform-nullish-coalescing-operator'
  ],
  env: {
    test: {
      plugins: [
        '@babel/plugin-transform-modules-commonjs'
      ]
    }
  }
};