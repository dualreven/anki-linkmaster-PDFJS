/** @jest-environment jsdom */
/**
 * 启动集成测试 — anchor-id
 * 目标：启动时 URL 含 anchor-id，解析后在锚点数据与文件就绪的门闸达成时，
 * 触发全局 URL_PARAMS.REQUESTED，请求包含页码/位置信息。
 */
import { EventBus } from "../../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { SimpleDependencyContainer } from "../../../container/simple-dependency-container.js";
import { URLNavigationFeature } from "../index.js";
import { createScopedEventBus } from "../../../../common/event/scoped-event-bus.js";
import { PDFAnchorFeature } from "../../pdf-anchor/index.js";

jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  setModuleLogLevel: jest.fn(),
  LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" },
}));

describe("Startup Integration — anchor-id", () => {
  let globalBus;
  let container;
  let urlNavFeature;
  let anchorFeature;

  beforeEach(async () => {
    jest.useFakeTimers();
    document.body.innerHTML = "<main></main><div id=\"viewerContainer\" style=\"height:1000px;\"></div>";
    window.history.pushState({}, "", "http://localhost/pdf-viewer/?pdf-id=doc-001&anchor-id=pdfanchor-1234567890ab");

    globalBus = new EventBus({ enableValidation: false, moduleName: "pdf-viewer" });
    container = new SimpleDependencyContainer("test");
    container.register("eventBus", globalBus);
    container.register("navigationService", {
      navigateTo: jest.fn(async ({ pageAt, position }) => ({ success: true, actualPage: pageAt ?? 1, actualPosition: position ?? null }))
    });

    // 安装 URL 解析与锚点 Feature
    urlNavFeature = new URLNavigationFeature();
    await urlNavFeature.install({ container });
    anchorFeature = new PDFAnchorFeature();
    await anchorFeature.install({ container, globalEventBus: globalBus, logger: console });
  });

  afterEach(async () => {
    try { await anchorFeature?.uninstall?.(); } catch {}
    try { globalBus?.destroy?.(); } catch {}
    jest.useRealTimers();
  });

  test("启动解析 anchor-id → 发出 URL_PARAMS.REQUESTED（含页码/位置）", async () => {
    // 门闸条件：标注数据已加载 + 锚点数据已加载 + 文件加载成功
    const anchorId = "pdfanchor-1234567890ab";
    const scopedAnnBus = createScopedEventBus(globalBus, "annotation");
    // 先订阅，再依次触发门闸，避免竞态
    const waiting = new Promise((resolve, reject) => {
      const off = globalBus.on(PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED, (data) => {
        try { off(); } catch { /* ignore */ }
        clearTimeout(timer);
        resolve(data);
      }, { subscriberId: "test-waiter" });
      const timer = setTimeout(() => {
        try { off(); } catch { /* ignore */ }
        reject(new Error("timeout: " + PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED));
      }, 2000);
    });
    scopedAnnBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED, { annotations: [], count: 0 });
    globalBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED, {
      anchors: [{ uuid: anchorId, name: "A", page_at: 5, position: 0.5, is_active: true }]
    });
    globalBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, { filename: "doc-001.pdf" });

    // AnchorFeature 内部存在 1s 的并发窗口，推进定时器
    jest.advanceTimersByTime(1100);
    await Promise.resolve();

    const req = await waiting;
    expect(req).toBeTruthy();
    expect(req.pageAt).toBe(5);
    if (typeof req.position === "number") {
      expect(req.position).toBeGreaterThan(45);
      expect(req.position).toBeLessThan(55);
    }
  });
});
