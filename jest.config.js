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
    '^(\\.{1,2}/.*)\\.js$': '$1',
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
