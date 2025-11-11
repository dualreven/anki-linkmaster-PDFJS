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
   * - anchorId：统一发射 ANCHOR.NAVIGATE.REQUESTED
   * - outlineItemId：统一发射 OUTLINE.NAVIGATE_BY_ID.REQUESTED
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
    // 保留“缺失参数 === undefined”的语义，用于决定是否弹 toast（未提供参数则不打扰用户）
    const outlineItemIdRaw = (parsed && Object.prototype.hasOwnProperty.call(parsed, "outlineItemId")) ? parsed.outlineItemId : undefined;
    const outlineItemId = outlineItemIdRaw ?? null;
    const anchorId = parsed?.anchorId ?? null;

    this.#logger.info(`[dispatcher] 收到解析结果: pageAt=${pageAt}, outlineItemId=${outlineItemId}`, { toast: { type: "info", ms: 3000 } });

    const detailMsg = `[URLJumpDispatcher] 检查outlineItemId: ${outlineItemId}, 类型=${typeof outlineItemId}, 是null=${outlineItemId === null}, 是undefined=${outlineItemId === undefined}`;
    // 若 outlineItemId 为 undefined（URL 未提供该参数），则仅记录日志，不弹 toast，避免启动阶段打扰
    if (outlineItemIdRaw === undefined || outlineItemId === null) {
      this.#logger.info(detailMsg);
    } else {
      this.#logger.info(detailMsg, { toast: { type: "error", ms: 5000 } });
    }

    if (parsed) {
      const hasOutlineKey = Object.prototype.hasOwnProperty.call(parsed, "outlineItemId");
      const keysMsg = `[URLJumpDispatcher] parsed keys: ${Object.keys(parsed).join(", ")}, 包含outlineItemId=${hasOutlineKey}`;
      // 仅当明确包含该键时才提示（例如为空字符串/非法值等），否则不弹 toast
      if (hasOutlineKey && outlineItemIdRaw !== undefined && outlineItemId !== null) {
        this.#logger.info(keysMsg, { toast: { type: "warn", ms: 5000 } });
      } else {
        this.#logger.info(keysMsg);
      }
    }

    // 1) annotationId 优先：需要等待标注数据就绪
    if (annotationId) {
      if (!annotationDataLoaded) {
        this.#logger.info("[dispatcher] 标注数据未就绪，暂不触发 annotation 跳转", { annotationId });
        try { this.#logger.error("URL 导航·标注：数据未就绪，稍后再试", { toast: { type: "error", ms: 3000 } }); } catch (e) { /* logger-guard */ void e; }
        return { type: "annotation", success: false, reason: "gate:annotationData" };
      }
      this.#logger.info("[dispatcher] 触发 annotation 跳转请求", { annotationId });
      try { this.#logger.info(`URL 导航·标注：请求跳转 id=${annotationId}`, { toast: { type: "info", ms: 2000 } }); } catch (e) { /* logger-guard */ void e; }
      this.#eventBus.emit(
        PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED,
        { id: annotationId },
        { actorId: "URLJumpDispatcher" }
      );
      return { type: "annotation", success: true };
    }

    // 2) anchorId：交由 AnchorFeature 统一处理
    if (anchorId) {
      this.#logger.info("[dispatcher] 触发 anchor 跳转请求", { anchorId });
      try { this.#logger.info(`URL 导航·锚点：请求跳转 id=${anchorId}`, { toast: { type: "info", ms: 2000 } }); } catch (e) { /* logger-guard */ void e; }
      this.#eventBus.emit(
        PDF_VIEWER_EVENTS.ANCHOR.NAVIGATE.REQUESTED,
        { anchorId },
        { actorId: "URLJumpDispatcher" }
      );
      return { type: "anchor", success: true };
    }

    // 3) outlineItemId：统一走大纲入口
    if (outlineItemId) {
      this.#logger.info("[dispatcher] 触发 outline 跳转请求", { outlineItemId });
      this.#logger.info("[URLJumpDispatcher] 准备发射OUTLINE.NAVIGATE_BY_ID.REQUESTED事件", {
        outlineItemId: outlineItemId,
        eventName: PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE_BY_ID.REQUESTED,
        payload: { outlineItemId }
      }, { toast: { type: "info", ms: 2000 } });
      try { this.#logger.info(`URL 导航·大纲：请求跳转 id=${outlineItemId}`, { toast: { type: "info", ms: 2000 } }); } catch (e) { /* logger-guard */ void e; }
      try {
        this.#eventBus.emitGlobal(
          PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE_BY_ID.REQUESTED,
          { outlineItemId },
          { actorId: "URLJumpDispatcher" }
        );
      } catch {
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE_BY_ID.REQUESTED,
          { outlineItemId },
          { actorId: "URLJumpDispatcher" }
        );
      }
      this.#logger.info("[URLJumpDispatcher] 已发射OUTLINE.NAVIGATE_BY_ID.REQUESTED事件", { outlineItemId }, { toast: { type: "success", ms: 2000 } });
      return { type: "outline", success: true };
    } else {
      const why = outlineItemId === null ? "null" : outlineItemIdRaw === undefined ? "undefined" : "other";
      // 未提供该参数（undefined）或显式为 null 时不弹 toast
      if (outlineItemIdRaw === undefined || outlineItemId === null) {
        this.#logger.info("[URLJumpDispatcher] outlineItemId为空或未定义，跳过 outline 导航", { outlineItemId, why });
      } else {
        this.#logger.info("[URLJumpDispatcher] outlineItemId为空或未定义，跳过 outline 导航", { outlineItemId, why }, { toast: { type: "warn", ms: 3000 } });
      }
    }

    // 4) 页面导航（pageAt/position）
    if (pageAt !== null || position !== null) {
      if (pageAt === null) {
        this.#logger.warn("[dispatcher] 缺少 pageAt，按照严格模式拒绝默认到第1页", { pageAt, position });
        try { this.#logger.error("URL 导航·页面：缺少 pageAt，已拒绝跳转", { toast: { type: "error", ms: 3000 } }); } catch (e) { /* logger-guard */ void e; }
        return { type: "page", success: false, reason: "missing:pageAt" };
      }
      this.#logger.info("[dispatcher] 执行页面导航", { pageAt, position });
      try { this.#logger.info(`URL 导航·页面：跳转第 ${pageAt} 页${(position!==null)?` @${position}%`:""}`, { toast: { type: "info", ms: 2000 } }); } catch (e) { /* logger-guard */ void e; }
      const result = await this.#navigationService.navigateTo({ pageAt, position });
      return { type: "page", success: !!result?.success, reason: result?.error };
    }

    // 5) 无需跳转
    return { type: "none", success: true };
  }
}

export default URLJumpDispatcher;
