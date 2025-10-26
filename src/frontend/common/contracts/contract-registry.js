/**
 * @file 事件负载契约注册表（轻量样板）
 * @module ContractRegistry
 * @description
 * 提供事件 → 校验函数 的映射。为最小试点而设：
 * - 若找不到校验器，则认为“无需校验”，返回 valid=true；
 * - 校验器仅在开发/测试环境启用，生产可采样启用。
 *
 * 说明：为避免额外依赖（如 Ajv），此处以手写校验器为主。
 * 后续可无缝替换为 Ajv 驱动的 JSON Schema 校验。
 */

import { PDF_VIEWER_EVENTS } from "../event/pdf-viewer-constants.js";

/**
 * 校验：对象且必含非空字符串字段
 * @param {any} data
 * @param {string} field
 * @returns {{valid:boolean, errors?:any}}
 */
function requireStringField(data, field) {
  if (!data || typeof data !== "object") {
    return { valid: false, errors: { message: "payload 必须是对象" } };
  }
  if (typeof data[field] !== "string" || data[field].trim() === "") {
    return { valid: false, errors: { message: `payload.${field} 必须是非空字符串` } };
  }
  return { valid: true };
}

/**
 * 默认注册的样板校验器
 * @returns {(event:string, data:any)=>({valid:boolean, errors?:any})}
 */
export function createDefaultValidator() {
  /** @type {Record<string,(data:any)=>({valid:boolean, errors?:any})>} */
  const validators = Object.create(null);

  // 书签按ID导航（UI 或 URL 分发触发）
  validators[PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE_BY_ID.REQUESTED] = (data) =>
    requireStringField(data, "outlineItemId");

  // 其他事件：未登记即跳过校验（valid=true）
  return function validate(event, data) {
    const fn = validators[event];
    if (typeof fn === "function") {
      return fn(data);
    }
    return { valid: true };
  };
}

/**
 * 工具：通过自定义映射创建校验器
 * @param {Record<string,(data:any)=>({valid:boolean, errors?:any})>} map
 */
export function createValidatorFromMap(map) {
  return function validate(event, data) {
    const fn = map?.[event];
    if (typeof fn === "function") { return fn(data); }
    return { valid: true };
  };
}

