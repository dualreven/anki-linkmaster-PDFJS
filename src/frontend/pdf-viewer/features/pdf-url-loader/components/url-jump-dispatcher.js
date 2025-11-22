/**
 * URLJumpDispatcher
 * @module URLJumpDispatcher
 * @description
 * URL 参数跳转分发器（功能已禁用）
 *
 * 历史：此组件曾负责根据解析的 URL 参数执行自动跳转，包括：
 * - annotation-id → 标注跳转
 * - anchor-id → 锚点跳转
 * - outline-item-id → 大纲跳转
 * - page-at / position → 页面跳转
 *
 * 当前状态：
 * - URL 参数跳转功能已完全禁用（2024-11）
 * - 所有导航只能通过 WebSocket 消息或前端 UI 操作触发
 * - 此组件保留仅为向后兼容，防止旧代码调用时报错
 *
 * 迁移指南：
 * - 如需导航，请通过事件 'pdf-viewer:navigation:url-params:requested' 触发
 * - 或通过 WebSocket 发送导航消息给后端
 */

import { getLogger } from "../../../../common/utils/logger.js";

export class URLJumpDispatcher {
  /** @type {import('../../../../common/utils/logger.js').Logger} */
  static #logger = getLogger("URLJumpDispatcher");

  /**
   * 尝试执行 URL 跳转（已禁用）
   *
   * @param {Object} parsed 已解析参数（URLParamsParser.parse 的返回）
   * @param {Object} [opts] 选项（已忽略）
   * @returns {Promise<{type: 'disabled', success: boolean, message: string}>}
   */
  static async tryExecute(parsed, opts = {}) {
    this.#logger.debug("[URLJumpDispatcher] URL 参数跳转功能已禁用", { parsed });

    return {
      type: "disabled",
      success: true,
      message: "URL 参数跳转功能已移除。请使用 WebSocket 消息或 UI 操作进行导航。"
    };
  }
}

export default URLJumpDispatcher;
