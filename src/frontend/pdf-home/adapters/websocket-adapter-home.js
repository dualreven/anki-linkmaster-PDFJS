/**
 * @file PDF Home专属 WebSocket适配器
 * @module WebSocketAdapterHome
 * @description
 * 继承公共基类，实现 pdf-home 特定的注册逻辑。
 * pdf-home 是单例窗口，使用固定的 client_id。
 */

import { WebSocketAdapterBase } from "../../common/adapters/websocket-adapter-base.js";

/**
 * PDF Home 专属 WebSocket适配器
 * @class WebSocketAdapterHome
 * @extends WebSocketAdapterBase
 */
export class WebSocketAdapterHome extends WebSocketAdapterBase {
  /**
   * 创建 PDF Home WebSocket适配器实例
   * @param {import('../../common/ws/ws-client.js').WSClient} wsClient - WebSocket客户端实例
   * @param {import('../../common/event/event-bus.js').EventBus} eventBus - 事件总线实例
   */
  constructor(wsClient, eventBus) {
    super(wsClient, eventBus, { loggerName: "WebSocketAdapterHome" });
    this.logger.debug("PDF Home WebSocket适配器实例已创建");
  }

  /**
   * 获取 PDF Home 的注册配置
   * @override
   * @protected
   * @returns {Object} 注册配置对象
   */
  _getRegistrationConfig() {
    try {
      // pdf-home 是单例窗口，使用固定的 client_id
      const clientId = "pdf-home";

      // 构造 client_type 数组（类型标签集合）
      const clientType = ["window:pdf-home", "singleton"];

      // 构造 capabilities 数组（功能能力）
      const capabilities = [
        "library-management",  // 文件库管理
        "search",              // 搜索功能
        "file-operations"      // 文件操作（添加/删除）
      ];

      // 构造 metadata 对象（扩展元数据）
      const metadata = {
        url: window?.location?.href || "",
        title: document?.title || "PDF Library Manager",
        window_type: "singleton"  // 标记为单例窗口
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
}
