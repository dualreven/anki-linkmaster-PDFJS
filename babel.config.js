export default function babelConfig(api) {
  const isTest = api.env('test');

  return {
    // 保持浏览器构建为 ESM，但在测试环境转换为 CommonJS 以兼容 Jest
    presets: [
      [
        '@babel/preset-env',
        isTest
          ? {
              modules: 'commonjs',
              targets: { node: 'current' }
            }
          : {
              modules: false,
              targets: { esmodules: true }
            }
      ]
    ],
    plugins: [
      '@babel/plugin-syntax-import-meta',
      // 仅在测试环境（Jest）转换 import.meta；浏览器构建必须保留为原生，以避免引入 require('url')
      ...(isTest ? [['babel-plugin-transform-import-meta', { module: 'CommonJS' }]] : []),
      ['@babel/plugin-transform-optional-chaining'],
      ['@babel/plugin-transform-nullish-coalescing-operator'],
      ['@babel/plugin-transform-private-methods', { loose: true }],
      ['@babel/plugin-transform-class-properties', { loose: true }],
      ['@babel/plugin-transform-private-property-in-object', { loose: true }]
    ],
    env: {
      production: {
        sourceMaps: false,
        compact: true
      }
    }
  };
}

