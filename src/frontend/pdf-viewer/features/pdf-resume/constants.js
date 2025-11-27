/**
 * @file PDF Resume 常量定义
 * @module pdf-resume/constants
 * @description 定义 ScrollMode、SpreadMode 等视图模式枚举和有效旋转角度。
 */

/**
 * 滚动模式枚举（与 PDF.js ScrollMode 对应）
 * @readonly
 * @enum {number}
 */
export const SCROLL_MODE = Object.freeze({
  /** 垂直滚动 */
  VERTICAL: 0,
  /** 水平滚动 */
  HORIZONTAL: 1,
  /** 环绕滚动（多列） */
  WRAPPED: 2,
  /** 单页模式 */
  PAGE: 3
});

/**
 * 滚动模式名称（与数值对应的字符串表示）
 * @readonly
 * @enum {string}
 */
export const SCROLL_MODE_NAMES = Object.freeze({
  [SCROLL_MODE.VERTICAL]: "vertical",
  [SCROLL_MODE.HORIZONTAL]: "horizontal",
  [SCROLL_MODE.WRAPPED]: "wrapped",
  [SCROLL_MODE.PAGE]: "page"
});

/**
 * 跨页模式枚举（与 PDF.js SpreadMode 对应）
 * @readonly
 * @enum {number}
 */
export const SPREAD_MODE = Object.freeze({
  /** 不跨页 */
  NONE: 0,
  /** 奇数页在左 */
  ODD: 1,
  /** 偶数页在左 */
  EVEN: 2
});

/**
 * 跨页模式名称（与数值对应的字符串表示）
 * @readonly
 * @enum {string}
 */
export const SPREAD_MODE_NAMES = Object.freeze({
  [SPREAD_MODE.NONE]: "none",
  [SPREAD_MODE.ODD]: "odd",
  [SPREAD_MODE.EVEN]: "even"
});

/**
 * 有效的旋转角度列表
 * @readonly
 * @type {number[]}
 */
export const VALID_ROTATIONS = Object.freeze([0, 90, 180, 270]);

/**
 * Resume 字段默认值
 * @readonly
 */
export const RESUME_DEFAULTS = Object.freeze({
  PAGE: 1,
  Y_PERCENT: 0,
  ZOOM: 1.0,
  SCROLL_MODE: "vertical",
  SPREAD_MODE: "none",
  ROTATION: 0
});
