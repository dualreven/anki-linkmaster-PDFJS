/**
 * @file Trace-safe serialization helpers
 * @description
 * 用于 tracing/日志链路的安全序列化：
 * - 任何序列化失败都必须 Fail-Closed 到占位字符串，禁止影响业务回调执行。
 * - 保持截断策略，避免日志/trace 过大。
 */

function truncate(text, maxLength) {
  if (typeof text !== "string") {
    throw new Error("[trace-safe-serialize] truncate: text must be a string");
  }
  if (typeof maxLength !== "number" || !Number.isFinite(maxLength) || maxLength <= 0) {
    throw new Error("[trace-safe-serialize] truncate: maxLength must be a positive number");
  }
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function createCircularReplacer() {
  const seen = new WeakSet();
  return function replacer(_key, value) {
    if (typeof value === "bigint") {
      return `[BigInt:${value.toString()}]`;
    }
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular]";
      }
      seen.add(value);
    }
    return value;
  };
}

/**
 * 将任意 payload 安全序列化为字符串（用于 tracing/messageTrace.data 等）。
 * 失败时返回占位字符串，且绝不抛出异常。
 *
 * @param {any} value
 * @param {{ maxLength?: number }} [options]
 * @returns {string}
 */
export function safeSerializeForTrace(value, options = {}) {
  const maxLength = options.maxLength ?? 500;
  try {
    const text = JSON.stringify(value, createCircularReplacer());
    return truncate(text, maxLength);
  } catch (e) {
    const msg = e?.message ? String(e.message) : String(e);
    return truncate(`[Unserializable payload: ${msg}]`, maxLength);
  }
}

