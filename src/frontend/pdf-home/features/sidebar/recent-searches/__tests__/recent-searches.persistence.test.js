import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventBus } from '../../../../../common/event/event-bus.js';
import { ScopedEventBus } from '../../../../../common/event/scoped-event-bus.js';
import { RecentSearchesFeature } from '../index.js';
import { WEBSOCKET_MESSAGE_TYPES } from '../../../../../common/event/event-constants.js';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  event: jest.fn()
});

describe('RecentSearchesFeature 持久化到后端', () => {
  let feature;
  let context;
  let globalEventBus;
  let scopedEventBus;
  let sentMessages;

  beforeEach(async () => {
    jest.useFakeTimers();
    window.localStorage.clear();
    document.body.innerHTML = `
      <div id="sidebar">
        <div class="sidebar-panel">
          <div class="sidebar-section" id="recent-searches-section">
            <h3 class="sidebar-section-title">
              <span>🔍 最近搜索</span>
            </h3>
            <ul class="sidebar-list" id="recent-searches-list">
              <li class="sidebar-empty">暂无搜索记录</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    globalEventBus = new EventBus({ moduleName: 'recent-searches-test', enableValidation: false });
    scopedEventBus = new ScopedEventBus(globalEventBus, 'recent-searches-test');

    sentMessages = [];
    globalEventBus.on('websocket:message:send', (msg) => {
      sentMessages.push(msg);
    }, { subscriberId: 'capture-ws-send' });

    context = {
      logger: createLogger(),
      scopedEventBus,
      globalEventBus,
      container: { register: jest.fn(), get: jest.fn() }
    };

    feature = new RecentSearchesFeature();
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

  it('安装后会请求后端配置（pdf-home:get:config）', () => {
    const hasGet = sentMessages.some(m => m && m.type === WEBSOCKET_MESSAGE_TYPES.GET_CONFIG);
    expect(hasGet).toBe(true);
  });

  it('搜索后会通过 WebSocket 推送配置更新（pdf-home:update:config）', () => {
    globalEventBus.emit('search:query:requested', { searchText: 'abc' });

    // 推进防抖定时器
    jest.advanceTimersByTime(400);

    const hasUpdate = sentMessages.some(m => m && m.type === WEBSOCKET_MESSAGE_TYPES.UPDATE_CONFIG);
    expect(hasUpdate).toBe(true);
    const last = sentMessages.filter(m => m.type === WEBSOCKET_MESSAGE_TYPES.UPDATE_CONFIG).pop();
    expect(Array.isArray(last?.data?.recent_search)).toBe(true);
    expect(last.data.recent_search.length).toBeGreaterThan(0);
  });

  it('收到后端 get:config 回执后会覆盖本地数据并渲染', () => {
    // 模拟后端回执
    const reqMsg = sentMessages.find(m => m && m.type === WEBSOCKET_MESSAGE_TYPES.GET_CONFIG);
    expect(reqMsg).toBeTruthy();
    const fakeResponse = {
      type: 'response',
      status: 'success',
      request_id: reqMsg.request_id,
      data: {
        config: { recent_search: [{ text: 'from-backend', ts: Date.now() }] }
      }
    };
    globalEventBus.emit('websocket:message:response', fakeResponse);

    const items = document.querySelectorAll('#recent-searches-list .sidebar-item-text');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toBe('from-backend');
  });
});

