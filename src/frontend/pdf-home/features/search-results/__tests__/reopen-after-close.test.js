import { SearchResultsFeature } from "../index.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../../common/event/event-constants.js";
import { RESULTS_EVENTS } from "../events.js";

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
  emitGlobal(event, data) {
    // 测试环境中将 emitGlobal 等同于 emit
    this.emit(event, data);
  }
}

describe("SearchResultsFeature - reopen after viewer closed (behavioral smoke)", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="main-content">
        <div class="search-results-header"></div>
      </div>
    `;
  });

  test("double \"open\" events should trigger exactly two OPEN_PDF WS messages", async () => {
    const wsSends = [];
    const originalFactory = SearchResultsFeature.bridgeFactory;
    // 关闭桥接强制走 WS 路径
    SearchResultsFeature.setBridgeFactory(null);

    const ctx = {
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
      scopedEventBus: new MiniBus(),
      globalEventBus: new MiniBus()
    };

    const feature = new SearchResultsFeature();
    await feature.install(ctx);

    // 监听 WS 发送
    ctx.scopedEventBus.on(WEBSOCKET_EVENTS.MESSAGE.SEND, (msg) => wsSends.push(msg));

    // 第一次打开
    ctx.scopedEventBus.emit(RESULTS_EVENTS.ITEM.OPEN, { result: { id: "abc123", filename: "a.pdf" } });
    await new Promise(r => setTimeout(r, 0));

    // 模拟用户关闭（在本测试中仅作为语义步骤，不需要真实关闭窗口）

    // 第二次打开（应再次产生一次调用）
    ctx.scopedEventBus.emit(RESULTS_EVENTS.ITEM.OPEN, { result: { id: "abc123", filename: "a.pdf" } });
    await new Promise(r => setTimeout(r, 0));

    const openMsgs = wsSends.filter(m => m && m.type === WEBSOCKET_MESSAGE_TYPES.OPEN_PDF);
    expect(openMsgs.length).toBe(2);
    expect(openMsgs[0]?.data?.pdf_id).toBe("abc123");
    expect(openMsgs[1]?.data?.pdf_id).toBe("abc123");

    // 还原工厂
    SearchResultsFeature.setBridgeFactory(originalFactory);
  });
});

