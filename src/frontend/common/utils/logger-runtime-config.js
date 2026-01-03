export const levelOrder = ["debug", "info", "warn", "error"];

export const globalLogConfig = {
  globalLevel: null,
  perModuleLevel: new Map(),
  enableRateLimit: true,
  rateLimit: { messages: 120, intervalMs: 1000 },
  dedupWindowMs: 500,
  event: { sampleRate: 1.0, maxJsonLength: 800, pretty: true },
  autoToast: { enabled: false, levels: ["error", "warn", "info"], defaultMs: null, excludeModules: [] },
  toastPolicy: { modules: new Map(), defaultEnabled: true },
  _rateState: new Map(),
};

export function shouldShowToast(moduleName, level) {
  try {
    const m = globalLogConfig.toastPolicy.modules.get(moduleName);
    if (m) {
      if (m.enabled === false) { return false; }
      if (Array.isArray(m.levels) && m.levels.length > 0) {
        return m.levels.includes(level);
      }
      return true;
    }
  } catch (e) { void e; /* logger-guard */ }
  return !!globalLogConfig.toastPolicy.defaultEnabled;
}

export function resetLoggerRuntimeConfigForTest() {
  globalLogConfig.globalLevel = null;
  globalLogConfig.perModuleLevel.clear();
  globalLogConfig.enableRateLimit = true;
  globalLogConfig.rateLimit.messages = 120;
  globalLogConfig.rateLimit.intervalMs = 1000;
  globalLogConfig.dedupWindowMs = 500;
  globalLogConfig.event.sampleRate = 1.0;
  globalLogConfig.event.maxJsonLength = 800;
  globalLogConfig.event.pretty = true;
  globalLogConfig.autoToast.enabled = false;
  globalLogConfig.autoToast.levels = ["error", "warn", "info"];
  globalLogConfig.autoToast.defaultMs = null;
  globalLogConfig.autoToast.excludeModules = [];
  globalLogConfig.toastPolicy.modules.clear();
  globalLogConfig.toastPolicy.defaultEnabled = true;
  globalLogConfig._rateState.clear();
}

export function getEffectiveLogLevel(moduleName, instanceLevel) {
  const per = globalLogConfig.perModuleLevel.get(moduleName);
  return per ?? globalLogConfig.globalLevel ?? instanceLevel;
}

export function buildSignature(level, message, args) {
  let argKind = "";
  if (args && args.length > 0) {
    const a0 = args[0];
    const t = typeof a0;
    argKind = t === "object" ? "o" : t === "string" ? "s" : t === "number" ? "n" : t;
  }
  return `${level}|${String(message)}|${argKind}`;
}

export function configureLogger(options = {}) {
  if (options.globalLevel && levelOrder.includes(options.globalLevel)) {
    globalLogConfig.globalLevel = options.globalLevel;
  }
  if (typeof options.enableRateLimit === "boolean") {
    globalLogConfig.enableRateLimit = options.enableRateLimit;
  }
  if (options.rateLimit) {
    const { messages, intervalMs } = options.rateLimit;
    if (typeof messages === "number" && messages > 0) {
      globalLogConfig.rateLimit.messages = messages;
    }
    if (typeof intervalMs === "number" && intervalMs > 0) {
      globalLogConfig.rateLimit.intervalMs = intervalMs;
    }
  }
  if (typeof options.dedupWindowMs === "number" && options.dedupWindowMs >= 0) {
    globalLogConfig.dedupWindowMs = options.dedupWindowMs;
  }
  if (options.event) {
    const e = options.event;
    if (typeof e.sampleRate === "number" && e.sampleRate >= 0 && e.sampleRate <= 1) {
      globalLogConfig.event.sampleRate = e.sampleRate;
    }
    if (typeof e.maxJsonLength === "number" && e.maxJsonLength >= 0) {
      globalLogConfig.event.maxJsonLength = e.maxJsonLength;
    }
    if (typeof e.pretty === "boolean") {
      globalLogConfig.event.pretty = e.pretty;
    }
  }
}

export function setGlobalLogLevel(level) {
  if (levelOrder.includes(level)) {
    globalLogConfig.globalLevel = level;
  }
}

export function setModuleLogLevel(moduleName, level) {
  if (levelOrder.includes(level)) {
    globalLogConfig.perModuleLevel.set(moduleName, level);
  }
}

export function enableAutoToast(options = {}) {
  globalLogConfig.autoToast.enabled = true;

  if (options.levels && Array.isArray(options.levels)) {
    globalLogConfig.autoToast.levels = options.levels.filter(l => levelOrder.includes(l));
  }

  if (typeof options.defaultMs === "number" && options.defaultMs > 0) {
    globalLogConfig.autoToast.defaultMs = options.defaultMs;
  }

  if (options.excludeModules && Array.isArray(options.excludeModules)) {
    globalLogConfig.autoToast.excludeModules = options.excludeModules;
  }

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("LOG_AUTO_TOAST_ENABLED", "true");
      if (options.levels) {
        window.localStorage.setItem("LOG_AUTO_TOAST_LEVELS", globalLogConfig.autoToast.levels.join(","));
      }
      if (options.defaultMs) {
        window.localStorage.setItem("LOG_AUTO_TOAST_MS", String(options.defaultMs));
      }
      if (options.excludeModules) {
        window.localStorage.setItem("LOG_AUTO_TOAST_EXCLUDE", options.excludeModules.join(","));
      }
    }
  } catch (e) { void e; /* logger-guard */ }
}

export function disableAutoToast() {
  globalLogConfig.autoToast.enabled = false;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem("LOG_AUTO_TOAST_ENABLED");
    }
  } catch (e) { void e; /* logger-guard */ }
}

export function setToastPolicy(moduleName, policy = {}) {
  if (!moduleName || typeof moduleName !== "string") { return; }
  const p = {};
  if (typeof policy.enabled === "boolean") { p.enabled = policy.enabled; }
  if (Array.isArray(policy.levels)) {
    const allowed = [...levelOrder, "success"];
    p.levels = policy.levels.filter(l => allowed.includes(l));
  }
  globalLogConfig.toastPolicy.modules.set(moduleName, p);
}

export function getToastPolicy() {
  const mods = {};
  try {
    for (const [k, v] of globalLogConfig.toastPolicy.modules.entries()) {
      mods[k] = { enabled: (v.enabled !== false), levels: v.levels ? [...v.levels] : undefined };
    }
  } catch (e) { void e; /* logger-guard */ }
  return {
    defaultEnabled: !!globalLogConfig.toastPolicy.defaultEnabled,
    modules: mods,
  };
}

export function setDefaultToastEnabled(enabled) {
  globalLogConfig.toastPolicy.defaultEnabled = !!enabled;
}

export function setAutoToastLevels(levels) {
  if (Array.isArray(levels)) {
    globalLogConfig.autoToast.levels = levels.filter(l => levelOrder.includes(l));
  }
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("LOG_AUTO_TOAST_LEVELS", globalLogConfig.autoToast.levels.join(","));
    }
  } catch (e) { void e; /* logger-guard */ }
}

export function getAutoToastConfig() {
  return {
    enabled: globalLogConfig.autoToast.enabled,
    levels: [...globalLogConfig.autoToast.levels],
    defaultMs: globalLogConfig.autoToast.defaultMs,
    excludeModules: [...globalLogConfig.autoToast.excludeModules]
  };
}

export function applyLoggerStartupOverridesFromEnvironment(options = {}) {
  try {
    const isProd = !!options.isProd;
    if (isProd) {
      if (!globalLogConfig.globalLevel) { globalLogConfig.globalLevel = "warn"; }
      globalLogConfig.event.pretty = false;
      globalLogConfig.event.sampleRate = 0.2;
    }

    const storage = options.storage ?? (typeof window !== "undefined" ? window.localStorage : null);
    if (!storage) { return; }

    const lv = storage.getItem("LOG_LEVEL");
    if (lv && levelOrder.includes(lv)) {
      globalLogConfig.globalLevel = lv;
    }

    const rate = storage.getItem("LOG_EVENT_SAMPLE_RATE");
    if (rate) {
      const r = parseFloat(rate);
      if (!Number.isNaN(r) && r >= 0 && r <= 1) { globalLogConfig.event.sampleRate = r; }
    }

    const rl = storage.getItem("LOG_RATE_LIMIT");
    if (rl && typeof rl === "string" && rl.includes(",")) {
      const parts = rl.split(",");
      const m = parseInt(parts[0], 10);
      const ms = parseInt(parts[1], 10);
      if (!Number.isNaN(m) && m > 0) { globalLogConfig.rateLimit.messages = m; }
      if (!Number.isNaN(ms) && ms > 0) { globalLogConfig.rateLimit.intervalMs = ms; }
    }

    const dd = storage.getItem("LOG_DEDUP_WINDOW_MS");
    if (dd) {
      const v = parseInt(dd, 10);
      if (!Number.isNaN(v) && v >= 0) { globalLogConfig.dedupWindowMs = v; }
    }

    const mj = storage.getItem("LOG_EVENT_MAX_JSON");
    if (mj) {
      const v = parseInt(mj, 10);
      if (!Number.isNaN(v) && v >= 0) { globalLogConfig.event.maxJsonLength = v; }
    }

    const pp = storage.getItem("LOG_EVENT_PRETTY");
    if (pp === "true" || pp === "false") {
      globalLogConfig.event.pretty = (pp === "true");
    }

    const autoToastEnabled = storage.getItem("LOG_AUTO_TOAST_ENABLED");
    if (autoToastEnabled === "true") {
      globalLogConfig.autoToast.enabled = true;

      const autoToastLevels = storage.getItem("LOG_AUTO_TOAST_LEVELS");
      if (autoToastLevels) {
        const levels = autoToastLevels.split(",").filter(l => levelOrder.includes(l));
        if (levels.length > 0) { globalLogConfig.autoToast.levels = levels; }
      }

      const autoToastMs = storage.getItem("LOG_AUTO_TOAST_MS");
      if (autoToastMs) {
        const ms = parseInt(autoToastMs, 10);
        if (!Number.isNaN(ms) && ms > 0) { globalLogConfig.autoToast.defaultMs = ms; }
      }

      const autoToastExclude = storage.getItem("LOG_AUTO_TOAST_EXCLUDE");
      if (autoToastExclude) {
        globalLogConfig.autoToast.excludeModules = autoToastExclude.split(",").filter(m => m.length > 0);
      }
    }
  } catch (e) { void e; /* logger-guard */ }
}
