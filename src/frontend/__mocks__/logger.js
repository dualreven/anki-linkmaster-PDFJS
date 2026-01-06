// Jest mock for common/utils/logger.js — 避免 import.meta/env 差异造成测试解析失败
export const LogLevel = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error"
};

const createLogger = (name) => {
  const calls = { debug: [], info: [], warn: [], error: [] };
  return {
    name,
    calls,
    setLevel: () => {},
    debug: (...args) => { calls.debug.push(args); },
    info: (...args) => { calls.info.push(args); },
    warn: (...args) => { calls.warn.push(args); },
    error: (...args) => { calls.error.push(args); }
  };
};

const registry = new Map();

export function getLogger(name = "Test") {
  if (!registry.has(name)) {
    registry.set(name, createLogger(name));
  }
  return registry.get(name);
}

export function setModuleLogLevel(/*name, level*/) {
  // no-op in tests
}

export function setToastPolicy(/*policy*/) {
  // no-op in tests
}

export function getToastPolicy() {
  return { defaultEnabled: false, perModule: {} };
}

// 兼容默认导出用法（部分测试以默认导入 logger）
export default function defaultLogger(name = "Test") {
  return getLogger(name);
}
