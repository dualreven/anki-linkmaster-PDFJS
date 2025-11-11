import { existsSync } from "node:fs";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import jsdoc from "eslint-plugin-jsdoc";
import eventNameFormat from "./eslint-rules/event-name-format.js";
import noDirectToastImport from "./eslint-rules/no-direct-toast-import.js";
import noIziToastGlobal from "./eslint-rules/no-izi-toast-global.js";
import notificationAllowedApis from "./eslint-rules/notification-allowed-apis.js";
import noDynamicNotificationImport from "./eslint-rules/no-dynamic-notification-import.js";
import loggerToastShape from "./eslint-rules/logger-toast-shape.js";
import noCrossFeatureInternals from "./eslint-rules/no-cross-feature-internals.js";
import noEventLiteral from "./eslint-rules/no-event-literal.js";
import noSilentCatch from "./eslint-rules/no-silent-catch.js";

const hasTsconfig = existsSync(new URL("./tsconfig.json", import.meta.url));
const tsParserOptions = hasTsconfig ? { project: "./tsconfig.json" } : {};

export default [
  // 使用 ESLint 官方推荐配置
  js.configs.recommended,

  // 针对 JavaScript 文件
  {
    files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
    plugins: {
      jsdoc,
      custom: {
        rules: {
          "event-name-format": eventNameFormat,
          "no-event-literal": noEventLiteral,
          "no-direct-toast-import": noDirectToastImport,
          "no-izi-toast-global": noIziToastGlobal,
          "notification-allowed-apis": notificationAllowedApis,
          "no-dynamic-notification-import": noDynamicNotificationImport,
          "logger-toast-shape": loggerToastShape,
          "no-cross-feature-internals": noCrossFeatureInternals,
          "no-silent-catch": noSilentCatch,
        }
      }
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // 🚨 事件名称格式检查（自定义规则）
      // - 强制三段式事件名称
      // - 禁止字符串字面量，必须通过常量命名空间引用（*_EVENTS / *_MESSAGE_TYPES / PDF_VIEWER_EVENTS / WEBSOCKET_EVENTS）
      "custom/event-name-format": "error",
      // 🚨 全局禁止任何三段式事件字符串字面量（除白名单文件外）
      "custom/no-event-literal": "error",
      // 🚨 禁止直接导入第三方 toast 适配器（要求走统一入口）
      "custom/no-direct-toast-import": "error",
      "custom/no-izi-toast-global": "error",
      "custom/notification-allowed-apis": "error",
      "custom/no-dynamic-notification-import": "error",
      // 开启形状校验为 error
      "custom/logger-toast-shape": "error",
      // 新增：禁止跨特性内部深层 import（升级为 error，作为 CI 门禁）
      "custom/no-cross-feature-internals": "error",
      // 禁止静默 catch（除 logger/toast 保护场景外）
      "custom/no-silent-catch": "error",

      // 风格与质量控制
      "eqeqeq": ["error", "always"],          // 强制使用 ===
      "semi": ["error", "always"],            // 必须使用分号
      "quotes": ["error", "double"],          // 统一双引号
      "indent": ["error", 2],                 // 两格缩进
      "no-trailing-spaces": "error",          // 禁止行尾空格
      "eol-last": ["error", "always"],        // 文件末尾必须有换行
      "no-multiple-empty-lines": ["error", { max: 1 }],
      "curly": ["error", "all"],              // if/while 强制使用大括号
      // 禁止空的 catch 块（用局部 override 白名单处理极少数必要场景）
      "no-empty": ["error", { "allowEmptyCatch": false }],

      // 质量问题
      "no-unused-vars": ["error", { args: "none", ignoreRestSiblings: true }],
      "no-console": "error",
      "no-alert": "error",                    // 禁止使用 alert
      "no-debugger": "error",
      "no-undef": "error",
      "no-unused-private-class-members": "error",
    },
  },

  // 针对 TypeScript 文件（如仓库存在 tsconfig.json，则启用类型感知）
  // 移除全局 TypeScript 推荐规则，避免作用到 .js/.mjs；仅在下方 TS overrides 中启用
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      jsdoc,
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ...tsParserOptions,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // TypeScript 常见质量规则
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      // 强制函数必须写 JSDoc
      "jsdoc/require-jsdoc": [
        "error",
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false, // 箭头函数可选
            FunctionExpression: false,      // 匿名函数可选
          },
        },
      ],
      // 要求 JSDoc 必须有描述
      "jsdoc/require-description": "error",
      // 确保 JSDoc 的参数和返回值与函数签名一致
      "jsdoc/check-param-names": "error",
      "jsdoc/require-param-type": "error",
      "jsdoc/require-returns-type": "error",
    },
  },

  // 允许日志核心模块使用 console（作为唯一出口）
  {
    files: ["src/frontend/common/utils/logger.js"],
    rules: {
      "no-console": "off",
    },
  },

  // EventBus 内核文件：允许变量事件名（不强制字面量）
  {
    files: [
      "src/frontend/common/event/scoped-event-bus.js",
      "src/frontend/common/event/event-bus.js",
      "src/frontend/common/event/event-bus-with-tracing.js"
    ],
    rules: {
      "custom/event-name-format": "off",
      "custom/no-event-literal": "off",
    },
  },

  // Feature 领域内的事件常量定义文件：允许字符串字面量作为常量值
  {
    files: [
      "src/frontend/**/features/**/events.js",
      "src/frontend/common/event/test-events.js"
    ],
    rules: {
      "custom/no-event-literal": "off",
    },
  },

  // PDF-Viewer 模块：允许使用第三方(PDF.js)事件名（非三段式），仅关闭格式校验，不影响三段式字面量禁令
  {
    files: [
      "src/frontend/pdf-viewer/**/*.js"
    ],
    rules: {
      "custom/event-name-format": "error",
      "custom/no-event-literal": "error",
    },
  },

  // PDF-Home 模块：逐步迁移，暂时关闭事件字面量与格式强校验
  {
    files: [
      "src/frontend/pdf-home/**/*.js"
    ],
    rules: {
      "custom/event-name-format": "error",
      "custom/no-event-literal": "error",
    },
  },

  // 阶段三（pdf-home：search & filter 子域恢复事件门禁）
  {
    files: [
      "src/frontend/pdf-home/features/search/**/*.js",
      "src/frontend/pdf-home/features/filter/**/*.js",
    ],
    rules: {
      "custom/event-name-format": "error",
      "custom/no-event-literal": "error",
    },
  },

  // 阶段四（pdf-home：search-results & sidebar 子域恢复事件门禁）
  {
    files: [
      "src/frontend/pdf-home/features/search-results/**/*.js",
      "src/frontend/pdf-home/features/sidebar/**/*.js",
      "src/frontend/pdf-home/features/search-result-item/**/*.js",
      "src/frontend/pdf-home/features/saved-filters/**/*.js",
    ],
    rules: {
      "custom/event-name-format": "error",
      "custom/no-event-literal": "error",
    },
  },
  // 常量与配置定义文件在上述子域仍允许字面量（避免误报）
  {
    files: [
      "src/frontend/pdf-home/features/**/events.js",
      "src/frontend/pdf-home/features/**/feature.config.js",
    ],
    rules: {
      "custom/event-name-format": "off",
      "custom/no-event-literal": "off",
    },
  },
  // 阶段二（开始回收 no-unused-*）：common/event/** 先启用为 warn
  {
    files: [
      "src/frontend/common/event/**/*.js"
    ],
    rules: {
      "no-unused-vars": ["error", { args: "none", ignoreRestSiblings: true }],
      "no-unused-private-class-members": "error",
    },
  },
  // 阶段二（开始回收 no-unused-*）：common/utils/** 先启用为 warn
  {
    files: [
      "src/frontend/common/utils/**/*.js"
    ],
    rules: {
      "no-unused-vars": ["error", { args: "none", ignoreRestSiblings: true }],
      "no-unused-private-class-members": "error",
    },
  },
  // 测试文件（Jest 环境）
  {
    files: ["**/__tests__/**", "**/*.test.js", "**/*.test.mjs", "**/__smoke__/**"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    // 测试中允许极简的防御性空 catch（例如释放资源），避免为断言噪音写无意义日志
    rules: {
      "no-empty": ["error", { "allowEmptyCatch": true }],
      "custom/no-silent-catch": "off",
    },
  },

  // 脚本目录：允许使用 console 与未使用变量（便于调试/脚本输出）
  {
    files: ["scripts/**"],
    rules: {
      "no-console": "off",
      "no-unused-vars": "off",
      "custom/no-silent-catch": "off",
    },
  },

  // 忽略文件
  {
    ignores: [
      "dist/**",
      "data/dist/**",
      "public/dist/**",
      // 工程根配置类文件
      "vite.config.*",
      "build/**",
      "logs/**",
      "AItemp/**",
      "coverage/**",
      ".venv/**",
      ".idea/**",
      ".vscode/**",
      "public/vendor/**",
      "public/js/**",
      "src/frontend/public/**",
      "**/vendor/**",
      "eslint-rules/fixtures/**",
      "**/__smoke__/**",
      "**/*.backup.js",
      "**/*.d.ts",
      "node_modules/**",
      "**/*.min.js",
      "**/*.min.mjs",
    ],
  },

  // 恢复严格门禁（阶段一）：pdf-viewer/pdf/** 启用事件字面量与格式校验
  {
    files: [
      "src/frontend/pdf-viewer/pdf/**/*.js"
    ],
    rules: {
      "custom/event-name-format": "error",
      "custom/no-event-literal": "error",
    },
  },
  // 阶段七（pdf-home 全量目录：启用 no-unused-* 为 error）
  {
    files: [
      "src/frontend/pdf-home/**/*.js"
    ],
    rules: {
      "no-unused-vars": ["error", { args: "none", ignoreRestSiblings: true }],
      "no-unused-private-class-members": "error",
    },
  },];
