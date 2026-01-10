/* @jest-environment jsdom */
jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  setModuleLogLevel: jest.fn(),
  LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" },
}));
/**
 * 目标（TDD）：首次从 PDF 导入场景，不应在拿到后端最终列表之前渲染大纲；
 * 渲染后，大纲节点导航应通过统一导航服务生效。
 */

import { EventBus } from "../../../../common/event/event-bus.js";
import { ScopedEventBus } from "../../../../common/event/scoped-event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../../common/event/event-constants.js";
import FeatureOutline from "../index.js";
import { setCurrentPDFDocument, clearCurrentPDFDocument } from "../../../pdf/current-document-registry.js";
import { installWsInboundBridge, resetWsInboundBridgeContractForTests } from "./ws-inbound-bridge.testkit.js";

function createContainer(stubs = {}) {
  const store = new Map(Object.entries(stubs));
  return {
    get: (k) => store.get(k),
    resolve: (k) => store.get(k),
    register: (k, v) => store.set(k, v),
    registerGlobal: (k, v) => store.set(k, v),
    getWSClient: () => (store.get("wsClient")),
  };
}

describe("Outline 首次导入：不提前渲染，最终渲染后可导航", () => {
  let eventBus;
  let scoped;
  let container;
  let feature;
  let wsClient;
  let navigationService;

  beforeEach(async () => {
    resetWsInboundBridgeContractForTests();
    eventBus = new EventBus({ moduleName: "App", enableValidation: true, logger: console });
    scoped = new ScopedEventBus(eventBus, "pdf-viewer");
    // 设置 URL，提供 pdf-id（真实场景为 12hex）
    try { window.history.pushState({}, "", "http://localhost/pdf-viewer/?pdf-id=abc123def456"); } catch {}
    // 模拟 WS 客户端（仅用于被 Feature 读取，不校验 request 次数）
    wsClient = { request: jest.fn().mockResolvedValue({ ok: true }) };
    navigationService = { navigateTo: jest.fn().mockResolvedValue({ success: true, actualPage: 1, actualPosition: 10 }) };
    container = createContainer({ wsClient, navigationService });

    // 设置“空原生大纲”的 PDF 文档，避免导入阶段解析 dest 的复杂性
    setCurrentPDFDocument({ getOutline: async () => [] });

    feature = new FeatureOutline();
    await feature.install({ logger: console, globalEventBus: eventBus, scopedEventBus: scoped, container });
    installWsInboundBridge({ eventBus, wsClient, logger: console, pdfIdProvider: () => "abc123def456" });
  });

  afterEach(() => {
    try { feature?.uninstall?.(); } catch {}
    clearCurrentPDFDocument();
  });

  async function waitUntil(predicate, { ticks = 50 } = {}) {
    for (let i = 0; i < ticks; i++) {
      if (predicate()) { return; }
      // 等待一个 macrotask，确保异步链路（await/then）推进
      await new Promise(r => setTimeout(r, 0));
    }
    throw new Error("waitUntil timeout");
  }

  test("【不提前渲染】先收到 null → 不应发 OUTLINE.LOAD.SUCCESS；最终列表到达后再渲染一次", async () => {
    let successCount = 0;
    let lastPayload = null;
    scoped.onGlobal(PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS, (data) => { successCount += 1; lastPayload = data; });

    // 启动首次加载流程
    eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, { filename: "doc.pdf" }, { actorId: "test" });

    // 等待初始化流程完成“订阅回执 + 发送首个 OUTLINE_LIST 请求”
    await waitUntil(() => wsClient.request.mock.calls.some(c => c?.[0] === WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST));

    // 1) 后端返回 null（数据库中无记录）
    eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      data: { outline_items: null }
    }, { actorId: "test" });

    // 等待微任务队列
    await Promise.resolve();
    // 不应提前渲染
    expect(successCount).toBe(0);

    // 等待“二次 OUTLINE_LIST 请求”发出后再回传最终列表，避免竞态导致回执被 init 监听错过
    await waitUntil(() => wsClient.request.mock.calls.filter(c => c?.[0] === WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST).length >= 2);

    // 2) 最终列表返回（含后端分配的 outline_id）→ 此时应渲染一次
    const finalItems = [
      { id: "outlineItem-ABCD1234", name: "章节一", pageAt: 1, position: 10, children: [] }
    ];
    eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      data: { outline_items: finalItems }
    }, { actorId: "test" });

    // 等待异步处理完成（消息→替换→刷新→事件发射）
    await waitUntil(() => successCount === 1);
    expect(successCount).toBe(1);
    expect(lastPayload).not.toBeNull();
    expect(Array.isArray(lastPayload.outlineItems)).toBe(true);
    expect(lastPayload.outlineItems[0].id).toBe("outlineItem-ABCD1234");
  });

  test("【可导航】最终渲染后，点击（导航请求）应通过统一导航服务", async () => {
    // 启动 + null 回执
    eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, { filename: "doc.pdf" }, { actorId: "test" });
    eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      data: { outline_items: null }
    }, { actorId: "test" });
    await Promise.resolve();

    // 最终列表回执（带 pageAt）
    const finalItems = [
      { id: "outlineItem-ABCD5678", name: "章节二", pageAt: 3, position: 25, children: [] }
    ];
    eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      data: { outline_items: finalItems }
    }, { actorId: "test" });
    await Promise.resolve();

    // 发出导航请求（模拟点击）
    scoped.emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.REQUESTED, {
      pageAt: finalItems[0].pageAt,
      position: finalItems[0].position,
    }, { actorId: "test" });
    await Promise.resolve();

    expect(navigationService.navigateTo).toHaveBeenCalledWith({ pageAt: 3, position: 25 });
  });

  test("【可编辑】最终渲染后，编辑请求应发送 OUTLINE_UPDATE（使用后端真实 outline_id）", async () => {
    // 启动 + null 回执
    scoped.emitGlobal(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, { filename: "doc.pdf" }, { actorId: "test" });
    scoped.emitGlobal(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      data: { outline_items: null }
    }, { actorId: "test" });
    await Promise.resolve();

    const finalItems = [{ id: "outlineItem-UPD00001", name: "章", pageAt: 2, position: 10, children: [] }];
    scoped.emitGlobal(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      data: { outline_items: finalItems }
    }, { actorId: "test" });
    await new Promise(r => setTimeout(r, 0));

    wsClient.request.mockClear();
    scoped.emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.UPDATE.REQUESTED, {
      outlineItemId: "outlineItem-UPD00001",
      update: { name: "改名", page_at: 9, position: 33 }
    }, { actorId: "test" });
    await new Promise(r => setTimeout(r, 0));
    await Promise.resolve();

    expect(wsClient.request).toHaveBeenCalledWith(
      WEBSOCKET_MESSAGE_TYPES.OUTLINE_UPDATE,
      expect.objectContaining({ outline_id: "outlineItem-UPD00001", update: { name: "改名", page_at: 9, position: 33 } }),
      expect.any(Object)
    );
  });

  test("【可删除】最终渲染后，删除请求应发送 OUTLINE_DELETE（使用后端真实 outline_id）", async () => {
    // 启动 + null 回执
    scoped.emitGlobal(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, { filename: "doc.pdf" }, { actorId: "test" });
    scoped.emitGlobal(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      data: { outline_items: null }
    }, { actorId: "test" });
    await Promise.resolve();

    const finalItems = [{ id: "outlineItem-DEL00002", name: "章", pageAt: 5, position: 50, children: [] }];
    scoped.emitGlobal(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      data: { outline_items: finalItems }
    }, { actorId: "test" });
    await new Promise(r => setTimeout(r, 0));

    wsClient.request.mockClear();
    scoped.emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.DELETE.REQUESTED, {
      outlineItemId: "outlineItem-DEL00002",
      cascade: true
    }, { actorId: "test" });
    await new Promise(r => setTimeout(r, 0));
    await Promise.resolve();

    expect(wsClient.request).toHaveBeenCalledWith(
      WEBSOCKET_MESSAGE_TYPES.OUTLINE_DELETE,
      expect.objectContaining({ outline_id: "outlineItem-DEL00002", cascade: true }),
      expect.any(Object)
    );
  });
});
