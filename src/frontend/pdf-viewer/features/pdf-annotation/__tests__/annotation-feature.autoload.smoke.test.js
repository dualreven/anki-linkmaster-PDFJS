/**
 * @jest-environment jsdom
 *
 * 目标：
 * - FILE.LOAD.SUCCESS 发生后，AnnotationFeature 能解析 pdfId 并发起一次 DATA.LOAD；
 * - AnnotationManager 完成加载后发出 DATA.LOADED（Mock 模式下为 0 条）。
 */
import { EventBus } from "../../../../common/event/event-bus.js";
import { createScopedEventBus } from "../../../../common/event/scoped-event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { AnnotationFeature } from "../index.js";

class SimpleContainer {
  constructor() { this._map = new Map(); }
  registerGlobal(name, inst) { this._map.set(name, inst); }
  get(name) { return this._map.get(name); }
}

// 不再使用变量转发事件名，避免触发 lint；在用例中以常量直接订阅

describe("AnnotationFeature — 自动加载冒烟", () => {
  beforeEach(() => {
    document.body.innerHTML = "<main></main><div id=\"viewerContainer\"></div>";
  });

  test("FILE.LOAD.SUCCESS → 触发 DATA.LOAD → 收到 DATA.LOADED", async () => {
    const globalBus = new EventBus({ enableValidation: false, moduleName: "pdf-viewer" });
    const scopedBus = createScopedEventBus(globalBus, "annotation");
    const container = new SimpleContainer();
    container.registerGlobal("navigationService", { navigateTo: async () => {} });
    container.registerGlobal("pdfViewerManager", { getPageView: () => null });

    const feature = new AnnotationFeature();
    await feature.install({
      globalEventBus: globalBus,
      scopedEventBus: scopedBus,
      logger: null,
      container
    });

    // 监听 LOADED（Mock 模式：0 条）
    const waitLoaded = new Promise((resolve, reject) => {
      const off = scopedBus.on(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED, (data) => {
        try { off(); } catch { /* ignore */ }
        clearTimeout(timer);
        resolve(data);
      });
      const timer = setTimeout(() => {
        try { off(); } catch { /* ignore */ }
        reject(new Error("timeout waiting for " + PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED));
      }, 4000);
    });
    // 触发文件加载完成
    globalBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, {
      pdfId: "c83c60c58ad2",
      filename: "c83c60c58ad2.pdf",
      url: "http://localhost/pdf-viewer/?pdf-id=c83c60c58ad2"
    });
    // 标注自动加载被门控到 resume 完成事件之后
    globalBus.emit(PDF_VIEWER_EVENTS.RESUME.FLOW.DONE, { pdfId: "c83c60c58ad2" });
    const loaded = await waitLoaded;
    expect(loaded).toBeTruthy();
    expect(typeof loaded.count).toBe("number");
    expect(loaded.count).toBeGreaterThanOrEqual(0);

    // 验证 AnnotationManager 已记录 pdfId（通过容器获取）
    const manager = container.get("annotationManager");
    expect(manager?.getStatus?.().pdfId).toBe("c83c60c58ad2");

    await feature.uninstall();
  });
});
