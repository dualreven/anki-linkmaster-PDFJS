/**
 * Jest 设置文件
 * @file 为 Jest 测试环境提供全局设置
 */

// 引入 fake-indexeddb 为测试环境提供 IndexedDB 支持
require('fake-indexeddb/auto');

// 模拟全局对象，以便在测试环境中使用
global.fetch = jest.fn();

// 模拟 WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
}));

// 模拟 console 方法以减少测试输出噪音
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// 设置全局的 requestAnimationFrame
global.requestAnimationFrame = jest.fn().mockImplementation(callback => {
  return setTimeout(callback, 0);
});

// 设置全局的 cancelAnimationFrame
global.cancelAnimationFrame = jest.fn().mockImplementation(id => {
  clearTimeout(id);
});

// 模拟 ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// 模拟 IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));