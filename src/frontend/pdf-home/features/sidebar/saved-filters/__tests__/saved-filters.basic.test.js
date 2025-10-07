import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventBus } from '../../../../../common/event/event-bus.js';
import { ScopedEventBus } from '../../../../../common/event/scoped-event-bus.js';
import { WEBSOCKET_MESSAGE_TYPES } from '../../../../../common/event/event-constants.js';
import { SavedFiltersFeature } from '../index.js';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  event: jest.fn(),
});

describe('SavedFiltersFeature 基本行为', () => {
  let feature;
  let context;
  let globalEventBus;
  let scopedEventBus;
  let sentMessages;
  let emittedSearch;

  beforeEach(async () => {
    jest.useFakeTimers();
    window.localStorage.clear();
    document.body.innerHTML = `
      <div class="sidebar">
        <div class="sidebar-panel"></div>
      </div>
      <div class="search-panel">
        <div class="search-panel-content"></div>
      </div>
      <input class="search-input" value="hello" />
      <button class="clear-search-btn" style="display:none"></button>
    `;

    globalEventBus = new EventBus({ moduleName: 'saved-filters-test', enableValidation: false });
    scopedEventBus = new ScopedEventBus(globalEventBus, 'saved-filters-test');

    sentMessages = [];
    emittedSearch = [];
    globalEventBus.on('websocket:message:send', (msg) => sentMessages.push(msg), { subscriberId: 'capture-ws-send' });
    globalEventBus.on('search:query:requested', (data) => emittedSearch.push(data), { subscriberId: 'capture-search' });

    const container = {
      get: jest.fn((key) => {
        if (key === 'searchManager') {
          return { getCurrentSearchText: () => 'hello' };
        }
        return null;
      }),
      register: jest.fn(),
    };

    context = {
      logger: createLogger(),
      scopedEventBus,
      globalEventBus,
      container,
    };

    feature = new SavedFiltersFeature();
    await feature.install(context);
  });

  afterEach(async () => {
    jest.useRealTimers();
    if (feature) {
      await feature.uninstall();
      feature = null;
    }
    document.body.innerHTML = '';
  });

  it('安装后会请求后端配置（pdf-library:config-read:requested）', () => {
    const hasGet = sentMessages.some(m => m && m.type === WEBSOCKET_MESSAGE_TYPES.GET_CONFIG);
    expect(hasGet).toBe(true);
  });

  it('点击加号会保存当前条件并通过 pdf-library:config-write:requested 持久化', () => {
    // 先模拟有筛选条件
    globalEventBus.emit('filter:state:updated', { filters: { type: 'fuzzy', field: 'filename', op: 'contains', value: 'abc' } });
    // 模拟有排序
    scopedEventBus.emitGlobal('@pdf-list/sort:change:completed', { column: 'updated_at', direction: 'desc' });

    const btn = document.querySelector('.saved-filters-add-btn');
    expect(btn).toBeTruthy();
    btn.click();

    jest.advanceTimersByTime(400);
    const lastUpdate = sentMessages.filter(m => m.type === WEBSOCKET_MESSAGE_TYPES.UPDATE_CONFIG).pop();
    expect(lastUpdate).toBeTruthy();
    expect(Array.isArray(lastUpdate.data.saved_filters)).toBe(true);
    expect(lastUpdate.data.saved_filters.length).toBeGreaterThan(0);
  });

  it('点击保存的项会触发一次搜索（包含filters与sort）', () => {
    // 找到请求ID并模拟返回包含 saved_filters
    const getMsg = sentMessages.find(m => m.type === WEBSOCKET_MESSAGE_TYPES.GET_CONFIG);
    const fakeItem = {
      id: 'sf_test',
      name: '关键词: world',
      searchText: 'world',
      filters: { type: 'fuzzy', field: 'filename', op: 'contains', value: 'z' },
      sort: [{ field: 'updated_at', direction: 'desc' }],
      ts: Date.now(),
    };
    const resp = {
      type: 'response',
      status: 'success',
      request_id: getMsg.request_id,
      data: { config: { saved_filters: [fakeItem] } },
    };
    globalEventBus.emit('websocket:message:response', resp);

    const row = document.querySelector('.saved-filter-item');
    expect(row).toBeTruthy();
    row.click();

    expect(emittedSearch.length).toBeGreaterThan(0);
    const last = emittedSearch.pop();
    expect(last.searchText).toBe('world');
    expect(last.filters).toBeTruthy();
    expect(Array.isArray(last.sort)).toBe(true);
  });
});

