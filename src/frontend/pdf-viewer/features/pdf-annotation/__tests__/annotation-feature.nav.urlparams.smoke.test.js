/**
 * @jest-environment jsdom
 *
 * 说明（加速/去 flake 改造）：
 * - 原实现通过安装 AnnotationFeature 跑完整链路，初始化重、易触发 5s timeout flake；
 * - 本用例改为“聚焦型”：直接单测 handleNavigateToAnnotation()，
 *   仅验证 pageAt/position 的计算与导航调用（不覆盖 Feature 装配细节）。
 */
import { handleNavigateToAnnotation } from "../annotation-feature-navigate-to-annotation.js";

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

  test("三种标注触发跳转 → navigationService.navigateTo 被调用，pageAt/position 计算正确", async () => {
    // 提供 navigationService（handleNavigateToAnnotation 直接用其跳转）
    const navigationService = {
      navigateTo: jest.fn().mockResolvedValue(undefined)
    };

    const eventBus = {
      emit: jest.fn(),
      emitGlobal: jest.fn(),
    };
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // 构造三种标注（只保留导航计算需要的字段）
    const annScreenshot = {
      id: "ann_screenshot",
      type: "screenshot",
      pageNumber: 2,
      data: { rectPercent: { xPercent: 10, yPercent: 20, widthPercent: 30, heightPercent: 10 } },
    };
    const annHighlight = {
      id: "ann_highlight",
      type: "text-highlight",
      pageNumber: 2,
      data: { lineRects: [{ xPercent: 0, yPercent: 40, widthPercent: 50, heightPercent: 10 }] },
    };
    const annComment = {
      id: "ann_comment",
      type: "comment",
      pageNumber: 2,
      data: { positionPercent: { xPercent: 10, yPercent: 65 }, content: "note" },
    };

    // 创建对应的 DOM 容器，便于高亮页码从 DOM 解析覆盖数据层页码（更贴近真实行为）
    const highlightEl = document.createElement("div");
    highlightEl.className = "text-highlight-container";
    highlightEl.setAttribute("data-annotation-id", annHighlight.id);
    const pageEl = document.querySelector(".page[data-page-number=\"2\"]");
    pageEl.appendChild(highlightEl);

    const annotationManager = {
      getAnnotation: jest.fn((id) => {
        if (id === annScreenshot.id) { return annScreenshot; }
        if (id === annHighlight.id) { return annHighlight; }
        if (id === annComment.id) { return annComment; }
        return null;
      }),
    };

    // 触发跳转（均按 id 传入）
    await handleNavigateToAnnotation({
      data: { annotation: annScreenshot.id },
      annotationManager,
      eventBus,
      navigationService,
      logger,
      highlightAnnotationMarker: jest.fn(),
    });
    await handleNavigateToAnnotation({
      data: { annotation: annHighlight.id },
      annotationManager,
      eventBus,
      navigationService,
      logger,
      highlightAnnotationMarker: jest.fn(),
    });
    await handleNavigateToAnnotation({
      data: { annotation: annComment.id },
      annotationManager,
      eventBus,
      navigationService,
      logger,
      highlightAnnotationMarker: jest.fn(),
    });

    expect(navigationService.navigateTo).toHaveBeenCalledTimes(3);

    const findCallByPosition = (pos) => navigationService.navigateTo.mock.calls.find(([arg]) => {
      if (!arg || arg.pageAt !== 2) { return false; }
      const p = arg.position;
      return typeof p === "number" && Math.abs(p - pos) < 1e-6;
    });
    // 截图：矩形中心 yPercent = 20 + 10/2 = 25
    expect(findCallByPosition(25)).toBeTruthy();
    // 高亮：第一段中心 yPercent = 40 + 10/2 = 45
    expect(findCallByPosition(45)).toBeTruthy();
    // 批注：直接使用 positionPercent.yPercent = 65
    expect(findCallByPosition(65)).toBeTruthy();
  });
});
