/**
 * @jest-environment jsdom
 */
import { describe, beforeEach, test, expect, jest } from "@jest/globals";

import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../common/event/event-constants.js";
import { getLogger } from "../../common/utils/logger.js";
import { PageTransferManager } from "../page-transfer-manager.js";

describe("PageTransferManager", () => {
  /** @type {Map<string, Function[]>} */
  let eventHandlers;
  let mockEventBus;
  let mockWsClient;
  let logger;

  beforeEach(() => {
    eventHandlers = new Map();

    mockEventBus = {
      on: jest.fn((eventName, handler) => {
        const list = eventHandlers.get(eventName) || [];
        list.push(handler);
        eventHandlers.set(eventName, list);
        return jest.fn(); // unsubscribe
      }),
      emit: jest.fn((eventName, data) => {
        const list = eventHandlers.get(eventName) || [];
        for (const handler of list) {
          handler(data);
        }
      })
    };

    mockWsClient = {
      readyState: 1,
      OPEN: 1,
      send: jest.fn()
    };

    logger = getLogger("test.page-transfer");
  });

  test("requestPage 发送请求并在 completed 回执后 resolve，且二次命中缓存", async () => {
    const mgr = new PageTransferManager(mockEventBus, mockWsClient, { logger });

    const promise = mgr.requestPage("file-1", 2, "zlib_base64");

    const outbound = JSON.parse(mockWsClient.send.mock.calls[0][0]);
    expect(outbound.type).toBe(WEBSOCKET_MESSAGE_TYPES.PDF_PAGE_REQUEST);
    expect(outbound.data).toEqual({
      file_id: "file-1",
      page_number: 2,
      compression: "zlib_base64"
    });

    mockEventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: WEBSOCKET_MESSAGE_TYPES.PDF_PAGE_COMPLETED,
      request_id: outbound.request_id,
      status: "success",
      data: {
        file_id: "file-1",
        page_number: 2,
        page_data: { content: "page-2-data" }
      }
    });

    await expect(promise).resolves.toEqual({ content: "page-2-data" });

    await expect(mgr.requestPage("file-1", 2, "zlib_base64")).resolves.toEqual({ content: "page-2-data" });
    expect(mockWsClient.send).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("返回缓存页面"));
  });

  test("requestPage 在 WebSocket 非 OPEN 时 fail-fast", async () => {
    const closedWs = { ...mockWsClient, readyState: 3 };
    const mgr = new PageTransferManager(mockEventBus, closedWs, { logger });
    await expect(mgr.requestPage("file-1", 1)).rejects.toThrow("WebSocket not open");
  });

  test("requestPage 在 failed 回执后 reject", async () => {
    const mgr = new PageTransferManager(mockEventBus, mockWsClient, { logger });

    const promise = mgr.requestPage("file-1", 1, "none");
    const outbound = JSON.parse(mockWsClient.send.mock.calls[0][0]);

    mockEventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: WEBSOCKET_MESSAGE_TYPES.PDF_PAGE_FAILED,
      request_id: outbound.request_id,
      status: "error",
      message: "boom",
      data: { file_id: "file-1", page_number: 1 }
    });

    await expect(promise).rejects.toThrow("boom");
  });

  test("preloadPages 发送请求并对同一范围去重", async () => {
    const mgr = new PageTransferManager(mockEventBus, mockWsClient, { logger });

    await mgr.preloadPages("file-1", 3, 5, { priority: "low", pages: [3, 4, 5] });
    await mgr.preloadPages("file-1", 3, 5, { priority: "low", pages: [3, 4, 5] });

    expect(mockWsClient.send).toHaveBeenCalledTimes(1);
    const outbound = JSON.parse(mockWsClient.send.mock.calls[0][0]);
    expect(outbound.type).toBe(WEBSOCKET_MESSAGE_TYPES.PDF_PAGE_PRELOAD);
    expect(outbound.data.file_id).toBe("file-1");
    expect(outbound.data.start_page).toBe(3);
    expect(outbound.data.end_page).toBe(5);
    expect(outbound.data.priority).toBe("low");
    expect(outbound.data.pages).toEqual([3, 4, 5]);
    expect(logger.debug).toHaveBeenCalledWith("预加载页面范围: file-1 3-5");
  });

  test("destroy 清理缓存并取消订阅", () => {
    const unsubscribe = jest.fn();
    mockEventBus.on = jest.fn(() => unsubscribe);

    const mgr = new PageTransferManager(mockEventBus, mockWsClient, { logger });
    mgr._addToCache("file-1", 1, { content: "x" });

    expect(mgr.getCacheStats().totalPages).toBe(1);
    mgr.destroy();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(mgr.getCacheStats().totalPages).toBe(0);
    expect(logger.info).toHaveBeenCalledWith("PageTransferManager已销毁");
  });
});

