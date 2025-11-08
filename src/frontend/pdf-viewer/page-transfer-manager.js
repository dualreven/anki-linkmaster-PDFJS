/**
 * @file PageTransferManager
 * @description 负责通过 WebSocket 请求/预加载 PDF 页面，并维护简单缓存
 */
import * as LoggerModule from "../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../common/event/pdf-viewer-constants.js";
const getLogger = (typeof LoggerModule.default === "function")
  ? LoggerModule.default
  : (LoggerModule.getLogger || ((name) => ({ name, info(){}, warn(){}, error(){}, debug(){} })));

export class PageTransferManager {
  #eventBus;
  #ws;
  #logger;
  #cache = new Map(); // fileId -> Map(pageNumber -> data)
  #pending = new Map(); // requestId -> {fileId,pageNumber,resolve,reject}
  #preloadRanges = new Set(); // key: fileId:start-end

  constructor(eventBus, wsClient) {
    this.#eventBus = eventBus;
    this.#ws = wsClient;
    this.#logger = getLogger("PDFViewer.PageTransfer");

    // 监听统一的 WebSocket 入站事件
    import("../common/event/event-constants.js").then(({ WEBSOCKET_EVENTS }) => {
      this.#eventBus.on?.(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, (msg) => {
        try {
          const type = String(msg?.type || "");
          if (type === "pdf_page_response" || type === PDF_VIEWER_EVENTS.PAGE_TRANSFER.RESPONSE) {
            const rid = msg.request_id;
            const rec = this.#pending.get(rid);
            if (!rec) { return; }
            const fileId = msg?.data?.file_id;
            const pageNumber = msg?.data?.page_number;
            const pageData = msg?.data?.page_data;
            // 缓存并完成
            this._addToCache(fileId, pageNumber, pageData);
            this.#pending.delete(rid);
            rec.resolve(pageData);
          }
        } catch { /* ignore */ }
      }, { subscriberId: "PageTransferManager" });
    }).catch(() => {
      // 无常量则不注册监听，避免字面量事件违规
      this.#logger.warn("WS events constants not available; skip registering MESSAGE.RECEIVED listener");
    });
  }

  // 内部：加入缓存（测试会直接调用以构造缓存命中场景）
  _addToCache(fileId, pageNumber, pageData) {
    if (!fileId || !Number.isInteger(pageNumber) || pageNumber < 1) {return;}
    const byFile = this.#cache.get(fileId) || new Map();
    byFile.set(pageNumber, pageData);
    this.#cache.set(fileId, byFile);
  }

  async requestPage(fileId, pageNumber, compression = "none") {
    if (!fileId || typeof fileId !== "string" || !fileId.trim()) {
      throw new Error("invalid fileId");
    }
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      throw new Error("invalid pageNumber");
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
      type: "pdf_page_request",
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

  async preloadPages(fileId, startPage, endPage, compression = "none") {
    if (!fileId || !Number.isInteger(startPage) || !Number.isInteger(endPage)) {return;}
    const key = `${fileId}:${startPage}-${endPage}`;
    if (this.#preloadRanges.has(key)) {
      return;
    }
    this.#preloadRanges.add(key);
    this.#logger.debug(`预加载页面范围: ${fileId} ${startPage}-${endPage}`);
    const payload = {
      type: "pdf_page_preload",
      request_id: `pre_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      data: {
        file_id: fileId,
        start_page: startPage,
        end_page: endPage,
        compression
      }
    };
    try {
      this.#ws?.send?.(JSON.stringify(payload));
    } catch { /* ignore */ }
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
    this.#cache.clear();
    this.#pending.clear();
    this.#preloadRanges.clear();
    this.#logger.info("PageTransferManager已销毁");
  }
}
