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

  /** @type {string} */
  #viewerInstanceId;

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
          // ===== Outline inbound bridging =====
          if (type.startsWith("pdf-viewer:outline-")) {
            if (type === WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED) {
              try {
                const data = message?.data || {};
                // 诊断：记录原始 outline_items 的类型与取值片段，便于确认后端回包
                try {
                  const raw = data?.outline_items;
                  const rawType = raw === null ? "null" : Array.isArray(raw) ? "array" : typeof raw;
                  const rawPreview = (() => {
                    try { return JSON.stringify(raw)?.slice(0, 200); } catch { return String(raw); }
                  })();
                  this.#logger.info(`[outline] inbound list (raw) outline_items_type=${rawType} preview=${rawPreview}`);
                } catch { /* no-op */ }

                // 若为 null（统一语义：数据库当前无大纲记录），不在适配器层桥接给 UI，交由 OutlineFeature 执行“从PDF导入→保存→再拉取”流程
                if (data?.outline_items === null) {
                  this.#logger.info("[outline] inbound list is null → skip bridging, defer to OutlineFeature");
                  return;
                }

                const items = Array.isArray(data?.outline_items) ? data.outline_items
                  : (Array.isArray(data?.items) ? data.items : []);
                const normalize = (nodes) => {
                  if (!Array.isArray(nodes)) { return []; }
                  return nodes.map(n => ({
                    id: String(n.id ?? n.outline_id ?? ""),
                    name: String(n.name ?? n.title ?? "(Untitled)"),
                    pageAt: Number.isFinite(n.pageAt) ? n.pageAt : (Number.isFinite(n.page_at) ? n.page_at : null),
                    position: (typeof n.position === "number") ? n.position
                      : (typeof n.y_percent === "number" ? Math.max(0, Math.min(100, Math.round(n.y_percent))) : null),
                    children: normalize(n.children || n.items || [])
                  }));
                };
                const outlineItems = normalize(items);
                this.#logger.info(`[outline] inbound list → emit OUTLINE.LOAD.SUCCESS (count=${outlineItems.length})`);
                this.#eventBus.emit(
                  PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS,
                  { outlineItems, source: "ws-backend" },
                  { actorId: "WebSocketAdapter" }
                );
              } catch {
                this.#logger.warn("[outline] list completed handling failed");
              }
            } else if (type === WEBSOCKET_MESSAGE_TYPES.OUTLINE_UPDATE_FAILED) {
              const err = message?.error || message?.data || { message: "unknown" };
              this.#logger.error("[outline] update failed", err, { toast: { type: "error", ms: 5000 } });
            } else if (type === WEBSOCKET_MESSAGE_TYPES.OUTLINE_CREATE_FAILED) {
              const err = message?.error || message?.data || { message: "unknown" };
              this.#logger.error("[outline] create failed", err, { toast: { type: "error", ms: 5000 } });
            } else if (type === WEBSOCKET_MESSAGE_TYPES.OUTLINE_DELETE_FAILED) {
              const err = message?.error || message?.data || { message: "unknown" };
              this.#logger.error("[outline] delete failed", err, { toast: { type: "error", ms: 5000 } });
            } else if (type.endsWith(":complete")) {
              // 其他操作完成后主动拉取最新列表
              try {
                const params = new URLSearchParams(window.location.search);
                const pdfId = params.get("pdf-id");
                if (pdfId) {
                  this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
                }
              } catch (e) { this.#logger.warn("[outline] request list after completed failed", e); }
            }
          }
          if (type.startsWith("anchor:")) {
            if (type.endsWith(":completed")) {
              if (type === WEBSOCKET_MESSAGE_TYPES.ANCHOR_GET_COMPLETED || type === WEBSOCKET_MESSAGE_TYPES.ANCHOR_LIST_COMPLETED) {
                const anchors = message?.data?.anchors || (message?.data?.anchor ? [message.data.anchor] : []);
                this.#logger.info("[anchor] inbound completed -> emit ANCHOR.DATA.LOADED", { type, count: Array.isArray(anchors) ? anchors.length : 0 });
                this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED, { anchors }, { actorId: "WebSocketAdapter" });
              } else if (type === WEBSOCKET_MESSAGE_TYPES.ANCHOR_CREATE_COMPLETED) {
                const id = message?.data?.uuid || message?.data?.anchor_id || null;
                this.#logger.info("[anchor] create completed", { id });
                try { this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.CREATED, { anchorId: id }, { actorId: "WebSocketAdapter" }); } catch {}
                // 创建成功后刷新列表
                try {
                  const params = new URLSearchParams(window.location.search);
                  const pdfId = params.get("pdf-id");
                  if (pdfId) {
                    this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
                  }
                } catch { this.#logger.warn("noop"); }
              } else if (type === WEBSOCKET_MESSAGE_TYPES.ANCHOR_ACTIVATE_COMPLETED) {
                // 先就地更新当前项，再刷新列表以对齐“单选语义”的后端状态
                try {
                  const id = message?.data?.anchor_id || message?.data?.uuid || null;
                  const active = !!(message?.data?.active ?? true);
                  if (id) {
                    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.ACTIVATED, { anchorId: String(id), active }, { actorId: "WebSocketAdapter" });
                  }
                } catch { this.#logger.warn("anchor activate inbound mapping failed"); }
                try {
                  const params = new URLSearchParams(window.location.search);
                  const pdfId = params.get("pdf-id");
                  if (pdfId) {
                    this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
                  }
                } catch { this.#logger.warn("noop"); }
              } else {
                // 其他完成事件后请求刷新列表（若可获取pdfId）
                try {
                  const params = new URLSearchParams(window.location.search);
                  const pdfId = params.get("pdf-id");
                  if (pdfId) {
                    this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
                  }
                } catch { this.#logger.warn("noop"); }
              }
            }
            // 将失败消息桥接为前端的 LOAD_FAILED（仅限 get/list 两类）
            else if (type.endsWith(":failed")) {
              if (type === WEBSOCKET_MESSAGE_TYPES.ANCHOR_GET_FAILED || type === WEBSOCKET_MESSAGE_TYPES.ANCHOR_LIST_FAILED) {
                const err = message?.error || message?.data?.error || message?.data || { message: "unknown error" };
                this.#logger.warn("[anchor] inbound failed -> emit ANCHOR.DATA.LOAD_FAILED", { type, err: (err?.message || err) });
                this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD_FAILED, { error: err, type }, { actorId: "WebSocketAdapter" });
              } else if (type === WEBSOCKET_MESSAGE_TYPES.ANCHOR_CREATE_FAILED) {
                const err = message?.error || message?.data?.error || message?.data || { message: "unknown error" };
                this.#logger.warn("[anchor] create failed", { err: (err?.message || err) });
                try { this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.CREATE_FAILED, { error: err }, { actorId: "WebSocketAdapter" }); } catch {}
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
    // 连接建立后，向后端注册本 Viewer 实例信息（viewer_id 与 pdf_uuid 绑定）
    const unsubConn = this.#eventBus.on(
      WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED,
      () => {
        try {
          const pdfId = (() => { try { return new URLSearchParams(window.location.search).get("pdf-id"); } catch { return null; } })();
          this.#wsClient.send({
            type: WEBSOCKET_MESSAGE_TYPES.VIEWER_REGISTER_REQUESTED,
            metadata: { version: "1.0.0" },
            data: {
              viewer_id: this.#viewerInstanceId,
              pdf_uuid: pdfId,
              url: window?.location?.href || "",
              title: document?.title || ""
            }
          });
          this.#logger.info("[ViewerRegister] sent", { viewer_id: this.#viewerInstanceId, pdf_uuid: pdfId });
        } catch (e) {
          this.#logger.warn("failed to send viewer register", e);
        }
      },
      { subscriberId: "WebSocketAdapter" }
    );
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
          if (anchorId) {
            this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_GET, { anchor_id: anchorId, pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
          } else if (pdfId) {
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
            } catch {}
            return;
          }
          // 规范化位置：确保 position 为 0..1 区间
          if (typeof anchor.position === "number") {
            anchor = { ...anchor, position: (anchor.position > 1 ? (anchor.position / 100) : anchor.position) };
          }
          this.#logger.info("[anchor] create → WS request", { pdf_uuid: pdfId, id: anchor.uuid, name: anchor.name, page_at: anchor.page_at });
          this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_CREATE, { pdf_uuid: pdfId, anchor }, { metadata: { version: "1.0.0" } });
        } catch { this.#logger.warn("noop"); }
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

    this.#unsubscribeFunctions.push(unsubscribe1, unsubscribe2, unsubscribe3, unsubA1, unsubA2, unsubA3, unsubA4, unsubA5, unsubConn);
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

    case WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED:
      this.#handleViewerNavigate(data, message?.request_id);
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

    // 📤 统一走 URL 导航入口
    const pdfId = (() => { try { return new URLSearchParams(window.location.search).get("pdf-id"); } catch { return null; } })();
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
  #handleViewerNavigate(data, correlationId) {
    try {
      const to = data?.to || {};
      const targetViewer = to.viewer_id || null;
      const targetPdf = to.pdf_uuid || null;

      // 路由匹配：若指定 viewer_id 且不匹配则忽略；若指定 pdf_uuid 且不匹配也忽略
      if (targetViewer && targetViewer !== this.#viewerInstanceId) {
        this.#logger.warn("[Navigate] ignore message: viewer_id mismatch", { targetViewer, self: this.#viewerInstanceId });
        return;
      }
      const currentPdf = (() => { try { return new URLSearchParams(window.location.search).get("pdf-id"); } catch { return null; } })();
      if (targetPdf && currentPdf && targetPdf !== currentPdf) {
        this.#logger.warn("[Navigate] ignore message: pdf_uuid mismatch", { targetPdf, currentPdf });
        return;
      }

      const mode = data?.target?.type || data?.mode || "page";
      const opts = data?.options || {};

      if (mode === "annotation") {
        const annotationId = data?.target?.annotation_id || data?.annotation_id;
        if (!annotationId) {
          throw new Error("annotation_id required for annotation mode");
        }
        try { this.#logger.info(`[WS] 导航·标注：请求跳转 id=${annotationId}`, { toast: { type: "info", ms: 2000 } }); } catch {}
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
        try { this.#logger.info(`[WS] 导航·锚点：请求跳转 id=${anchorId}`, { toast: { type: "info", ms: 2000 } }); } catch {}
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
        try { this.#logger.info(`[WS] 导航·大纲：请求跳转 id=${outlineItemId}`, { toast: { type: "info", ms: 2000 } }); } catch {}
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
        try { this.#logger.info(`[WS] 导航·页面：跳转第 ${pageNumber} 页`, { toast: { type: "info", ms: 2000 } }); } catch {}
        // 统一经由 URL 导航入口；若 position 为百分比则透传，否则省略
        const pos = data?.target?.position || data?.position || null; // { y_percent, x_percent } or { x, y } or number
        let positionPercent = null;
        try {
          if (pos && typeof pos === "object" && typeof pos.y_percent === "number") {
            positionPercent = pos.y_percent;
          } else if (typeof pos === "number" && pos >= 0 && pos <= 100) {
            positionPercent = pos;
          }
        } catch {}
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
