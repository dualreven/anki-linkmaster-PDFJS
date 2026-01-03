/**
 * @file OutlineManager 事件流测试（原 BookmarkManager）
 */

import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { ScopedEventBus } from "../../common/event/scoped-event-bus.js";
import { setCurrentPDFDocument, clearCurrentPDFDocument } from "../pdf/current-document-registry.js";

// 使用真实类，但替换数据提供者
import OutlineManager from "../outline/outline-manager.js";

describe("OutlineManager (was BookmarkManager)", () => {
  let eventBus;
  let manager;
  let mockProvider;
  let emitted;

  beforeEach(() => {
    emitted = [];

    // 作用域总线需要一个“全局总线”实现 on/off/emit
    const handlers = new Map();
    const globalBus = {
      on(evt, fn) {
        const arr = handlers.get(evt) || [];
        arr.push(fn);
        handlers.set(evt, arr);
        return () => {
          const a = handlers.get(evt) || [];
          const i = a.indexOf(fn);
          if (i >= 0) { a.splice(i, 1); }
          handlers.set(evt, a);
        };
      },
      off(evt, fn) {
        const a = handlers.get(evt) || [];
        const i = a.indexOf(fn);
        if (i >= 0) { a.splice(i, 1); }
        handlers.set(evt, a);
      },
      emit(evt, data, ctx) {
        emitted.push({ evt, data });
        (handlers.get(evt) || []).forEach((fn) => fn(data, ctx));
      }
    };
    eventBus = new ScopedEventBus(globalBus, "test-outline");

    mockProvider = { getOutline: jest.fn(), parseDestination: jest.fn() };
    manager = new OutlineManager(eventBus, { dataProvider: mockProvider });
    manager.initialize();
  });

  afterEach(() => { clearCurrentPDFDocument(); manager.destroy(); });

  test("在文档加载成功后自动加载大纲并发布成功事件", async () => {
    setCurrentPDFDocument({});
    mockProvider.getOutline.mockResolvedValue([{ id: "0-0", title: "A", dest: null, items: [], level: 0 }]);
    eventBus.emitGlobal(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, {}, { actorId: "test" });
    await Promise.resolve();
    const success = emitted.find(e => e.evt === PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS);
    expect(success).toBeTruthy();
    expect(success.data.count).toBe(1);
  });

  test("无当前文档时发布 EMPTY", async () => {
    clearCurrentPDFDocument();
    eventBus.emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.LOAD.REQUESTED, {}, { actorId: "test" });
    await Promise.resolve();
    const empty = emitted.find(e => e.evt === PDF_VIEWER_EVENTS.OUTLINE.LOAD.EMPTY);
    expect(empty).toBeTruthy();
  });

  test("导航请求触发 NAVIGATION.URL_PARAMS.REQUESTED 与 OUTLINE.NAVIGATE.SUCCESS", async () => {
    setCurrentPDFDocument({});
    mockProvider.parseDestination.mockResolvedValue({ pageNumber: 3, x: 10, y: 20, zoom: null });
    eventBus.emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.REQUESTED, { outlineItem: { dest: ["p3"] } }, { actorId: "test" });
    await Promise.resolve();
    const gotoEvt = emitted.find(e => e.evt === PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED);
    const okEvt = emitted.find(e => e.evt === PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.SUCCESS);
    expect(gotoEvt).toBeTruthy();
    expect(okEvt).toBeTruthy();
    expect(gotoEvt.data.pageAt).toBe(3);
  });
});
