/**
 * @file PageTransferManager
 * @description 负责通过 WebSocket 请求/预加载 PDF 页面，并维护简单缓存
 */
import { getLogger } from "../common/utils/logger.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../common/event/event-constants.js";

export class PageTransferManager {
  #eventBus;
  #ws;
  #logger;
  #cache = new Map(); // fileId -> Map(pageNumber -> data)
  #pending = new Map(); // requestId -> {fileId,pageNumber,resolve,reject}
  #preloadRanges = new Set(); // key: fileId:start-end
  #unsubscribeWsInbound = null;

  constructor(eventBus, wsClient, { logger } = {}) {
    if (!eventBus?.on || !eventBus?.emit) {
      throw new Error("PageTransferManager requires an EventBus with on/emit");
    }
    if (!wsClient?.send) {
      throw new Error("PageTransferManager requires a WebSocket client with send()");
    }
    this.#eventBus = eventBus;
    this.#ws = wsClient;
    this.#logger = logger || getLogger("PDFViewer.PageTransfer");

    // 监听统一的 WebSocket 入站事件（同步注册，避免测试/运行时竞态）
    this.#unsubscribeWsInbound = this.#eventBus.on(
      WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
      (msg) => this.#onWsInbound(msg),
      { subscriberId: "PageTransferManager" }
    );
  }

  // 内部：加入缓存（测试会直接调用以构造缓存命中场景）
  _addToCache(fileId, pageNumber, pageData) {
    if (!fileId || !Number.isInteger(pageNumber) || pageNumber < 1) {return;}
    const byFile = this.#cache.get(fileId) || new Map();
    byFile.set(pageNumber, pageData);
    this.#cache.set(fileId, byFile);
  }

  // 内部：从缓存读取（用于测试）
  _getFromCache(fileId, pageNumber) {
    const byFile = this.#cache.get(fileId);
    if (!byFile) { return undefined; }
    return byFile.get(pageNumber);
  }

  #onWsInbound(msg) {
    const type = String(msg?.type || "");
    if (type === WEBSOCKET_MESSAGE_TYPES.PDF_PAGE_COMPLETED) {
      const requestId = msg?.request_id;
      if (!requestId) {
        throw new Error("pdf-page:load:completed missing request_id");
      }
      const pending = this.#pending.get(requestId);
      if (!pending) { return; }

      const fileId = msg?.data?.file_id;
      const pageNumber = msg?.data?.page_number;
      const pageData = msg?.data?.page_data;
      if (!fileId || !Number.isInteger(pageNumber) || pageNumber < 1) {
        throw new Error("pdf-page:load:completed invalid payload");
      }

      this._addToCache(fileId, pageNumber, pageData);
      this.#pending.delete(requestId);
      pending.resolve(pageData);
      return;
    }

    if (type === WEBSOCKET_MESSAGE_TYPES.PDF_PAGE_FAILED) {
      const requestId = msg?.request_id;
      if (!requestId) {
        throw new Error("pdf-page:load:failed missing request_id");
      }
      const pending = this.#pending.get(requestId);
      if (!pending) { return; }
      this.#pending.delete(requestId);
      pending.reject(new Error(msg?.message || "pdf page load failed"));
    }
  }

  async requestPage(fileId, pageNumber, compression = "none") {
    if (!fileId || typeof fileId !== "string" || !fileId.trim()) {
      throw new Error("invalid fileId");
    }
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      throw new Error("invalid pageNumber");
    }
    const openState = (typeof this.#ws.OPEN === "number") ? this.#ws.OPEN : 1;
    if (this.#ws.readyState !== openState) {
      throw new Error("WebSocket not open");
    }
    // 缓存命中
    const byFile = this.#cache.get(fileId);
    if (byFile && byFile.has(pageNumber)) {
      this.#logger.debug(`返回缓存页面: ${fileId}-${pageNumber}`);
      return byFile.get(pageNumber);
    }
    // 发送请求
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
      type: WEBSOCKET_MESSAGE_TYPES.PDF_PAGE_REQUEST,
      request_id: requestId,
      data: {
        file_id: fileId,
        page_number: pageNumber,
        compression
      }
    };
    const promise = new Promise((resolve, reject) => {
      this.#pending.set(requestId, { fileId, pageNumber, resolve, reject });
    });
    try {
      this.#ws?.send?.(JSON.stringify(payload));
    } catch (e) {
      this.#pending.delete(requestId);
      throw e;
    }
    return promise;
  }

  async preloadPages(fileId, startPage, endPage, { compression = "none", priority = "low", pages = null } = {}) {
    if (!fileId || !Number.isInteger(startPage) || !Number.isInteger(endPage)) {return;}
    const key = `${fileId}:${startPage}-${endPage}`;
    if (this.#preloadRanges.has(key)) {
      return;
    }
    this.#preloadRanges.add(key);
    this.#logger.debug(`预加载页面范围: ${fileId} ${startPage}-${endPage}`);
    const payload = {
      type: WEBSOCKET_MESSAGE_TYPES.PDF_PAGE_PRELOAD,
      request_id: `pre_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      data: {
        file_id: fileId,
        start_page: startPage,
        end_page: endPage,
        compression,
        priority,
        pages: Array.isArray(pages) ? pages : undefined
      }
    };
    this.#ws.send(JSON.stringify(payload));
  }

  getCacheStats() {
    const fileStats = {};
    let totalPages = 0;
    for (const [fid, map] of this.#cache.entries()) {
      fileStats[fid] = { cachedPages: map.size };
      totalPages += map.size;
    }
    return {
      totalFiles: this.#cache.size,
      totalPages,
      fileStats
    };
  }

  destroy() {
    if (typeof this.#unsubscribeWsInbound === "function") {
      this.#unsubscribeWsInbound();
    }
    this.#cache.clear();
    this.#pending.clear();
    this.#preloadRanges.clear();
    this.#logger.info("PageTransferManager已销毁");
  }
}
