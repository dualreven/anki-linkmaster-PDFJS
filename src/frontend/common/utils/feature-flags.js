/**
 * @file 运行时特性开关工具
 * @module common/utils/feature-flags
 * 说明：
 * - 仅做“读取”与“轻量判断”，不引入复杂依赖；
 * - 支持 URL 参数与 localStorage（优先 URL）；
 * - 返回 boolean，默认 false。
 */

/**
 * 从 URL 参数读取布尔开关
 * @param {string|string[]} keys - 参数名或别名数组（按顺序优先）
 * @returns {boolean}
 */
export function readBoolFromUrl(keys) {
  try {
    const params = new URLSearchParams(window.location.search);
    const names = Array.isArray(keys) ? keys : [keys];
    for (const k of names) {
      if (params.has(k)) {
        const v = String(params.get(k) || '').toLowerCase();
        if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
        if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
        // 存在但为空，视为启用
        if (v === '') return true;
      }
    }
  } catch (_) {}
  return false;
}

/**
 * 从 localStorage 读取布尔开关
 * @param {string|string[]} keys - 键或别名数组（按顺序优先）
 * @returns {boolean}
 */
export function readBoolFromLocalStorage(keys) {
  try {
    const names = Array.isArray(keys) ? keys : [keys];
    for (const k of names) {
      if (Object.prototype.hasOwnProperty.call(window.localStorage, k)) {
        const v = String(window.localStorage.getItem(k) || '').toLowerCase();
        if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
        if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
        // 存在但空字符串，视为启用
        if (v === '') return true;
      }
    }
  } catch (_) {}
  return false;
}

/**
 * 判断是否启用 Outline（大纲新实现）
 * 优先级：URL 参数 > localStorage；默认 false
 * URL 参数：?outline=1 | ?feature_outline=1
 * localStorage：FEATURE_OUTLINE=1|true
 * @returns {boolean}
 */
export function isOutlineEnabled() {
  const url = readBoolFromUrl(['outline', 'feature_outline']);
  if (url) return true;
  const ls = readBoolFromLocalStorage(['FEATURE_OUTLINE']);
  return !!ls;
}

export default { isOutlineEnabled, readBoolFromUrl, readBoolFromLocalStorage };

