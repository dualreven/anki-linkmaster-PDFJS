import { showError } from "./notification.js";
import { getLogger } from "./logger.js";

/**
 * @file 统一的领域错误提示工具
 * @description
 * - 功能：在前端给用户展示“业务/领域错误”提示，同时按需记录日志；
 * - 目标：替代各模块内自行实现的 showError 包装，统一错误提示行为。
 */

const fallbackLogger = (() => {
  try { return getLogger("DomainErrorNotifier"); }
  catch { return { error() {}, warn() {} }; }
})();

/**
 * 领域错误提示（统一入口）
 *
 * @param {Object} options
 * @param {string} options.message   - 面向用户的错误文案（必填）
 * @param {Object} [options.logger]  - 所在模块的 logger（可选）
 * @param {Error|Object} [options.error] - 原始错误对象或调试信息（可选）
 * @param {string} [options.scope]   - 作用域标识，如 "pdf-home:search"（可选）
 * @param {number} [options.durationMs=5000] - toast 展示时长（毫秒）
 */
export function notifyDomainError(options) {
  const { message, logger, error, scope, durationMs } = options || {};

  if (!message || typeof message !== "string") {
    throw new Error("[notifyDomainError] message 必须是非空字符串");
  }

  const text = message;
  const ms = typeof durationMs === "number" ? durationMs : 5000;
  const log = logger || fallbackLogger;

  // 1) 面向用户的统一错误提示（toast）
  try {
    showError(text, ms);
  } catch (e) {
    try { log.warn?.("[notifyDomainError] showError 调用失败，将仅记录日志", e); } catch { /* no-op */ }
  }

  // 2) 记录日志，便于排查
  try {
    const payload = {};
    if (scope) { payload.scope = scope; }
    if (error) { payload.error = error; }
    log.error?.("[DomainError]", text, payload);
  } catch { /* no-op */ }
}

