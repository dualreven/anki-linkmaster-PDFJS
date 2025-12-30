/* @jest-environment jsdom */
jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  setModuleLogLevel: jest.fn(),
  LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" },
}));
/**
 * 目标：验证 AnnotationFeature 在接收到 FILE.LOAD.SUCCESS 后，会根据 URL/事件数据派发
 * ANNOTATION.DATA.LOAD（作用域事件），以维持“自动加载标注”的行为不变。
 */

import globalEventBus from "../../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { createScopedEventBus } from "../../../../common/event/scoped-event-bus.js";
import { AnnotationFeature } from "../index.js";

function createContainer(stubs = {}) {
  const store = new Map(Object.entries(stubs));
  return {
    get: (k) => store.get(k),
    registerGlobal: (k, v) => store.set(k, v),
    resolve: (k) => store.get(k),
  };
}

describe("AnnotationFeature - FILE.LOAD.SUCCESS 自动加载", () => {
  beforeEach(() => {
    try { globalEventBus.destroy(); } catch {}
    document.body.innerHTML = "<main id=\"app\"><div id=\"viewerContainer\"></div></main>";
    // 伪造 URL 参数（使用 history.pushState 避免 jsdom 导航）
    window.history.pushState({}, "", "/pdf-viewer/?pdf-id=doc-abc");
  });

  test("触发 ANNOTATION.DATA.LOAD（局部事件 @annotation/...）", async () => {
    const emitted = [];
    const scopedBus = createScopedEventBus(globalEventBus, "annotation");
    const offLoad = scopedBus.on(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD, (data) => {
      emitted.push(data);
    }, { subscriberId: "test" });

    const container = createContainer({
      pdfViewerManager: {}, // 轻量桩
      navigationService: { navigateTo: jest.fn() },
    });

    const feature = new AnnotationFeature();
    await feature.install({
      globalEventBus,
      container,
      logger: console,
    });

    // 触发文件加载成功
    globalEventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, { filename: "doc-abc.pdf", pdfId: "doc-abc" });
    await new Promise((r) => setTimeout(r, 50));

    expect(emitted.length).toBeGreaterThan(0);
    // 严格契约：必须由 FILE.LOAD.SUCCESS 提供 pdfId
    offLoad?.();
  });

  test("缺少 pdfId 必须 fail-fast（触发 LOAD_FAILED 且不触发 LOAD）", async () => {
    const emittedLoad = [];
    const emittedFailed = [];
    const scopedBus = createScopedEventBus(globalEventBus, "annotation");
    const offLoad = scopedBus.on(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD, (data) => {
      emittedLoad.push(data);
    }, { subscriberId: "test2" });
    const offFailed = scopedBus.on(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD_FAILED, (data) => {
      emittedFailed.push(data);
    }, { subscriberId: "test2" });

    const container = createContainer({
      pdfViewerManager: {},
      navigationService: { navigateTo: jest.fn() },
    });

    const feature = new AnnotationFeature();
    await feature.install({
      globalEventBus,
      container,
      logger: console,
    });

    globalEventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, { filename: "doc-abc.pdf" });
    await new Promise((r) => setTimeout(r, 50));

    expect(emittedLoad.length).toBe(0);
    expect(emittedFailed.length).toBeGreaterThan(0);

    offLoad?.();
    offFailed?.();
  });
});
