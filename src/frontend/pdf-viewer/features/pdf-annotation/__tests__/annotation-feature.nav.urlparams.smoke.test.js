/**
 * @jest-environment jsdom
 *
 * 注：这是“冒烟级”用例，聚焦端到端可观察行为，而非内部实现细节。
 * 目标：
 * - 安装 AnnotationFeature；
 * - 通过事件创建三种标注（截图/高亮/批注，走本地 Mock 保存路径）；
 * - 触发“跳转到标注”请求，断言会在全局总线发出 URL_PARAMS.REQUESTED，
 *   且 pageAt/position 计算符合预期（不同类型的来源不同）。
 */
import { EventBus } from "../../../../common/event/event-bus.js";
import { createScopedEventBus } from "../../../../common/event/scoped-event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { AnnotationFeature } from "../index.js";
import { Annotation } from "../models/annotation.js";

// 简易容器桩件：支持 registerGlobal/get，提供 navigationService
class SimpleContainer {
  constructor() {
    this._map = new Map();
  }
  registerGlobal(name, inst) {
    this._map.set(name, inst);
  }
  get(name) {
    return this._map.get(name);
  }
}

// 不再通过变量传递事件名，直接在订阅处使用常量表达式

describe("AnnotationFeature — 导航 URL 参数冒烟", () => {
  beforeEach(() => {
    // 准备最小 DOM：main + viewerContainer + 一页
    document.body.innerHTML = `
      <main></main>
      <div id="viewerContainer">
        <div class="page" data-page-number="2" style="height:1000px;"></div>
      </div>
    `;
  });

  test("三种标注触发跳转 → 发出 URL_PARAMS.REQUESTED，pageAt/position 计算正确", async () => {
    const globalBus = new EventBus({ enableValidation: false, moduleName: "pdf-viewer" });
    const scopedBus = createScopedEventBus(globalBus, "annotation");

    const container = new SimpleContainer();
    // 提供 navigationService（在像素 position 回退路径时会用到；当前用例不触发，可为 no-op）
    container.registerGlobal("navigationService", {
      navigateTo: async () => {}
    });
    // 其余依赖（pdfViewerManager）可为 null
    container.registerGlobal("pdfViewerManager", {});

    // 安装 Feature
    const feature = new AnnotationFeature();
    await feature.install({
      globalEventBus: globalBus,
      scopedEventBus: scopedBus,
      logger: null,
      container
    });

    // 取出 AnnotationManager（由 feature 注册到容器）
    const manager = container.get("annotationManager");
    expect(manager).toBeTruthy();

    // 构造三种标注并创建（走本地 Mock 保存路径：未设 pdfId、无 wsClient）
    const annScreenshot = Annotation.createScreenshot(
      2,
      { xPercent: 10, yPercent: 20, widthPercent: 30, heightPercent: 10 },
      "/data/screens/abc.png",
      "0123456789abcdef0123456789abcdef",
      "desc"
    );
    const annHighlight = Annotation.createTextHighlight(
      2,
      "hello",
      [{ start: 0, end: 5 }],
      "#ffff00",
      "",
      [{ xPercent: 0, yPercent: 40, widthPercent: 50, heightPercent: 10 }]
    );
    const annComment = Annotation.createComment(2, { xPercent: 10, yPercent: 65 }, "note");

    // 创建对应的 DOM 容器，便于高亮页码从 DOM 解析覆盖数据层页码（更贴近真实行为）
    const highlightEl = document.createElement("div");
    highlightEl.className = "text-highlight-container";
    highlightEl.setAttribute("data-annotation-id", annHighlight.id);
    const pageEl = document.querySelector(".page[data-page-number=\"2\"]");
    pageEl.appendChild(highlightEl);

    // 通过事件创建（AnnotationManager 会接收并加入内存），并等待 CREATED 结算
    const waitCreated = (id) => new Promise((resolve, reject) => {
      const off = scopedBus.on(PDF_VIEWER_EVENTS.ANNOTATION.CREATED, (data) => {
        if (data?.annotation?.id === id) {
          try { off(); } catch { /* ignore */ }
          clearTimeout(timer);
          resolve(data);
        }
      }, { subscriberId: `test-created-${id}` });
      const timer = setTimeout(() => {
        try { off(); } catch { /* ignore */ }
        reject(new Error("timeout waiting for annotation:create:success"));
      }, 1200);
    });
    const p1 = waitCreated(annScreenshot.id);
    const p2 = waitCreated(annHighlight.id);
    const p3 = waitCreated(annComment.id);
    scopedBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.CREATE, { annotation: annScreenshot });
    scopedBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.CREATE, { annotation: annHighlight });
    scopedBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.CREATE, { annotation: annComment });
    await Promise.all([p1, p2, p3]);

    // 监听全局 URL 参数请求（3 次）
    const wait3 = new Promise((resolve, reject) => {
      const outputs = [];
      const off = globalBus.on(PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED, (data) => {
        outputs.push(data);
        if (outputs.length >= 3) {
          try { off(); } catch { /* ignore */ }
          clearTimeout(timer);
          resolve(outputs);
        }
      });
      const timer = setTimeout(() => {
        try { off(); } catch { /* ignore */ }
        reject(new Error("timeout waiting for URL_PARAMS.REQUESTED x3"));
      }, 4000);
    });

    // 触发跳转（均按 id 传入）
    scopedBus.emitGlobal(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED, { annotation: annScreenshot.id });
    scopedBus.emitGlobal(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED, { annotation: annHighlight.id });
    scopedBus.emitGlobal(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED, { annotation: annComment.id });

    const reqs = await wait3;
    expect(Array.isArray(reqs)).toBe(true);
    expect(reqs).toHaveLength(3);

    // 将三次请求按 annotationId 映射，便于断言
    const byId = {};
    for (const r of reqs) {
      byId[r.annotationId] = r;
      expect(r.pageAt).toBe(2);
    }
    // 截图：使用矩形中心 yPercent = 20 + 10/2 = 25
    expect(byId[annScreenshot.id].position).toBeCloseTo(25, 5);
    // 高亮：使用第一段中心 yPercent = 40 + 10/2 = 45
    expect(byId[annHighlight.id].position).toBeCloseTo(45, 5);
    // 批注：直接使用 positionPercent.yPercent = 65
    expect(byId[annComment.id].position).toBeCloseTo(65, 5);

    // 清理
    await feature.uninstall();
  });
});
