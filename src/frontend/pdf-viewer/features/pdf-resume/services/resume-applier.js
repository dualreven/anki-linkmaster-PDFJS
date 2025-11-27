/**
 * @file Resume 应用服务
 * @module pdf-resume/services/resume-applier
 * @description 应用 Resume 到 PDF 查看器（导航 + 视图状态恢复）。
 */

import { getLogger } from "../../../../common/utils/logger.js";
import { scrollModeFromString, spreadModeFromString } from "../utils/view-mode-converter.js";
import { VALID_ROTATIONS } from "../constants.js";

const logger = getLogger("resume-applier");

/**
 * 应用 Resume 的选项
 * @typedef {Object} ApplyResumeOptions
 * @property {boolean} [skipNavigation=false] - 是否跳过导航（仅恢复视图状态）
 */

/**
 * 应用 Resume 到 PDF 查看器
 *
 * @param {Object} resume - 规范化后的 resume 对象
 * @param {Object} navigationService - 导航服务实例
 * @param {Object} pdfViewerManager - PDF 查看器管理器实例
 * @param {ApplyResumeOptions} [options] - 可选配置
 * @returns {Promise<void>}
 * @throws {Error} 当 resume 无效或依赖缺失时抛出
 *
 * @example
 * await applyResume(resume, navigationService, pdfViewerManager);
 */
export async function applyResume(resume, navigationService, pdfViewerManager, options = {}) {
  if (!resume || typeof resume !== "object") {
    throw new Error("[resume-applier] resume is required");
  }
  if (!Number.isInteger(resume.page) || resume.page < 1) {
    throw new Error(`[resume-applier] invalid resume.page: ${resume.page}`);
  }

  const skipNavigation = options.skipNavigation === true;

  // 1. 先恢复视图状态（缩放/布局/旋转）
  if (pdfViewerManager) {
    applyViewState(resume, pdfViewerManager);
  } else {
    logger.warn("[resume-applier] pdfViewerManager not provided, skipping view state");
  }

  // 2. 执行导航
  if (!skipNavigation) {
    if (!navigationService) {
      throw new Error("[resume-applier] navigationService is required for navigation");
    }

    const position = typeof resume.y_percent === "number" ? resume.y_percent : null;

    logger.info("[resume-applier] navigating to resume position", {
      page: resume.page,
      position
    });

    try {
      await navigationService.navigateTo({
        pageAt: resume.page,
        position
      });
    } catch (e) {
      logger.error("[resume-applier] navigation failed", e);
      throw new Error(`[resume-applier] navigation failed: ${e.message}`);
    }
  }

  logger.info("[resume-applier] resume applied successfully");
}

/**
 * 仅应用视图状态（不导航）
 *
 * @param {Object} resume - 规范化后的 resume 对象
 * @param {Object} pdfViewerManager - PDF 查看器管理器实例
 * @throws {Error} 当 pdfViewerManager 无效时抛出
 */
export function applyViewState(resume, pdfViewerManager) {
  if (!pdfViewerManager || typeof pdfViewerManager !== "object") {
    throw new Error("[resume-applier] pdfViewerManager is required");
  }

  // 缩放
  if (typeof resume.zoom === "number" && Number.isFinite(resume.zoom) && resume.zoom > 0) {
    try {
      pdfViewerManager.currentScale = resume.zoom;
      logger.debug("[resume-applier] applied zoom", { zoom: resume.zoom });
    } catch (e) {
      logger.warn("[resume-applier] failed to apply zoom", e);
    }
  }

  // 滚动模式
  if (typeof resume.scroll_mode === "string") {
    try {
      const scrollValue = scrollModeFromString(resume.scroll_mode);
      pdfViewerManager.scrollMode = scrollValue;
      logger.debug("[resume-applier] applied scrollMode", { scroll_mode: resume.scroll_mode, value: scrollValue });
    } catch (e) {
      logger.warn("[resume-applier] failed to apply scroll_mode", e);
    }
  }

  // 跨页模式
  if (typeof resume.spread_mode === "string") {
    try {
      const spreadValue = spreadModeFromString(resume.spread_mode);
      pdfViewerManager.spreadMode = spreadValue;
      logger.debug("[resume-applier] applied spreadMode", { spread_mode: resume.spread_mode, value: spreadValue });
    } catch (e) {
      logger.warn("[resume-applier] failed to apply spread_mode", e);
    }
  }

  // 旋转
  if (typeof resume.rotation === "number" && Number.isInteger(resume.rotation)) {
    if (VALID_ROTATIONS.includes(resume.rotation)) {
      try {
        pdfViewerManager.pagesRotation = resume.rotation;
        logger.debug("[resume-applier] applied rotation", { rotation: resume.rotation });
      } catch (e) {
        logger.warn("[resume-applier] failed to apply rotation", e);
      }
    } else {
      logger.warn("[resume-applier] invalid rotation value", { rotation: resume.rotation });
    }
  }
}

/**
 * 从 DI 容器获取依赖并应用 Resume
 *
 * @param {Object} resume - 规范化后的 resume 对象
 * @param {Object} container - DI 容器
 * @param {ApplyResumeOptions} [options] - 可选配置
 * @returns {Promise<void>}
 * @throws {Error} 当依赖缺失时抛出
 */
export async function applyResumeFromContainer(resume, container, options = {}) {
  if (!container || typeof container.get !== "function") {
    throw new Error("[resume-applier] container must have a get() method");
  }

  const navigationService = container.get("navigationService");
  const pdfViewerManager = container.get("pdfViewerManager");

  if (!navigationService && !options.skipNavigation) {
    throw new Error("[resume-applier] navigationService not found in container");
  }

  return applyResume(resume, navigationService, pdfViewerManager, options);
}
