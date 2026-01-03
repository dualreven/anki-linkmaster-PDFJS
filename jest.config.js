import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const babelJestConfigAbs = path.join(__dirname, 'babel.jest.config.cjs');

/** @type {import(''jest'').Config} */
export default {
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/jest.setup.js'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  moduleNameMapper: {
    // 将各处相对导入到的 logger.js 映射为测试友好的 mock，避免 import.meta/env 影响
    '.*logger\\.js$': '<rootDir>/tests/__mocks__/logger.js',
    '^pdfjs-dist$': '<rootDir>/tests/__mocks__/pdfjs-dist.js',
    '^@pdfjs/web/pdf_viewer\\.mjs$': '<rootDir>/tests/__mocks__/pdfjs-web-viewer.js',
    '\\.(css|less|sass|scss)$': '<rootDir>/tests/__mocks__/styleMock.js'
  },
  transform: {
    // 显式传入绝对路径，避免在不同 CWD/根目录解析下找不到 CJS 配置
    '^.+\\.m?js$': ['babel-jest', { configFile: babelJestConfigAbs }]
  },
  transformIgnorePatterns: [
    // 保留对 pdfjs-dist 的特殊处理，同时支持 .mjs 文件
    'node_modules/(?!(pdfjs-dist|.*\\.mjs$)/)'
  ],
  testPathIgnorePatterns: [
    // E2E 使用 Playwright 自己的 test runner，避免被 Jest 误扫到 .e2e.spec.mjs
    '<rootDir>/tests/e2e/'
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/data/dist/',
    '<rootDir>/dist/latest/static/vendor/',
    '<rootDir>/public/dist/',
    '<rootDir>/public/dist/vendor/',
    '<rootDir>/src/frontend/dist/'  // 忽略前端构建输出目录
  ]
};
