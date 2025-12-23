/**
 * @file Annotation 持久化行为测试
 */

import { EventBus } from "../../../../common/event/event-bus.js";
import { createScopedEventBus } from "../../../../common/event/scoped-event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_MESSAGE_TYPES } from "../../../../common/event/event-constants.js";

import { AnnotationManager } from "../core/annotation-manager.js";
import { Annotation } from "../../../../common/models/annotation.js";

describe("AnnotationManager 持久化", () => {
  let globalBus;
  let scopedBus;
  let wsClient;

  beforeEach(() => {
    // 全局事件总线（关闭验证，便于测试）
    globalBus = new EventBus({ enableValidation: false, moduleName: "pdf-viewer" });
    scopedBus = createScopedEventBus(globalBus, "annotation-test");

    // Mock wsClient
    wsClient = {
      isConnected: () => true,
      request: jest.fn().mockResolvedValue({ ok: true })
    };

    const container = {
      getDependencies: () => ({ wsClient }),
    };

    // 仅为触发初始化与事件绑定；无需持有引用
    new AnnotationManager(scopedBus, null, container);
  });

  test("在 LOAD 后 CREATE 会发送 annotation:save:requested", async () => {
    // 设置 PDF ID
    scopedBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD, { pdfId: "0fda6ae76b06" }, { actorId: "test" });

    // 触发创建
    const ann = Annotation.createComment(1, { x: 0.5, y: 0.5 }, "hello");
    scopedBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.CREATE, { annotation: ann }, { actorId: "test" });

    // 等待异步请求结算
    await new Promise((r) => setTimeout(r, 10));

    expect(wsClient.request).toHaveBeenCalled();
    const [type, payload] = wsClient.request.mock.calls.find(([t]) => t === WEBSOCKET_MESSAGE_TYPES.ANNOTATION_SAVE) || [];
    expect(type).toBe(WEBSOCKET_MESSAGE_TYPES.ANNOTATION_SAVE);
    expect(payload).toBeTruthy();
    expect(payload.pdf_uuid).toBe("0fda6ae76b06");
    expect(payload.annotation?.type).toBe("comment");
  });

  test("LOAD 会发送 annotation:list:requested", async () => {
    scopedBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD, { pdfId: "0fda6ae76b06" }, { actorId: "test" });
    await new Promise((r) => setTimeout(r, 10));

    const called = wsClient.request.mock.calls.some(([t]) => t === WEBSOCKET_MESSAGE_TYPES.ANNOTATION_LIST);
    expect(called).toBe(true);
  });

  test("即使 WS 未连接，LOAD 也应发送 annotation:list:requested（由 WSClient 排队）", async () => {
    // 全局事件总线（关闭验证，便于测试）
    const globalBus2 = new EventBus({ enableValidation: false, moduleName: "pdf-viewer" });
    const scopedBus2 = createScopedEventBus(globalBus2, "annotation-test-2");

    const wsClient2 = {
      isConnected: () => false,
      request: jest.fn().mockResolvedValue({ annotations: [] })
    };
    const container2 = {
      getDependencies: () => ({ wsClient: wsClient2 }),
    };

    new AnnotationManager(scopedBus2, null, container2);

    scopedBus2.emit(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD, { pdfId: "0fda6ae76b06" }, { actorId: "test" });
    await new Promise((r) => setTimeout(r, 10));

    const called = wsClient2.request.mock.calls.some(([t]) => t === WEBSOCKET_MESSAGE_TYPES.ANNOTATION_LIST);
    expect(called).toBe(true);
  });

  test("当远端 list 请求失败时应触发 LOAD_FAILED（不应静默 LOADED(0)）", async () => {
    // 全局事件总线（关闭验证，便于测试）
    const globalBus2 = new EventBus({ enableValidation: false, moduleName: "pdf-viewer" });
    const scopedBus2 = createScopedEventBus(globalBus2, "annotation-test-3");

    const wsClient2 = {
      isConnected: () => true,
      request: jest.fn().mockRejectedValue(new Error("boom"))
    };
    const container2 = {
      getDependencies: () => ({ wsClient: wsClient2 }),
    };

    new AnnotationManager(scopedBus2, null, container2);

    let loadedFired = false;
    const offLoaded = scopedBus2.on(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED, () => {
      loadedFired = true;
    });

    const failed = new Promise((resolve, reject) => {
      const offFailed = scopedBus2.on(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD_FAILED, (data) => {
        try { offFailed(); } catch { /* ignore */ }
        resolve(data);
      });
      setTimeout(() => {
        try { offFailed(); } catch { /* ignore */ }
        reject(new Error("timeout waiting for LOAD_FAILED"));
      }, 1000);
    });

    scopedBus2.emit(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD, { pdfId: "0fda6ae76b06" }, { actorId: "test" });

    const payload = await failed;

    try { offLoaded(); } catch { /* ignore */ }
    expect(loadedFired).toBe(false);
    expect(payload).toBeTruthy();
    expect(String(payload.error || "")).toContain("boom");
  });

  test("在 UPDATE 后会再次发送 annotation:save:requested 并包含最新标题", async () => {
    scopedBus.emit(
      PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD,
      { pdfId: "0fda6ae76b06" },
      { actorId: "test" }
    );

    const ann = Annotation.createComment(1, { x: 0.5, y: 0.5 }, "hello");
    scopedBus.emit(
      PDF_VIEWER_EVENTS.ANNOTATION.CREATE,
      { annotation: ann },
      { actorId: "test" }
    );

    await new Promise((r) => setTimeout(r, 10));

    scopedBus.emit(
      PDF_VIEWER_EVENTS.ANNOTATION.UPDATE,
      { id: ann.id, changes: { title: "new-title" } },
      { actorId: "test" }
    );

    await new Promise((r) => setTimeout(r, 10));

    const saveCalls = wsClient.request.mock.calls.filter(
      ([t]) => t === WEBSOCKET_MESSAGE_TYPES.ANNOTATION_SAVE
    );
    expect(saveCalls.length).toBeGreaterThanOrEqual(2);
    const [, payload] = saveCalls[saveCalls.length - 1];
    expect(payload).toBeTruthy();
    expect(payload.annotation).toBeTruthy();
    expect(payload.annotation.title).toBe("new-title");
  });
});
