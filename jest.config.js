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
    '.*logger\\.js$': '<rootDir>/src/frontend/__mocks__/logger.js',
    '^pdfjs-dist$': '<rootDir>/src/frontend/__mocks__/pdfjs-dist.js',
    '^@pdfjs/web/pdf_viewer\\.mjs$': '<rootDir>/src/frontend/__mocks__/pdfjs-web-viewer.js',
    '\\.(css|less|sass|scss)$': '<rootDir>/src/frontend/__mocks__/styleMock.js'
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
    // 本仓库的 tests/ 目录可能在不同 worktree/机器上“存在但未纳入 git”，
    // 若存在旧的 tests/__mocks__ 会导致 jest-haste-map 报 duplicate manual mock。
    '<rootDir>/tests/__mocks__/',
    '<rootDir>/data/dist/',
    '<rootDir>/dist/latest/static/vendor/',
    '<rootDir>/public/dist/',
    '<rootDir>/public/dist/vendor/',
    '<rootDir>/src/frontend/dist/'  // 忽略前端构建输出目录
  ]
};
