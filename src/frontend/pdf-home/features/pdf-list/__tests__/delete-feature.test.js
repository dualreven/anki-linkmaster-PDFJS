// 必要的模块模拟，避免 import.meta 与第三方库在 Jest 环境报错
jest.mock('../../../../common/utils/logger.js', () => ({
  getLogger: () => ({ info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() })
}));
jest.mock('../../../../common/utils/thirdparty-toast.js', () => ({
  pending: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn(), dismissById: jest.fn()
}));
jest.mock('tabulator-tables', () => ({}), { virtual: true });

import { PDFListFeature } from '../../pdf-list/index.js';
import { ScopedEventBus } from '../../../../common/event/scoped-event-bus.js';
import { getEventBus } from '../../../../common/event/event-bus.js';
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from '../../../../common/event/event-constants.js';

// 简化的容器实现
class DummyContainer {
  constructor(map = new Map()) { this.map = map; }
  has(key) { return this.map.has(key); }
  get(key) { return this.map.get(key); }
  register(key, value) { this.map.set(key, value); }
}

describe('PDFListFeature - 批量删除选中', () => {
  let feature;
  let fakeState;
  let globalBus;
  let scopedBus;
  let container;

  let sentMessages = [];
  let searchRequests = [];
  let unsubSend;
  let unsubSearch;

  beforeEach(async () => {
    document.body.innerHTML = '';
    // 创建删除按钮与搜索输入
    const btn = document.createElement('button');
    btn.id = 'batch-delete-btn';
    document.body.appendChild(btn);
    const input = document.createElement('input');
    input.className = 'search-input';
    input.value = 'test keywords';
    document.body.appendChild(input);

    // EventBus
    globalBus = getEventBus(`PDFHomeTest_${Math.random()}`, { enableValidation: false });
    scopedBus = new ScopedEventBus(globalBus, 'pdf-list');
    // 监听发出的WS消息
    sentMessages = [];
    unsubSend = globalBus.on(WEBSOCKET_EVENTS.MESSAGE.SEND, (msg) => { sentMessages.push(msg); });
    // 监听搜索刷新
    searchRequests = [];
    unsubSearch = globalBus.on('search:query:requested', (data) => { searchRequests.push(data); });

    // 伪造的状态管理器（返回可用的响应式对象接口）
    fakeState = {
      items: [
        { id: 'id-1', filename: 'a.pdf' },
        { id: 'id-2', filename: 'b.pdf' }
      ],
      selectedIndices: [0, 1],
      isLoading: false,
      subscribe: jest.fn(() => () => {})
    };

    // 容器
    container = new DummyContainer();
    container.register('stateManager', { createState: () => fakeState });

    // Feature
    feature = new PDFListFeature();
    await feature.install({
      container,
      scopedEventBus: scopedBus,
      globalEventBus: globalBus,
      logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
    });

    // 确保初始WS请求不影响断言
    sentMessages = [];

    // 确认对话框默认通过
    global.confirm = jest.fn(() => true);
  });

  afterEach(() => {
    try { unsubSend && unsubSend(); } catch {}
    try { unsubSearch && unsubSearch(); } catch {}
  });

  test('点击删除应发送 remove:requested，包含 file_ids 数组', async () => {
    // 触发点击
    document.getElementById('batch-delete-btn').click();

    expect(sentMessages.length).toBeGreaterThan(0);
    const delMsg = sentMessages.find(m => m && m.type === WEBSOCKET_MESSAGE_TYPES.REMOVE_PDF);
    expect(delMsg).toBeTruthy();
    expect(Array.isArray(delMsg.data?.file_ids)).toBe(true);
    expect(delMsg.data.file_ids).toEqual(['id-1', 'id-2']);
    expect(typeof delMsg.request_id).toBe('string');
  });

  test('删除完成后应刷新搜索结果（触发 search:query:requested）', async () => {
    // 点击并捕获 request_id
    document.getElementById('batch-delete-btn').click();
    const delMsg = sentMessages.find(m => m && m.type === WEBSOCKET_MESSAGE_TYPES.REMOVE_PDF);
    const rid = delMsg.request_id;

    // 模拟后端响应
    globalBus.emit('websocket:message:response', {
      type: WEBSOCKET_MESSAGE_TYPES.REMOVE_PDF_COMPLETED,
      status: 'success',
      request_id: rid,
      data: {
        removed_files: ['id-1', 'id-2'],
        failed_files: {}
      }
    });

    // 断言触发了搜索刷新
    expect(searchRequests.length).toBe(1);
    expect(searchRequests[0]).toEqual({ searchText: 'test keywords' });
  });
});
