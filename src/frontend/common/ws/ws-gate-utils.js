/**
 * @file 条件 WebSocket 消息 gate 工具
 * @description
 * 统一约束 WS 消息上的 `gate` 字段格式，当前支持：
 * - once: string  等待某“状态型事件”已发生或下一次发生
 * - on:   string  等待某事件的下一次发生（不关心历史）
 * - timeout_ms?: number 可选超时时间（正整数毫秒）
 *
 * 设计原则：
 * - Fail-Fast：非法 gate 必须抛出错误，禁止静默兜底。
 * - 仅做结构校验与规范化，不关心事件语义，由上层 helper 处理。
 */

/**
 * @typedef {Object} WsGateConfig
 * @property {string} [once] - 等待某事件已发生或下一次发生（状态型事件）
 * @property {string} [on] - 等待某事件的下一次发生（动作型事件）
 * @property {number} [timeout_ms] - 超时时间（毫秒，正整数）
 */

/**
 * 校验并规范化 gate 配置对象。
 *
 * @param {unknown} rawGate
 * @returns {WsGateConfig|null} 规范化后的 gate；若未配置 gate（null/undefined/非对象）则返回 null
 * @throws {Error} 当 gate 对象结构不合法时抛出错误
 */
export function validateGateConfig(rawGate) {
  // 未配置 gate：直接视为 null，交由调用方决定是否应用 gating
  if (rawGate === null || rawGate === undefined) {
    return null;
  }

  if (typeof rawGate !== "object") {
    return null;
  }

  const gate = /** @type {Record<string, unknown>} */ (rawGate);
  const result = /** @type {WsGateConfig} */ ({});

  const hasOnce = Object.prototype.hasOwnProperty.call(gate, "once");
  const hasOn = Object.prototype.hasOwnProperty.call(gate, "on");

  if (!hasOnce && !hasOn && !Object.prototype.hasOwnProperty.call(gate, "timeout_ms")) {
    throw new Error("[ws-gate] gate 对象不能为空；至少需要 once 或 on");
  }

  if (hasOnce && hasOn) {
    throw new Error("[ws-gate] gate.once 与 gate.on 互斥，只能配置一个");
  }

  if (hasOnce) {
    const once = gate.once;
    if (typeof once !== "string" || once.trim() === "") {
      throw new Error("[ws-gate] gate.once 必须为非空字符串");
    }
    result.once = once.trim();
  }

  if (hasOn) {
    const on = gate.on;
    if (typeof on !== "string" || on.trim() === "") {
      throw new Error("[ws-gate] gate.on 必须为非空字符串");
    }
    result.on = on.trim();
  }

  if (Object.prototype.hasOwnProperty.call(gate, "timeout_ms")) {
    const timeout = gate.timeout_ms;
    if (timeout === null || timeout === undefined) {
      // 明确传入 null/undefined 视为未配置，不写入 result
    } else if (typeof timeout !== "number" || !Number.isFinite(timeout) || timeout <= 0) {
      throw new Error("[ws-gate] gate.timeout_ms 必须为正数（毫秒）");
    } else {
      result.timeout_ms = Math.floor(timeout);
    }
  }

  if (!result.once && !result.on) {
    throw new Error("[ws-gate] gate 必须包含 once 或 on 其中之一");
  }

  return result;
}

