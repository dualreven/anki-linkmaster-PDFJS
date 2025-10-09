export default {
  // 重要：保持模块为 ESM，避免在浏览器中生成 require()
  presets: [
    [
      '@babel/preset-env',
      {
        modules: false,            // 不把 ESM 转成 CommonJS
        targets: { esmodules: true } // 针对支持 ES Modules 的浏览器
      }
    ]
  ],
  plugins: [
    '@babel/plugin-syntax-import-meta',
    ['@babel/plugin-transform-optional-chaining'],
    ['@babel/plugin-transform-nullish-coalescing-operator'],
    ['@babel/plugin-transform-private-methods', { loose: true }],
    ['@babel/plugin-transform-class-properties', { loose: true }],
    ['@babel/plugin-transform-private-property-in-object', { loose: true }]
  ],
  // 仅在生产构建关闭 source map；开发保留调试能力
  env: {
    production: {
      sourceMaps: false,
      // 某些插件可能会注入 //# sourceURL 注释；确保不产生映射
      compact: true
    }
  }
};
