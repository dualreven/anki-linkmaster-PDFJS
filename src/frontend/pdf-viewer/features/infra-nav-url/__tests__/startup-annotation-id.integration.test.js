/** @jest-environment jsdom */
/**
 * 启动集成测试 — annotation-id
 * 目标：启动时 URL 含 annotation-id，解析后在标注数据就绪时触发跳转请求，
 * 并返回页码与位置（通过 URL_PARAMS.REQUESTED 全局事件体现）。
 */
import { EventBus } from "../../../../common/event/event-bus.js";
import { createScopedEventBus } from "../../../../common/event/scoped-event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { SimpleDependencyContainer } from "../../../container/simple-dependency-container.js";
import { URLNavigationFeature } from "../index.js";
import { AnnotationFeature } from "../../pdf-annotation/index.js";
import { Annotation, AnnotationType } from "../../pdf-annotation/models/annotation.js";

// 使用项目内置 logger mock 以避免 import.meta 差异带来的副作用
jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  setModuleLogLevel: jest.fn(),
  LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" },
}));

describe("Startup Integration — annotation-id", () => {
  let globalBus;
  let scopedAnnotationBus;
  let container;
  let urlNavFeature;
  let annotationFeature;

  beforeEach(async () => {
    // 最小 DOM（AnnotationFeature 需要 main 容器）
    document.body.innerHTML = "<main></main><div id=\"viewerContainer\"></div>";
    // 伪造启动 URL：pdf-id 为普通字符串（非 12hex），annotation-id 为固定值
    window.history.pushState({}, "", "http://localhost/pdf-viewer/?pdf-id=doc-abc&annotation-id=ann-startup-1");

    // 全局总线与容器
    globalBus = new EventBus({ enableValidation: false, moduleName: "pdf-viewer" });
    scopedAnnotationBus = createScopedEventBus(globalBus, "annotation");
    container = new SimpleDependencyContainer("test");
    container.register("eventBus", globalBus);
    // 提供 navigationService（本用例不直接用到，但为 URLNavigationFeature 的依赖）
    container.register("navigationService", { navigateTo: async () => ({ success: true, actualPage: 1, actualPosition: 0 }) });

    // 安装 AnnotationFeature（负责计算 annotation 跳转位置并发出 URL_PARAMS.REQUESTED）
    annotationFeature = new AnnotationFeature();
    await annotationFeature.install({
      globalEventBus: globalBus,
      scopedEventBus: scopedAnnotationBus,
      container,
      logger: null
    });
  });

  afterEach(async () => {
    try { await annotationFeature?.uninstall?.(); } catch {}
    try { globalBus?.destroy?.(); } catch {}
  });

  test("启动解析 annotation-id → 在标注数据就绪后发出 URL_PARAMS.REQUESTED（含页码与位置）", async () => {
    // 先准备一个已存在的标注（id 与 URL 匹配），落入 AnnotationManager 内存
    const ann = new Annotation({
      id: "ann-startup-1",
      type: AnnotationType.COMMENT,
      pageNumber: 2,
      data: { positionPercent: { xPercent: 10, yPercent: 65 }, content: "note" },
      comments: []
    });
    // 通过局部事件创建（AnnotationManager 会加入内存并发出 CREATED）
    const createdP = new Promise((resolve, reject) => {
      const off = scopedAnnotationBus.on(PDF_VIEWER_EVENTS.ANNOTATION.CREATED, (data) => {
        try { off(); } catch {}
        resolve(data);
      }, { subscriberId: "test-created" });
      setTimeout(() => { try { off(); } catch {} ; reject(new Error("timeout waiting CREATED")); }, 1000);
    });
    scopedAnnotationBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.CREATE, { annotation: ann });
    await createdP;

    // 安装 URLNavigationFeature（解析 URL 并监听 LOADED 门闸）
    urlNavFeature = new URLNavigationFeature();
    await urlNavFeature.install({ container });

    // 提前订阅，再触发门闸，避免竞态
    const jumpWaiting = new Promise((resolve, reject) => {
      const off = globalBus.on(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED, (data) => {
        try { off(); } catch {}
        clearTimeout(timer);
        resolve(data);
      }, { subscriberId: "test-waiter" });
      const timer = setTimeout(() => {
        try { off(); } catch {}
        reject(new Error("timeout: " + PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED));
      }, 1500);
    });
    const waiting = new Promise((resolve, reject) => {
      const off = globalBus.on(PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED, (data) => {
        try { off(); } catch {}
        clearTimeout(timer);
        resolve(data);
      }, { subscriberId: "test-waiter" });
      const timer = setTimeout(() => {
        try { off(); } catch {}
        reject(new Error("timeout: " + PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED));
      }, 2000);
    });
    const scopedAnnBusForGate = createScopedEventBus(globalBus, "annotation");
    scopedAnnBusForGate.emit(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED, { annotations: [ { id: ann.id } ], count: 1 });
    await jumpWaiting;
    const req = await waiting;
    expect(req).toBeTruthy();
    expect(req.pageAt).toBe(2);
    // 允许少许浮点误差
    expect(typeof req.position).toBe("number");
    expect(req.position).toBeGreaterThan(60);
    expect(req.position).toBeLessThan(70);
  });
});
