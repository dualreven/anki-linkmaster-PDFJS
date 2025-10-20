/**
 * URLJumpDispatcher
 * @module URLJumpDispatcher
 * @description
 * 解耦“参数解析”与“跳转执行”的轻量调度器：
 * - 仅负责根据已解析的参数，按类型发起跳转请求或直接调用导航服务；
 * - 不参与参数解析与构建（交由 URLParamsParser）；
 * - 不参与锚点(anchor-id)的数据加载逻辑（交由 PDFAnchorFeature 处理）；
 * - outline-item-id 当前不触发跳转，仅记录到日志（后续 Outline 暴露统一跳转入口后再接入）。
 */

import { getLogger } from "../../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";

export class URLJumpDispatcher {
  /** @type {import('../../../../common/utils/logger.js').Logger} */
  #logger = getLogger("URLJumpDispatcher");
  /** @type {EventBus} */
  #eventBus;
  /** @type {NavigationService} */
  #navigationService;

  /**
   * @param {Object} deps
   * @param {EventBus} deps.eventBus
   * @param {NavigationService} deps.navigationService
   */
  constructor({ eventBus, navigationService }) {
    this.#eventBus = eventBus;
    this.#navigationService = navigationService;
  }

  /**
   * 基于解析结果尝试执行跳转
   * - 优先级：annotationId > pageAt/position
   * - anchorId 由 PDFAnchorFeature 自行处理（监听 URL_PARAMS.PARSED）
   * - outlineItemId 暂不触发，只记录日志
   *
   * @param {Object} parsed 已解析参数（URLParamsParser.parse 的返回）
   * @param {Object} [opts]
   * @param {boolean} [opts.annotationDataLoaded=false] 标注数据是否就绪（用于 annotationId 跳转的门闸）
   * @returns {Promise<{'type': 'annotation'|'page'|'none', success: boolean, reason?: string}>}
   */
  async tryExecute(parsed, opts = {}) {
    const { annotationDataLoaded = false } = opts;
    const pageAt = parsed?.pageAt ?? null;
    const position = parsed?.position ?? null;
    const annotationId = parsed?.annotationId ?? null;
    const outlineItemId = parsed?.outlineItemId ?? null;
    const anchorId = parsed?.anchorId ?? null;

    this.#logger.info("[dispatcher] 收到解析结果", {
      pageAt, position, annotationId, outlineItemId, anchorId
    });

    // 1) annotationId 优先：需要等待标注数据就绪
    if (annotationId) {
      if (!annotationDataLoaded) {
        this.#logger.info("[dispatcher] 标注数据未就绪，暂不触发 annotation 跳转", { annotationId });
        return { type: "annotation", success: false, reason: "gate:annotationData" };
      }
      this.#logger.info("[dispatcher] 触发 annotation 跳转请求", { annotationId });
      this.#eventBus.emit(
        PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED,
        { id: annotationId },
        { actorId: "URLJumpDispatcher" }
      );
      return { type: "annotation", success: true };
    }

    // 2) outlineItemId：当前不触发，仅记录
    if (outlineItemId) {
      this.#logger.info("[dispatcher] 检测到 outline-item-id，但暂未启用自动跳转", { outlineItemId });
      return { type: "none", success: true };
    }

    // 3) 页面导航（pageAt/position）
    if (pageAt !== null || position !== null) {
      if (pageAt === null) {
        this.#logger.warn("[dispatcher] 缺少 pageAt，按照严格模式拒绝默认到第1页", { pageAt, position });
        return { type: "page", success: false, reason: "missing:pageAt" };
      }
      this.#logger.info("[dispatcher] 执行页面导航", { pageAt, position });
      const result = await this.#navigationService.navigateTo({ pageAt, position });
      return { type: "page", success: !!result?.success, reason: result?.error };
    }

    // 4) 无需跳转
    return { type: "none", success: true };
  }
}

export default URLJumpDispatcher;
