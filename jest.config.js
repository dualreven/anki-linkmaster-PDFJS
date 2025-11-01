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
    // 将 logger.js 映射为测试友好的 mock，避免 import.meta 与环境差异影响
    '.*/common/utils/logger\\.js$': '<rootDir>/tests/__mocks__/logger.js',
    '\\.(css|less|sass|scss)$': '<rootDir>/tests/__mocks__/styleMock.js'
  },
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  transformIgnorePatterns: [
    // 保留对 pdfjs-dist 的特殊处理，同时支持 .mjs 文件
    'node_modules/(?!(pdfjs-dist|.*\\.mjs$)/)'
  ]
};
