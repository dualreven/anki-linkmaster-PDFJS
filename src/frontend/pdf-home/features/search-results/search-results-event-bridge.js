import { RESULTS_EVENTS } from "./events.js";
import { SEARCH_RESULTS_EVENTS, WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../common/event/event-constants.js";
import { showError, showInfo } from "../../../common/utils/notification.js";

function emitGlobalOrThrow(scopedEventBus, event, payload) {
  if (!scopedEventBus || typeof scopedEventBus.emitGlobal !== "function") {
    throw new Error("[search-results-event-bridge] scopedEventBus.emitGlobal is required");
  }
  scopedEventBus.emitGlobal(event, payload);
}

function shouldFetchDetailFallback({ allowWsDetailFallback }) {
  const v = window.localStorage.getItem("PDF_HOME_FETCH_DETAIL_IF_MISSING");
  if (typeof v === "string") {
    return v === "true";
  }
  return allowWsDetailFallback === true;
}

function fetchPdfDetailViaWs({ logger, name, globalEventBus, scopedEventBus, pdfId, requestTimeoutMs }) {
  const rid = `sr-open-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  logger.info("[SearchResultsFeature] Requesting pdf detail via WS", { pdfId, rid });

  return new Promise((resolve, reject) => {
    let settled = false;

    const off = globalEventBus.on(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, (message) => {
      try {
        if (!message || message.request_id !== rid) {
          return;
        }

        if (message.type === WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_COMPLETED) {
          settled = true;
          off();
          resolve(message.data || null);
          return;
        }

        if (message.type === WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_FAILED) {
          settled = true;
          off();
          reject(new Error("[SearchResultsFeature] PDF detail request failed"));
        }
      } catch (e) {
        settled = true;
        off();
        reject(e);
      }
    }, { subscriberId: `${name}:fetch-detail:${rid}` });

    const payload = {
      type: WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_REQUEST,
      request_id: rid,
      metadata: { version: "1.0.0" },
      data: { pdf_id: String(pdfId) },
    };
    emitGlobalOrThrow(scopedEventBus, WEBSOCKET_EVENTS.MESSAGE.SEND, payload);

    setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      off();
      reject(new Error("[SearchResultsFeature] PDF detail request timeout"));
    }, requestTimeoutMs);
  });
}

export function installSearchResultsEventBridge({
  logger,
  name,
  sidBase,
  scopedEventBus,
  globalEventBus,
  subscriptionBag,
  qwcBridge,
  allowWsDetailFallback,
  requestTimeoutMs,
}) {
  const unsubSelected = scopedEventBus.on(RESULTS_EVENTS.ITEM.SELECTED, (data) => {
    logger.debug("[SearchResultsFeature] Item selected", data);
    globalEventBus.emit(SEARCH_RESULTS_EVENTS.ACTIONS.SELECTED, data);
  }, { subscriberId: `${name}:${sidBase}:item-selected` });
  subscriptionBag.add(unsubSelected);

  const unsubOpen = scopedEventBus.on(RESULTS_EVENTS.ITEM.OPEN, async (data) => {
    showInfo("🔍 正在打开PDF...", 2500);
    logger.info("[SearchResultsFeature] [步骤1] Item open requested", data);

    globalEventBus.emit(SEARCH_RESULTS_EVENTS.ACTIONS.OPEN, data);
    logger.info("[SearchResultsFeature] [步骤2] Global event emitted");

    try {
      const pdfId = data?.result?.id || data?.id || data?.pdfId;
      let filePath = data?.result?.path || data?.result?.file_path || data?.file_path || null;

      logger.info("[SearchResultsFeature] [步骤3] Parsed params", { pdfId, hasFilePath: !!filePath });

      if (!pdfId) {
        showError("❌ 缺少PDF ID", 5000);
        logger.warn("[SearchResultsFeature] Skip open: missing pdfId", { data });
        return;
      }

      if (qwcBridge) {
        try {
          await qwcBridge.initialize?.();
          if (qwcBridge.isReady && !qwcBridge.isReady()) {
            logger.info("[SearchResultsFeature] Waiting for optional QWebChannel ready");
            await new Promise((r) => setTimeout(r, 200));
          }
        } catch (e) {
          logger.warn("[SearchResultsFeature] 可选的 QWebChannel 初始化失败，忽略", e);
        }
      }

      if (!filePath && shouldFetchDetailFallback({ allowWsDetailFallback })) {
        logger.info("[SearchResultsFeature] Fetching file path via WS", { pdfId });
        try {
          const detail = await fetchPdfDetailViaWs({
            logger,
            name,
            globalEventBus,
            scopedEventBus,
            pdfId: String(pdfId),
            requestTimeoutMs,
          });
          filePath = detail?.file_path || filePath;
          logger.info("[SearchResultsFeature] File path retrieved", { hasFilePath: !!filePath });
        } catch (e) {
          logger.warn("[SearchResultsFeature] fetch detail failed, continue without file_path", e);
        }
      }

      logger.info("[SearchResultsFeature] Opening pdf-viewer by id", { pdfId, hasFile: !!filePath });

      const rid = `open-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const msg = {
        type: WEBSOCKET_MESSAGE_TYPES.OPEN_PDF,
        request_id: rid,
        metadata: { version: "1.0.0" },
        data: { pdf_id: String(pdfId) },
      };
      emitGlobalOrThrow(scopedEventBus, WEBSOCKET_EVENTS.MESSAGE.SEND, msg);
      logger.info("[SearchResultsFeature] WS open viewer message sent", { pdfId, rid });
    } catch (e) {
      showError(`❌ 打开失败: ${e.message}`, 5000);
      logger.error("[SearchResultsFeature] Open viewer failed", e);
    }
  }, { subscriberId: `${name}:${sidBase}:item-open` });
  subscriptionBag.add(unsubOpen);

  logger.info("[SearchResultsFeature] Event bridge setup");
}
