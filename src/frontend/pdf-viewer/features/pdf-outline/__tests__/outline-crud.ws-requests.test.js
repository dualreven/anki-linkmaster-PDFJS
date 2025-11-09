/**
 * 目的：验证 Outline CRUD 与拖拽排序事件能发出正确的 WS 请求，并进行列表二次拉取
 * 仅编写测试，不修改源码
 */
import { EventBus } from "../../../../common/event/event-bus.js";
import { getLogger } from "../../../../common/utils/logger.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../../common/event/event-constants.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import FeatureOutline from "../../pdf-outline/index.js";
import { OutlineDialog } from "../../../outline/components/outline-dialog.js";

class StubContainer {
  constructor(wsClient) { this._store = new Map([["wsClient", wsClient]]); }
  register(k, v) { this._store.set(k, v); }
  registerGlobal(k, v) { this._store.set(k, v); }
  get(name) { return this._store.get(name); }
  resolve(name) { return this._store.get(name); }
  getWSClient() { return this._store.get("wsClient"); }
}

describe("Outline CRUD 与排序 → WS 请求", () => {
  let eventBus;
  let scoped;
  let container;
  let wsCalls;

  beforeEach(async () => {
    wsCalls = [];
    const wsClient = { request: jest.fn(async (type, data) => { wsCalls.push({ type, data }); return { ok: true }; }) };
    eventBus = new EventBus({ moduleName: "TestBus", enableValidation: true, logger: getLogger("test") });
    const mod = await import("../../../../common/event/scoped-event-bus.js");
    scoped = new mod.ScopedEventBus(eventBus, "pdf-viewer");
    container = new StubContainer(wsClient);
    // 提供 currentPageNumber
    container.register("pdfViewerManager", { currentPageNumber: 7 });
    // 关闭 UI（避免 jstree/DOM 依赖）
    global.window.__DISABLE_OUTLINE_UI = true;
    // 注入 pdf-id
    try { window.history.pushState({}, "", "?pdf-id=jest-pdf"); } catch {}
  });

  test("CREATE：对话框确认后 → OUTLINE_CREATE + OUTLINE_LIST", async () => {
    const feature = new FeatureOutline();
    await feature.install({ logger: getLogger("feature"), globalEventBus: eventBus, scopedEventBus: scoped, container });

    // mock 对话框：立即调用 onConfirm
    const spy = jest.spyOn(OutlineDialog.prototype, "showAdd").mockImplementation(({ onConfirm }) => {
      onConfirm({ name: " 新章 标题 ", pageAt: 5, position: 149.7 });
    });

    eventBus.emit(PDF_VIEWER_EVENTS.OUTLINE.CREATE.REQUESTED, {}, { actorId: "test" });
    await new Promise(r => setTimeout(r, 0));
    spy.mockRestore();

    const types = wsCalls.map(c => c.type);
    expect(types).toContain(WEBSOCKET_MESSAGE_TYPES.OUTLINE_CREATE);
    expect(types).toContain(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST);
    // 载荷归一化：name 去空白；position 限制 0~100 且取整
    const create = wsCalls.find(c => c.type === WEBSOCKET_MESSAGE_TYPES.OUTLINE_CREATE);
    expect(create.data).toEqual(expect.objectContaining({ pdf_uuid: "jest-pdf", name: "新章 标题", page_at: 5, position: 100 }));
  });

  test("UPDATE：编辑确认 → OUTLINE_UPDATE + OUTLINE_LIST", async () => {
    const feature = new FeatureOutline();
    await feature.install({ logger: getLogger("feature"), globalEventBus: eventBus, scopedEventBus: scoped, container });

    // 先同步一棵列表（含目标项）
    eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      data: { outline_items: [{ id: "outlineItem-AAA11111", name: "A", pageAt: 3, position: 10, children: [] }] }
    }, { actorId: "test" });
    await new Promise(r => setTimeout(r, 0));

    const spy = jest.spyOn(OutlineDialog.prototype, "showEdit").mockImplementation(({ onConfirm }) => {
      onConfirm({ name: " 改名 ", pageAt: 9, position: 33.2 });
    });

    eventBus.emit(PDF_VIEWER_EVENTS.OUTLINE.UPDATE.REQUESTED, { outlineItemId: "outlineItem-AAA11111" }, { actorId: "test" });
    await new Promise(r => setTimeout(r, 0));
    spy.mockRestore();

    const types = wsCalls.map(c => c.type);
    expect(types).toContain(WEBSOCKET_MESSAGE_TYPES.OUTLINE_UPDATE);
    expect(types).toContain(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST);
    const upd = wsCalls.find(c => c.type === WEBSOCKET_MESSAGE_TYPES.OUTLINE_UPDATE);
    expect(upd.data).toEqual(expect.objectContaining({ outline_id: "outlineItem-AAA11111", update: { name: "改名", page_at: 9, position: 33 } }));
  });

  test("DELETE：确认删除 → OUTLINE_DELETE + OUTLINE_LIST", async () => {
    const feature = new FeatureOutline();
    await feature.install({ logger: getLogger("feature"), globalEventBus: eventBus, scopedEventBus: scoped, container });

    eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      data: { outline_items: [{ id: "outlineItem-DEL00001", name: "ToDel", pageAt: 2, position: null, children: [{ id: "c1", name: "c", pageAt: 3, position: null, children: [] }] }] }
    }, { actorId: "test" });
    await new Promise(r => setTimeout(r, 0));

    const spy = jest.spyOn(OutlineDialog.prototype, "showDelete").mockImplementation(({ onConfirm }) => {
      onConfirm(true);
    });

    eventBus.emit(PDF_VIEWER_EVENTS.OUTLINE.DELETE.REQUESTED, { outlineItemId: "outlineItem-DEL00001" }, { actorId: "test" });
    await new Promise(r => setTimeout(r, 0));
    spy.mockRestore();

    const types = wsCalls.map(c => c.type);
    expect(types).toContain(WEBSOCKET_MESSAGE_TYPES.OUTLINE_DELETE);
    expect(types).toContain(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST);
    const del = wsCalls.find(c => c.type === WEBSOCKET_MESSAGE_TYPES.OUTLINE_DELETE);
    expect(del.data).toEqual(expect.objectContaining({ outline_id: "outlineItem-DEL00001", cascade: true }));
  });

  test("REORDER：拖拽排序 → OUTLINE_REORDER + OUTLINE_LIST", async () => {
    const feature = new FeatureOutline();
    await feature.install({ logger: getLogger("feature"), globalEventBus: eventBus, scopedEventBus: scoped, container });
    eventBus.emit(PDF_VIEWER_EVENTS.OUTLINE.REORDER.REQUESTED, { outlineItemId: "outlineItem-A", newParentId: null, newIndex: 2 }, { actorId: "test" });
    await new Promise(r => setTimeout(r, 0));

    const types = wsCalls.map(c => c.type);
    expect(types).toContain(WEBSOCKET_MESSAGE_TYPES.OUTLINE_REORDER);
    expect(types).toContain(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST);
    const reo = wsCalls.find(c => c.type === WEBSOCKET_MESSAGE_TYPES.OUTLINE_REORDER);
    expect(reo.data).toEqual(expect.objectContaining({ outline_id: "outlineItem-A", new_parent_id: null, new_index: 2 }));
  });
});

