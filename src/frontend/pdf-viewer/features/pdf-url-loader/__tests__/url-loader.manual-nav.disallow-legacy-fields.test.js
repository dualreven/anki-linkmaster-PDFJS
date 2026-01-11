/* @jest-environment jsdom */

import { PDFUrlLoaderFeature } from "../index.js";
import { DependencyContainer } from "../../../../common/micro-service/dependency-container.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";

describe("pdf-url-loader manual nav contract (regression)", () => {
  test("URL_PARAMS.REQUESTED with legacy fields should fail-fast and not navigate", async () => {
    // install 阶段避免触发启动时 FILE.LOAD.REQUESTED
    window.history.pushState({}, "", "http://localhost/");

    const handlers = new Map();
    const mockEventBus = {
      on: jest.fn((evt, handler) => {
        handlers.set(evt, handler);
        return jest.fn(() => handlers.delete(evt));
      }),
      emit: jest.fn(),
      off: jest.fn(),
    };

    const navigationService = {
      navigateTo: jest.fn(async () => ({ success: true, actualPage: 1, actualPosition: 0 })),
    };

    const container = new DependencyContainer();
    container.register("eventBus", mockEventBus);
    container.register("navigationService", navigationService);

    const feature = new PDFUrlLoaderFeature();
    await feature.install(container);

    const onRequested = handlers.get(PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED);
    expect(typeof onRequested).toBe("function");

    await onRequested({
      pdfId: "doc",
      pageAt: 1,
      position: 10,
      outlineItemId: "outlineItem-123",
    });

    const failedCalls = mockEventBus.emit.mock.calls.filter((c) => c[0] === PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.FAILED);
    expect(failedCalls.length).toBe(1);
    expect(failedCalls[0][1]).toEqual(expect.objectContaining({ stage: "validate" }));

    const loadReqCalls = mockEventBus.emit.mock.calls.filter((c) => c[0] === PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED);
    expect(loadReqCalls.length).toBe(0);

    expect(navigationService.navigateTo).not.toHaveBeenCalled();

    await feature.uninstall();
  });
});

