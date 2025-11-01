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

function waitForEvent(bus, eventName, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const off = bus.on(eventName, (data) => {
      try { off(); } catch { /* ignore */ }
      clearTimeout(timer);
      resolve(data);
    });
    const timer = setTimeout(() => {
      try { off(); } catch { /* ignore */ }
      reject(new Error("timeout waiting for " + eventName));
    }, timeoutMs);
  });
}

describe("AnnotationFeature — 自动加载冒烟", () => {
  beforeEach(() => {
    document.body.innerHTML = `<main></main><div id="viewerContainer"></div>`;
    // 模拟 URL 中含 pdf-id，供 URLParamsParser.parse() 使用
    const url = "http://localhost/pdf-viewer/?pdf-id=c83c60c58ad2";
    // jsdom 允许直接赋值
    window.history.pushState({}, "", url);
  });

  test("FILE.LOAD.SUCCESS → 触发 DATA.LOAD → 收到 DATA.LOADED", async () => {
    const globalBus = new EventBus({ enableValidation: false, moduleName: "pdf-viewer" });
    const scopedBus = createScopedEventBus(globalBus, "annotation");
    const container = new SimpleContainer();
    container.registerGlobal("navigationService", { navigateTo: async () => {} });
    container.registerGlobal("pdfViewerManager", {});

    const feature = new AnnotationFeature();
    await feature.install({
      globalEventBus: globalBus,
      scopedEventBus: scopedBus,
      logger: null,
      container
    });

    // 监听 LOADED（Mock 模式：0 条）
    const waitLoaded = waitForEvent(scopedBus, PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED, 4000);
    // 触发文件加载完成
    globalBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, {
      filename: "c83c60c58ad2.pdf",
      url: window.location.href
    });
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

