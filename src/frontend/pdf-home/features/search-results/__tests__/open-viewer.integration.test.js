import { SearchResultsFeature } from "../index.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../../common/event/event-constants.js";
import { RESULTS_EVENTS } from "../events.js";

// 简易事件总线（仅用于本测试）
class MiniBus {
  constructor() { this._map = new Map(); }
  on(event, cb) {
    const arr = this._map.get(event) || [];
    arr.push(cb);
    this._map.set(event, arr);
    return () => {
      const list = this._map.get(event) || [];
      this._map.set(event, list.filter(fn => fn !== cb));
    };
  }
  emit(event, data) {
    const arr = this._map.get(event) || [];
    arr.forEach(fn => fn(data));
  }
}

class ScopedBus extends MiniBus {
  constructor(globalBus) {
    super();
    this._global = globalBus;
  }
  emitGlobal(event, data) {
    this._global.emit(event, data);
  }
}

describe("SearchResultsFeature - open viewer by item event", () => {
  beforeEach(() => {
    // 基础 DOM：容器 + header
    document.body.innerHTML = `
      <div class="main-content">
        <div class="search-results-header"></div>
      </div>
    `;
  });

  test("emitting results:item:open sends OPEN_PDF via WebSocket with single id", async () => {
    const sent = [];

    const mockBridge = {
      initialize: jest.fn(async () => {}),
      isReady: jest.fn(() => true),
      openPdfViewers: jest.fn(async () => true) // 现实现走 WS，为兼容旧桥接保留但不做断言
    };

    // 可选 Bridge（不强依赖）
    SearchResultsFeature.setBridgeFactory(() => mockBridge);

    const globalBus = new MiniBus();
    const scopedBus = new ScopedBus(globalBus);

    const ctx = {
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
      scopedEventBus: scopedBus,
      globalEventBus: globalBus
    };

    // 捕获 WS 发送事件
    ctx.globalEventBus.on(WEBSOCKET_EVENTS.MESSAGE.SEND, (msg) => sent.push(msg));

    const feature = new SearchResultsFeature();
    await feature.install(ctx);

    // 触发“条目打开”事件
    ctx.scopedEventBus.emit(RESULTS_EVENTS.ITEM.OPEN, { result: { id: "abc123" } });

    // 等待微任务，以处理 async 调用
    await new Promise(r => setTimeout(r, 0));

    expect(sent.length).toBeGreaterThan(0);
    const last = sent.pop();
    expect(last.type).toBe(WEBSOCKET_MESSAGE_TYPES.OPEN_PDF);
    expect(last.data && last.data.pdf_id).toBe("abc123");
  });
});

