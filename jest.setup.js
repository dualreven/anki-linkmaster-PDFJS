const { jest: jestGlobal } = require('@jest/globals');

try {
  require('fake-indexeddb/auto');
} catch (e) {
  console.warn('fake-indexeddb not found, skipping IndexedDB mock');
}

// Polyfill structuredClone for environments that lack it (fake-indexeddb depends on it)
if (typeof global.structuredClone !== "function") {
  global.structuredClone = (value) => {
    const seen = new Map();
    const cloneAny = (v) => {
      if (v === null || v === undefined) { return v; }
      if (typeof v !== "object") { return v; }
      if (v instanceof ArrayBuffer) { return v.slice(0); }
      if (ArrayBuffer.isView(v)) {
        const buf = v.buffer.slice(0);
        return new v.constructor(buf, v.byteOffset, v.byteLength / v.BYTES_PER_ELEMENT);
      }
      if (v instanceof Date) { return new Date(v.getTime()); }
      if (seen.has(v)) { return seen.get(v); }
      if (Array.isArray(v)) {
        const arr = [];
        seen.set(v, arr);
        for (const item of v) { arr.push(cloneAny(item)); }
        return arr;
      }
      const out = {};
      seen.set(v, out);
      for (const [k, val] of Object.entries(v)) {
        out[k] = cloneAny(val);
      }
      return out;
    };
    return cloneAny(value);
  };
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

// Mock Logger module to fix "getLogger is not a function" errors
jestGlobal.mock('./src/frontend/common/utils/logger.js', () => {
  const createMockLogger = () => ({
    debug: jestGlobal.fn(),
    info: jestGlobal.fn(),
    warn: jestGlobal.fn(),
    error: jestGlobal.fn(),
    event: jestGlobal.fn(),
    setLogLevel: jestGlobal.fn(),
  });

  const LoggerConstructor = jestGlobal.fn().mockImplementation((moduleName) => createMockLogger());

  return {
    __esModule: true,  // 标记为 ES 模块
    default: LoggerConstructor,  // 默认导出（支持 import Logger from './logger.js'）
    getLogger: jestGlobal.fn((moduleName) => createMockLogger()),
    Logger: LoggerConstructor,  // 命名导出（支持 import { Logger } from './logger.js'）
    LogLevel: {
      DEBUG: "debug",
      INFO: "info",
      WARN: "warn",
      ERROR: "error",
    },
    // runtime-config / governance APIs（避免测试环境引用时报 "is not a function"）
    configureLogger: jestGlobal.fn(),
    setGlobalLogLevel: jestGlobal.fn(),
    setModuleLogLevel: jestGlobal.fn(),
    enableAutoToast: jestGlobal.fn(),
    disableAutoToast: jestGlobal.fn(),
    setAutoToastLevels: jestGlobal.fn(),
    getAutoToastConfig: jestGlobal.fn(() => ({ enabled: false, levels: ["error", "warn", "info"], defaultMs: null, excludeModules: [] })),
    setToastPolicy: jestGlobal.fn(),
    getToastPolicy: jestGlobal.fn(() => ({ modules: {}, defaultEnabled: true })),
    setDefaultToastEnabled: jestGlobal.fn(),
  };
});
