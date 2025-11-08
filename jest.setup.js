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

// Stub CanvasRenderingContext for jsdom
if (typeof HTMLCanvasElement !== "undefined") {
  const GL_ENUMS = { VERSION: 0x1F02, RENDERER: 0x1F01, VENDOR: 0x1F00 };
  const glStub = {
    getParameter: jestGlobal.fn((p) => {
      switch (p) {
        case GL_ENUMS.VERSION: return "WebGL 1.0 (Test)";
        case GL_ENUMS.RENDERER: return "Test Renderer";
        case GL_ENUMS.VENDOR: return "Test Vendor";
        default: return null;
      }
    }),
    ...GL_ENUMS
  };
  // Provide getContext returning our stub for 'webgl' and 'webgl2'
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    writable: true,
    value: jestGlobal.fn((type) => {
      if (!type) { return null; }
      const t = String(type).toLowerCase();
      if (t === "webgl" || t === "experimental-webgl") {
        return glStub;
      }
      return null;
    })
  });
}

