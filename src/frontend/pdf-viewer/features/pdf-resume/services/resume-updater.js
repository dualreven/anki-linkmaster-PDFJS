/**
 * @file Resume 更新服务
 * @module pdf-resume/services/resume-updater
 * @description 将 Resume 更新发送到后端。
 */

import { getLogger } from "../../../../common/utils/logger.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../../common/event/event-constants.js";
import { measureYPercent } from "../../../../common/utils/pdf-page-detection-utils.js";
import { scrollModeToString, spreadModeToString } from "../utils/view-mode-converter.js";
import { tryCaptureViewStateFromContainer } from "../utils/view-state-capturer.js";

const logger = getLogger("resume-updater");

/**
 * 生成唯一请求 ID
 * @returns {string}
 */
function generateRequestId() {
  return "rid_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * 构建 Resume 更新 payload
 *
 * @param {Object} params - 参数
 * @param {number} params.pageNumber - 页码
 * @param {HTMLElement} [params.container] - viewerContainer（用于计算 y_percent）
 * @param {Object} [params.viewState] - 视图状态 { zoom, scrollMode, spreadMode, rotation }
 * @returns {Object} Resume payload
 * @throws {Error} 当 pageNumber 无效时抛出
 */
export function buildResumePayload({ pageNumber, container, viewState }) {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new Error(`[resume-updater] invalid pageNumber: ${pageNumber}`);
  }

  const resume = {
    page: pageNumber,
    updated_at: Date.now()
  };

  // 计算 y_percent
  if (container) {
    try {
      const yPercent = measureYPercent(container, pageNumber);
      if (yPercent !== null && Number.isFinite(yPercent)) {
        resume.y_percent = Math.max(0, Math.min(100, yPercent));
      }
    } catch (e) {
      logger.warn("[resume-updater] failed to measure y_percent", e);
    }
  }

  // 添加视图状态
  if (viewState) {
    // zoom
    if (typeof viewState.zoom === "number" && Number.isFinite(viewState.zoom) && viewState.zoom > 0) {
      resume.zoom = viewState.zoom;
    }

    // scroll_mode
    if (viewState.scrollMode !== null && viewState.scrollMode !== undefined) {
      try {
        resume.scroll_mode = scrollModeToString(viewState.scrollMode);
      } catch (e) {
        logger.warn("[resume-updater] failed to convert scrollMode", e);
      }
    }

    // spread_mode
    if (viewState.spreadMode !== null && viewState.spreadMode !== undefined) {
      try {
        resume.spread_mode = spreadModeToString(viewState.spreadMode);
      } catch (e) {
        logger.warn("[resume-updater] failed to convert spreadMode", e);
      }
    }

    // rotation
    if (viewState.rotation !== null && viewState.rotation !== undefined) {
      if (Number.isInteger(viewState.rotation)) {
        resume.rotation = viewState.rotation;
      }
    }
  }

  return resume;
}

/**
 * 发送 Resume 更新到后端
 *
 * @param {Object} eventBus - 事件总线实例
 * @param {string} pdfId - PDF 标识符
 * @param {Object} resume - Resume payload
 * @throws {Error} 当参数无效时抛出
 *
 * @example
 * sendResumeUpdate(eventBus, 'abc123', { page: 5, y_percent: 30 });
 */
export function sendResumeUpdate(eventBus, pdfId, resume) {
  if (!eventBus || typeof eventBus.emit !== "function") {
    throw new Error("[resume-updater] eventBus is required and must have emit method");
  }
  if (!pdfId || typeof pdfId !== "string") {
    throw new Error("[resume-updater] pdfId is required and must be a non-empty string");
  }
  if (!resume || typeof resume !== "object") {
    throw new Error("[resume-updater] resume is required and must be an object");
  }

  const requestId = generateRequestId();

  const message = {
    type: WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_REQUESTED,
    request_id: requestId,
    data: {
      file_id: pdfId,
      updates: {
        visited_at: resume.updated_at || Date.now(),
        json_data: { resume }
      }
    }
  };

  logger.info("[resume-updater] sending update", { pdfId, resume });

  eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, message, { actorId: "resume-updater" });
}

/**
 * Resume 更新器类 - 封装更新逻辑和依赖
 */
export class ResumeUpdater {
  #eventBus;
  #diContainer;
  #pdfId;
  #latestPage = null;
  #latestZoom = null;

  /**
   * @param {Object} options - 配置选项
   * @param {Object} options.eventBus - 事件总线
   * @param {Object} options.container - DI 容器
   * @param {string} options.pdfId - PDF 标识符
   */
  constructor({ eventBus, container, pdfId }) {
    if (!eventBus) {
      throw new Error("[ResumeUpdater] eventBus is required");
    }
    if (!pdfId) {
      throw new Error("[ResumeUpdater] pdfId is required");
    }

    this.#eventBus = eventBus;
    this.#diContainer = container;
    this.#pdfId = pdfId;
  }

  /**
   * 更新最新页码
   * @param {number} pageNumber
   */
  setPage(pageNumber) {
    if (Number.isInteger(pageNumber) && pageNumber > 0) {
      this.#latestPage = pageNumber;
    }
  }

  /**
   * 更新最新缩放
   * @param {number} zoom
   */
  setZoom(zoom) {
    if (typeof zoom === "number" && Number.isFinite(zoom) && zoom > 0) {
      this.#latestZoom = zoom;
    }
  }

  /**
   * 获取 viewerContainer 元素
   * @returns {HTMLElement|null}
   */
  #getViewerContainer() {
    try {
      return document.getElementById("viewerContainer");
    } catch {
      return null;
    }
  }

  /**
   * 执行更新（发送到后端）
   * @throws {Error} 当无法确定 pageNumber 时抛出
   */
  flush() {
    let pageNumber = this.#latestPage;

    // 尝试从 pdfViewerManager 获取当前页码
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      try {
        const mgr = this.#diContainer?.get?.("pdfViewerManager");
        const current = mgr?.currentPageNumber;
        if (Number.isInteger(current) && current > 0) {
          pageNumber = current;
        }
      } catch (e) {
        logger.error("[ResumeUpdater] failed to read currentPageNumber", e);
        throw e;
      }
    }

    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      throw new Error(`[ResumeUpdater] invalid pageNumber: ${pageNumber}`);
    }

    const viewerContainer = this.#getViewerContainer();
    const viewState = tryCaptureViewStateFromContainer(this.#diContainer);

    // 如果有手动设置的 zoom，优先使用
    if (this.#latestZoom !== null) {
      viewState.zoom = this.#latestZoom;
    }

    const resume = buildResumePayload({
      pageNumber,
      container: viewerContainer,
      viewState
    });

    sendResumeUpdate(this.#eventBus, this.#pdfId, resume);
  }

  /**
   * 同步刷新（用于 beforeunload）
   */
  flushSync() {
    try {
      this.flush();
    } catch (e) {
      logger.error("[ResumeUpdater] flushSync failed", e);
      // beforeunload 场景不抛出，仅记录日志
    }
  }
}
