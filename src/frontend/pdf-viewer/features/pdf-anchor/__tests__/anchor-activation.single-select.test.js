/* @jest-environment jsdom */
/**
 * UTF-8; 严格 \n
 * 目的：验证锚点激活“单选”语义与事件广播。
 */
import { jest } from "@jest/globals";
jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
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

describe("PDFAnchorFeature - 激活单选语义", () => {
  beforeEach(() => {
    try { globalEventBus.destroy(); } catch {}
    document.body.innerHTML = "<div id=\"viewerContainer\"></div>";
  });

  test("激活A后再激活B：只应有一个 is_active=true，且触发 ACTIVATED", async () => {
    const container = createContainer({
      navigationService: { navigateTo: jest.fn().mockResolvedValue({ success: true, actualPage: 1 }) },
    });
    const feature = new PDFAnchorFeature();
    await feature.install({ container, globalEventBus, logger: console });

    // 注入两条锚点数据
    const aId = "pdfanchor-aaaaaaaaaaaa";
    const bId = "pdfanchor-bbbbbbbbbbbb";
    globalEventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED, {
      anchors: [
        { uuid: aId, name: "A", page_at: 1, position: 0.1, is_active: false },
        { uuid: bId, name: "B", page_at: 2, position: 0.2, is_active: false },
      ],
    });

    const activated = [];
    const lists = [];
    const off1 = globalEventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.ACTIVATED,
      (info) => activated.push(info),
      { subscriberId: "test" }
    );
    const off2 = globalEventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED,
      ({ anchors }) => lists.push(anchors),
      { subscriberId: "test" }
    );

    // 激活 A
    globalEventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.ACTIVATE, { anchorId: aId, active: true });
    // 再激活 B
    globalEventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.ACTIVATE, { anchorId: bId, active: true });

    expect(activated.some(e => e.anchorId === aId && e.active === true)).toBe(true);
    expect(activated.some(e => e.anchorId === bId && e.active === true)).toBe(true);

    // 最新一次列表：只允许一个 is_active=true
    const last = lists[lists.length - 1] || [];
    const activeCount = (last || []).filter(x => x && x.is_active === true).length;
    expect(activeCount).toBe(1);
    expect((last || []).some(x => x.uuid === bId && x.is_active === true)).toBe(true);

    off1?.(); off2?.();
  });
});

