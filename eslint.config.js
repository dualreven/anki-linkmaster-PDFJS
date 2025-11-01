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
          "no-direct-toast-import": noDirectToastImport,
          "no-izi-toast-global": noIziToastGlobal,
          "notification-allowed-apis": notificationAllowedApis,
          "no-dynamic-notification-import": noDynamicNotificationImport,
          "logger-toast-shape": loggerToastShape,
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
      "custom/event-name-format": "error",    // 强制三段式事件名称
      // 🚨 禁止直接导入第三方 toast 适配器（要求走统一入口）
      "custom/no-direct-toast-import": "error",
      "custom/no-izi-toast-global": "error",
      "custom/notification-allowed-apis": "error",
      "custom/no-dynamic-notification-import": "error",
      // 可先以 warning 形式上线，成熟后再升级为 error
      "custom/logger-toast-shape": "warn",

      // 风格与质量控制
      "eqeqeq": ["error", "always"],          // 强制使用 ===
      "semi": ["error", "always"],            // 必须使用分号
      "quotes": ["error", "double"],          // 统一双引号
      "indent": ["error", 2],                 // 两格缩进
      "no-trailing-spaces": "error",          // 禁止行尾空格
      "eol-last": ["error", "always"],        // 文件末尾必须有换行
      "no-multiple-empty-lines": ["error", { max: 1 }],
      "curly": ["error", "all"],              // if/while 强制使用大括号

      // 质量问题
      "no-unused-vars": ["warn", { args: "none", ignoreRestSiblings: true }],
      "no-console": "warn",
      "no-alert": "error",                    // 禁止使用 alert
      "no-debugger": "error",
      "no-undef": "error",
      "no-unused-private-class-members": "warn",
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
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
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
      "jsdoc/require-description": "warn",
      // 确保 JSDoc 的参数和返回值与函数签名一致
      "jsdoc/check-param-names": "error",
      "jsdoc/require-param-type": "warn",
      "jsdoc/require-returns-type": "warn",
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
    rules: {
      "no-undef": "off",
    },
  },

  // 忽略文件
  {
    ignores: [
      "dist/**",
      "build/**",
      "logs/**",
      "AItemp/**",
      "coverage/**",
      ".venv/**",
      ".idea/**",
      ".vscode/**",
      "public/vendor/**",
      "src/frontend/public/**",
      "**/*.d.ts",
      "node_modules/**",
      "**/*.min.js",
    ],
  },
];
