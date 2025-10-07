import { SearchResultsFeature } from '../index.js';

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

describe('SearchResultsFeature - reopen after viewer closed (behavioral smoke)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="main-content">
        <div class="search-results-header"></div>
      </div>
    `;
  });

  test('double "open" events should trigger exactly two bridge calls (no extra)', async () => {
    const calls = [];
    const mockBridge = {
      initialize: jest.fn(async () => {}),
      isReady: jest.fn(() => true),
      openPdfViewersWithMeta: jest.fn(async (payload) => { calls.push(payload); return true; })
    };

    SearchResultsFeature.setBridgeFactory(() => mockBridge);

    const ctx = {
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
      scopedEventBus: new MiniBus(),
      globalEventBus: new MiniBus()
    };

    const feature = new SearchResultsFeature();
    await feature.install(ctx);

    // 第一次打开
    ctx.scopedEventBus.emit('results:item:open', { result: { id: 'abc123', filename: 'a.pdf' } });
    await new Promise(r => setTimeout(r, 0));

    // 模拟用户关闭（在本测试中仅作为语义步骤，不需要真实关闭窗口）

    // 第二次打开（应再次产生一次调用）
    ctx.scopedEventBus.emit('results:item:open', { result: { id: 'abc123', filename: 'a.pdf' } });
    await new Promise(r => setTimeout(r, 0));

    expect(mockBridge.openPdfViewersWithMeta).toHaveBeenCalledTimes(2);
    expect(calls[0]?.pdfIds).toEqual(['abc123']);
    expect(calls[1]?.pdfIds).toEqual(['abc123']);
  });
});

