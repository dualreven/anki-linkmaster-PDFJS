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
    '\\.(css|less|sass|scss)$': '<rootDir>/tests/__mocks__/styleMock.js'
  },
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  transformIgnorePatterns: [
    // 保留对 pdfjs-dist 的特殊处理，同时支持 .mjs 文件
    'node_modules/(?!(pdfjs-dist|.*\\.mjs$)/)'
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/data/dist/',
    '<rootDir>/dist/latest/static/vendor/',
    '<rootDir>/public/dist/vendor/'
  ]
};
