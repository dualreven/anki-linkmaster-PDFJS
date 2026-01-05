/* eslint-env jest */
import { getEventBus } from "../../../../common/event/event-bus.js";
import { createScopedEventBus } from "../../../../common/event/scoped-event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { Annotation, AnnotationType } from "../../../../common/models/annotation.js";
import { AnnotationManager } from "../core/annotation.manager.v2.js";
import { getLogger } from "../../../../common/utils/logger.js";

// Directly use constants in subscriptions to avoid variable event name lint errors

describe("AnnotationManager create fallback", () => {
  test("emits CREATED when pdfId missing (should not attempt remote save)", async () => {
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
      getWSClient: () => wsClientStub
    };

    // Instantiate manager (will detect wsClient), but we do NOT set pdfId
    const manager = new AnnotationManager(scopedBus, getLogger("test"), containerStub);

    const payload = Annotation.createScreenshot(
      1,
      { xPercent: 10, yPercent: 10, widthPercent: 20, heightPercent: 10 },
      "/data/screens/mock.png",
      "0123456789abcdef0123456789abcdef",
      "unit-test"
    ).toJSON();

    // Act: call createAnnotation and wait for CREATED
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
    void manager.createAnnotation(payload);

    const created = await waitCreated;

    // Assert
    expect(created).toBeTruthy();
    expect(created.annotation).toBeTruthy();
    expect(created.annotation.type).toBe(AnnotationType.SCREENSHOT);

    // pdfId missing -> should not attempt remote save
    expect(wsClientStub.request).not.toHaveBeenCalled();
  });
});
