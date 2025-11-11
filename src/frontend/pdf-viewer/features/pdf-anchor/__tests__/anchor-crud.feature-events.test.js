/* @jest-environment jsdom */
/**
 * UTF-8; 严格 \n
 * 目的：验证锚点添加/修改/删除与相关事件广播。
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

describe("PDFAnchorFeature - CRUD 事件链", () => {
  beforeEach(() => {
    try { globalEventBus.destroy(); } catch {}
    // 准备最小 DOM，便于“快速创建”路径采样当前位置
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
    Object.defineProperty(container, "scrollTop", { value: 100 }); // 靠近第1页
  });

  test("CREATE(UI) → 列表包含新锚点；UPDATE/DELETE 事件有效", async () => {
    const container = createContainer({
      navigationService: { navigateTo: jest.fn().mockResolvedValue({ success: true, actualPage: 1 }) },
    });
    const feature = new PDFAnchorFeature();
    await feature.install({ container, globalEventBus, logger: console });

    const observedLists = [];
    const observedUpdated = [];
    const observedCreateRelay = [];
    const offList = globalEventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED,
      ({ anchors }) => observedLists.push(anchors),
      { subscriberId: "test" }
    );
    const offUpd = globalEventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.UPDATED,
      (info) => observedUpdated.push(info),
      { subscriberId: "test" }
    );
    const offRelay = globalEventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.CREATE,
      (data) => { if (data?.__fromFeature) { observedCreateRelay.push(data); } },
      { subscriberId: "test-relay" }
    );

    // A) UI 指定负载创建
    const id = "pdfanchor-1234567890ab";
    globalEventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.CREATE, {
      anchor: { uuid: id, name: "A", page_at: 2, position: 30 }, // UI 可传 0~100 百分比
      pdf_uuid: "doc-001"
    }, { actorId: "Jest" });
    const lastListA = observedLists[observedLists.length - 1] || [];
    expect(lastListA.some(x => x?.uuid === id && x.name === "A")).toBe(true);

    // B) UPDATE
    globalEventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.UPDATE, {
      anchorId: id, update: { name: "A1", position: 40, page_at: 3 }
    });
    expect(observedUpdated.some(u => u.anchorId === id && u.page_at === 3 && u.position === 40)).toBe(true);

    // C) 快捷创建（无负载）→ 由特性生成 uuid 并回放 CREATE(__fromFeature)
    globalEventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.CREATE, {}); // 采样当前位置
    expect(observedCreateRelay.some(d => d.__fromFeature === true && d.anchor && /^pdfanchor-[a-f0-9]{12}$/i.test(d.anchor.uuid))).toBe(true);

    // D) DELETE
    globalEventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DELETE, { anchorId: id });
    const lastListD = observedLists[observedLists.length - 1] || [];
    expect(lastListD.some(x => x?.uuid === id)).toBe(false);

    offList?.(); offUpd?.(); offRelay?.();
  });
});
