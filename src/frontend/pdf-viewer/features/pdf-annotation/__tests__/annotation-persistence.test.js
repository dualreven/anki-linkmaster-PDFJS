/**
 * @file Annotation 持久化行为测试
 */

import { EventBus } from "../../../../common/event/event-bus.js";
import { createScopedEventBus } from "../../../../common/event/scoped-event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_MESSAGE_TYPES } from "../../../../common/event/event-constants.js";
import { getLogger } from "../../../../common/utils/logger.js";
import { AnnotationManager } from "../core/annotation.manager.v2.js";
import { Annotation } from "../../../../common/models/annotation.js";

describe("AnnotationManager 持久化", () => {
  let globalBus;
  let scopedBus;
  let wsClient;
  let manager;

  beforeEach(() => {
    // 全局事件总线（关闭验证，便于测试）
    globalBus = new EventBus({ enableValidation: false, moduleName: "pdf-viewer" });
    scopedBus = createScopedEventBus(globalBus, "annotation-test");

    // Mock wsClient
    wsClient = {
      isConnected: () => true,
      request: jest.fn().mockImplementation((type) => {
        if (type === WEBSOCKET_MESSAGE_TYPES.ANNOTATION_LIST) {
          return Promise.resolve({ annotations: [] });
        }
        return Promise.resolve({ ok: true });
      })
    };

    const container = {
      getWSClient: () => wsClient
    };

    manager = new AnnotationManager(scopedBus, getLogger("test"), container);
  });

  test("在 LOAD 后 CREATE 会发送 annotation:save:requested", async () => {
    await manager.loadAnnotations("0fda6ae76b06");

    // 触发创建
    const ann = Annotation.createComment(1, { x: 0.5, y: 0.5 }, "hello");
    await manager.createAnnotation(ann);

    expect(wsClient.request).toHaveBeenCalled();
    const saveCall = wsClient.request.mock.calls.find(([t]) => t === WEBSOCKET_MESSAGE_TYPES.ANNOTATION_SAVE);
    expect(saveCall).toBeTruthy();
    expect(saveCall[0]).toBe(WEBSOCKET_MESSAGE_TYPES.ANNOTATION_SAVE);
    expect(saveCall[1].pdf_uuid).toBe("0fda6ae76b06");
    expect(saveCall[1].annotation?.type).toBe("comment");
  });

  test("LOAD 会发送 annotation:list:requested", async () => {
    await manager.loadAnnotations("0fda6ae76b06");

    const called = wsClient.request.mock.calls.some(([t]) => t === WEBSOCKET_MESSAGE_TYPES.ANNOTATION_LIST);
    expect(called).toBe(true);
  });

  test("即使 WS 未连接，LOAD 也应发送 annotation:list:requested（由 WSClient 排队）", async () => {
    const wsClient2 = {
      isConnected: () => false,
      request: jest.fn().mockResolvedValue({ annotations: [] })
    };
    const container2 = { getWSClient: () => wsClient2 };

    const manager2 = new AnnotationManager(scopedBus, getLogger("test"), container2);
    await manager2.loadAnnotations("0fda6ae76b06");

    const called = wsClient2.request.mock.calls.some(([t]) => t === WEBSOCKET_MESSAGE_TYPES.ANNOTATION_LIST);
    expect(called).toBe(true);
  });

  test("当远端 list 请求失败时应触发 LOAD_FAILED（不应静默 LOADED(0)）", async () => {
    const wsClient2 = {
      isConnected: () => true,
      request: jest.fn().mockRejectedValue(new Error("boom"))
    };
    const container2 = { getWSClient: () => wsClient2 };

    const manager2 = new AnnotationManager(scopedBus, getLogger("test"), container2);

    const failed = new Promise((resolve, reject) => {
      const offFailed = scopedBus.on(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD_FAILED, (data) => {
        try { offFailed(); } catch { }
        resolve(data);
      });
      setTimeout(() => {
        try { offFailed(); } catch { }
        reject(new Error("timeout waiting for LOAD_FAILED"));
      }, 1000);
    });

    void manager2.loadAnnotations("0fda6ae76b06");

    const payload = await failed;
    expect(payload).toBeTruthy();
    expect(String(payload.error || "")).toContain("boom");
  });

  test("在 UPDATE 后会再次发送 annotation:save:requested 并包含最新标题", async () => {
    // 1. 等待 LOAD 完成
    await manager.loadAnnotations("0fda6ae76b06");

    // 2. 创建标注并等待完成
    const ann = Annotation.createComment(1, { x: 0.5, y: 0.5 }, "hello");
    await manager.createAnnotation(ann);

    // 3. 触发更新
    await manager.updateAnnotation(ann.id, { title: "new-title" });

    const saveCalls = wsClient.request.mock.calls.filter(([t]) => t === WEBSOCKET_MESSAGE_TYPES.ANNOTATION_SAVE);
    expect(saveCalls.length).toBeGreaterThanOrEqual(2);
    const [, payload] = saveCalls[saveCalls.length - 1];
    expect(payload.annotation.title).toBe("new-title");
  });
});
