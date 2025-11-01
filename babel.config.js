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
      // 将 import.meta 转为可在 CJS（Jest）环境安全执行的表达式
      ['babel-plugin-transform-import-meta', { module: 'CommonJS' }],
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
