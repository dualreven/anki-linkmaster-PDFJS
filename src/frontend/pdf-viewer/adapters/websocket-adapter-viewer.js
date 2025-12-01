/**
 * @file PDF Viewer专属 WebSocket适配器
 * @module WebSocketAdapterViewer
 * @description
 * 继承公共基类，实现 pdf-viewer 特定的注册逻辑和消息路由。
 */

import { WebSocketAdapterBase } from "../../common/adapters/websocket-adapter-base.js";
import { WEBSOCKET_MESSAGE_TYPES } from "../../common/event/event-constants.js";
import { getCurrentPdfIdFromWindow } from "../shared/url-context.js";

/**
 * PDF Viewer 专属 WebSocket适配器
 * @class WebSocketAdapterViewer
 * @extends WebSocketAdapterBase
 */
export class WebSocketAdapterViewer extends WebSocketAdapterBase {
  /** @type {string} */
  #viewerInstanceId;

  /**
   * 创建 PDF Viewer WebSocket适配器实例
   * @param {import('../../common/ws/ws-client.js').WSClient} wsClient - WebSocket客户端实例
   * @param {import('../../common/event/event-bus.js').EventBus} eventBus - 事件总线实例
   */
  constructor(wsClient, eventBus) {
    super(wsClient, eventBus, { loggerName: "WebSocketAdapterViewer" });
    this.#viewerInstanceId = WebSocketAdapterViewer.#resolveViewerInstanceId();
    this.logger.debug("PDF Viewer WebSocket适配器实例已创建", { viewerInstanceId: this.#viewerInstanceId });
  }

  /**
   * 获取 PDF Viewer 的注册配置
   * @override
   * @protected
   * @returns {Object} 注册配置对象
   */
  _getRegistrationConfig() {
    try {
      // 从 URL 参数获取 pdf-id
      const pdfId = getCurrentPdfIdFromWindow();

      // 构造 client_id（标准格式：pdf-viewer-{pdf-id}）
      const clientId = pdfId
        ? `pdf-viewer-${pdfId}`
        : `pdf-viewer-${this.#viewerInstanceId}`;

      // 构造 client_type 数组（类型标签集合）
      const clientType = [];
      if (pdfId) {
        clientType.push(`window:pdf-viewer:${pdfId}`); // 窗口类型 + 资源ID
      } else {
        clientType.push("window:pdf-viewer"); // 仅窗口类型
      }
      clientType.push("editable"); // 默认可编辑

      // 构造 capabilities 数组（功能能力）
      const capabilities = ["navigation", "annotation", "bookmark", "outline"];

      // 构造 metadata 对象（扩展元数据）
      const metadata = {
        viewer_instance_id: this.#viewerInstanceId, // 保留旧的实例ID用于调试
        pdf_id: pdfId,
        url: window?.location?.href || "",
        title: document?.title || "",
        migrated_from: WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_REQUESTED // 标记协议迁移
      };

      return {
        client_id: clientId,
        client_type: clientType,
        capabilities: capabilities,
        metadata: metadata
      };
    } catch (error) {
      this.logger.error("Failed to build registration config", error);
      throw error;
    }
  }

  /**
   * 解析 Viewer 实例 ID（从 sessionStorage 获取或生成新ID）
   * @static
   * @private
   * @returns {string} Viewer 实例 ID
   */
  static #resolveViewerInstanceId() {
    try {
      const key = "pdf_viewer_instance_id";
      let id = window?.sessionStorage?.getItem(key);
      if (!id) {
        id = "vwr_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        window?.sessionStorage?.setItem(key, id);
      }
      return id;
    } catch {
      return "vwr_" + Math.random().toString(36).slice(2, 10);
    }
  }
}
