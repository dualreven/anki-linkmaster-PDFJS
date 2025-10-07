import { SearchResultsFeature } from '../index.js';

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

describe('SearchResultsFeature - open viewer by item event', () => {
  beforeEach(() => {
    // 基础 DOM：容器 + header
    document.body.innerHTML = `
      <div class="main-content">
        <div class="search-results-header"></div>
      </div>
    `;
  });

  test('emitting results:item:open calls QWebChannelBridge.openPdfViewers with single id', async () => {
    const calls = [];

    const mockBridge = {
      initialize: jest.fn(async () => {}),
      isReady: jest.fn(() => true),
      openPdfViewers: jest.fn(async ({ pdfIds }) => { calls.push(pdfIds); return true; })
    };

    // 注入自定义 Bridge 工厂，避免直接依赖真实 QWebChannel
    SearchResultsFeature.setBridgeFactory(() => mockBridge);

    const ctx = {
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
      scopedEventBus: new MiniBus(),
      globalEventBus: new MiniBus()
    };

    const feature = new SearchResultsFeature();
    await feature.install(ctx);

    // 触发“条目打开”事件
    ctx.scopedEventBus.emit('results:item:open', { result: { id: 'abc123' } });

    // 等待微任务，以处理 async 调用
    await new Promise(r => setTimeout(r, 0));

    expect(mockBridge.openPdfViewers).toHaveBeenCalledTimes(1);
    expect(calls[0]).toEqual(['abc123']);
  });
});

