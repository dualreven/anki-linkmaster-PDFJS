/**
 * @jest-environment jsdom
 */

import eventBus from '../../../../common/event/event-bus.js';
import { SearchManager } from '../../search/services/search-manager.js';
import { WEBSOCKET_EVENTS } from '../../../../common/event/event-constants.js';

describe('SearchManager request payload', () => {
  beforeEach(() => {
    // 清理事件监听（注意：默认导出的 eventBus 是单例，这里重置订阅者）
    try { eventBus.destroy(); } catch {}
  });

  test('构造标准请求：data.query + data.tokens（按空格分词）', () => {
    const mgr = new SearchManager(eventBus);

    const sent = [];
    eventBus.on(
      WEBSOCKET_EVENTS.MESSAGE.SEND,
      (message) => {
        sent.push(message);
      },
      { subscriberId: 'jest-search' }
    );

    // 触发搜索请求
    eventBus.emit('search:query:requested', { searchText: 'deep learn  RL ' });

    // 检查发送的请求
    expect(sent.length).toBe(1);
    const msg = sent[0];
    expect(msg).toHaveProperty('type', 'pdf-library:search:requested');
    expect(msg).toHaveProperty('request_id');
    expect(typeof msg.request_id).toBe('string');
    expect(msg).toHaveProperty('data');
    expect(msg.data).toHaveProperty('query', 'deep learn  RL ');
    expect(Array.isArray(msg.data.tokens)).toBe(true);
    expect(msg.data.tokens).toEqual(['deep', 'learn', 'RL']);
  });
});

