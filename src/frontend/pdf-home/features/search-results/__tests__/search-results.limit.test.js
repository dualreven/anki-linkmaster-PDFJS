/**
 * @jest-environment jsdom
 */

import { SearchResultsFeature } from '../index.js';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

class MockBus {
  constructor() { this._handlers = new Map(); }
  on(event, handler) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(handler);
    return () => { this._handlers.get(event)?.delete(handler); };
  }
  emit(event, payload) {
    const set = this._handlers.get(event);
    if (!set) return;
    for (const h of Array.from(set)) { try { h(payload); } catch {} }
  }
}

describe('SearchResults 前端截断渲染（page.limit）', () => {
  let feature;
  let globalEventBus;
  let scopedEventBus;
  let context;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div class="main-content"></div>
    `;

    globalEventBus = new MockBus();
    scopedEventBus = globalEventBus;

    context = {
      logger: createLogger(),
      scopedEventBus,
      globalEventBus,
      container: { register: jest.fn(), get: jest.fn() },
    };

    feature = new SearchResultsFeature();
    await feature.install(context);
  });

  afterEach(async () => {
    try { await feature.uninstall(); } catch {}
    document.body.innerHTML = '';
  });

  it('当搜索结果包含18条且page.limit=5时，仅渲染5条', () => {
    const records = Array.from({ length: 18 }, (_, i) => ({ id: `id-${i}`, title: `书籍${i}` }));
    globalEventBus.emit('search:results:updated', {
      records,
      count: records.length,
      searchText: '',
      page: { limit: 5, offset: 0 }
    });

    const container = document.querySelector('.search-results');
    const items = container ? container.querySelectorAll('.search-result-item') : [];
    expect(items.length).toBe(5);
  });
});

