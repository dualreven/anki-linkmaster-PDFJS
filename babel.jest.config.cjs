// CommonJS 版 Babel 配置，仅供 Jest 使用（解决 ESM 配置在同步加载下的限制）
/** @type {(api: import('@babel/core').ConfigAPI) => import('@babel/core').TransformOptions} */
module.exports = function babelJestConfig(api) {
  const isTest = api.env("test");

  return {
    presets: [
      [
        "@babel/preset-env",
        isTest
          ? { modules: "commonjs", targets: { node: "current" } }
          : { modules: false, targets: { esmodules: true } },
      ],
    ],
    plugins: [
      "@babel/plugin-syntax-import-meta",
      ...(isTest ? [["babel-plugin-transform-import-meta", { module: "CommonJS" }]] : []),
      ["@babel/plugin-transform-optional-chaining"],
      ["@babel/plugin-transform-nullish-coalescing-operator"],
      ["@babel/plugin-transform-private-methods", { loose: true }],
      ["@babel/plugin-transform-class-properties", { loose: true }],
      ["@babel/plugin-transform-private-property-in-object", { loose: true }],
    ],
    env: {
      production: {
        sourceMaps: false,
        compact: true,
      },
    },
  };
};

