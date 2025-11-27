/**
 * @file Resume 加载服务
 * @module pdf-resume/services/resume-loader
 * @description 从后端拉取 PDF resume 数据。
 */

import { getLogger } from "../../../../common/utils/logger.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES, WEBSOCKET_MESSAGE_EVENTS } from "../../../../common/event/event-constants.js";
import { validateResume } from "../utils/resume-validator.js";

const logger = getLogger("resume-loader");

/**
 * 生成唯一请求 ID
 * @returns {string}
 */
function generateRequestId() {
  return "rid_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * 加载结果
 * @typedef {Object} LoadResumeResult
 * @property {Object|null} resume - 规范化后的 resume 对象
 * @property {string} pdfId - PDF ID
 * @property {Object} [rawData] - 原始响应数据
 */

/**
 * 从后端加载 PDF resume
 *
 * @param {Object} eventBus - 事件总线实例
 * @param {string} pdfId - PDF 标识符
 * @param {Object} [options] - 可选配置
 * @param {number} [options.timeoutMs=10000] - 超时时间（毫秒）
 * @returns {Promise<LoadResumeResult>}
 * @throws {Error} 当参数无效或加载失败时抛出
 *
 * @example
 * const result = await loadResume(eventBus, 'abc123');
 * if (result.resume) {
 *   applyResume(result.resume);
 * }
 */
export async function loadResume(eventBus, pdfId, options = {}) {
  if (!eventBus || typeof eventBus.emit !== "function" || typeof eventBus.on !== "function") {
    throw new Error("[resume-loader] eventBus is required and must have emit/on methods");
  }
  if (!pdfId || typeof pdfId !== "string") {
    throw new Error("[resume-loader] pdfId is required and must be a non-empty string");
  }

  const timeoutMs = typeof options.timeoutMs === "number" ? options.timeoutMs : 10000;
  const requestId = generateRequestId();

  return new Promise((resolve, reject) => {
    let unsubscribe = null;
    let timeoutId = null;

    const cleanup = () => {
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch {
          // ignore
        }
        unsubscribe = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    // 设置超时
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`[resume-loader] load timeout after ${timeoutMs}ms for pdfId: ${pdfId}`));
    }, timeoutMs);

    // 监听响应
    unsubscribe = eventBus.on(WEBSOCKET_MESSAGE_EVENTS.RESPONSE, (message) => {
      try {
        if (!message) {
          return;
        }

        const messageType = String(message.type || message.received_type || "");
        const data = message.data || {};
        const messageId = String(data.id || data.pdf_id || "");

        // 检查是否是目标 PDF 的响应
        if (!messageId || messageId !== pdfId) {
          return;
        }

        if (messageType === WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_COMPLETED) {
          cleanup();

          const rawResume = data?.json_data?.resume || null;
          let normalizedResume = null;

          try {
            normalizedResume = validateResume(rawResume);
          } catch (e) {
            // Resume 验证失败，作为加载失败处理
            logger.error("[resume-loader] resume validation failed", e);
            reject(new Error(`[resume-loader] resume validation failed: ${e.message}`));
            return;
          }

          logger.info("[resume-loader] resume loaded", { pdfId, hasResume: !!normalizedResume });

          resolve({
            resume: normalizedResume,
            pdfId,
            rawData: data
          });

        } else if (messageType === WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_FAILED) {
          cleanup();
          const errorMsg = message.error || "unknown error";
          logger.error("[resume-loader] load failed", { pdfId, error: errorMsg });
          reject(new Error(`[resume-loader] load failed for pdfId ${pdfId}: ${errorMsg}`));
        }
      } catch (e) {
        // 处理响应时出错
        cleanup();
        logger.error("[resume-loader] error processing response", e);
        reject(new Error(`[resume-loader] error processing response: ${e.message}`));
      }
    }, { subscriberId: `resume-loader-${requestId}` });

    // 发送请求
    logger.debug("[resume-loader] sending detail request", { pdfId, requestId });

    eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, {
      type: WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_REQUEST,
      request_id: requestId,
      data: { pdf_id: pdfId },
      metadata: { version: "1.0.0" }
    }, { actorId: "resume-loader" });
  });
}

/**
 * 从 URL 解析 PDF ID
 * @returns {string|null}
 */
export function resolvePdfIdFromURL() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("pdf-id") || null;
  } catch {
    return null;
  }
}
