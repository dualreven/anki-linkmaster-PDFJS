/* @jest-environment jsdom */
import { jest } from "@jest/globals";
jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  setModuleLogLevel: jest.fn(),
  LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" },
}));

import globalEventBus from "../../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { PDFAnchorFeature } from "../index.js";

function containerStub() {
  const store = new Map();
  return {
    get: (k) => store.get(k),
    registerGlobal: (k, v) => store.set(k, v),
  };
}

describe("PDFAnchorFeature - ANCHOR.NAVIGATE.REQUESTED 自动激活目标锚点（单选）", () => {
  beforeEach(() => {
    try { globalEventBus.destroy(); } catch {}
    document.body.innerHTML = "<div id=\"viewerContainer\"></div>";
    window.history.pushState({}, "", "/pdf-viewer/?pdf-id=doc-001");
  });

  test("触发 ANCHOR.NAVIGATE.REQUESTED → 发出 ANCHOR.ACTIVATED，且只有一个 is_active=true", async () => {
    const container = containerStub();
    const feature = new PDFAnchorFeature();
    await feature.install({ container, globalEventBus, logger: console });

    const activated = [];
    const lists = [];
    globalEventBus.on(PDF_VIEWER_EVENTS.ANCHOR.ACTIVATED, (d) => activated.push(d), { subscriberId: "assert" });
    globalEventBus.on(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED, (d) => lists.push(d.anchors || []), { subscriberId: "assert" });

    const aId = "pdfanchor-aaaaaaaaaaaa";
    const bId = "pdfanchor-bbbbbbbbbbbb";
    // 预设两个锚点（均未激活）
    globalEventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED, {
      anchors: [
        { uuid: aId, name: "A", page_at: 2, position: 0.1, is_active: false },
        { uuid: bId, name: "B", page_at: 3, position: 0.2, is_active: false },
      ],
    }, { actorId: "test" });

    // 触发“按ID导航”请求（应当自动经事件激活目标锚点）
    globalEventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.NAVIGATE.REQUESTED, { anchorId: bId }, { actorId: "test" });

    // 断言出现一次激活事件（目标为 bId）
    expect(activated.some(e => e && e.anchorId === bId && e.active === true)).toBe(true);

    // 获取最新一次列表，验只允许单选
    const last = lists[lists.length - 1] || [];
    const activeCount = last.filter(x => x && x.is_active === true).length;
    expect(activeCount).toBeLessThanOrEqual(1);
    expect(last.some(x => x && x.uuid === bId && x.is_active === true)).toBe(true);
  });
});

