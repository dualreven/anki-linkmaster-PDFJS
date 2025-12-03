/* @jest-environment jsdom */
/**
 * UTF-8; 严格 \n
 * 目的：验证“取消激活后再次激活”仍会触发导航事件。
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

describe("PDFAnchorFeature - 取消激活后再次激活仍应触发导航", () => {
  beforeEach(() => {
    try { globalEventBus.destroy(); } catch {}
    document.body.innerHTML = "<div id=\"viewerContainer\"></div>";
    window.history.pushState({}, "", "/pdf-viewer/?pdf-id=doc-001");
  });

  test("ANCHOR.NAVIGATE.REQUESTED → ACTIVATE(false) → ANCHOR.NAVIGATE.REQUESTED 仍会发出两次 URL_PARAMS.REQUESTED", async () => {
    const container = createContainer();
    const feature = new PDFAnchorFeature();
    await feature.install({ container, globalEventBus, logger: console });

    const navRequests = [];
    const offNav = globalEventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED,
      (data) => navRequests.push(data),
      { subscriberId: "assert" }
    );

    const anchorId = "pdfanchor-aaaaaaaaaaaa";
    // 预置一个锚点
    globalEventBus.emit(
      PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED,
      { anchors: [{ uuid: anchorId, name: "A", page_at: 3, position: 0.4 }] },
      { actorId: "test" }
    );

    // 第一次：请求导航
    globalEventBus.emit(
      PDF_VIEWER_EVENTS.ANCHOR.NAVIGATE.REQUESTED,
      { anchorId },
      { actorId: "test" }
    );

    expect(navRequests.length).toBe(1);
    expect(navRequests[0].anchorId).toBe(anchorId);

    // 中途：取消激活
    globalEventBus.emit(
      PDF_VIEWER_EVENTS.ANCHOR.ACTIVATE,
      { anchorId, active: false },
      { actorId: "test" }
    );

    // 第二次：再次请求导航
    globalEventBus.emit(
      PDF_VIEWER_EVENTS.ANCHOR.NAVIGATE.REQUESTED,
      { anchorId },
      { actorId: "test" }
    );

    expect(navRequests.length).toBe(2);
    expect(navRequests[1].anchorId).toBe(anchorId);

    offNav?.();
  });
});
