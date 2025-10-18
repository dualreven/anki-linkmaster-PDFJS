const { jest: jestGlobal } = require('@jest/globals');

try {
  require('fake-indexeddb/auto');
} catch (e) {
  console.warn('fake-indexeddb not found, skipping IndexedDB mock');
}

global.fetch = jestGlobal.fn();

global.WebSocket = jestGlobal.fn().mockImplementation(() => ({
  send: jestGlobal.fn(),
  close: jestGlobal.fn(),
  addEventListener: jestGlobal.fn(),
  removeEventListener: jestGlobal.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
}));

global.console = {
  ...console,
  log: jestGlobal.fn(),
  debug: jestGlobal.fn(),
  info: jestGlobal.fn(),
  warn: jestGlobal.fn(),
  error: jestGlobal.fn()
};

global.requestAnimationFrame = jestGlobal.fn().mockImplementation((callback) => {
  return setTimeout(callback, 0);
});

global.cancelAnimationFrame = jestGlobal.fn().mockImplementation((id) => {
  clearTimeout(id);
});

global.ResizeObserver = jestGlobal.fn().mockImplementation(() => ({
  observe: jestGlobal.fn(),
  unobserve: jestGlobal.fn(),
  disconnect: jestGlobal.fn()
}));

global.IntersectionObserver = jestGlobal.fn().mockImplementation(() => ({
  observe: jestGlobal.fn(),
  unobserve: jestGlobal.fn(),
  disconnect: jestGlobal.fn()
}));
