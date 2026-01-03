/* @jest-environment jsdom */
jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  setModuleLogLevel: jest.fn(),
  LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" },
}));
/**
 * 目标：验证 AnnotationFeature 的标注自动加载会延迟到 resume 完成事件之后触发，且晚订阅可命中历史。
 */

import globalEventBus from "../../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { createScopedEventBus } from "../../../../common/event/scoped-event-bus.js";
import { AnnotationFeature } from "../index.js";
import { clearWsGateStatusStore, markWsGateEventFired } from "../../../../common/ws/ws-gate-status-store.js";

function createContainer(stubs = {}) {
  const store = new Map(Object.entries(stubs));
  return {
    get: (k) => store.get(k),
    registerGlobal: (k, v) => store.set(k, v),
    resolve: (k) => store.get(k),
  };
}

function createPdfViewerManagerStub() {
  return {
    getPageView: jest.fn(() => null),
    eventBus: null,
    currentPageNumber: 1,
  };
}

describe("AnnotationFeature - FILE.LOAD.SUCCESS 自动加载", () => {
  beforeEach(() => {
    try { globalEventBus.destroy(); } catch {}
    try { clearWsGateStatusStore(); } catch {}
    document.body.innerHTML = "<main id=\"app\"><div id=\"viewerContainer\"></div></main>";
    // 伪造 URL 参数（使用 history.pushState 避免 jsdom 导航）
    window.history.pushState({}, "", "/pdf-viewer/?pdf-id=doc-abc");
  });

  test("FILE.LOAD.SUCCESS 不应立即触发；RESUME.FLOW.DONE 后触发 ANNOTATION.DATA.LOAD", async () => {
    const emitted = [];
    const scopedBus = createScopedEventBus(globalEventBus, "annotation");
    const offLoad = scopedBus.on(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD, (data) => {
      emitted.push(data);
    }, { subscriberId: "test" });

    const container = createContainer({
      pdfViewerManager: createPdfViewerManagerStub(), // 轻量桩（满足 ScreenshotTool 的最小契约）
      navigationService: { navigateTo: jest.fn() },
    });

    const feature = new AnnotationFeature();
    await feature.install({
      globalEventBus,
      container,
      logger: console,
    });

    // 仅触发文件加载成功：不应立刻加载标注
    globalEventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, { filename: "doc-abc.pdf", pdfId: "doc-abc" });
    await new Promise((r) => setTimeout(r, 50));

    expect(emitted.length).toBe(0);

    // resume 完成后：触发标注加载
    globalEventBus.emit(PDF_VIEWER_EVENTS.RESUME.FLOW.DONE, { pdfId: "doc-abc", hasResume: false, status: "success" });
    await new Promise((r) => setTimeout(r, 50));

    expect(emitted.length).toBeGreaterThan(0);
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
      pdfViewerManager: createPdfViewerManagerStub(),
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

  test("RESUME.FLOW.DONE 缺少 pdfId 必须 fail-fast", async () => {
    const emittedLoad = [];
    const emittedFailed = [];
    const scopedBus = createScopedEventBus(globalEventBus, "annotation");
    const offLoad = scopedBus.on(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD, (data) => emittedLoad.push(data), { subscriberId: "t3" });
    const offFailed = scopedBus.on(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD_FAILED, (data) => emittedFailed.push(data), { subscriberId: "t3" });

    const container = createContainer({
      pdfViewerManager: createPdfViewerManagerStub(),
      navigationService: { navigateTo: jest.fn() },
    });

    const feature = new AnnotationFeature();
    await feature.install({ globalEventBus, container, logger: console });

    globalEventBus.emit(PDF_VIEWER_EVENTS.RESUME.FLOW.DONE, { hasResume: false, status: "success" });
    await new Promise((r) => setTimeout(r, 50));

    expect(emittedLoad.length).toBe(0);
    expect(emittedFailed.length).toBeGreaterThan(0);

    offLoad?.();
    offFailed?.();
  });

  test("晚安装：若 RESUME.FLOW.DONE 已发生，应立即补触发一次 ANNOTATION.DATA.LOAD（命中历史）", async () => {
    // 模拟“事件先发生、Feature 后安装”
    markWsGateEventFired(PDF_VIEWER_EVENTS.RESUME.FLOW.DONE, { pdfId: "doc-abc", hasResume: false, status: "success" });

    const emitted = [];
    const scopedBus = createScopedEventBus(globalEventBus, "annotation");
    const offLoad = scopedBus.on(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD, (data) => emitted.push(data), { subscriberId: "t4" });

    const container = createContainer({
      pdfViewerManager: createPdfViewerManagerStub(),
      navigationService: { navigateTo: jest.fn() },
    });

    const feature = new AnnotationFeature();
    await feature.install({ globalEventBus, container, logger: console });
    await new Promise((r) => setTimeout(r, 50));

    expect(emitted.length).toBeGreaterThan(0);
    offLoad?.();
  });
});
