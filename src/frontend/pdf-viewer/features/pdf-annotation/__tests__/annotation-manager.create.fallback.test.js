/* eslint-env jest */
import { getEventBus } from "../../../../common/event/event-bus.js";
import { createScopedEventBus } from "../../../../common/event/scoped-event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { Annotation, AnnotationType } from "../../../../common/models/annotation.js";
import { AnnotationManager } from "../core/annotation-manager.js";

// 直接在订阅处使用常量，避免变量事件名

describe("AnnotationManager create fallback", () => {
  test("falls back to mock save and emits CREATED when pdfId missing", async () => {
    // Arrange: create isolated event bus scope
    const globalBus = getEventBus("TestAnnotation", { enableValidation: true });
    const scopedBus = createScopedEventBus(globalBus, "annotation");

    // Container stub with a wsClient to simulate presence of WS (but no pdfId set)
    const wsClientStub = {
      isConnected: () => true,
      request: jest.fn().mockResolvedValue({ ok: true })
    };
    const containerStub = {
      get: (name) => (name === "wsClient" ? wsClientStub : null),
      getDependencies: () => ({ wsClient: wsClientStub })
    };

    // Instantiate manager (will detect wsClient), but we do NOT set pdfId
    // 仅为触发初始化与事件绑定；无需持有引用
    new AnnotationManager(scopedBus, undefined, containerStub);

    // 构造符合 v003 新契约的截图标注（使用 rectPercent + imagePath + imageHash）
    const payload = Annotation.createScreenshot(
      1,
      { xPercent: 10, yPercent: 10, widthPercent: 20, heightPercent: 10 },
      "/data/screens/mock.png",
      "0123456789abcdef0123456789abcdef",
      "unit-test"
    ).toJSON();

    // Act: emit CREATE and wait for CREATED
    const waitCreated = new Promise((resolve, reject) => {
      const off = scopedBus.on(PDF_VIEWER_EVENTS.ANNOTATION.CREATED, (data) => {
        try { off(); } catch {}
        clearTimeout(timer);
        resolve(data);
      });
      const timer = setTimeout(() => {
        try { off(); } catch {}
        reject(new Error("timeout waiting for " + PDF_VIEWER_EVENTS.ANNOTATION.CREATED));
      }, 3000);
    });
    scopedBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.CREATE, { annotation: payload });

    const created = await waitCreated;

    // Assert
    expect(created).toBeTruthy();
    expect(created.annotation).toBeTruthy();
    expect(created.annotation.type).toBe(AnnotationType.SCREENSHOT);
    // Because fallback path was taken, wsClient.request should NOT have been required for success
    // We don't assert request not called strictly (implementation may preflight),
    // but CREATED should be emitted regardless
  });
});

