import { EventHandler } from "../event-handler.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../event/event-constants.js";

class Bus {
  constructor() { this._map = new Map(); }
  on(name, fn) {
    const set = this._map.get(name) || new Set();
    set.add(fn);
    this._map.set(name, set);
    return () => set.delete(fn);
  }
  emit(name, payload) {
    const set = this._map.get(name);
    if (!set) { return; }
    for (const fn of Array.from(set)) {
      try { fn(payload); } catch {}
    }
  }
}

const createLogger = () => ({ info: () => {}, warn: () => {}, error: () => {}, debug: () => {} });

describe("PDF 删除请求（单个与批量）", () => {
  test("handleBatchRemove(单个) 发送单条 REMOVE_PDF，自动补 .pdf 后缀", () => {
    const bus = new Bus();
    const sent = [];
    bus.on(WEBSOCKET_EVENTS.MESSAGE.SEND, (msg) => sent.push(msg));

    // 伪造最小 manager，仅供 EventHandler 使用
    const mgr = {
      eventBus: bus,
      logger: createLogger(),
      pdfs: [],
      batchTrack: new Map(),
      generateRequestId: () => "rid1",
    };
    const handler = new EventHandler(mgr);

    handler.handleBatchRemove({ files: ["doc"] });

    expect(sent.length).toBe(1);
    const m = sent[0];
    expect(m.type).toBe(WEBSOCKET_MESSAGE_TYPES.REMOVE_PDF);
    expect(m.data.file_id).toBe("doc");
    expect(m.data.filename).toBe("doc.pdf");
  });

  test("EventHandler.handleBatchRemove 将批次拆分为多个 REMOVE_PDF", () => {
    const bus = new Bus();
    const sent = [];
    bus.on(WEBSOCKET_EVENTS.MESSAGE.SEND, (msg) => sent.push(msg));

    const mgr = {
      eventBus: bus,
      logger: createLogger(),
      pdfs: [],
      batchTrack: new Map(),
      generateRequestId: () => "rid-" + Math.random().toString(36).slice(2, 8),
    };
    const handler = new EventHandler(mgr);

    handler.handleBatchRemove({ files: ["a", "b.pdf", "c"] });

    expect(sent.length).toBe(3);
    const types = sent.map(x => x.type);
    expect(types.every(t => t === WEBSOCKET_MESSAGE_TYPES.REMOVE_PDF)).toBe(true);
    // 基本字段校验
    expect(sent[0].data.file_id).toBe("a");
    expect(sent[0].data.filename).toBe("a.pdf");
    expect(sent[1].data.file_id).toBe("b"); // id 去除 .pdf 后缀
    expect(sent[1].data.filename).toBe("b.pdf");
    expect(sent[2].data.file_id).toBe("c");
    expect(sent[2].data.filename).toBe("c.pdf");
  });
});
