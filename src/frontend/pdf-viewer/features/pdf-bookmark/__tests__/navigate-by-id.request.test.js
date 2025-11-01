/**
 * @file navigate-by-id.request.test.js
 * 验证当发射 PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE_BY_ID.REQUESTED 事件时，
 * PDFBookmarkFeature 能根据 ID 定位书签并调用导航服务。
 */

import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { PDFBookmarkFeature } from "../index.js";

// 简易事件总线（支持全局/局部）
function createEventBus() {
  const handlers = new Map();
  const onLike = (mapKey, type, cb) => {
    if (!handlers.has(type)) {handlers.set(type, []);}
    handlers.get(type).push(cb);
    return () => {
      const arr = handlers.get(type) || [];
      handlers.set(type, arr.filter(f => f !== cb));
    };
  };
  const emitLike = (type, data, meta) => {
    const arr = handlers.get(type) || [];
    for (const cb of arr) {
      try { cb(data, meta); } catch { /* ignore */ }
    }
  };
  return {
    on: (type, cb) => onLike("on", type, cb),
    onGlobal: (type, cb) => onLike("onGlobal", type, cb),
    emit: (type, data, meta) => emitLike(type, data, meta),
    emitGlobal: (type, data, meta) => emitLike(type, data, meta)
  };
}

// 统一 mock：避免引发实际 PDF 文档加载流程
jest.mock("../../pdf/current-document-registry.js", () => ({
  getCurrentPDFDocument: () => null
}));

// Mock BookmarkManager：返回固定的测试书签
jest.mock("../services/bookmark-manager.js", () => {
  class FakeBookmarkManager {
    constructor() {}
    async initialize() {}
    async loadFromStorage() {}
    destroy() {}
    getBookmark(id) {
      if (id === "outlineItem-12345678") {
        return { id, name: "Test Node", pageAt: 3, position: 25 };
      }
      return null;
    }
  }
  return { BookmarkManager: FakeBookmarkManager };
});

// 轻量 logger
const makeLogger = () => ({
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {}
});

describe("PDFBookmarkFeature - NAVIGATE_BY_ID.REQUESTED", () => {
  it("应在接收到按ID导航事件后调用导航服务", async () => {
    const eventBus = createEventBus();
    const navigateTo = jest.fn(async () => ({ success: true, actualPage: 3, actualPosition: 25 }));
    const container = {
      get: (key) => {
        if (key === "navigationService") {
          return { navigateTo };
        }
        return null;
      },
      resolve: () => null
    };

    const feature = new PDFBookmarkFeature();
    await feature.install({
      logger: makeLogger(),
      scopedEventBus: eventBus,
      globalEventBus: eventBus,
      container
    });

    // 触发“按ID导航”事件
    eventBus.emitGlobal(PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE_BY_ID.REQUESTED, {
      outlineItemId: "outlineItem-12345678"
    }, { actorId: "TEST" });

    // 等待微任务队列
    await Promise.resolve();

    // 断言调用了导航服务，并传入了期望的页码/位置
    expect(navigateTo).toHaveBeenCalledTimes(1);
    const args = navigateTo.mock.calls[0][0];
    expect(args.pageAt).toBe(3);
    expect(args.position).toBe(25);
  });
});

