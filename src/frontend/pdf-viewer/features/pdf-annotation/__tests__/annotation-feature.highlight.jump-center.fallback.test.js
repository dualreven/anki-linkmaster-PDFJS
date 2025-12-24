/**
 * @jest-environment jsdom
 *
 * 高亮跳转居中回归：当高亮标注缺少 lineRects（历史/刷新后数据）时，
 * 依赖 DOM 的兜底逻辑应能根据高亮容器位置计算中心百分比并触发滚动。
 */

import { centerTextHighlightViaDom } from "../utils/text-highlight-dom-centering.js";

describe("text-highlight DOM centering fallback", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main></main>
      <div id="viewerContainer">
        <div class="page" data-page-number="2"></div>
      </div>
    `;
    const page = document.querySelector(".page[data-page-number=\"2\"]");
    Object.defineProperty(page, "offsetHeight", {
      configurable: true,
      get() { return 1000; }
    });
    page.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 1000 });
  });

  test("should call scrollToPosition using DOM-centered percent", async () => {
    const scrollToPosition = jest.fn().mockResolvedValue(41.5);
    const navigationService = { scrollToPosition };

    const pageEl = document.querySelector(".page[data-page-number=\"2\"]");
    const containerEl = document.createElement("div");
    containerEl.className = "text-highlight-container";
    containerEl.setAttribute("data-annotation-id", "ann_test_1");
    // 注意：真实实现中容器覆盖整页，因此容器 rect 不可用于定位
    containerEl.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 1000, bottom: 1000, right: 800 });

    const block1 = document.createElement("div");
    block1.className = "text-highlight";
    block1.getBoundingClientRect = () => ({ left: 0, top: 400, bottom: 410, width: 200, height: 10, right: 200 });

    const block2 = document.createElement("div");
    block2.className = "text-highlight";
    block2.getBoundingClientRect = () => ({ left: 0, top: 420, bottom: 430, width: 200, height: 10, right: 200 });

    containerEl.appendChild(block1);
    containerEl.appendChild(block2);
    pageEl.appendChild(containerEl);

    const result = await centerTextHighlightViaDom({
      annotationId: "ann_test_1",
      pageNumber: 2,
      navigationService
    });

    expect(result.ok).toBe(true);
    expect(result.percent).toBeCloseTo(41.5, 2);
    expect(scrollToPosition).toHaveBeenCalled();
    const [percent, pageNumber] = scrollToPosition.mock.calls[0];
    expect(pageNumber).toBe(2);
    expect(percent).toBeCloseTo(41.5, 2);
  });

  test("should return ok=false when highlight has no blocks", async () => {
    const scrollToPosition = jest.fn().mockResolvedValue(0);
    const navigationService = { scrollToPosition };

    const pageEl = document.querySelector(".page[data-page-number=\"2\"]");
    const containerEl = document.createElement("div");
    containerEl.className = "text-highlight-container";
    containerEl.setAttribute("data-annotation-id", "ann_test_empty");
    containerEl.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 1000, bottom: 1000, right: 800 });
    pageEl.appendChild(containerEl);

    const result = await centerTextHighlightViaDom({
      annotationId: "ann_test_empty",
      pageNumber: 2,
      navigationService,
      timeoutMs: 80
    });

    expect(result.ok).toBe(false);
    expect(result.percent).toBeNull();
    expect(scrollToPosition).not.toHaveBeenCalled();
  });
});
