/**
 * @file WebSocket适配器
 * @module WebSocketAdapter
 * @description 负责将WebSocket消息转换为应用内部事件，实现外部通信与内部事件总线的适配
 */

import { getLogger } from "../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../common/event/event-constants.js";

/**
 * WebSocket适配器类
 * @class WebSocketAdapter
 * @description
 * 适配器模式的实现，负责：
 * 1. 外部→内部：将WebSocket消息转换为内部事件
 * 2. 内部→外部：监听内部事件并发送WebSocket消息
 * 3. 消息队列：在初始化前缓存消息
 * 4. 路由分发：根据消息类型分发到对应处理器
 *
 * @example
 * const adapter = new WebSocketAdapter(wsClient, eventBus);
 * adapter.setupMessageHandlers();
 * adapter.onInitialized(); // 在应用初始化完成后调用
 */
export class WebSocketAdapter {
  /** @type {import('../../common/utils/logger.js').Logger} */
  #logger;

  /** @type {import('../../common/event/event-bus.js').EventBus} */
  #eventBus;

  /** @type {import('../../common/ws/ws-client.js').WSClient} */
  #wsClient;

  /** @type {boolean} */
  #initialized = false;

  /** @type {Array} */
  #messageQueue = [];

  /** @type {Array<Function>} */
  #unsubscribeFunctions = [];

  /**
   * 创建WebSocket适配器实例
   * @param {import('../../common/ws/ws-client.js').WSClient} wsClient - WebSocket客户端实例
   * @param {import('../../common/event/event-bus.js').EventBus} eventBus - 事件总线实例
   */
  constructor(wsClient, eventBus) {
    if (!wsClient) {
      throw new Error("WebSocketAdapter: wsClient is required");
    }
    if (!eventBus) {
      throw new Error("WebSocketAdapter: eventBus is required");
    }

    this.#logger = getLogger("WebSocketAdapter");
    this.#eventBus = eventBus;
    this.#wsClient = wsClient;

    this.#logger.debug("WebSocketAdapter instance created");
  }

  /**
   * 设置消息处理器
   * 建立WebSocket消息与内部事件之间的双向桥接
   *
   * @public
   */
  setupMessageHandlers() {
    this.#logger.info("Setting up WebSocket message handlers");

    // 外部→内部：监听WebSocket消息事件
    this.#setupIncomingMessageHandlers();

    // 内部→外部：监听应用事件并转发到WebSocket
    this.#setupOutgoingMessageHandlers();

    this.#logger.debug("WebSocket message handlers setup complete");
  }

  /**
   * 设置传入消息处理器（WebSocket → EventBus）
   * @private
   */
  #setupIncomingMessageHandlers() {
    // 监听通用WebSocket消息接收事件
    const unsubscribe = this.#eventBus.on(
      WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
      (message) => {
        this.#logger.debug(`Received WebSocket message event: ${message?.type}`);
        this.handleMessage(message);
        try {
          const type = String(message?.type || "");
          if (type.startsWith("anchor:")) {
            if (type.endsWith(":completed")) {
              if (type === "anchor:get:completed" || type === "anchor:list:completed") {
                const anchors = message?.data?.anchors || (message?.data?.anchor ? [message.data.anchor] : []);
                this.#logger.info("[anchor] inbound completed -> emit ANCHOR.DATA.LOADED", { type, count: Array.isArray(anchors) ? anchors.length : 0 });
                this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED, { anchors }, { actorId: "WebSocketAdapter" });
              } else {
                // 其他完成事件后请求刷新列表（若可获取pdfId）
                try {
                  const params = new URLSearchParams(window.location.search);
                  const pdfId = params.get("pdf-id");
                  if (pdfId) {
                    this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_LIST, { pdf_uuid: pdfId });
                  }
                } catch(e){ this.#logger.warn("noop", e); }
              }
            }
          }
        } catch (e) { this.#logger.warn("anchor inbound bridge failed", e); }
      },
      { subscriberId: "WebSocketAdapter" }
    );

    this.#unsubscribeFunctions.push(unsubscribe);
  }

  /**
   * 设置传出消息处理器（EventBus → WebSocket）
   * 监听内部事件，转发到WebSocket
   *
   * @private
   */
  #setupOutgoingMessageHandlers() {
    // 📥 监听事件: pdf-viewer:file:load-success
    // 发射者: features/pdf
    // 作用: 通知后端PDF加载完成
    const unsubscribe1 = this.#eventBus.on(
      PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
      (data) => {
        this.#logger.debug("File loaded successfully, sending notification to backend", data);
        this.#wsClient.send({
          type: "pdf_loaded",
          data: {
            file_path: data.filePath,
            filename: data.filename,
            total_pages: data.totalPages,
            url: data.url
          }
        });
      },
      { subscriberId: "WebSocketAdapter" }
    );

    // 📥 监听事件: pdf-viewer:navigation:changed
    // 发射者: features/pdf
    // 作用: 通知后端页码变更
    const unsubscribe2 = this.#eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.CHANGED,
      (data) => {
        this.#logger.debug("Page changed, sending notification to backend", data);
        this.#wsClient.send({
          type: "page_changed",
          data: {
            page_number: data.pageNumber,
            total_pages: data.totalPages
          }
        });
      },
      { subscriberId: "WebSocketAdapter" }
    );

    // 📥 监听事件: pdf-viewer:zoom:changed
    // 发射者: features/pdf or features/ui
    // 作用: 通知后端缩放级别变更
    const unsubscribe3 = this.#eventBus.on(
      PDF_VIEWER_EVENTS.ZOOM.CHANGED,
      (data) => {
        this.#logger.debug("Zoom changed, sending notification to backend", data);
        this.#wsClient.send({
          type: "zoom_changed",
          data: {
            level: data.level,
            scale: data.scale
          }
        });
      },
      { subscriberId: "WebSocketAdapter" }
    );

    // ===== Anchor outbound bridging =====
    const getPdfId = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        return params.get("pdf-id");
      } catch { return null; }
    };

    const unsubA1 = this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD,
      (data) => {
        try {
          const anchorId = data?.anchorId || null;
          const pdfId = data?.pdf_uuid || getPdfId();
          if (anchorId) {
            this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_GET, { anchor_id: anchorId, pdf_uuid: pdfId });
          } else if (pdfId) {
            this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_LIST, { pdf_uuid: pdfId });
          }
        } catch (e) { this.#logger.warn("ANCHOR.DATA.LOAD bridge failed", e); }
      },
      { subscriberId: "WebSocketAdapter" }
    );

    const unsubA2 = this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.CREATE,
      (data) => {
        const pdfId = data?.pdf_uuid || getPdfId();
        const anchor = data?.anchor;
        if (!anchor) {return;}
        try { this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_CREATE, { pdf_uuid: pdfId, anchor }); } catch(e){ this.#logger.warn("noop", e); }
      },
      { subscriberId: "WebSocketAdapter" }
    );

    const unsubA3 = this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.UPDATE,
      (data) => {
        // 本地 UI 更新与后端更新共用事件，因此需要判断是否包含 update
        const id = data?.anchorId || data?.uuid; const update = data?.update;
        if (!id || !update) {return;}
        try { this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_UPDATE, { anchor_id: id, update }); } catch(e){ this.#logger.warn("noop", e); }
      },
      { subscriberId: "WebSocketAdapter" }
    );

    const unsubA4 = this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.DELETE,
      (data) => {
        const id = data?.anchorId || data?.uuid; if (!id) {return;}
        try { this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_DELETE, { anchor_id: id }); } catch(e){ this.#logger.warn("noop", e); }
      },
      { subscriberId: "WebSocketAdapter" }
    );

    const unsubA5 = this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.ACTIVATE,
      (data) => {
        const id = data?.anchorId || data?.uuid; if (!id) {return;}
        const active = !!data?.active;
        try { this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_ACTIVATE, { anchor_id: id, active }); } catch(e){ this.#logger.warn("noop", e); }
      },
      { subscriberId: "WebSocketAdapter" }
    );

    this.#unsubscribeFunctions.push(unsubscribe1, unsubscribe2, unsubscribe3, unsubA1, unsubA2, unsubA3, unsubA4, unsubA5);
  }

  /**
   * 处理WebSocket消息
   * 如果未初始化，将消息加入队列；否则立即路由处理
   *
   * @public
   * @param {Object} message - WebSocket消息
   */
  handleMessage(message) {
    if (!this.#initialized) {
      // 如果还未初始化，将消息加入队列
      this.#messageQueue.push(message);
      this.#logger.debug(`Message queued (not initialized yet): ${message.type}`);
      return;
    }

    this.#routeMessage(message);
  }

  /**
   * 路由消息到对应的处理方法
   *
   * @private
   * @param {Object} message - WebSocket消息
   */
  #routeMessage(message) {
    const { type, data } = message;

    this.#logger.debug(`Routing WebSocket message: ${type}`, data);

    switch (type) {
    case "load_pdf_file":
      this.#handleLoadPdfFile(data);
      break;

    case "navigate_page":
      this.#handleNavigatePage(data);
      break;

    case "set_zoom":
      this.#handleSetZoom(data);
      break;

    default:
      this.#logger.warn(`Unhandled WebSocket message type: ${type}`);
    }
  }

  /**
   * 处理加载PDF文件消息
   *
   * @private
   * @param {Object} data - 文件数据
   */
  #handleLoadPdfFile(data) {
    // 支持新消息格式 (file_path) 和旧格式 (fileId)
    let fileData = null;

    if (data && data.filename && data.url) {
      if (data.file_path) {
        // 新格式：使用 file_path
        fileData = {
          file_path: data.file_path,
          filePath: data.file_path, // 同时提供camelCase版本
          filename: data.filename,
          url: data.url
        };
      } else if (data.fileId) {
        // 旧格式：保持兼容性
        fileData = {
          filename: data.filename,
          url: data.url,
          fileId: data.fileId
        };
      }

      if (fileData) {
        this.#logger.info(`Received load PDF file request: ${data.filename}`);

        // 📤 发射事件: pdf-viewer:file:load-requested
        // 监听者: features/pdf
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED,
          fileData,
          { actorId: "WebSocketAdapter" }
        );
      } else {
        this.#logger.warn("Invalid load_pdf_file message format:", data);
      }
    } else {
      this.#logger.warn("Invalid load_pdf_file message format (missing required fields):", data);
    }
  }

  /**
   * 处理页面导航消息
   *
   * @private
   * @param {Object} data - 导航数据
   */
  #handleNavigatePage(data) {
    const { page_number } = data;

    if (typeof page_number !== "number") {
      this.#logger.warn("Invalid navigate_page message: page_number must be a number", data);
      return;
    }

    // 📤 发射事件: pdf-viewer:navigation:goto
    // 监听者: features/pdf
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.NAVIGATION.GOTO,
      { pageNumber: page_number },
      { actorId: "WebSocketAdapter" }
    );
  }

  /**
   * 处理设置缩放消息
   *
   * @private
   * @param {Object} data - 缩放数据
   */
  #handleSetZoom(data) {
    const { level, scale } = data;

    if (level === undefined && scale === undefined) {
      this.#logger.warn("Invalid set_zoom message: must provide either level or scale", data);
      return;
    }

    // 📤 发射事件: pdf-viewer:zoom:changed
    // 监听者: features/pdf or features/ui
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.ZOOM.CHANGED,
      { level, scale },
      { actorId: "WebSocketAdapter" }
    );
  }

  /**
   * 标记为已初始化，处理队列中的消息
   *
   * @public
   */
  onInitialized() {
    this.#initialized = true;

    if (this.#messageQueue.length > 0) {
      this.#logger.info(`Processing ${this.#messageQueue.length} queued messages`);

      this.#messageQueue.forEach((message) => {
        this.#routeMessage(message);
      });

      this.#messageQueue = [];
    }

    this.#logger.debug("WebSocketAdapter marked as initialized");
  }

  /**
   * 销毁适配器，清理所有监听器
   *
   * @public
   */
  destroy() {
    this.#logger.info("Destroying WebSocketAdapter");

    // 取消所有事件订阅
    this.#unsubscribeFunctions.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        this.#logger.warn("Error unsubscribing from event:", error);
      }
    });

    this.#unsubscribeFunctions = [];
    this.#messageQueue = [];
    this.#initialized = false;

    this.#logger.debug("WebSocketAdapter destroyed");
  }

  /**
   * 获取适配器状态（用于调试）
   *
   * @public
   * @returns {Object} 状态对象
   */
  getState() {
    return {
      initialized: this.#initialized,
      queuedMessages: this.#messageQueue.length,
      activeListeners: this.#unsubscribeFunctions.length
    };
  }
}

/**
 * 创建WebSocket适配器实例（工厂函数）
 *
 * @param {import('../../common/ws/ws-client.js').WSClient} wsClient - WebSocket客户端实例
 * @param {import('../../common/event/event-bus.js').EventBus} eventBus - 事件总线实例
 * @returns {WebSocketAdapter} 适配器实例
 *
 * @example
 * import { createWebSocketAdapter } from './adapters/websocket-adapter.js';
 * import wsClient from './common/ws/ws-client.js';
 * import eventBus from './common/event/event-bus.js';
 *
 * const adapter = createWebSocketAdapter(wsClient, eventBus);
 * adapter.setupMessageHandlers();
 */
export function createWebSocketAdapter(wsClient, eventBus) {
  return new WebSocketAdapter(wsClient, eventBus);
}
