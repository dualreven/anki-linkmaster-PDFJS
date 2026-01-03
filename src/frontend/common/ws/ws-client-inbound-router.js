import {
  WEBSOCKET_EVENTS,
  WEBSOCKET_MESSAGE_EVENTS,
  WEBSOCKET_MESSAGE_TYPES,
  WEBSOCKET_LEGACY_TYPES,
} from "../event/event-constants.js";
import { AllowedGlobalEvents } from "../event/global-event-registry.js";

/**
 * WSClient 入站消息处理（解析 + 白名单校验 + 路由 + 结算 pending 请求）
 *
 * @param {{
 *  rawData: string,
 *  eventBus: any,
 *  logger: any,
 *  validMessageTypes: string[],
 *  pendingRequests: Map<string, any>,
 *  settlePendingRequest: (message:any, options?:{error?:any,data?:any})=>boolean,
 * }} ctx
 * @returns {void}
 */
export function handleWsClientInboundRawMessage(ctx) {
  const { rawData, eventBus, logger, validMessageTypes, pendingRequests, settlePendingRequest } = ctx;

  try {
    const message = JSON.parse(rawData);
    logger?.info?.(`Received message: ${String(message.type)} rid=${message.request_id || "none"}`);

    if (!message.type) {
      logger?.error?.("❌ WebSocket消息缺少type字段", {
        rawData: String(rawData || "").substring(0, 200),
        message,
        diagnostic: "后端消息必须包含type字段，请检查消息格式"
      });
      eventBus.emit(WEBSOCKET_MESSAGE_EVENTS.ERROR, {
        error_code: "MISSING_MESSAGE_TYPE",
        message: "消息缺少type字段",
        raw_message: message
      }, { actorId: "WSClient" });
      return;
    }

    eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, message, { actorId: "WSClient" });

    // 泛化的请求-响应结算：
    const rid = message?.request_id;
    const typeStr = String(message?.type || "");
    const status = message?.status;
    const isTerminal = typeStr.endsWith(":completed") || typeStr.endsWith(":failed") || typeof status === "string";
    if (rid && pendingRequests.has(rid) && isTerminal) {
      if (typeStr.startsWith("annotation:")) {
        logger?.info?.("[WSClient] Settling request", JSON.stringify({ type: typeStr, request_id: rid, status: status || "n/a" }, null, 2));
      }
      if (status === "error" || typeStr.endsWith(":failed")) {
        settlePendingRequest(message, { error: message?.error || message?.data || { message: "请求失败" } });
      } else {
        settlePendingRequest(message);
      }
    }

    // 允许标准契约外的一些通用类型
    const _type = String(message.type || "");
    const isCompatAllowed = (Array.isArray(validMessageTypes) && validMessageTypes.includes(_type)) || _type === "response";
    if (!AllowedGlobalEvents.has(message.type) && !isCompatAllowed) {
      const errInfo = {
        error_code: "UNREGISTERED_MESSAGE_TYPE",
        received_type: message.type,
        note: "该消息类型不在全局事件白名单中，已被拦截",
      };
      logger?.error?.("❌ 拦截未注册WebSocket消息类型", JSON.stringify(errInfo, null, 2));
      if (message?.request_id && pendingRequests.has(message.request_id)) {
        settlePendingRequest(message, { error: errInfo });
      }
      eventBus.emit(WEBSOCKET_MESSAGE_EVENTS.ERROR, errInfo, { actorId: "WSClient" });
      return;
    }

    let targetEvent = null;
    const typeStrGeneric = String(message.type || "");
    if (typeStrGeneric.endsWith(":failed")) {
      targetEvent = WEBSOCKET_MESSAGE_EVENTS.ERROR;
    } else {
      switch (message.type) {
      case "pdf_list_updated":
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.PDF_LIST_UPDATED;
        break;
      case WEBSOCKET_LEGACY_TYPES.PDF_LIBRARY_LIST_RECORDS:
      case "pdf_list":
      case "list":
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.PDF_LIST;
        break;
      // 统一将标准契约的 add 完成/失败 路由为通用响应，方便上层复用既有监听
      case WEBSOCKET_MESSAGE_TYPES.ADD_PDF_COMPLETED:
        settlePendingRequest(message);
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
        break;
      case WEBSOCKET_MESSAGE_TYPES.ADD_PDF_FAILED:
        settlePendingRequest(message, { error: message?.error || message?.data });
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
        break;
      case WEBSOCKET_MESSAGE_TYPES.REMOVE_PDF_COMPLETED:
      // 标准删除完成事件：路由为通用 RESPONSE，供上层 PDFListFeature 统一处理
        settlePendingRequest(message);
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
        break;
      case WEBSOCKET_MESSAGE_TYPES.REMOVE_PDF_FAILED:
      // 标准删除失败事件：同样路由为通用 RESPONSE，便于上层在同一监听中处理 error/status
        settlePendingRequest(message, { error: message?.error || message?.data });
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
        break;
      case "batch_pdf_removed":
      // 兼容旧批量删除完成事件
      // falls through
      case "pdf_removed":
      // 兼容旧单个删除完成事件
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
        break;
      case WEBSOCKET_LEGACY_TYPES.BOOKMARK_LIST_RECORDS:
        settlePendingRequest(message);
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.BOOKMARK_LIST;
        break;
      case WEBSOCKET_LEGACY_TYPES.BOOKMARK_SAVE_RECORD:
        settlePendingRequest(message);
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.BOOKMARK_SAVE;
        break;
      case "load_pdf_file":
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.LOAD_PDF_FILE;
        break;
      case "pdf_detail_response": {
        const { data, error } = message || {};
        const err = error ? new Error(error.message || "PDF详情请求失败") : null;
        settlePendingRequest(message || {}, { error: err, data });
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
        break;
      }
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
        settlePendingRequest(message);
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
        break;
      case WEBSOCKET_MESSAGE_TYPES.ANNOTATION_LIST_FAILED:
        settlePendingRequest(message, { error: message?.error || message?.data });
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.ERROR;
        break;
      case WEBSOCKET_MESSAGE_TYPES.ANNOTATION_SAVE_COMPLETED:
        settlePendingRequest(message);
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
        break;
      case WEBSOCKET_MESSAGE_TYPES.ANNOTATION_SAVE_FAILED:
        settlePendingRequest(message, { error: message?.error || message?.data });
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.ERROR;
        break;
      case WEBSOCKET_MESSAGE_TYPES.ANNOTATION_DELETE_COMPLETED:
        settlePendingRequest(message);
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
        break;
      case WEBSOCKET_MESSAGE_TYPES.ANNOTATION_DELETE_FAILED:
        settlePendingRequest(message, { error: message?.error || message?.data });
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.ERROR;
        break;
      // ===== Outline bulk save =====
      case WEBSOCKET_MESSAGE_TYPES.OUTLINE_BULK_SAVE_COMPLETED:
        settlePendingRequest(message);
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
        break;
      case WEBSOCKET_MESSAGE_TYPES.OUTLINE_BULK_SAVE_FAILED:
        settlePendingRequest(message, { error: message?.error || message?.data });
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.ERROR;
        break;
      case "success":
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.SUCCESS;
        break;
      case "error":
        settlePendingRequest(message, { error: message?.error || message?.data });
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.ERROR;
        break;
      case "response":
      // 兼容旧服务：通用 response 也广播为标准 RESPONSE 事件，便于上层统一处理
        settlePendingRequest(message);
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
        break;
      case "system_status":
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.SYSTEM_STATUS;
        break;
      case WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_COMPLETED:
        settlePendingRequest(message);
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.RESPONSE;
        break;
      case WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_FAILED:
        settlePendingRequest(message, { error: message?.error || message?.data });
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.ERROR;
        break;
      default:
        targetEvent = WEBSOCKET_MESSAGE_EVENTS.UNKNOWN;
      }
    }

    if (targetEvent) {
      logger?.debug?.(`Routing message to event: ${targetEvent}`);
      // eslint-disable-next-line custom/event-name-format
      eventBus.emit(targetEvent, message, { actorId: "WSClient" });
    }
  } catch (error) {
    const errorContext = {
      error_code: "MESSAGE_PARSE_ERROR",
      error_name: error.name,
      error_message: error.message,
      stack: error.stack,
      raw_data_preview: String(rawData || "").substring(0, 200),
      raw_data_length: String(rawData || "").length,
      diagnostic: "消息解析失败，可能是JSON格式错误或包含非法字符"
    };

    logger?.error?.("❌ WebSocket消息解析失败", JSON.stringify(errorContext, null, 2));
    eventBus.emit(WEBSOCKET_MESSAGE_EVENTS.ERROR, errorContext, { actorId: "WSClient" });
  }
}
