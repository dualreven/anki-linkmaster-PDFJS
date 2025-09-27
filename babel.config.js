// Babel configuration file

export default {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          browsers: '> 0.25%, not dead'
        },
        useBuiltIns: false,
        corejs: 3,
        debug: false,
        modules: false // 改为 'auto' 以便在测试环境中自动处理模块
      }
    ]
  ],
  plugins: [
    // 启用类字段、私有方法等新语法
    '@babel/plugin-transform-private-methods',
    '@babel/plugin-transform-class-properties',
    
    // 启用动态 import 语法支持 (解决Vite启动时的报错)
    '@babel/plugin-syntax-dynamic-import',
    
    // 启用可选链和空值合并运算符（使用兼容的Transform版本）
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
