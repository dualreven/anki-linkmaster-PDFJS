/**

 * WSClient (moved)

 */

import Logger from "../utils/logger.js";

import {
  WEBSOCKET_EVENTS,
  WEBSOCKET_MESSAGE_EVENTS,
  WEBSOCKET_MESSAGE_TYPES,
  WEBSOCKET_LEGACY_TYPES,
} from "../event/event-constants.js";
import { AllowedGlobalEvents } from "../event/global-event-registry.js";

export class WSClient {
  #url;
  #eventBus;
  #logger;
  #socket = null;
  #isConnectedFlag = false;
  #reconnectAttempts = 0;
  #maxReconnectAttempts = 5;
  #reconnectDelay = 1000;
  #messageQueue = [];
  #pendingRequests = new Map();
  #requestRetries = new Map();
  #lastError = null;
  #connectionHistory = [];
  #identity = null;

  static VALID_MESSAGE_TYPES = [
    "pdf_list_updated",
    WEBSOCKET_LEGACY_TYPES.PDF_LIBRARY_LIST_RECORDS,
    "pdf_list",
    "list",  // 兼容旧版广播类型（非三段式）
    "load_pdf_file",
    "pdf_detail_response",
    "success",
    "error",
    "response",
    "system_status",
    WEBSOCKET_LEGACY_TYPES.BOOKMARK_LIST_RECORDS,
    WEBSOCKET_LEGACY_TYPES.BOOKMARK_SAVE_RECORD,
    // 新增：契约与能力/搜索/存储事件（减少告警）
    WEBSOCKET_MESSAGE_TYPES.CAPABILITY_DISCOVER_COMPLETED,
    WEBSOCKET_MESSAGE_TYPES.CAPABILITY_DESCRIBE_COMPLETED,
    WEBSOCKET_MESSAGE_TYPES.SEARCH_PDF_COMPLETED,
    WEBSOCKET_MESSAGE_TYPES.SEARCH_PDF_FAILED,
    // 详情查询（确保为全局白名单外的环境也放行）
    WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_COMPLETED,
    WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_FAILED,
    // 查看器启动回执（pdf-home侧接收）
    WEBSOCKET_MESSAGE_TYPES.OPEN_PDF_COMPLETED,
    WEBSOCKET_MESSAGE_TYPES.OPEN_PDF_FAILED,
    WEBSOCKET_MESSAGE_TYPES.STORAGE_KV_GET_COMPLETED,
    WEBSOCKET_MESSAGE_TYPES.STORAGE_KV_GET_FAILED,
    WEBSOCKET_MESSAGE_TYPES.ADD_PDF_COMPLETED,
    WEBSOCKET_MESSAGE_TYPES.ADD_PDF_FAILED,
    // Annotation domain (allow inbound standard contract messages)
    WEBSOCKET_MESSAGE_TYPES.ANNOTATION_LIST_COMPLETED,
    WEBSOCKET_MESSAGE_TYPES.ANNOTATION_LIST_FAILED,
    WEBSOCKET_MESSAGE_TYPES.ANNOTATION_SAVE_COMPLETED,
    WEBSOCKET_MESSAGE_TYPES.ANNOTATION_SAVE_FAILED,
    WEBSOCKET_MESSAGE_TYPES.ANNOTATION_DELETE_COMPLETED,
    WEBSOCKET_MESSAGE_TYPES.ANNOTATION_DELETE_FAILED,
    // Debug / Flags
    WEBSOCKET_MESSAGE_TYPES.DEBUG_INFO_READ_COMPLETED,
    WEBSOCKET_MESSAGE_TYPES.DEBUG_INFO_READ_FAILED,
    // PDF-Viewer 契约消息（服务端→前端）
    WEBSOCKET_MESSAGE_TYPES.VIEWER_REGISTER_COMPLETED,
    WEBSOCKET_MESSAGE_TYPES.VIEWER_REGISTER_FAILED,
    WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED,
    WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_COMPLETED,
    WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_FAILED,
    // System / heartbeat / client registration
    WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_COMPLETED,
    WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_FAILED,
    WEBSOCKET_MESSAGE_TYPES.HEARTBEAT_COMPLETED
  ];

  static ALLOWED_OUTBOUND_TYPES = (() => {
    const values = new Set();
    // 收集所有 *:requested 作为可发送类型；兼容历史 *:request 后缀
    Object.values(WEBSOCKET_MESSAGE_TYPES).forEach((v) => {
      if (typeof v === "string") {
        if (v.endsWith(":requested")) { values.add(v); }
        if (v.endsWith(":request")) { values.add(v); }
      }
    });
    return values;
  })();

  constructor(url, eventBus, identityOptions = null) {
    this.#url = url;
    this.#eventBus = eventBus;
    this.#logger = new Logger("WSClient");
    this.#identity = this.#resolveIdentity(identityOptions);
    this.#setupEventListeners();
  }

  #resolveIdentity(identityOptions) {
    // 显式传入优先：允许调用方指定 client_name/client_id/module
    if (identityOptions && typeof identityOptions === "object") {
      const name = String(identityOptions.client_name || "").trim();
      const cid = (identityOptions.client_id !== null && identityOptions.client_id !== undefined)
        ? String(identityOptions.client_id).trim()
        : null;
      const mod = (identityOptions.module !== null && identityOptions.module !== undefined)
        ? String(identityOptions.module).trim()
        : null;
      if (name) {
        this.#logger.info(`[WSClient] 使用显式身份: ${name}:${cid || "none"} (module=${mod || "n/a"})`);
        return { client_name: name, client_id: cid, module: mod };
      }
    }

    // 浏览器环境下根据 URL 推断：pdf-viewer / pdf-home / 其他
    try {
      if (typeof window !== "undefined" && window.location) {
        const loc = window.location;
        const pathname = String(loc.pathname || "");
        const params = new URLSearchParams(loc.search || "");
        const pdfId = (params.get("pdf-id") || params.get("pdf_id") || "").trim();

        if (pathname.includes("/pdf-viewer/")) {
          const name = pdfId ? `pdf-viewer-${pdfId}` : "pdf-viewer";
          const cid = pdfId || null;
          this.#logger.info(`[WSClient] 解析为 pdf-viewer 身份: ${name}:${cid || "none"}`);
          return { client_name: name, client_id: cid, module: "pdf-viewer" };
        }

        if (pathname.includes("/pdf-home/")) {
          const name = "pdf-home";
          // pdf-home 使用固定的 client_id（单例窗口，不可多开）
          // 设计理由：
          // 1. 语义清晰：反映单例特性
          // 2. 路由稳定：不会因重连而变化
          // 3. 简化查找：后端可直接通过 "pdf-home" 定位
          const cid = "pdf-home";
          this.#logger.info(`[WSClient] 解析为 pdf-home 身份（固定ID）: ${name}:${cid}`);
          return { client_name: name, client_id: cid, module: "pdf-home" };
        }
      }
    } catch {
      // 忽略 URL 解析失败，走到通用分支
    }

    // 兜底：通用 js-client
    const fallback = { client_name: "js-client", client_id: null, module: "generic" };
    this.#logger.info("[WSClient] 使用默认身份: js-client");
    return fallback;
  }

  #setupEventListeners() {
    this.#eventBus.on(
      WEBSOCKET_EVENTS.MESSAGE.SEND,
      (message) => {
        this.#logger.info(
          `Received request to send message: ${JSON.stringify(
            message,
            null,
            2
          )}`
        );
        this.send(message);
      },
      { subscriberId: "WSClient" }
    );

    // 添加状态查询响应
    this.#eventBus.on(
      WEBSOCKET_EVENTS.MSG_CENTER.STATUS.REQUEST,
      () => {
        const statusData = {
          connected: this.isConnected(),
          url: this.#url,
          readyState: this.#socket?.readyState || null,
          reconnectAttempts: this.#reconnectAttempts
        };
        this.#logger.info(`Status requested, responding with: ${JSON.stringify(statusData)}`);
        this.#eventBus.emit(WEBSOCKET_EVENTS.MSG_CENTER.STATUS.RESPONSE, statusData, {
          actorId: "WSClient"
        });
      },
      { subscriberId: "WSClient" }
    );
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.#logger.info(`Connecting to WebSocket server: ${this.#url}`);
        this.#socket = new WebSocket(this.#url);

        const onOpen = () => {
          cleanup();
          resolve();
        };

        const onError = (error) => {
          cleanup();
          this.#logger.error("Failed to initiate WebSocket connection.", error);
          this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.FAILED, error, {
            actorId: "WSClient",
          });
          reject(error);
        };

        const cleanup = () => {
          try { this.#socket.removeEventListener("open", onOpen); } catch (e) { this.#logger.debug("[WSClient] cleanup removeEventListener(open) failed", e); }
          try { this.#socket.removeEventListener("error", onError); } catch (e) { this.#logger.debug("[WSClient] cleanup removeEventListener(error) failed", e); }
        };

        this.#socket.addEventListener("open", onOpen);
        this.#socket.addEventListener("error", onError);

        this.#attachSocketHandlers();
      } catch (error) {
        this.#logger.error("Failed to create WebSocket object.", error);
        this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.FAILED, error, {
          actorId: "WSClient",
        });
        reject(error);
      }
    });
  }

  /**
   * 断开WebSocket连接（先发送取消注册消息，再关闭连接）
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.#socket) {
      this.#logger.info("Disconnecting WebSocket.");

      // 1. 先发送取消注册消息（有超时保护，不会阻塞）
      if (this.isConnected()) {
        try {
          await this.#sendClientUnregister("manual_disconnect");
        } catch (error) {
          // 忽略错误，继续断开流程
          this.#logger.debug("[WSClient] 取消注册失败，继续断开", error);
        }
      }

      // 2. 再关闭WebSocket连接
      this.#socket.close(1000, "Client initiated disconnect.");
      this.#socket = null;
      this.#isConnectedFlag = false;
    }
  }

  isConnected() {
    return this.#isConnectedFlag && this.#socket?.readyState === WebSocket.OPEN;
  }

  send(messageInput) {
    // 支持两种调用方式:
    // 1. send({ type, data }) - 传统方式，自动添加timestamp
    // 2. send({ type, request_id, data, ... }) - 完整消息，保留所有字段
    const type = messageInput.type;
    const data = messageInput.data || {};

    // 保留原始消息的所有字段（如 request_id），并添加 timestamp（如果没有）
    const message = {
      ...messageInput,  // 保留所有原始字段
      timestamp: messageInput.timestamp || Date.now()  // 添加时间戳（如果没有）
    };

    // ========== 自动添加 to 字段（新协议：2025-01-16）==========
    // 规则：
    // 1. 注册/取消注册消息禁止包含 to 字段
    // 2. 已有 to 字段的消息不覆盖（调用方显式指定）
    // 3. 其他请求消息自动添加 to: "backend"
    const REGISTER_MESSAGES = [
      WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_REQUESTED,
      WEBSOCKET_MESSAGE_TYPES.CLIENT_UNREGISTER_REQUESTED,  // 客户端取消注册（窗口关闭时）
      WEBSOCKET_MESSAGE_TYPES.VIEWER_REGISTER_REQUESTED
    ];

    if (!message.to && !REGISTER_MESSAGES.includes(type)) {
      // 自动添加 to: "backend"（大部分请求消息都是后端消息）
      message.to = "backend";
      this.#logger.debug(`[WSClient] 自动添加 to: "backend" (type=${type})`);
    }

    if (this.isConnected()) {
      try {
        // 若该消息对应 request() 生成的 pending 请求，则在真正发送前启动 timeout 计时
        // （避免“排队时提前超时，flush 后响应无人接收”）
        try {
          const rid = message.request_id;
          if (rid && this.#pendingRequests.has(rid)) {
            const h = this.#pendingRequests.get(rid);
            if (h && typeof h.startTimeout === "function") {
              h.startTimeout();
            }
          }
        } catch { /* ignore */ }

        this.#socket.send(JSON.stringify(message));
        this.#logger.debug(`✉️ 已发送消息: ${type}`, {
          type,
          data,
          request_id: message.request_id || "none"
        });
      } catch (error) {
        const errorInfo = {
          error_code: "MESSAGE_SEND_ERROR",
          message_type: type,
          error_name: error.name,
          error_message: error.message,
          ready_state: this.#socket?.readyState,
          ready_state_name: this.#getReadyStateName(),
          queued_messages: this.#messageQueue.length,
          diagnostic: "消息发送失败，可能是连接已断开或消息格式错误"
        };

        this.#logger.error(`❌ 消息发送失败: ${type}`, JSON.stringify(errorInfo, null, 2));

        this.#eventBus.emit(
          WEBSOCKET_EVENTS.MESSAGE.SEND_FAILED,
          errorInfo,
          { actorId: "WSClient" }
        );

        this.#messageQueue.push(message);
        this.#logger.info(`📥 消息已加入队列，等待重连后发送: ${type}`);
      }
    } else {
      this.#messageQueue.push(message);
      this.#logger.debug(`📥 消息已排队（连接未建立）: ${type}`, {
        queue_length: this.#messageQueue.length,
        ready_state: this.#socket?.readyState,
        ready_state_name: this.#getReadyStateName()
      });
    }
  }

  #attachSocketHandlers() {
    this.#socket.onopen = () => {
      const connectionInfo = {
        url: this.#url,
        timestamp: Date.now(),
        reconnect_attempts: this.#reconnectAttempts
      };

      this.#connectionHistory.push({
        event: "connected",
        ...connectionInfo
      });

      this.#logger.info("✅ WebSocket连接已建立", JSON.stringify(connectionInfo, null, 2));
      this.#isConnectedFlag = true;
      this.#reconnectAttempts = 0;
      this.#lastError = null;

      this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED, connectionInfo, {
        actorId: "WSClient",
      });

      // 注册逻辑已移至各模块的 WebSocketAdapter（pdf-viewer/pdf-home）
      // 不再需要延迟回退机制

      this.#flushMessageQueue();
    };

    this.#socket.onmessage = (event) => this.#handleMessage(event.data);

    this.#socket.onclose = (event) => {
      const closeInfo = {
        code: event.code,
        reason: event.reason || "未提供原因",
        wasClean: event.wasClean,
        url: this.#url,
        timestamp: Date.now(),
        queued_messages: this.#messageQueue.length
      };

      this.#connectionHistory.push({
        event: "closed",
        ...closeInfo
      });

      this.#logger.warn("⚠️ WebSocket连接已关闭", JSON.stringify(closeInfo, null, 2));
      this.#isConnectedFlag = false;

      this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.CLOSED, closeInfo, {
        actorId: "WSClient",
      });
      this.#attemptReconnect();
    };

    this.#socket.onerror = (error) => {
      const errorInfo = {
        error_code: "CONNECTION_ERROR",
        url: this.#url,
        ready_state: this.#socket?.readyState,
        ready_state_name: this.#getReadyStateName(),
        reconnect_attempts: this.#reconnectAttempts,
        max_reconnect_attempts: this.#maxReconnectAttempts,
        timestamp: Date.now(),
        error
      };

      this.#lastError = errorInfo;
      this.#connectionHistory.push({
        event: "error",
        ...errorInfo
      });

      this.#logger.error("❌ WebSocket连接错误", JSON.stringify(errorInfo, null, 2));

      this.#eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.ERROR, errorInfo, {
        actorId: "WSClient",
      });
    };
  }

  #handleMessage(rawData) {
    try {
      const message = JSON.parse(rawData);
      // 提升关键入站消息的可见性：统一按 info 级别记录类型与 request_id
      this.#logger.info(`Received message: ${String(message.type)} rid=${message.request_id || "none"}`);

      if (!message.type) {
        this.#logger.error("❌ WebSocket消息缺少type字段", {
          rawData: rawData.substring(0, 200),
          message,
          diagnostic: "后端消息必须包含type字段，请检查消息格式"
        });
        this.#eventBus.emit(WEBSOCKET_MESSAGE_EVENTS.ERROR, {
          error_code: "MISSING_MESSAGE_TYPE",
          message: "消息缺少type字段",
          raw_message: message
        }, { actorId: "WSClient" });
        return;
      }

      // 发出通用的 websocket:message:received 事件（所有消息都会发出）
      // 这允许任何 Feature 监听所有 WebSocket 消息并自行过滤
      this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, message, {
        actorId: "WSClient"
      });

      // 泛化的请求-响应结算：
      // 任何带 request_id 的消息，若类型以 completed/failed 结尾或带有 status 字段，则结算对应 pending 请求
      const rid = message?.request_id;
      const typeStr = String(message?.type || "");
      const status = message?.status;
      const isTerminal = typeStr.endsWith(":completed") || typeStr.endsWith(":failed") || typeof status === "string";
      if (rid && this.#pendingRequests.has(rid) && isTerminal) {
        // 增强可观测性：记录结算信息（仅注解域/调试排障用）
        if (typeStr.startsWith("annotation:")) {
          this.#logger.info("[WSClient] Settling request", JSON.stringify({ type: typeStr, request_id: rid, status: status || "n/a" }, null, 2));
        }
        if (status === "error" || typeStr.endsWith(":failed")) {
          this._settlePendingRequest(message, { error: message?.error || message?.data || { message: "请求失败" } });
        } else {
          this._settlePendingRequest(message);
        }
      }

      // 允许标准契约外的一些通用类型（后端可能返回 'response'/'error' 等兼容类型）
      const _type = String(message.type || "");
      const isCompatAllowed = WSClient.VALID_MESSAGE_TYPES.includes(_type) || _type === "response";
      if (!AllowedGlobalEvents.has(message.type) && !isCompatAllowed) {
        // 未注册的消息类型：拦截并作为错误处理
        const errInfo = {
          error_code: "UNREGISTERED_MESSAGE_TYPE",
          received_type: message.type,
          note: "该消息类型不在全局事件白名单中，已被拦截",
        };
        this.#logger.error("❌ 拦截未注册WebSocket消息类型", JSON.stringify(errInfo, null, 2));
        // 如果有 pending 请求，按失败结算
        if (message?.request_id && this.#pendingRequests.has(message.request_id)) {
          this._settlePendingRequest(message, { error: errInfo });
        }
        // 广播错误
        this.#eventBus.emit(WEBSOCKET_MESSAGE_EVENTS.ERROR, errInfo, { actorId: "WSClient" });
        return;
      }

      let targetEvent = null;
      const typeStrGeneric = String(message.type || "");
      // 通用失败类型路由到 ERROR（例如 anchor:update:failed / pdf-library:*:failed 等）
      if (typeStrGeneric.endsWith(":failed")) {
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.ERROR;
      } else {
        switch (message.type) {
        case "pdf_list_updated":
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.PDF_LIST_UPDATED;
          break;
        case WEBSOCKET_LEGACY_TYPES.PDF_LIBRARY_LIST_RECORDS:
        case "pdf_list":
        case "list":  // 兼容旧版广播类型
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.PDF_LIST;
          break;
        // 统一将标准契约的 add 完成/失败 路由为通用响应，方便上层复用既有监听
        case WEBSOCKET_MESSAGE_TYPES.ADD_PDF_COMPLETED:
          this._settlePendingRequest(message);
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
          break;
        case WEBSOCKET_MESSAGE_TYPES.ADD_PDF_FAILED:
          this._settlePendingRequest(message, { error: message?.error || message?.data });
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
          break;
        case WEBSOCKET_MESSAGE_TYPES.REMOVE_PDF_COMPLETED:
        // 标准删除完成事件：路由为通用 RESPONSE，供上层 PDFListFeature 统一处理
          this._settlePendingRequest(message);
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
          break;
        case WEBSOCKET_MESSAGE_TYPES.REMOVE_PDF_FAILED:
        // 标准删除失败事件：同样路由为通用 RESPONSE，便于上层在同一监听中处理 error/status
          this._settlePendingRequest(message, { error: message?.error || message?.data });
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
          break;
        case "batch_pdf_removed":
        // 兼容旧批量删除完成事件
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
          break;
        case "pdf_removed":
        // 兼容旧单个删除完成事件
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
          break;
        case WEBSOCKET_LEGACY_TYPES.BOOKMARK_LIST_RECORDS:
          this._settlePendingRequest(message);
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.BOOKMARK_LIST;
          break;
        case WEBSOCKET_LEGACY_TYPES.BOOKMARK_SAVE_RECORD:
          this._settlePendingRequest(message);
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.BOOKMARK_SAVE;
          break;
        case "load_pdf_file":
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.LOAD_PDF_FILE;
          break;
        case "pdf_detail_response":
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
          this._handlePDFDetailResponse(message);
          break;
        case WEBSOCKET_MESSAGE_TYPES.SEARCH_PDF_COMPLETED:
        // 标准搜索完成事件：统一路由为通用 RESPONSE，便于既有模块复用
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
          break;
        case WEBSOCKET_MESSAGE_TYPES.SEARCH_PDF_FAILED:
        // 标准搜索失败事件：作为通用 ERROR 处理
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.ERROR;
          break;
        case WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_COMPLETED:
        // 标准详情完成事件：统一路由为通用 RESPONSE，便于上层监听
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
          break;
        case WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_FAILED:
        // 标准详情失败事件：路由为通用 ERROR
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.ERROR;
          break;
        case WEBSOCKET_MESSAGE_TYPES.PDF_LIST_COMPLETED:
        // 统一作为通用 RESPONSE，供上层 PDF 列表处理逻辑消费
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
          break;
        case WEBSOCKET_MESSAGE_TYPES.CONFIG_READ_COMPLETED:
        // 统一作为通用 RESPONSE，便于配置读取监听
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
          break;
        // ===== Annotation domain (route to generic RESPONSE/ERROR and ensure settle) =====
        case WEBSOCKET_MESSAGE_TYPES.ANNOTATION_LIST_COMPLETED:
          this._settlePendingRequest(message);
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
          break;
        case WEBSOCKET_MESSAGE_TYPES.ANNOTATION_LIST_FAILED:
          this._settlePendingRequest(message, { error: message?.error || message?.data });
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.ERROR;
          break;
        case WEBSOCKET_MESSAGE_TYPES.ANNOTATION_SAVE_COMPLETED:
          this._settlePendingRequest(message);
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
          break;
        case WEBSOCKET_MESSAGE_TYPES.ANNOTATION_SAVE_FAILED:
          this._settlePendingRequest(message, { error: message?.error || message?.data });
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.ERROR;
          break;
        case WEBSOCKET_MESSAGE_TYPES.ANNOTATION_DELETE_COMPLETED:
          this._settlePendingRequest(message);
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
          break;
        case WEBSOCKET_MESSAGE_TYPES.ANNOTATION_DELETE_FAILED:
          this._settlePendingRequest(message, { error: message?.error || message?.data });
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.ERROR;
          break;
        // ===== Outline bulk save =====
        case WEBSOCKET_MESSAGE_TYPES.OUTLINE_BULK_SAVE_COMPLETED:
          this._settlePendingRequest(message);
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
          break;
        case WEBSOCKET_MESSAGE_TYPES.OUTLINE_BULK_SAVE_FAILED:
          this._settlePendingRequest(message, { error: message?.error || message?.data });
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.ERROR;
          break;
        case "success":
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.SUCCESS;
          break;
        case "error":
          this._settlePendingRequest(message, { error: message?.error || message?.data });
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.ERROR;
          break;
        case "response":
        // 兼容旧服务：通用 response 也广播为标准 RESPONSE 事件，便于上层统一处理
          this._settlePendingRequest(message);
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
          break;
        case "system_status":
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.SYSTEM_STATUS;
          break;
        case WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_COMPLETED:
          // 注册成功：结算请求
          this._settlePendingRequest(message);
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
          break;
        case WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_FAILED:
          // 注册失败：结算请求
          this._settlePendingRequest(message, { error: message?.error || message?.data });
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.ERROR;
          break;
        default:
          targetEvent = WEBSOCKET_MESSAGE_EVENTS.UNKNOWN;
        }
      }

      if (targetEvent) {
        this.#logger.debug(`Routing message to event: ${targetEvent}`);
        // eslint-disable-next-line custom/event-name-format
        this.#eventBus.emit(targetEvent, message, { actorId: "WSClient" });
      }
    } catch (error) {
      const errorContext = {
        error_code: "MESSAGE_PARSE_ERROR",
        error_name: error.name,
        error_message: error.message,
        stack: error.stack,
        raw_data_preview: rawData.substring(0, 200),
        raw_data_length: rawData.length,
        diagnostic: "消息解析失败，可能是JSON格式错误或包含非法字符"
      };

      this.#logger.error("❌ WebSocket消息解析失败", JSON.stringify(errorContext, null, 2));

      this.#eventBus.emit(WEBSOCKET_MESSAGE_EVENTS.ERROR, errorContext, {
        actorId: "WSClient"
      });
    }
  }

  /**
   * 生成唯一的请求ID
   * @returns {string} 唯一的请求ID
   */
  _generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  _settlePendingRequest(message, { error = null, data = undefined } = {}) {
    const requestId = message?.request_id;
    if (!requestId || !this.#pendingRequests.has(requestId)) {
      return false;
    }

    const handlers = this.#pendingRequests.get(requestId);
    this.#pendingRequests.delete(requestId);
    this.#requestRetries.delete(requestId);

    if (error) {
      const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : (error?.message || "WebSocket请求失败"));
      handlers.reject(err);
    } else {
      handlers.resolve(data !== undefined ? data : message?.data);
    }
    return true;
  }

  /**
   * 构建符合标准协议的PDF详情请求消息
   * @param {string} pdfId - PDF文件ID
   * @param {string} requestId - 请求ID
   * @returns {object} 标准格式的消息
   */
  _buildPDFDetailRequestMessage(pdfId, requestId) {
    return {
      type: WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_REQUEST,
      request_id: requestId,
      timestamp: Date.now(),
      metadata: { version: "1.0.0" },
      data: {
        pdf_id: pdfId
      }
    };
  }

  /**
   * 发送客户端取消注册消息（窗口关闭时调用）
   *
   * ✅ 修复：同时注销新旧两个 client_id，防止 RouteRegistry 中的"僵尸"记录
   * - 旧协议 client_id：如 "sample"（旧注册机制，已废弃）
   * - 新协议 client_name：如 "pdf-viewer-sample"（新注册机制）
   *
   * @param {string} reason - 取消注册原因（默认: "window_closing"）
   * @returns {Promise<void>} - 总是resolve（避免阻塞窗口关闭）
   * @private
   */
  async #sendClientUnregister(reason = "window_closing") {
    const ident = this.#identity || {};
    const clientId = ident.client_id;        // 旧协议ID（如 "sample"）
    const clientName = ident.client_name;    // 新协议ID（如 "pdf-viewer-sample"）

    if (!clientId && !clientName) {
      this.#logger.debug("[WSClient] 跳过取消注册：缺少 client_id 和 client_name");
      return Promise.resolve();
    }

    if (!WEBSOCKET_MESSAGE_TYPES.CLIENT_UNREGISTER_REQUESTED) {
      this.#logger.debug("[WSClient] CLIENT_UNREGISTER_REQUESTED 未在常量集中注册，跳过取消注册");
      return Promise.resolve();
    }

    // ✅ 同时注销新旧两个ID（防御性编程，确保完全清理）
    const unregisterTasks = [];

    // 注销旧协议ID
    if (clientId) {
      this.#logger.info(`[WSClient] 注销旧协议 client_id: ${clientId}, reason=${reason}`);
      unregisterTasks.push(
        this.request(
          WEBSOCKET_MESSAGE_TYPES.CLIENT_UNREGISTER_REQUESTED,
          { client_id: clientId, reason },
          { timeout: 500 }
        ).then(() => {
          this.#logger.info(`[WSClient] ✅ 旧协议注销成功: ${clientId}`);
        }).catch(error => {
          this.#logger.warn(`[WSClient] ⚠️ 旧协议注销失败（忽略）: ${clientId}, error=${error.message}`);
        })
      );
    }

    // 注销新协议ID（如果与旧ID不同）
    if (clientName && clientName !== clientId) {
      this.#logger.info(`[WSClient] 注销新协议 client_name: ${clientName}, reason=${reason}`);
      unregisterTasks.push(
        this.request(
          WEBSOCKET_MESSAGE_TYPES.CLIENT_UNREGISTER_REQUESTED,
          { client_id: clientName, reason },
          { timeout: 500 }
        ).then(() => {
          this.#logger.info(`[WSClient] ✅ 新协议注销成功: ${clientName}`);
        }).catch(error => {
          this.#logger.warn(`[WSClient] ⚠️ 新协议注销失败（忽略）: ${clientName}, error=${error.message}`);
        })
      );
    }

    // 等待所有注销任务完成（即使部分失败也继续）
    try {
      await Promise.allSettled(unregisterTasks);
      this.#logger.info("[WSClient] 取消注册完成（新旧协议均已尝试）");
    } catch (error) {
      // Promise.allSettled 不会reject，这里是兜底
      this.#logger.warn(`[WSClient] 取消注册异常（忽略）: ${error.message}`);
    }

    // 总是resolve，确保不阻塞后续流程
    return Promise.resolve();
  }

  async request(messageType, payload = {}, options = {}) {
    // 严格白名单：仅允许已注册的 *:requested 类型
    if (!WSClient.ALLOWED_OUTBOUND_TYPES.has(messageType)) {
      const err = new Error(`未注册的请求消息类型：${messageType}. 请使用 event-constants.js 中的 WEBSOCKET_MESSAGE_TYPES 或先合入契约文档`);
      this.#logger.error("❌ WS 请求被拒绝（未注册类型）", { messageType });
      throw err;
    }
    const { timeout = 5000, maxRetries = 0, metadata = undefined } = options;
    const requestId = this._generateRequestId();
    const message = {
      type: messageType,
      request_id: requestId,
      timestamp: Date.now(),
      data: payload
    };
    if (metadata) { message.metadata = metadata; }

    // ========== 自动添加 to 字段（新协议：2025-01-16）==========
    // 规则：注册/取消注册消息禁止包含 to，其他请求消息自动添加 to: "backend"
    const REGISTER_MESSAGES = [
      WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_REQUESTED,
      WEBSOCKET_MESSAGE_TYPES.CLIENT_UNREGISTER_REQUESTED,  // 客户端取消注册（窗口关闭时）
      WEBSOCKET_MESSAGE_TYPES.VIEWER_REGISTER_REQUESTED
    ];
    if (!message.to && !REGISTER_MESSAGES.includes(messageType)) {
      message.to = "backend";
      this.#logger.debug(`[WSClient] request() 自动添加 to: "backend" (type=${messageType})`);
    }

    return new Promise((resolve, reject) => {
      let retryCount = 0;

      const doRegisterPending = () => {
        // 关键：当 WS 还未连接时，request 会被排队等待 flush 发送。
        // 如果此时就启动 timeout，会导致“连接尚未建立即超时，随后 flush 发送但响应无人接收”的丢失。
        // 因此 timeout 仅在消息真正被发送时才开始计时（见 send()/flush 阶段的 startTimeout）。
        const timeoutRef = { id: null };

        const startTimeout = () => {
          if (timeoutRef.id) { return; }
          timeoutRef.id = setTimeout(() => {
            this.#pendingRequests.delete(requestId);
            this.#requestRetries.delete(requestId);
            reject(new Error("请求超时"));
          }, timeout);
        };

        this.#pendingRequests.set(requestId, {
          startTimeout,
          resolve: (data) => {
            if (timeoutRef.id) { clearTimeout(timeoutRef.id); }
            resolve(data);
          },
          reject: (error) => {
            if (timeoutRef.id) { clearTimeout(timeoutRef.id); }
            reject(error);
          }
        });
      };

      const sendOnce = () => {
        if (!this.isConnected()) {
          // 未连接：注册 pending，消息入队，等待连接后由 flush 发送
          doRegisterPending();
          this.#messageQueue.push(message);
          this.#logger.debug(`📥 请求已排队（连接未建立）: ${messageType}`, {
            request_id: requestId,
            queue_length: this.#messageQueue.length,
            ready_state_name: this.#getReadyStateName()
          });
          return;
        }

        doRegisterPending();
        try {
          const h = this.#pendingRequests.get(requestId);
          if (h && typeof h.startTimeout === "function") {
            h.startTimeout();
          }
        } catch { /* ignore */ }
        try {
          message.timestamp = Date.now();
          this.#socket.send(JSON.stringify(message));
          this.#logger.debug(`WS request sent: ${messageType}`, message);
        } catch (error) {
          if (retryCount < maxRetries) {
            retryCount += 1;
            this.#requestRetries.set(requestId, retryCount);
            this.#logger.warn(`WS请求发送失败，第${retryCount}次重试: ${error.message}`);
            setTimeout(() => sendOnce(), 1000 * retryCount);
          } else {
            this.#pendingRequests.delete(requestId);
            this.#requestRetries.delete(requestId);
            const err = error instanceof Error ? error : new Error(error?.message || "WebSocket请求失败");
            reject(err);
          }
        }
      };

      sendOnce();
    });
  }

  /**
   * 处理PDF详情响应
   * @param {object} message - 响应消息
   * @private
   */
  _handlePDFDetailResponse(message) {
    const { data, error } = message || {};
    const err = error ? new Error(error.message || "PDF详情请求失败") : null;
    this._settlePendingRequest(message || {}, { error: err, data });
  }

  /**
   * 发送PDF详情请求
   * @param {string} pdfId - PDF文件ID
   * @param {number} timeout - 超时时间（毫秒），默认5000
   * @param {number} maxRetries - 最大重试次数，默认3
   * @returns {Promise<object>} PDF详情数据
   */
  async sendPDFDetailRequest(pdfId, timeout = 5000, maxRetries = 3) {
    return this.request(
      WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_REQUEST,
      { pdf_id: pdfId },
      { timeout, maxRetries, metadata: { version: "1.0.0" } }
    );
  }

  /**
   * 发送系统心跳请求（严格契约）
   * @param {number} timeout - 超时（毫秒）
   * @returns {Promise<object>} 心跳返回数据（包含 timestamp ）
   */
  async sendHeartbeat(timeout = 4000) {
    return this.request(
      WEBSOCKET_MESSAGE_TYPES.HEARTBEAT_REQUESTED,
      {},
      { timeout, metadata: { version: "1.0.0" } }
    );
  }
  #attemptReconnect() {
    if (this.#reconnectAttempts >= this.#maxReconnectAttempts) {
      const failureInfo = {
        error_code: "MAX_RECONNECT_ATTEMPTS",
        url: this.#url,
        attempts: this.#reconnectAttempts,
        max_attempts: this.#maxReconnectAttempts,
        queued_messages: this.#messageQueue.length,
        last_error: this.#lastError,
        connection_history: this.#connectionHistory.slice(-5)
      };

      this.#logger.error("❌ WebSocket重连失败：已达最大重试次数", JSON.stringify(failureInfo, null, 2));

      this.#eventBus.emit(WEBSOCKET_EVENTS.RECONNECT.FAILED, failureInfo, {
        actorId: "WSClient",
      });
      return;
    }

    this.#reconnectAttempts++;
    const delay = this.#reconnectDelay * this.#reconnectAttempts;

    this.#logger.info(
      `🔄 尝试重新连接 (${this.#reconnectAttempts}/${this.#maxReconnectAttempts})`,
      JSON.stringify({
        url: this.#url,
        delay_ms: delay,
        queued_messages: this.#messageQueue.length
      }, null, 2)
    );

    setTimeout(
      () => this.connect(),
      delay
    );
  }

  #flushMessageQueue() {
    const queueLength = this.#messageQueue.length;
    if (queueLength === 0) {
      return;
    }

    this.#logger.info("📤 开始发送队列中的消息", JSON.stringify({
      queue_length: queueLength,
      messages: this.#messageQueue.map(m => m.type)
    }, null, 2));

    let successCount = 0;
    let failCount = 0;

    while (this.#messageQueue.length > 0) {
      const message = this.#messageQueue.shift();
      try {
        // 保留原始消息（包含 request_id 等字段），避免丢失请求关联
        this.send(message);
        successCount++;
      } catch (error) {
        failCount++;
        this.#logger.error(`队列消息发送失败: ${message.type}`, error);
      }
    }

    this.#logger.info("✅ 队列消息发送完成", JSON.stringify({
      total: queueLength,
      success: successCount,
      failed: failCount
    }, null, 2));
  }

  #getReadyStateName() {
    if (!this.#socket) {return "NO_SOCKET";}
    const states = {
      [WebSocket.CONNECTING]: "CONNECTING",
      [WebSocket.OPEN]: "OPEN",
      [WebSocket.CLOSING]: "CLOSING",
      [WebSocket.CLOSED]: "CLOSED"
    };
    return states[this.#socket.readyState] || "UNKNOWN";
  }

  getConnectionHistory() {
    return [...this.#connectionHistory];
  }

  getLastError() {
    return this.#lastError;
  }

  getDebugInfo() {
    return {
      url: this.#url,
      connected: this.#isConnectedFlag,
      ready_state: this.#socket?.readyState,
      ready_state_name: this.#getReadyStateName(),
      reconnect_attempts: this.#reconnectAttempts,
      max_reconnect_attempts: this.#maxReconnectAttempts,
      queued_messages: this.#messageQueue.length,
      pending_requests: this.#pendingRequests.size,
      last_error: this.#lastError,
      connection_history: this.#connectionHistory.slice(-10)
    };
  }

  /**
   * 获取客户端身份信息（用于窗口控制等功能）
   * @returns {Object} 身份对象 { client_name, client_id, module }
   */
  getIdentity() {
    return this.#identity ? { ...this.#identity } : null;
  }

  /**
   * 获取客户端名称（用于后端识别窗口）
   * @returns {string|null} 客户端名称（如 'pdf-viewer-c83c60c58ad2' 或 'pdf-home'）
   */
  getClientName() {
    return this.#identity?.client_name || null;
  }
}

// 兼容默认导出（部分模块以 default 方式导入）
export default WSClient;
