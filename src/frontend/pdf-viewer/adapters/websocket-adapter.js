/**
 * @file WebSocket适配器
 * @module WebSocketAdapter
 * @description 负责将WebSocket消息转换为应用内部事件，实现外部通信与内部事件总线的适配
 */

import { getLogger } from "../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../common/event/event-constants.js";
import { createEventStatusStore, markEventFired, runWithGate } from "../utils/event-gate-runner.js";
import { createSubscriptionBag } from "../../common/ws/ws-subscription-bag.js";
import { createMessageQueue } from "../../common/ws/ws-message-queue.js";
import { handleViewerWsInbound } from "./ws-inbound-bridge.js";

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
    this.#eventStatusStore = createEventStatusStore();
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
        try {
          handleViewerWsInbound({
            message,
            eventBus: this.#eventBus,
            wsClient: this.#wsClient,
            logger: this.#logger
          });
        } catch (e) {
          this.#logger.warn("anchor/outline inbound bridge failed", e);
        }
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
    // 注册逻辑已移至 WebSocketAdapterViewer（使用公共基类）
    // 此方法仅负责业务消息的转发

    // 📥 监听事件: pdf-viewer:file:load-success
    // 发射者: features/pdf
    // 作用: 加载完成后执行必要的后续动作（如 visited_at 更新）
    const unsubscribe1 = this.#eventBus.on(
      PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
      (data) => {
        this.#logger.debug("File loaded successfully; legacy 'pdf_loaded' message suppressed", {
          filename: data?.filename,
          totalPages: data?.totalPages,
          url: data?.url
        });

        // 同步更新 pdf_info.visited_at（若 URL 中提供了 pdf-id）
        try {
          const params = new URLSearchParams(window.location.search);
          const pdfId = params.get("pdf-id");
          if (pdfId && typeof pdfId === "string" && pdfId.trim()) {
            const now = Date.now();
            const reqId = `update_visited_${now}_${Math.random().toString(36).slice(2, 8)}`;
            this.#logger.info("[VisitedAt] Updating visited_at for pdf-id", { pdfId, now });
            this.#wsClient.send({
              type: WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_REQUESTED,
              request_id: reqId,
              metadata: { version: "1.0.0" },
              data: {
                file_id: pdfId,
                updates: {
                  visited_at: now,
                  // 同步写入 json_data.last_accessed_at，便于前端一处消费
                  json_data: { last_accessed_at: now }
                }
              }
            });
          } else {
            this.#logger.info("[VisitedAt] Skip update: pdf-id not present in URL");
          }
        } catch (e) {
          this.#logger.warn("[VisitedAt] Failed to send visited_at update", e);
        }

        // 严格模式：禁止在 FILE.LOAD.SUCCESS 自动拉取 outline-list
        // 加载顺序由 Feature.pdf-outline 统一编排（先原生导入并持久化，再请求列表对齐）
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
          metadata: { version: "1.0.0" },
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
          metadata: { version: "1.0.0" },
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

          // [DIAGNOSTIC] 追踪 ANCHOR.DATA.LOAD 事件来源
          const stack = new Error().stack.split("\n").slice(1, 4).join("\n");
          this.#logger.warn("[DIAGNOSTIC] ANCHOR.DATA.LOAD triggered", {
            source: "EventBus listener",
            location: "Line 376-390",
            anchorId,
            pdfId,
            callStack: stack
          });

          if (anchorId) {
            this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_GET, { anchor_id: anchorId, pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
          } else if (pdfId) {
            // [DIAGNOSTIC] 记录 ANCHOR_LIST 请求发送
            this.#logger.warn("[DIAGNOSTIC] Sending ANCHOR_LIST request", {
              source: "ANCHOR.DATA.LOAD handler",
              pdfId,
              timestamp: Date.now()
            });
            this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
          }
        } catch (e) { this.#logger.warn("ANCHOR.DATA.LOAD bridge failed", e); }
      },
      { subscriberId: "WebSocketAdapter" }
    );

    const unsubA2 = this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.CREATE,
      (data) => {
        const pdfId = data?.pdf_uuid || getPdfId();
        let anchor = data?.anchor;
        if (!anchor) {return;}
        try {
          // 仅转发“来自特性层补齐”的事件，避免 UI 直发（缺失 uuid）造成重复创建
          const fromFeature = data && data.__fromFeature === true;
          const hasValidId = typeof anchor.uuid === "string" && /^pdfanchor-[a-f0-9]{12}$/i.test(anchor.uuid);
          if (!fromFeature && !hasValidId) {
            // 丢弃不合规的创建事件，等待 PDFAnchorFeature 重新发布带 uuid 的事件
            return;
          }
          if (!pdfId) {
            this.#logger.warn("[anchor] create aborted: missing pdf_uuid", { source: fromFeature ? "feature" : "ui" });
            // 显式发失败事件，便于 UI/日志观察
            try {
              this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.CREATE_FAILED, { error: { message: "缺少 pdf_uuid" } }, { actorId: "WebSocketAdapter" });
            } catch (e) { this.#logger.warn("[anchor] emit CREATE_FAILED failed (missing pdf_uuid path)", e); }
            return;
          }
          // 规范化位置：确保 position 为 0..1 区间
          if (typeof anchor.position === "number") {
            anchor = { ...anchor, position: (anchor.position > 1 ? (anchor.position / 100) : anchor.position) };
          }
          this.#logger.info("[anchor] create → WS request", { pdf_uuid: pdfId, id: anchor.uuid, name: anchor.name, page_at: anchor.page_at });
          this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_CREATE, { pdf_uuid: pdfId, anchor }, { metadata: { version: "1.0.0" } });
        } catch (e) { this.#logger.warn("[anchor] create request failed", e); }
      },
      { subscriberId: "WebSocketAdapter" }
    );

    const unsubA3 = this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.UPDATE,
      (data) => {
        // 本地 UI 更新与后端更新共用事件，因此需要判断是否包含 update
        const id = data?.anchorId || data?.uuid; let update = data?.update;
        if (!id || !update) {return;}
        try {
          // 规范化位置：确保 position 为 0..1 区间
          if (typeof update.position === "number") {
            update = { ...update, position: (update.position > 1 ? (update.position / 100) : update.position) };
          }
          this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_UPDATE, { anchor_id: id, update }, { metadata: { version: "1.0.0" } });
        } catch { this.#logger.warn("noop"); }
      },
      { subscriberId: "WebSocketAdapter" }
    );

    const unsubA4 = this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.DELETE,
      (data) => {
        const id = data?.anchorId || data?.uuid; if (!id) {return;}
        try { this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_DELETE, { anchor_id: id }, { metadata: { version: "1.0.0" } }); } catch (e) { this.#logger.warn("noop", e); }
      },
      { subscriberId: "WebSocketAdapter" }
    );

    const unsubA5 = this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.ACTIVATE,
      (data) => {
        const id = data?.anchorId || data?.uuid; if (!id) {return;}
        const active = !!data?.active;
        try { this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_ACTIVATE, { anchor_id: id, active }, { metadata: { version: "1.0.0" } }); } catch (e) { this.#logger.warn("noop", e); }
      },
      { subscriberId: "WebSocketAdapter" }
    );

    // 标注管理器窗口打开请求 → 通过 MsgCenter 打开 anno-manager Hosted 窗口
    const unsubAnnoManager = this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.MANAGER.OPEN_WINDOW_REQUESTED,
      (payload) => {
        try {
          if (!this.#wsClient || typeof this.#wsClient.send !== "function") {
            this.#logger.error("[AnnoManager] Skip app-window open: wsClient unavailable", { payload });
            return;
          }

          // 优先使用事件中携带的 pdfId，其次回退到 URL 解析
          const fromEvent = payload && (payload.pdfId || payload.pdf_id);
          const pdfId = (typeof fromEvent === "string" && fromEvent.trim() !== "")
            ? fromEvent.trim()
            : getPdfId();

          if (!pdfId || typeof pdfId !== "string" || pdfId.trim() === "") {
            try {
              this.#logger.error(
                "[AnnoManager] Skip app-window open: missing pdf-id",
                { payload },
                { toast: { type: "error", ms: 4000 } }
              );
            } catch (logErr) {
              void logErr;
            }
            return;
          }

          const clientId = "anno-manager";
          this.#logger.info("[AnnoManager] Sending app-window open request via WS", { clientId, pdfId });

          this.#wsClient.send({
            type: WEBSOCKET_MESSAGE_TYPES.APP_WINDOW_OPEN_REQUESTED,
            data: {
              client_id: clientId,
              window_type: "anno-manager",
              params: { pdf_id: pdfId }
            }
          });
        } catch (e) {
          try {
            this.#logger.error(
              "[AnnoManager] Failed to send app-window open request",
              e,
              { toast: { type: "error", ms: 4000 } }
            );
          } catch (logErr) {
            void logErr;
          }
        }
      },
      { subscriberId: "WebSocketAdapter" }
    );

    this.#subscriptions.add(unsubscribe1);
    this.#subscriptions.add(unsubscribe2);
    this.#subscriptions.add(unsubscribe3);
    this.#subscriptions.add(unsubA1);
    this.#subscriptions.add(unsubA2);
    this.#subscriptions.add(unsubA3);
    this.#subscriptions.add(unsubA4);
    this.#subscriptions.add(unsubA5);
    this.#subscriptions.add(unsubAnnoManager);
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
    let fileData = null;
    if (data && data.filename && data.url) {
      const pdfId = (() => {
        const raw = (typeof data.pdfId === "string" ? data.pdfId : (typeof data.pdf_id === "string" ? data.pdf_id : (typeof data.fileId === "string" ? data.fileId : ""))).trim();
        if (raw) { return raw; }
        const m = String(data.filename).match(/([a-f0-9]{12})/i);
        return m ? String(m[1]).toLowerCase() : "";
      })();

      if (data.file_path) {
        // 新格式：使用 file_path
        fileData = {
          file_path: data.file_path,
          filePath: data.file_path, // 同时提供camelCase版本
          filename: data.filename,
          url: data.url, pdfId: pdfId || null,
        };
      } else if (data.fileId) {
        // 旧格式：保持兼容性
        fileData = {
          filename: data.filename,
          url: data.url,
          fileId: data.fileId, pdfId: pdfId || null,
        };
      }

      if (fileData) {
        this.#logger.info(`Received load PDF file request: ${data.filename}`);

        // 📤 发射事件: pdf-viewer:file:load-requested
        // 监听者: features/pdf
        // 以 warn 级别输出一次“将要触发加载”的跟踪日志，便于生产环境观察触发来源
        try {
          this.#logger.warn("[TRACE] Emitting FILE.LOAD.REQUESTED from WebSocketAdapter", fileData);
        } catch  { /* noop */ }
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

    // 📤 统一走导航事件入口（pdfId 仅用于标识当前文档，不再由 URL 控制导航语义）
    const pdfId = (() => {
      try {
        const params = new URLSearchParams(window.location.search);
        return params.get("pdf-id");
      } catch {
        return null;
      }
    })();
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
    try {
      // ✅ 从 message 顶层读取路由字段
      const to = message?.to || {};
      const data = message?.data || {};

      // ✅ 记录收到的导航请求详情（便于调试）
      this.#logger.info("[Navigate] 收到导航请求", {
        to: to,
        data_target: data?.target,
        request_id: correlationId,
        has_to_field: !!message?.to,
        has_data_field: !!message?.data
      });

      // === 路由协议验证 ===

      // 1. 检查旧协议字段（给出警告但仍然处理）
      if (to.viewer_id || to.pdf_uuid) {
        this.#logger.warn(
          "[Navigate] 收到已废弃的旧协议字段（viewer_id/pdf_uuid），建议迁移到新协议（client_id/routing_key）",
          { deprecated_fields: { viewer_id: to.viewer_id, pdf_uuid: to.pdf_uuid } }
        );

        // ⚠️ 向后兼容：旧协议仍然验证
        const targetViewer = to.viewer_id || null;
        const targetPdf = to.pdf_uuid || null;

        if (targetViewer && targetViewer !== this.#viewerInstanceId) {
          this.#logger.warn("[Navigate] ignore message: viewer_id mismatch", { targetViewer, self: this.#viewerInstanceId });
          this.#wsClient.send({
            type: WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_FAILED,
            request_id: correlationId,
            error: { code: "VIEWER_ID_MISMATCH", message: "navigate ignored: viewer_id mismatch", target: String(targetViewer), self: String(this.#viewerInstanceId) },
            data: { viewer_id: this.#viewerInstanceId }
          });
          return;
        }

        const currentPdf = (() => {
          try {
            const params = new URLSearchParams(window.location.search);
            return params.get("pdf-id");
          } catch {
            return null;
          }
        })();
        if (targetPdf && currentPdf && targetPdf !== currentPdf) {
          this.#logger.warn("[Navigate] ignore message: pdf_uuid mismatch", { targetPdf, currentPdf });
          this.#wsClient.send({
            type: WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_FAILED,
            request_id: correlationId,
            error: { code: "PDF_UUID_MISMATCH", message: "navigate ignored: pdf_uuid mismatch", target: String(targetPdf), current: String(currentPdf) },
            data: { viewer_id: this.#viewerInstanceId, pdf_uuid: currentPdf }
          });
          return;
        }
      }

      // 2. ✅ 验证新协议字段（推荐）
      const targetClientId = to.client_id || null;
      const routingKey = to.routing_key || null;

      // 验证：如果指定了 client_id，检查是否匹配当前 viewer
      if (targetClientId) {
        // 当前 viewer 的标准化 client_id
        const currentPdf = (() => {
          try {
            const params = new URLSearchParams(window.location.search);
            return params.get("pdf-id");
          } catch {
            return null;
          }
        })();
        const currentClientId = currentPdf ? `pdf-viewer-${currentPdf}` : null;

        if (currentClientId && targetClientId !== currentClientId) {
          this.#logger.debug(
            "[Navigate] 消息目标不匹配，忽略（client_id 不匹配）",
            { target: targetClientId, current: currentClientId }
          );
          // ⚠️ 组播场景：其他 viewer 也收到了消息，但不是给自己的
          // 不发送错误（避免污染日志），静默忽略
          return;
        }

        this.#logger.debug("[Navigate] 路由验证通过（client_id 匹配）", { client_id: targetClientId });
      } else if (routingKey) {
        // 仅通过 routing_key 定位（组播场景）
        this.#logger.debug("[Navigate] 使用资源路由（routing_key）", { routing_key: routingKey });
      } else {
        // 缺少所有路由字段
        this.#logger.warn("[Navigate] 消息缺少路由字段（client_id 和 routing_key 都为空），假定为广播消息");
      }

      // === 业务逻辑处理 ===

      const mode = data?.target?.type || data?.mode || "page";
      const opts = data?.options || {};

      if (mode === "annotation") {
        const annotationId = data?.target?.annotation_id || data?.annotation_id;
        if (!annotationId) {
          throw new Error("annotation_id required for annotation mode");
        }
        try { this.#logger.info(`[WS] 导航·标注：请求跳转 id=${annotationId}`, { toast: { type: "info", ms: 2000 } }); } catch (e) { void e; }
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED,
          { id: annotationId, highlight: !!opts.highlight },
          { actorId: "WebSocketAdapter" }
        );
      } else if (mode === "anchor") {
        const anchorId = data?.target?.anchor_id || data?.anchor_id;
        if (!anchorId) {
          throw new Error("anchor_id required for anchor mode");
        }
        try { this.#logger.info(`[WS] 导航·锚点：请求跳转 id=${anchorId}`, { toast: { type: "info", ms: 2000 } }); } catch (e) { void e; }
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.ANCHOR.NAVIGATE.REQUESTED,
          { anchorId },
          { actorId: "WebSocketAdapter" }
        );
      } else if (mode === "outline") {
        // 通过大纲节点ID跳转（对齐 OUTLINE 的统一入口）
        const outlineItemId = data?.target?.outline_item_id || data?.outline_item_id || data?.target?.id || data?.id;
        if (!outlineItemId) {
          throw new Error("outline_item_id/id required for outline mode");
        }
        try { this.#logger.info(`[WS] 导航·大纲：请求跳转 id=${outlineItemId}`, { toast: { type: "info", ms: 2000 } }); } catch (e) { void e; }
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE_BY_ID.REQUESTED,
          { outlineItemId },
          { actorId: "WebSocketAdapter" }
        );
      } else if (mode === "page" || mode === "xy") {
        const pageNumber = Number(data?.target?.page_number ?? data?.page_number);
        if (!Number.isFinite(pageNumber)) {
          throw new Error("page_number must be a number");
        }
        try { this.#logger.info(`[WS] 导航·页面：跳转第 ${pageNumber} 页`, { toast: { type: "info", ms: 2000 } }); } catch (e) { void e; }
        // 统一经由 URL 导航入口；若 position 为百分比则透传，否则省略
        const pos = data?.target?.position || data?.position || null; // { y_percent, x_percent } or { x, y } or number
        let positionPercent = null;
        if (pos && typeof pos === "object" && typeof pos.y_percent === "number") {
          positionPercent = pos.y_percent;
        } else if (typeof pos === "number" && pos >= 0 && pos <= 100) {
          positionPercent = pos;
        }
        const req = { pageAt: pageNumber };
        const pdfId = to?.pdf_uuid || (() => { try { return new URLSearchParams(window.location.search).get("pdf-id"); } catch { return null; } })();
        if (pdfId) { req.pdfId = pdfId; }
        if (positionPercent !== null) { req.position = positionPercent; }
        this.#eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED, req, { actorId: "WebSocketAdapter" });
      } else {
        throw new Error(`unsupported navigate mode: ${mode}`);
      }

      // 回执（完成）
      this.#wsClient.send({
        type: WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_COMPLETED,
        request_id: correlationId,
        data: { viewer_id: this.#viewerInstanceId }
      });
    } catch (error) {
      this.#logger.error("[Navigate] failed", error);
      this.#wsClient.send({
        type: WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_FAILED,
        request_id: correlationId,
        error: { message: error?.message || String(error) },
        data: { viewer_id: this.#viewerInstanceId }
      });
    }
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
