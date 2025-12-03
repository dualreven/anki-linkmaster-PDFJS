/* @jest-environment jsdom */
/**
 * UTF-8; 严格 \n
 * 目的：验证锚点位置更新机制与 pdf-resume 一致：
 * - 由 PositionTracker 驱动位置采样；
 * - 仅在激活锚点存在时写回；
 * - 1 秒节流；
 * - 导航后 3 秒冻结。
 */
import { jest } from "@jest/globals";
jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  setModuleLogLevel: jest.fn(),
  LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" },
}));

import globalEventBus from "../../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { PDFAnchorFeature } from "../index.js";

function createContainer(stubs = {}) {
  const store = new Map(Object.entries(stubs));
  return {
    get: (k) => store.get(k),
    registerGlobal: (k, v) => store.set(k, v),
  };
}

describe("PDFAnchorFeature - PositionTracker 驱动位置更新机制", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    try { globalEventBus.destroy(); } catch {}
    // 准备最小 DOM，便于 PositionTracker / getCurrentPageAndPosition 工作
    document.body.innerHTML = `
      <div id="viewerContainer" style="height:600px; overflow:auto;">
        <div class="page" data-page-number="1"></div>
        <div class="page" data-page-number="2"></div>
      </div>
    `;
    // jsdom 无布局，手动补 offset
    const pages = Array.from(document.querySelectorAll(".page"));
    pages.forEach((el, i) => {
      Object.defineProperty(el, "offsetTop", { value: i * 1000 });
      Object.defineProperty(el, "offsetHeight", { value: 1000 });
    });
    const container = document.getElementById("viewerContainer");
    Object.defineProperty(container, "clientHeight", { value: 600 });
    Object.defineProperty(container, "scrollTop", { value: 0, writable: true });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    const viewerContainer = document.getElementById("viewerContainer");
    if (viewerContainer) {
      viewerContainer.remove();
    }
  });

  test("激活锚点后滚动应触发一次 ANCHOR.UPDATE 写回", async () => {
    const container = createContainer();
    const feature = new PDFAnchorFeature();
    await feature.install({ container, globalEventBus, logger: console });

    const anchorId = "pdfanchor-aaaaaaaaaaaa";
    // 预置锚点列表
    globalEventBus.emit(
      PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED,
      { anchors: [{ uuid: anchorId, name: "A", page_at: 1, position: 0.0 }] },
      { actorId: "test" }
    );

    const updates = [];
    const offUpdate = globalEventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.UPDATE,
      (payload) => { updates.push(payload); },
      { subscriberId: "assert-update" }
    );

    // 激活锚点
    globalEventBus.emit(
      PDF_VIEWER_EVENTS.ANCHOR.ACTIVATE,
      { anchorId, active: true },
      { actorId: "test" }
    );

    // 模拟用户滚动
    const viewerContainer = document.getElementById("viewerContainer");
    viewerContainer.scrollTop = 1100; // 视口中心接近第 2 页
    viewerContainer.dispatchEvent(new Event("scroll"));

    // PositionTracker 去抖动 200ms
    jest.advanceTimersByTime(250);

    expect(updates.length).toBe(1);
    expect(updates[0].anchorId).toBe(anchorId);
    expect(typeof updates[0].update.page_at).toBe("number");
    expect(typeof updates[0].update.position).toBe("number");

    offUpdate?.();
  });

  test("在 1 秒节流窗口内多次滚动只应写回一次", async () => {
    const container = createContainer();
    const feature = new PDFAnchorFeature();
    await feature.install({ container, globalEventBus, logger: console });

    const anchorId = "pdfanchor-bbbbbbbbbbbb";
    globalEventBus.emit(
      PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED,
      { anchors: [{ uuid: anchorId, name: "B", page_at: 1, position: 0.0 }] },
      { actorId: "test" }
    );

    const updates = [];
    const offUpdate = globalEventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.UPDATE,
      (payload) => { updates.push(payload); },
      { subscriberId: "assert-update" }
    );

    globalEventBus.emit(
      PDF_VIEWER_EVENTS.ANCHOR.ACTIVATE,
      { anchorId, active: true },
      { actorId: "test" }
    );

    const viewerContainer = document.getElementById("viewerContainer");

    // 第一次滚动 → 触发一次写回
    viewerContainer.scrollTop = 1000;
    viewerContainer.dispatchEvent(new Event("scroll"));
    jest.advanceTimersByTime(250);
    expect(updates.length).toBe(1);

    // 1 秒内第二次滚动 → 由于节流，不应新增写回
    viewerContainer.scrollTop = 1500;
    viewerContainer.dispatchEvent(new Event("scroll"));
    jest.advanceTimersByTime(250);
    expect(updates.length).toBe(1);

    offUpdate?.();
  });

  test("导航后 3 秒内滚动不写回，3 秒后滚动才写回", async () => {
    const container = createContainer();
    const feature = new PDFAnchorFeature();
    await feature.install({ container, globalEventBus, logger: console });

    const anchorId = "pdfanchor-cccccccccccc";
    globalEventBus.emit(
      PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED,
      { anchors: [{ uuid: anchorId, name: "C", page_at: 1, position: 0.0 }] },
      { actorId: "test" }
    );

    const updates = [];
    const offUpdate = globalEventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.UPDATE,
      (payload) => { updates.push(payload); },
      { subscriberId: "assert-update" }
    );

    // 通过导航请求触发 navigateToAnchor → 冻结 PositionTracker 3 秒
    globalEventBus.emit(
      PDF_VIEWER_EVENTS.ANCHOR.NAVIGATE.REQUESTED,
      { anchorId },
      { actorId: "test" }
    );

    const viewerContainer = document.getElementById("viewerContainer");

    // 冻结窗口内滚动，不应写回
    viewerContainer.scrollTop = 800;
    viewerContainer.dispatchEvent(new Event("scroll"));
    jest.advanceTimersByTime(250);
    expect(updates.length).toBe(0);

    // 3 秒后再次滚动，应产生一次写回
    jest.advanceTimersByTime(3000);
    viewerContainer.scrollTop = 1600;
    viewerContainer.dispatchEvent(new Event("scroll"));
    jest.advanceTimersByTime(250);
    expect(updates.length).toBe(1);

    offUpdate?.();
  });
});
