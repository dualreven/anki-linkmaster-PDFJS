/**
 * Dependency Cruiser 配置
 * 用于检查模块依赖关系是否符合五层架构规则
 */

module.exports = {
  forbidden: [
    // 禁止循环依赖
    {
      name: 'no-circular',
      severity: 'error',
      comment: '禁止循环依赖',
      from: {},
      to: { circular: true }
    },

    // Layer 1 (common) 不能依赖任何上层
    {
      name: 'common-no-upper-deps',
      severity: 'error',
      comment: 'Layer 1 (common) 不能依赖任何上层模块',
      from: { path: '^src/frontend/common' },
      to: {
        path: '^src/frontend/pdf-viewer/(core|features|adapters|bootstrap)'
      }
    },

    // Layer 2 (core) 不能依赖 features/adapters/bootstrap
    {
      name: 'core-no-feature-deps',
      severity: 'error',
      comment: 'Layer 2 (core) 不能依赖 features/adapters/bootstrap',
      from: { path: '^src/frontend/pdf-viewer/core' },
      to: {
        path: '^src/frontend/pdf-viewer/(features|adapters|bootstrap)'
      }
    },

    // Layer 3 (features) 不能互相依赖
    {
      name: 'features-no-cross-deps',
      severity: 'error',
      comment: 'Layer 3 (features) 模块之间不能直接依赖,必须通过事件总线通信',
      from: { path: '^src/frontend/pdf-viewer/features/([^/]+)' },
      to: {
        path: '^src/frontend/pdf-viewer/features/([^/]+)',
        pathNot: '^src/frontend/pdf-viewer/features/$1'
      }
    },

    // Layer 3 (features) 不能依赖 adapters/bootstrap
    {
      name: 'features-no-adapter-deps',
      severity: 'error',
      comment: 'Layer 3 (features) 不能依赖 adapters/bootstrap',
      from: { path: '^src/frontend/pdf-viewer/features' },
      to: {
        path: '^src/frontend/pdf-viewer/(adapters|bootstrap)'
      }
    },

    // Layer 4 (adapters) 只能依赖 common
    {
      name: 'adapters-only-common',
      severity: 'error',
      comment: 'Layer 4 (adapters) 只能依赖 Layer 1 (common)',
      from: { path: '^src/frontend/pdf-viewer/adapters' },
      to: {
        path: '^src/frontend/pdf-viewer/(core|features|bootstrap)'
      }
    }
  ],

  options: {
    // 只检查 pdf-viewer 模块
    doNotFollow: {
      path: 'node_modules'
    },

    // 排除测试文件
    exclude: {
      path: '(node_modules|__tests__|dist|pyqt)'
    },

    // 模块系统
    moduleSystems: ['es6', 'cjs'],

    // TypeScript 配置
    tsPreCompilationDeps: false,
    tsConfig: {
      fileName: 'src/frontend/pdf-viewer/jsconfig.json'
    },

    // 报告选项
    reporterOptions: {
      dot: {
        collapsePattern: '^src/frontend/pdf-viewer/(common|core|features|adapters|bootstrap)/[^/]+'
      },
      text: {
        highlightFocused: true
      }
    }
  }
};
