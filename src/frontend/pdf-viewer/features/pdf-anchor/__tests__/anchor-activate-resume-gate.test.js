/* @jest-environment jsdom */
/**
 * 目的：验证通过 WS 触发的 anchor 激活在 resume 流程完成前不会发起导航，
 *       仅在收到 RESUME.FLOW.DONE 之后才真正触发 NAVIGATION.URL_PARAMS.REQUESTED。
 */
import { jest } from "@jest/globals";
jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { EventBus } from "../../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { PDFAnchorFeature } from "../index.js";

function createContainer(stubs = {}) {
  const store = new Map(Object.entries(stubs));
  return {
    get: (k) => store.get(k),
    registerGlobal: (k, v) => store.set(k, v),
  };
}

describe("PDFAnchorFeature - WS 激活在 RESUME.FLOW.DONE 前后对导航的影响", () => {
  let eventBus;

  beforeEach(() => {
    jest.useFakeTimers();
    eventBus = new EventBus({ moduleName: "test-bus", enableValidation: true, logger: console });
    document.body.innerHTML = "<div id=\"viewerContainer\"></div>";
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test("来自 ws-anchor-activate 的激活在 RESUME.FLOW.DONE 之前不应触发 NAVIGATION.URL_PARAMS.REQUESTED", async () => {
    const container = createContainer({
      navigationService: { navigateTo: jest.fn().mockResolvedValue({ success: true }) },
    });
    const feature = new PDFAnchorFeature();
    await feature.install({ container, globalEventBus: eventBus, logger: console });

    const anchorId = "pdfanchor-aaaaaaaaaaaa";
    // 预加载锚点列表（模拟 ANCHOR.DATA.LOADED）
    eventBus.emit(
      PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED,
      { anchors: [{ uuid: anchorId, name: "A", page_at: 2, position: 0.4 }] },
      { actorId: "test" }
    );

    const navRequests = [];
    eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED,
      (data) => navRequests.push(data),
      { subscriberId: "test-nav" }
    );

    // 文件与渲染已就绪，但 resume 尚未标记完成
    eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, {}, { actorId: "test" });
    eventBus.emit(PDF_VIEWER_EVENTS.RENDER.READY, { firstPage: 1, totalPages: 10 }, { actorId: "test" });

    // 来自 WS 的激活请求被桥接为 ANCHOR.NAVIGATE.REQUESTED，source 标记为 ws-anchor-activate
    eventBus.emit(
      PDF_VIEWER_EVENTS.ANCHOR.NAVIGATE.REQUESTED,
      { anchorId, source: "ws-anchor-activate" },
      { actorId: "test" }
    );

    // 即便推进定时器，也不应发出导航请求
    jest.runAllTimers();
    expect(navRequests).toHaveLength(0);

    // 当 resume 流程结束（无论是否实际应用）时，再次尝试导航
    eventBus.emit(
      PDF_VIEWER_EVENTS.RESUME.FLOW.DONE,
      { pdfId: "dummy", hasResume: false, status: "success" },
      { actorId: "PDFResumeFeature" }
    );

    // 触发 gate 之后的延迟导航
    jest.runAllTimers();
    expect(navRequests).toHaveLength(1);
    expect(navRequests[0]).toMatchObject({ anchorId, pageAt: 2 });

    await feature.uninstall?.();
  });
});

