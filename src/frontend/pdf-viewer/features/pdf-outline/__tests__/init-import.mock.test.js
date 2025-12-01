// UTF-8, \n
/**
 * 前端集成（纯 Mock）：pdf-viewer 大纲初始化导入
 * 目标：严格验证“首帧 list=null → bulk-save(items>0) → 二次 list 非空数组”
 * 不使用 Playwright / 不跨后端；仅以 JS 层的 Feature + WSClient Test Double + 事件总线完成。
 */
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { OutlineManager as FeatureOutline } from "../index.js";

function createEventBus() {
  const handlers = new Map();
  const globals = new Map();
  return {
    on(event, fn) { const a = handlers.get(event) || []; a.push(fn); handlers.set(event, a); return () => { const b = handlers.get(event)||[]; const i=b.indexOf(fn); if(i>=0){b.splice(i,1);} handlers.set(event,b); }; },
    onGlobal(event, fn) { const a = globals.get(event) || []; a.push(fn); globals.set(event, a); return () => { const b = globals.get(event)||[]; const i=b.indexOf(fn); if(i>=0){b.splice(i,1);} globals.set(event,b); }; },
    emit(event, data) { (handlers.get(event)||[]).forEach(fn=>{ try{ fn(data);}catch{} }); (globals.get(event)||[]).forEach(fn=>{ try{ fn(data);}catch{} }); }
  };
}

function createWSClientDouble() {
  const pending = new Map();
  const sent = [];
  let seq = 0;
  const request = (type, data, opts) => {
    const request_id = "req_" + (++seq);
    sent.push({ type, data, opts, request_id });
    return new Promise(resolve => pending.set(request_id, { type, resolve }));
  };
  const mockInbound = (msg) => {
    const rid = msg?.request_id;
    if (rid && pending.has(rid)) { const p = pending.get(rid); pending.delete(rid); p.resolve(msg); }
  };
  return { request, mockInbound, getSent: () => sent.slice() };
}

function createContainer(wsClient) {
  const m = new Map();
  return {
    register(n, v){ m.set(n,v); },
    registerGlobal(n, v){ m.set(n,v); },
    resolve(n){ return m.get(n); },
    get(n){ return m.get(n); },
    getWSClient(){ return wsClient; }
  };
}

function createOutlineDataProviderMock() {
  return {
    async getOutline() {
      return [
        { title: "一、绪论", items: [{ title: "背景", items: [] }] },
        { title: "二、方法", items: [] }
      ];
    }
  };
}

async function waitForSent(ws, type, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const s = ws.getSent().find(m => m.type === type);
    if (s) {return s;}
    await new Promise(r => setTimeout(r, 10));
  }
  return null;
}

describe("integ:frontend:pdf-viewer:outline:init-import (pure-mock)", () => {
  test("首帧 null → bulk-save(items>0) → 二次 list 非空数组", async () => {
    const eventBus = createEventBus();
    const ws = createWSClientDouble();
    const container = createContainer(ws);
    container.register("OutlineDataProvider", createOutlineDataProviderMock());

    const ctx = { logger: console, container, globalEventBus: eventBus, scopedEventBus: eventBus };
    const feature = new FeatureOutline();
    await feature.install(ctx);

    // 配置 URL 参数，提供 pdf-id 与 file，满足 OutlineFeature.#getPdfId() 取值
    try {
      window.history.pushState({}, "", "http://localhost:3000/pdf-viewer/index.html?pdf-id=test-with-outline&file=/test-with-outline.pdf");
    } catch {}

    // 触发初始导入流程（等价于文件加载成功）
    eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, { pdfDocument: {}, filename: "test-with-outline.pdf" });

    // 首次 list → null
    const r1 = await waitForSent(ws, "pdf-viewer:outline-list:request", 2000);
    expect(r1).toBeTruthy();
    ws.mockInbound({ type: "pdf-viewer:outline-list:complete", request_id: r1.request_id, data: { outline_items: null } });

    // bulk-save(items>0)
    const r2 = await waitForSent(ws, "pdf-viewer:outline-bulk-save:request", 2000);
    expect(Array.isArray(r2?.data?.items) && r2.data.items.length > 0).toBeTruthy();
    ws.mockInbound({ type: "pdf-viewer:outline-bulk-save:complete", request_id: r2.request_id, data: { count: r2.data.items.length } });

    // 二次 list → 非空数组
    const r3 = await waitForSent(ws, "pdf-viewer:outline-list:request", 2000);
    expect(r3).toBeTruthy();
    ws.mockInbound({
      type: "pdf-viewer:outline-list:complete",
      request_id: r3.request_id,
      data: { outline_items: [{ id: "outlineItem-ABCD1234", name: "样例", pageAt: 1, position: 10, children: [] }] }
    });
  });
});
