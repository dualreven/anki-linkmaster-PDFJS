/**
 * @file 视图模式转换器
 * @module pdf-resume/utils/view-mode-converter
 * @description 提供 ScrollMode/SpreadMode 数值与字符串之间的双向转换。
 */

import {
  SCROLL_MODE,
  SCROLL_MODE_NAMES,
  SPREAD_MODE,
  SPREAD_MODE_NAMES
} from "../constants.js";

/**
 * 将 ScrollMode 数值转换为字符串名称
 * @param {number} mode - ScrollMode 数值（0-3）
 * @returns {string} 字符串名称（'vertical'/'horizontal'/'wrapped'/'page'）
 * @throws {Error} 当 mode 不是有效的 ScrollMode 时抛出
 */
export function scrollModeToString(mode) {
  if (!Number.isInteger(mode)) {
    throw new Error(`[view-mode-converter] invalid scrollMode value: ${mode}, expected integer`);
  }
  const name = SCROLL_MODE_NAMES[mode];
  if (name === undefined) {
    throw new Error(`[view-mode-converter] unsupported scrollMode value: ${mode}, valid values are 0-3`);
  }
  return name;
}

/**
 * 将字符串名称转换为 ScrollMode 数值
 * @param {string} name - 字符串名称（'vertical'/'horizontal'/'wrapped'/'page'）
 * @returns {number} ScrollMode 数值（0-3）
 * @throws {Error} 当 name 不是有效的 ScrollMode 名称时抛出
 */
export function scrollModeFromString(name) {
  if (typeof name !== "string") {
    throw new Error(`[view-mode-converter] scroll_mode must be a string, got: ${typeof name}`);
  }
  const normalized = name.toLowerCase().trim();
  switch (normalized) {
  case "vertical":
    return SCROLL_MODE.VERTICAL;
  case "horizontal":
    return SCROLL_MODE.HORIZONTAL;
  case "wrapped":
    return SCROLL_MODE.WRAPPED;
  case "page":
    return SCROLL_MODE.PAGE;
  default:
    throw new Error(`[view-mode-converter] unsupported scroll_mode: "${name}", valid values are: vertical, horizontal, wrapped, page`);
  }
}

/**
 * 将 SpreadMode 数值转换为字符串名称
 * @param {number} mode - SpreadMode 数值（0-2）
 * @returns {string} 字符串名称（'none'/'odd'/'even'）
 * @throws {Error} 当 mode 不是有效的 SpreadMode 时抛出
 */
export function spreadModeToString(mode) {
  if (!Number.isInteger(mode)) {
    throw new Error(`[view-mode-converter] invalid spreadMode value: ${mode}, expected integer`);
  }
  const name = SPREAD_MODE_NAMES[mode];
  if (name === undefined) {
    throw new Error(`[view-mode-converter] unsupported spreadMode value: ${mode}, valid values are 0-2`);
  }
  return name;
}

/**
 * 将字符串名称转换为 SpreadMode 数值
 * @param {string} name - 字符串名称（'none'/'odd'/'even'）
 * @returns {number} SpreadMode 数值（0-2）
 * @throws {Error} 当 name 不是有效的 SpreadMode 名称时抛出
 */
export function spreadModeFromString(name) {
  if (typeof name !== "string") {
    throw new Error(`[view-mode-converter] spread_mode must be a string, got: ${typeof name}`);
  }
  const normalized = name.toLowerCase().trim();
  switch (normalized) {
  case "none":
    return SPREAD_MODE.NONE;
  case "odd":
    return SPREAD_MODE.ODD;
  case "even":
    return SPREAD_MODE.EVEN;
  default:
    throw new Error(`[view-mode-converter] unsupported spread_mode: "${name}", valid values are: none, odd, even`);
  }
}

/**
 * 检查 ScrollMode 数值是否有效
 * @param {number} mode - ScrollMode 数值
 * @returns {boolean}
 */
export function isValidScrollMode(mode) {
  return Number.isInteger(mode) && SCROLL_MODE_NAMES[mode] !== undefined;
}

/**
 * 检查 SpreadMode 数值是否有效
 * @param {number} mode - SpreadMode 数值
 * @returns {boolean}
 */
export function isValidSpreadMode(mode) {
  return Number.isInteger(mode) && SPREAD_MODE_NAMES[mode] !== undefined;
}
