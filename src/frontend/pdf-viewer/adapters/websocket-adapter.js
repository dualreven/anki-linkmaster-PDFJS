/**
 * @file WebSocket适配器
 * @module WebSocketAdapter
 * @description 负责将WebSocket消息转换为应用内部事件，实现外部通信与内部事件总线的适配
 *
 * 详细拆分说明：`docs/standards/websocket-adapter.md`
 */

import { getLogger } from "../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../common/event/event-constants.js";
import { markEventFired, runWithGate } from "../utils/event-gate-runner.js";
import { getWsGateStatusStore } from "../../common/ws/ws-gate-status-store.js";
import { createSubscriptionBag } from "../../common/ws/ws-subscription-bag.js";
import { createMessageQueue } from "../../common/ws/ws-message-queue.js";
import { handleViewerWsInbound } from "./ws-inbound-bridge.js";
import { installWebSocketAdapterOutgoingHandlers } from "./websocket-adapter-outgoing-handlers.js";
import { handleLoadPdfFileMessage } from "./websocket-adapter-load-pdf-file.js";
import { handleViewerNavigateMessage } from "./websocket-adapter-viewer-navigate.js";
import { getCurrentPdfIdFromWindow } from "../shared/url-context.js";
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

  /** @type {{ enqueue:(msg:any)=>void, drain:(fn:(msg:any)=>void)=>void, clear:()=>void, size:()=>number }} */
  #messageQueue;

  /** @type {{ add:(fn:Function)=>void, clear:()=>void, size:()=>number }} */
  #subscriptions;

  /** @type {string} */
  #viewerInstanceId;
  /** @type {{ events: Record<string, {fired:boolean,count:number,lastPayload:any,lastAt:number}> }} */
  #eventStatusStore;

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
    this.#viewerInstanceId = WebSocketAdapter.#resolveViewerInstanceId();
    this.#eventStatusStore = getWsGateStatusStore();
    this.#messageQueue = createMessageQueue({ loggerName: "WebSocketAdapter" });
    this.#subscriptions = createSubscriptionBag({ loggerName: "WebSocketAdapter" });
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

    // 监听核心状态型事件以更新 gate 状态字典（例如 RENDER.READY）
    this.#setupGateStatusObservers();

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
        handleViewerWsInbound({
          message,
          eventBus: this.#eventBus,
          wsClient: this.#wsClient,
          logger: this.#logger
        });
      },
      { subscriberId: "WebSocketAdapter" }
    );

    this.#subscriptions.add(unsubscribe);
  }

  /**
   * 为 gate.once / gate.on 提供状态型事件的观测入口。
   * 当前仅监听 RENDER.READY，后续如有需要可在此集中扩展。
   * @private
   */
  #setupGateStatusObservers() {
    try {
      const unsubRenderReady = this.#eventBus.onGlobal
        ? this.#eventBus.onGlobal(
          PDF_VIEWER_EVENTS.RENDER.READY,
          (payload) => {
            try {
              markEventFired(this.#eventStatusStore, PDF_VIEWER_EVENTS.RENDER.READY, payload);
            } catch (e) {
              this.#logger.warn("[WebSocketAdapter] failed to markEventFired for RENDER.READY", e);
            }
          },
          { subscriberId: "WebSocketAdapter" }
        )
        : this.#eventBus.on(
          PDF_VIEWER_EVENTS.RENDER.READY,
          (payload) => {
            try {
              markEventFired(this.#eventStatusStore, PDF_VIEWER_EVENTS.RENDER.READY, payload);
            } catch (e) {
              this.#logger.warn("[WebSocketAdapter] failed to markEventFired for RENDER.READY", e);
            }
          },
          { subscriberId: "WebSocketAdapter" }
        );

      this.#subscriptions.add(unsubRenderReady);
    } catch (e) {
      this.#logger.warn("[WebSocketAdapter] setupGateStatusObservers failed", e);
    }
  }

  /**
   * 设置传出消息处理器（EventBus → WebSocket）
   * 监听内部事件，转发到WebSocket
   *
   * @private
   */
  #setupOutgoingMessageHandlers() {
    installWebSocketAdapterOutgoingHandlers({
      eventBus: this.#eventBus,
      wsClient: this.#wsClient,
      logger: this.#logger,
      subscriptions: this.#subscriptions
    });
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
      this.#messageQueue.enqueue(message);
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

    case WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED: {
      const correlationId = message?.request_id || null;
      // 使用 gate 协议控制导航执行时机（如等待 RENDER.READY）
      void runWithGate({
        eventBus: this.#eventBus,
        store: this.#eventStatusStore,
        rawGate: message?.gate,
        run: async () => {
          this.#handleViewerNavigate(message, correlationId);
        }
      }).catch((error) => {
        try {
          this.#logger.warn("[Navigate] gate execution failed", error);
        } catch (e) {
          void e;
        }
        try {
          this.#wsClient.send({
            type: WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_FAILED,
            request_id: correlationId,
            error: {
              code: "GATE_FAILED",
              message: error?.message || String(error)
            },
            data: { viewer_id: this.#viewerInstanceId }
          });
        } catch (e) {
          this.#logger.warn("[Navigate] failed to send gate failure response", e);
        }
      });
      break;
    }

    default:
      this.#logger.warn(`Unhandled WebSocket message type: ${type}`, {
        message_keys: Object.keys(message),
        has_to: !!message?.to,
        has_data: !!message?.data,
        message_type: type
      });
    }
  }

  // 处理加载PDF文件消息
  #handleLoadPdfFile(data) {
    handleLoadPdfFileMessage({
      data,
      eventBus: this.#eventBus,
      logger: this.#logger
    });
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

    // 📤 统一走导航事件入口（pdfId 仅用于标识当前文档，不再由 URL 控制导航语义）
    const pdfId = getCurrentPdfIdFromWindow();
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED,
      { pdfId: pdfId || undefined, pageAt: page_number },
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
   * 处理跨实例导航消息（支持按 viewer_id 或 pdf_uuid 定向）
   * @private
   * @param {Object} data
   * @param {string} [correlationId]
   */
  /**
   * 处理 PDF Viewer 导航请求（支持新路由协议）
   *
   * @private
   * @param {Object} message - 完整的 WebSocket 消息对象
   * @param {string} correlationId - 请求关联 ID
   */
  #handleViewerNavigate(message, correlationId) {
    handleViewerNavigateMessage({
      message,
      correlationId,
      eventBus: this.#eventBus,
      wsClient: this.#wsClient,
      logger: this.#logger,
      viewerInstanceId: this.#viewerInstanceId
    });
  }

  /**
   * 解析/生成稳定的 Viewer 实例ID
   * @private
   * @returns {string}
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

  /**
   * 标记为已初始化，处理队列中的消息
   *
   * @public
   */
  onInitialized() {
    this.#initialized = true;

    const queued = this.#messageQueue.size();
    if (queued > 0) {
      this.#logger.info(`Processing ${queued} queued messages`);

      this.#messageQueue.drain((message) => {
        this.#routeMessage(message);
      });
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
    this.#subscriptions.clear();
    this.#messageQueue.clear();
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
      queuedMessages: this.#messageQueue.size(),
      activeListeners: this.#subscriptions.size()
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
