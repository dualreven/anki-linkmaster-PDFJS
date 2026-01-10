/* @jest-environment jsdom */
import { PDFUrlLoaderFeature } from "../index.js";
import { DependencyContainer } from "../../../../common/micro-service/dependency-container.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";

describe("pdf-url-loader gate reset (regression)", () => {
  test("FILE.LOAD.FAILED should reset pending state so a new request can proceed", async () => {
    // install 阶段避免触发启动时 FILE.LOAD.REQUESTED，专注验证手动导航 gate 行为
    window.history.pushState({}, "", "http://localhost/");

    const handlers = new Map();
    const cleanupFns = [];
    const mockEventBus = {
      on: jest.fn((evt, handler) => {
        handlers.set(evt, handler);
        const cleanup = jest.fn(() => handlers.delete(evt));
        cleanupFns.push(cleanup);
        return cleanup;
      }),
      emit: jest.fn(),
      off: jest.fn(),
    };

    const navigationService = {
      navigateTo: jest.fn(async () => ({ success: true, actualPage: 5, actualPosition: 0 }))
    };

    const container = new DependencyContainer();
    container.register("eventBus", mockEventBus);
    container.register("navigationService", navigationService);

    const feature = new PDFUrlLoaderFeature();
    await feature.install(container);

    window.history.pushState({}, "", "http://localhost/?pdf-id=current");

    const onRequested = handlers.get(PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED);
    const onLoadFailed = handlers.get(PDF_VIEWER_EVENTS.FILE.LOAD.FAILED);

    expect(typeof onRequested).toBe("function");
    expect(typeof onLoadFailed).toBe("function");

    // first request triggers reload and sets pending manual nav
    await onRequested({ pdfId: "target", pageAt: 5, position: 0 });
    const firstLoadReq = mockEventBus.emit.mock.calls.filter((c) => c[0] === PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED);
    expect(firstLoadReq.length).toBe(1);

    // fail should clear pending & release gate
    onLoadFailed({ message: "fail" });

    // second request should not be blocked by stale gate
    await onRequested({ pdfId: "target2", pageAt: 6, position: 0 });
    const secondLoadReq = mockEventBus.emit.mock.calls.filter((c) => c[0] === PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED);
    expect(secondLoadReq.length).toBe(2);

    await feature.uninstall();
    cleanupFns.forEach((fn) => expect(fn).toHaveBeenCalledTimes(1));
  });
});
