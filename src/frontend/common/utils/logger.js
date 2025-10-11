/**
 * @file 日志记录器模块，提供分级、分类的日志记录功能。
 * @module Logger
 */

/**
 * @enum {string}
 * @description 定义日志的严重性级别。
 */
export const LogLevel = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
};

/**
 * @class Logger
 * @description 一个灵活的日志记录器，支持模块化、日志级别和上下文数据。
 *
 * @param {string} [moduleName="App"] - 当前日志记录器实例所属的模块名。
 * @param {LogLevel} [initialLogLevel=LogLevel.INFO] - 该实例的初始日志级别。
 */
import { info as toastInfo, warning as toastWarning, error as toastError, success as toastSuccess } from "./thirdparty-toast.js";

export class Logger {
  #moduleName;
  #logLevel;
  #lastSig;
  #lastSigTime;
  #repeatCount;

  constructor(moduleName = "App", initialLogLevel = LogLevel.INFO) {
    this.#moduleName = moduleName;
    this.#logLevel = initialLogLevel;
    this.#lastSig = null;
    this.#lastSigTime = 0;
    this.#repeatCount = 0;
  }

  /**
   * 设置当前日志实例的日志级别。
   * @param {LogLevel} level - 新的日志级别。
   */
  setLogLevel(level) {
    if (Object.values(LogLevel).includes(level)) {
      this.#logLevel = level;
    } else {
      console.error(`[Logger] Invalid log level: ${level}`);
    }
  }

  /**
   * 获取当前日志实例的日志级别。
   * @returns {LogLevel} 当前的日志级别。
   */
  getLogLevel() {
    return this.#logLevel;
  }

  #log(level, message, ...args) {
    // 可选 toast 参数解析：允许最后一个参数为 { toast: true | { type, ms } }
    let toastOpt = null;
    if (args && args.length > 0) {
      const maybe = args[args.length - 1];
      if (maybe && typeof maybe === "object" && ("toast" in maybe)) {
        toastOpt = maybe.toast === true ? {} : (typeof maybe.toast === "object" ? maybe.toast : {});
        // 从日志参数中移除该选项对象，避免污染 console 输出
        args = args.slice(0, -1);
      }
    }

    // 全局toast开关：如果开启且当前级别在允许列表中，自动启用toast
    if (!toastOpt && globalLogConfig.autoToast.enabled) {
      const { levels, excludeModules, defaultMs } = globalLogConfig.autoToast;
      // 检查是否在排除模块列表中
      const isExcluded = excludeModules && excludeModules.includes(this.#moduleName);
      // 检查级别是否允许
      const isLevelAllowed = levels && levels.includes(level);

      if (!isExcluded && isLevelAllowed) {
        toastOpt = defaultMs !== null ? { ms: defaultMs } : {};
      }
    }
    const levelOrder = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const effectiveLevel = getEffectiveLogLevel(this.#moduleName, this.#logLevel);
    if (levelOrder.indexOf(level) < levelOrder.indexOf(effectiveLevel)) {
      return;
    }

    // 速率限制（按 模块+级别）
    if (shouldRateLimit(this.#moduleName, level)) {
      return;
    }

    // 短窗重复折叠
    const now = Date.now();
    const dedupWindowMs = globalLogConfig.dedupWindowMs;
    const sig = buildSignature(level, message, args);
    if (this.#lastSig && this.#lastSig === sig && now - this.#lastSigTime <= dedupWindowMs) {
      this.#repeatCount++;
      this.#lastSigTime = now;
      return;
    }

    // 如果存在折叠计数，先输出一次汇总
    if (this.#repeatCount > 0) {
      const infoMethod = console.info || console.log;
      infoMethod(`[${this.#moduleName}] [INFO]`, `上条相同日志在 ${dedupWindowMs}ms 内重复 ${this.#repeatCount} 次，已折叠`);
      this.#repeatCount = 0;
    }

    // 简化日志前缀：移除ISO时间戳，只保留模块名和级别
    // 时间戳由PyQt后端的日志系统统一添加，避免重复
    const prefix = `[${this.#moduleName}] [${level.toUpperCase()}]`;

    const consoleMethod = console[level] || console.log;

    if (args.length > 0) {
      // 序列化对象以便更好地查看内容
      const serializedArgs = args.map(arg => this.#serializeArg(arg));
      consoleMethod(prefix, message, ...serializedArgs);
    } else {
      consoleMethod(prefix, message);
    }

    // 记录本次签名
    this.#lastSig = sig;
    this.#lastSigTime = now;

    // 若请求 toast，则将本条日志同步以 toast 输出
    if (toastOpt) {
      try {
        const ms = typeof toastOpt.ms === "number" ? toastOpt.ms : undefined;
        const tText = this.#buildToastText(message, args);
        const tType = typeof toastOpt.type === "string" ? toastOpt.type : level;
        switch (tType) {
        case LogLevel.ERROR:
        case "error":
          toastError(tText, ms ?? 5000); break;
        case LogLevel.WARN:
        case "warn":
          toastWarning(tText, ms ?? 4000); break;
        case "success":
          toastSuccess(tText, ms ?? 3000); break;
        case LogLevel.DEBUG:
        case "debug":
          // 调试级别默认不弹 toast，除非显式指定 type: 'info'|'success' 等
          break;
        case LogLevel.INFO:
        case "info":
        default:
          toastInfo(tText, ms ?? 3000); break;
        }
      } catch (e) { void e; }
    }
  }

  #buildToastText(message, args) {
    try {
      if (!args || args.length === 0) {return String(message ?? "");}
      const head = String(message ?? "");
      // 仅拼接第一个对象的关键字段，避免过长
      const a0 = args[0];
      if (a0 === null || a0 === undefined) {return head;}
      if (typeof a0 === "string" || typeof a0 === "number" || typeof a0 === "boolean") {
        return `${head} ${String(a0)}`.trim();
      }
      if (typeof a0 === "object") {
        const trimmed = Object.fromEntries(Object.entries(a0).slice(0, 6));
        return `${head} ${this.#safeStringify(trimmed, 2, 0)}`.trim();
      }
      return head;
    } catch (e) { return String(message ?? ""); }
  }

  #serializeArg(arg) {
    if (arg === null || arg === undefined) {
      return arg;
    }

    if (typeof arg === "string" || typeof arg === "number" || typeof arg === "boolean") {
      return arg;
    }

    if (arg instanceof Error) {
      return {
        name: arg.name,
        message: arg.message,
        stack: arg.stack
      };
    }

    if (typeof arg === "object") {
      try {
        return this.#deepSerialize(arg, 3);
      } catch (e) {
        return `[Object serialization failed: ${e.message}]`;
      }
    }

    return arg;
  }

  #deepSerialize(obj, maxDepth, seen = new Set()) {
    if (maxDepth <= 0) {
      return "[Max depth reached]";
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== "object") {
      return obj;
    }

    if (seen.has(obj)) {
      return "[Circular reference]";
    }

    seen.add(obj);

    if (Array.isArray(obj)) {
      const result = obj.slice(0, 10).map(item => this.#deepSerialize(item, maxDepth - 1, seen));
      if (obj.length > 10) {
        result.push(`[... and ${obj.length - 10} more items]`);
      }
      seen.delete(obj);
      return result;
    }

    const result = {};
    const keys = Object.keys(obj).slice(0, 20);

    for (const key of keys) {
      try {
        result[key] = this.#deepSerialize(obj[key], maxDepth - 1, seen);
      } catch (e) {
        result[key] = `[Error serializing: ${e.message}]`;
      }
    }

    const totalKeys = Object.keys(obj).length;
    if (totalKeys > 20) {
      result["..."] = `[and ${totalKeys - 20} more properties]`;
    }

    seen.delete(obj);
    return result;
  }

  debug(message, ...args) {
    this.#log(LogLevel.DEBUG, message, ...args);
  }

  info(message, ...args) {
    this.#log(LogLevel.INFO, message, ...args);
  }

  warn(message, ...args) {
    this.#log(LogLevel.WARN, message, ...args);
  }

  error(message, ...args) {
    this.#log(LogLevel.ERROR, message, ...args);
  }

  event(eventName, action, data = {}) {
    // 事件采样
    const sampleRate = globalLogConfig.event.sampleRate;
    if (sampleRate < 1) {
      if (Math.random() > sampleRate) {return;}
    }

    const serializedData = this.#serializeForMessage(data);
    this.info(`Event [${eventName}]: ${action} ${serializedData}`);
  }

  #serializeForMessage(obj) {
    if (obj === null || obj === undefined) {
      return String(obj);
    }

    if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") {
      return String(obj);
    }

    if (typeof obj === "object") {
      try {
        return this.#safeStringify(obj, 3);
      } catch (e) {
        return `[Object: ${e.message}]`;
      }
    }

    return String(obj);
  }

  #safeStringify(obj, maxDepth = 3, indent = (globalLogConfig.event.pretty ? 2 : 0)) {
    const seen = new WeakSet();

    const replacer = (key, value) => {
      if (key.startsWith("_") || key.startsWith("#")) {
        return "[Internal Property]";
      }

      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message
        };
      }

      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return "[Circular Reference]";
        }
        seen.add(value);
      }

      return value;
    };

    try {
      let result = JSON.stringify(obj, replacer, indent);
      const maxLen = globalLogConfig.event.maxJsonLength;
      if (typeof maxLen === "number" && maxLen > 0 && result.length > maxLen) {
        result = result.slice(0, maxLen) + ` ... [truncated, total ${result.length} chars]`;
      }
      return result;
    } catch (e) {
      return `[Serialization Error: ${e.message}]`;
    }
  }
}

/**
 * Logger 实例缓存，用于确保同一模块名只创建一个 logger 实例
 */
const loggerInstances = new Map();

/**
 * 获取或创建指定模块名的 Logger 实例
 * @param {string} moduleName - 模块名称
 * @param {LogLevel} [initialLogLevel=LogLevel.INFO] - 初始日志级别
 * @returns {Logger} Logger 实例
 */
export function getLogger(moduleName, initialLogLevel = LogLevel.INFO) {
  if (!loggerInstances.has(moduleName)) {
    loggerInstances.set(moduleName, new Logger(moduleName, initialLogLevel));
  }
  return loggerInstances.get(moduleName);
}

/**
 * 设置全局 WebSocket 客户端（用于向后端发送日志）
 * 注意：由于我们已经重构为独立分层日志系统，此函数保留但不实际使用
 * @param {Object} wsClient - WebSocket 客户端实例
 */
export function setGlobalWebSocketClient(wsClient) {
  // 保留接口兼容性，但不实际使用
  try {
    void wsClient;
    console.info("[Logger] setGlobalWebSocketClient called but not used in new architecture");
  } catch (e) {
    void e;
  }
}
// ================================
// 运行时配置与治理能力（新增）
// ================================

const levelOrder = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];

const globalLogConfig = {
  globalLevel: null, // 若为 null 则不覆盖实例级别
  perModuleLevel: new Map(),
  enableRateLimit: true,
  rateLimit: { messages: 120, intervalMs: 1000 }, // 每模块/级别每秒120条
  dedupWindowMs: 500, // 同签名消息在500ms内折叠
  event: {
    sampleRate: 1.0, // 事件日志采样率（0~1）
    maxJsonLength: 800, // 事件JSON最大长度
    pretty: true // 是否使用缩进美化
  },
  // 全局Toast开关配置
  autoToast: {
    enabled: false,        // 是否启用全局toast
    levels: [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO],  // 哪些级别自动显示toast（不包括debug）
    defaultMs: null,       // 默认显示时长（null表示使用级别默认值）
    excludeModules: [],    // 排除的模块列表
  },
  // 内部：速率窗口状态
  _rateState: new Map(),
};

function getEffectiveLogLevel(moduleName, instanceLevel) {
  const per = globalLogConfig.perModuleLevel.get(moduleName);
  const lvl = per ?? globalLogConfig.globalLevel ?? instanceLevel;
  return lvl;
}

function shouldRateLimit(moduleName, level) {
  if (!globalLogConfig.enableRateLimit) {return false;}
  const key = moduleName + "|" + level;
  const now = Date.now();
  let state = globalLogConfig._rateState.get(key);
  if (!state) {
    state = { windowStart: now, count: 0, dropped: 0, timer: null };
    globalLogConfig._rateState.set(key, state);
  }
  const { messages, intervalMs } = globalLogConfig.rateLimit;
  if (now - state.windowStart >= intervalMs) {
    // 窗口滚动，若存在丢弃，输出一次汇总
    if (state.dropped > 0) {
      const warnMethod = console.warn || console.log;
      warnMethod(`[${moduleName}] [WARN]`, `在 ${intervalMs}ms 窗口抑制 ${state.dropped} 条 [${level}] 日志`);
    }
    state.windowStart = now;
    state.count = 0;
    state.dropped = 0;
  }
  state.count++;
  if (state.count > messages) {
    state.dropped++;
    return true; // 抑制该条
  }
  return false;
}

function buildSignature(level, message, args) {
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

/**
 * 启用全局Toast自动显示
 * @param {Object} options - 配置选项
 * @param {Array<string>} [options.levels] - 要显示toast的日志级别数组
 * @param {number} [options.defaultMs] - 默认显示时长（毫秒）
 * @param {Array<string>} [options.excludeModules] - 排除的模块名列表
 */
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

  // 持久化到localStorage
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
  } catch (e) {
    // 忽略localStorage错误
  }

  console.info("[Logger] 全局Toast已启用", {
    levels: globalLogConfig.autoToast.levels,
    defaultMs: globalLogConfig.autoToast.defaultMs,
    excludeModules: globalLogConfig.autoToast.excludeModules
  });
}

/**
 * 禁用全局Toast自动显示
 */
export function disableAutoToast() {
  globalLogConfig.autoToast.enabled = false;

  // 从localStorage移除
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem("LOG_AUTO_TOAST_ENABLED");
    }
  } catch (e) {
    // 忽略localStorage错误
  }

  console.info("[Logger] 全局Toast已禁用");
}

/**
 * 设置自动Toast的级别
 * @param {Array<string>} levels - 日志级别数组
 */
export function setAutoToastLevels(levels) {
  if (Array.isArray(levels)) {
    globalLogConfig.autoToast.levels = levels.filter(l => levelOrder.includes(l));

    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("LOG_AUTO_TOAST_LEVELS", globalLogConfig.autoToast.levels.join(","));
      }
    } catch (e) {
      // 忽略localStorage错误
    }

    console.info("[Logger] 自动Toast级别已更新:", globalLogConfig.autoToast.levels);
  }
}

/**
 * 获取当前全局Toast配置
 * @returns {Object} 当前配置
 */
export function getAutoToastConfig() {
  return {
    enabled: globalLogConfig.autoToast.enabled,
    levels: [...globalLogConfig.autoToast.levels],
    defaultMs: globalLogConfig.autoToast.defaultMs,
    excludeModules: [...globalLogConfig.autoToast.excludeModules]
  };
}

// 启动时从环境/本地存储加载覆盖
try {
  const isProd = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.PROD) ||
                 (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "production");
  if (isProd) {
    // 生产默认更"安静"
    if (!globalLogConfig.globalLevel) {globalLogConfig.globalLevel = LogLevel.WARN;}
    globalLogConfig.event.pretty = false;
    globalLogConfig.event.sampleRate = 0.2; // 事件日志采样 20%
  }
  if (typeof window !== "undefined" && window.localStorage) {
    const lv = window.localStorage.getItem("LOG_LEVEL");
    if (lv && levelOrder.includes(lv)) {
      globalLogConfig.globalLevel = lv;
    }
    const rate = window.localStorage.getItem("LOG_EVENT_SAMPLE_RATE");
    if (rate) {
      const r = parseFloat(rate);
      if (!Number.isNaN(r) && r >= 0 && r <= 1) {globalLogConfig.event.sampleRate = r;}
    }
    const rl = window.localStorage.getItem("LOG_RATE_LIMIT"); // 例如: "100,1000"
    if (rl && typeof rl === "string" && rl.includes(",")) {
      const parts = rl.split(",");
      const m = parseInt(parts[0]);
      const ms = parseInt(parts[1]);
      if (!Number.isNaN(m) && m > 0) {globalLogConfig.rateLimit.messages = m;}
      if (!Number.isNaN(ms) && ms > 0) {globalLogConfig.rateLimit.intervalMs = ms;}
    }
    const dd = window.localStorage.getItem("LOG_DEDUP_WINDOW_MS");
    if (dd) {
      const v = parseInt(dd);
      if (!Number.isNaN(v) && v >= 0) {globalLogConfig.dedupWindowMs = v;}
    }
    const mj = window.localStorage.getItem("LOG_EVENT_MAX_JSON");
    if (mj) {
      const v = parseInt(mj);
      if (!Number.isNaN(v) && v >= 0) {globalLogConfig.event.maxJsonLength = v;}
    }
    const pp = window.localStorage.getItem("LOG_EVENT_PRETTY");
    if (pp === "true" || pp === "false") {
      globalLogConfig.event.pretty = (pp === "true");
    }

    // 加载全局Toast配置
    const autoToastEnabled = window.localStorage.getItem("LOG_AUTO_TOAST_ENABLED");
    if (autoToastEnabled === "true") {
      globalLogConfig.autoToast.enabled = true;

      const autoToastLevels = window.localStorage.getItem("LOG_AUTO_TOAST_LEVELS");
      if (autoToastLevels) {
        const levels = autoToastLevels.split(",").filter(l => levelOrder.includes(l));
        if (levels.length > 0) {
          globalLogConfig.autoToast.levels = levels;
        }
      }

      const autoToastMs = window.localStorage.getItem("LOG_AUTO_TOAST_MS");
      if (autoToastMs) {
        const ms = parseInt(autoToastMs);
        if (!Number.isNaN(ms) && ms > 0) {
          globalLogConfig.autoToast.defaultMs = ms;
        }
      }

      const autoToastExclude = window.localStorage.getItem("LOG_AUTO_TOAST_EXCLUDE");
      if (autoToastExclude) {
        globalLogConfig.autoToast.excludeModules = autoToastExclude.split(",").filter(m => m.length > 0);
      }
    }
  }
} catch (e) {
  // 忽略环境检测错误
}

// 在开发环境下暴露到window对象，方便调试
try {
  if (typeof window !== "undefined") {
    const isDev = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV) ||
                  (typeof process !== "undefined" && process.env && process.env.NODE_ENV !== "production");

    if (isDev || typeof window.__LOGGER_DEBUG__ !== "undefined") {
      window.enableAutoToast = enableAutoToast;
      window.disableAutoToast = disableAutoToast;
      window.setAutoToastLevels = setAutoToastLevels;
      window.getAutoToastConfig = getAutoToastConfig;
      window.getLogger = getLogger;
      window.setGlobalLogLevel = setGlobalLogLevel;
      window.LogLevel = LogLevel;

      console.info("[Logger] 调试函数已暴露到 window 对象:", {
        functions: [
          "enableAutoToast(options)",
          "disableAutoToast()",
          "setAutoToastLevels(levels)",
          "getAutoToastConfig()",
          "getLogger(moduleName)",
          "setGlobalLogLevel(level)",
          "LogLevel"
        ]
      });
    }
  }
} catch (e) {
  // 忽略暴露错误
}

export default Logger;
