/**
 * @file 视图状态捕获器
 * @module pdf-resume/utils/view-state-capturer
 * @description 从 pdfViewerManager 捕获当前视图状态（缩放/布局/旋转）。
 */

import { getLogger } from "../../../../common/utils/logger.js";
import { isValidScrollMode, isValidSpreadMode } from "./view-mode-converter.js";

const logger = getLogger("view-state-capturer");

/**
 * 捕获的视图状态
 * @typedef {Object} CapturedViewState
 * @property {number|null} zoom - 当前缩放比例
 * @property {number|null} scrollMode - 当前滚动模式（0-3）
 * @property {number|null} spreadMode - 当前跨页模式（0-2）
 * @property {number|null} rotation - 当前旋转角度
 */

/**
 * 从 pdfViewerManager 捕获当前视图状态
 *
 * @param {Object} pdfViewerManager - PDF 查看器管理器实例
 * @returns {CapturedViewState} 捕获的视图状态（无法读取的字段为 null）
 * @throws {Error} 当 pdfViewerManager 无效时抛出
 *
 * @example
 * const mgr = container.get("pdfViewerManager");
 * const state = captureViewState(mgr);
 * // => { zoom: 1.5, scrollMode: 0, spreadMode: 0, rotation: 0 }
 */
export function captureViewState(pdfViewerManager) {
  if (!pdfViewerManager || typeof pdfViewerManager !== "object") {
    throw new Error("[view-state-capturer] pdfViewerManager is required");
  }

  const state = {
    zoom: null,
    scrollMode: null,
    spreadMode: null,
    rotation: null
  };

  // 捕获缩放比例
  try {
    const z = pdfViewerManager.currentScale;
    if (typeof z === "number" && Number.isFinite(z) && z > 0) {
      state.zoom = z;
    }
  } catch (e) {
    logger.warn("[view-state-capturer] failed to read currentScale", e);
  }

  // 捕获滚动模式
  try {
    const sm = pdfViewerManager.scrollMode;
    if (isValidScrollMode(sm)) {
      state.scrollMode = sm;
    }
  } catch (e) {
    logger.warn("[view-state-capturer] failed to read scrollMode", e);
  }

  // 捕获跨页模式
  try {
    const sp = pdfViewerManager.spreadMode;
    if (isValidSpreadMode(sp)) {
      state.spreadMode = sp;
    }
  } catch (e) {
    logger.warn("[view-state-capturer] failed to read spreadMode", e);
  }

  // 捕获旋转角度
  try {
    const rot = pdfViewerManager.pagesRotation;
    if (Number.isInteger(rot)) {
      state.rotation = rot;
    }
  } catch (e) {
    logger.warn("[view-state-capturer] failed to read pagesRotation", e);
  }

  return state;
}

/**
 * 从 DI 容器获取 pdfViewerManager 并捕获视图状态
 *
 * @param {Object} container - DI 容器
 * @returns {CapturedViewState} 捕获的视图状态
 * @throws {Error} 当 container 无效或 pdfViewerManager 不存在时抛出
 */
export function captureViewStateFromContainer(container) {
  if (!container || typeof container.get !== "function") {
    throw new Error("[view-state-capturer] container must have a get() method");
  }

  const pdfViewerManager = container.get("pdfViewerManager");
  if (!pdfViewerManager) {
    throw new Error("[view-state-capturer] pdfViewerManager not found in container");
  }

  return captureViewState(pdfViewerManager);
}

/**
 * 尝试从 DI 容器获取 pdfViewerManager 并捕获视图状态（不抛错版本）
 *
 * @param {Object} container - DI 容器
 * @returns {CapturedViewState} 捕获的视图状态（失败时返回全 null）
 */
export function tryCaptureViewStateFromContainer(container) {
  const defaultState = {
    zoom: null,
    scrollMode: null,
    spreadMode: null,
    rotation: null
  };

  try {
    if (!container || typeof container.get !== "function") {
      return defaultState;
    }

    const pdfViewerManager = container.get("pdfViewerManager");
    if (!pdfViewerManager) {
      return defaultState;
    }

    return captureViewState(pdfViewerManager);
  } catch (e) {
    logger.warn("[view-state-capturer] tryCaptureViewStateFromContainer failed", e);
    return defaultState;
  }
}
