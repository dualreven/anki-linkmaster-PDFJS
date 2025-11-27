/**
 * @file Resume 数据校验器
 * @module pdf-resume/utils/resume-validator
 * @description 提供 Resume 对象的严格校验和规范化功能。
 */

import { VALID_ROTATIONS } from "../constants.js";

/**
 * Resume 规范化结果
 * @typedef {Object} NormalizedResume
 * @property {number} page - 页码（1-based，必须）
 * @property {number} [y_percent] - Y 百分比位置（0-100）
 * @property {number} [zoom] - 缩放比例（正数）
 * @property {string} [scroll_mode] - 滚动模式名称
 * @property {string} [spread_mode] - 跨页模式名称
 * @property {number} [rotation] - 旋转角度（0/90/180/270）
 * @property {number} [updated_at] - 更新时间戳
 */

/**
 * 校验并规范化 Resume 对象
 *
 * @param {Object} obj - 待校验的 Resume 对象
 * @returns {NormalizedResume|null} 规范化后的 Resume 对象，或 null（当 obj 为空或不包含有效 page）
 * @throws {Error} 当字段值非法时抛出（Fail-Fast）
 *
 * @example
 * const resume = validateResume({ page: 5, y_percent: 30.5, zoom: 1.5 });
 * // => { page: 5, y_percent: 30.5, zoom: 1.5 }
 *
 * validateResume({ page: 5, y_percent: -10 });
 * // => throws Error: invalid y_percent: -10
 */
export function validateResume(obj) {
  // 空值或非对象：返回 null（无 resume）
  if (!obj || typeof obj !== "object") {
    return null;
  }

  // 必填字段：page
  const page = obj.page;
  if (!Number.isInteger(page) || page < 1) {
    // 无有效 page 视为无 resume
    return null;
  }

  const normalized = { page };

  // 可选字段：y_percent
  if (obj.y_percent !== undefined) {
    const y = obj.y_percent;
    if (typeof y !== "number" || !Number.isFinite(y) || y < 0 || y > 100) {
      throw new Error(`[resume-validator] invalid y_percent: ${y}, expected number in range [0, 100]`);
    }
    normalized.y_percent = y;
  }

  // 可选字段：zoom
  if (obj.zoom !== undefined) {
    const zoom = obj.zoom;
    if (typeof zoom !== "number" || !Number.isFinite(zoom) || zoom <= 0) {
      throw new Error(`[resume-validator] invalid zoom: ${zoom}, expected positive number`);
    }
    normalized.zoom = zoom;
  }

  // 可选字段：rotation
  if (obj.rotation !== undefined) {
    const rotation = obj.rotation;
    if (!Number.isInteger(rotation) || !VALID_ROTATIONS.includes(rotation)) {
      throw new Error(`[resume-validator] invalid rotation: ${rotation}, expected one of ${VALID_ROTATIONS.join("/")}`);
    }
    normalized.rotation = rotation;
  }

  // 可选字段：scroll_mode（字符串类型，具体值在应用阶段校验）
  if (obj.scroll_mode !== undefined) {
    if (typeof obj.scroll_mode !== "string") {
      throw new Error(`[resume-validator] invalid scroll_mode: ${obj.scroll_mode}, expected string`);
    }
    normalized.scroll_mode = obj.scroll_mode;
  }

  // 可选字段：spread_mode（字符串类型，具体值在应用阶段校验）
  if (obj.spread_mode !== undefined) {
    if (typeof obj.spread_mode !== "string") {
      throw new Error(`[resume-validator] invalid spread_mode: ${obj.spread_mode}, expected string`);
    }
    normalized.spread_mode = obj.spread_mode;
  }

  // 可选字段：updated_at
  if (obj.updated_at !== undefined) {
    const ts = obj.updated_at;
    if (!Number.isInteger(ts) || ts < 0) {
      throw new Error(`[resume-validator] invalid updated_at: ${ts}, expected non-negative integer timestamp`);
    }
    normalized.updated_at = ts;
  }

  return normalized;
}

/**
 * 检查 Resume 对象是否有效（不抛错，仅返回布尔值）
 * @param {Object} obj - 待检查的 Resume 对象
 * @returns {boolean}
 */
export function isValidResume(obj) {
  try {
    const result = validateResume(obj);
    return result !== null;
  } catch {
    return false;
  }
}
