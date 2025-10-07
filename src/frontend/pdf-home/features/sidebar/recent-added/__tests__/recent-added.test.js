import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RecentAddedFeature } from '../index.js';
import { WEBSOCKET_MESSAGE_TYPES } from '../../../../../common/event/event-constants.js';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  event: jest.fn()
});

const STORAGE_KEY = 'pdf-home:recent-added';

// 简易事件总线桩，避免引入项目Logger/ImportMeta等在Jest下的问题
class SimpleEventBus {
  constructor() {
    this.handlers = new Map();
  }
  on(name, fn) {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name).add(fn);
    return () => this.handlers.get(name)?.delete(fn);
  }
  emit(name, data) {
    const set = this.handlers.get(name);
    if (set) Array.from(set).forEach(fn => fn(data));
  }
  onGlobal(name, fn, _opts) { return this.on(name, fn); }
  emitGlobal(name, data) { this.emit(name, data); }
}

describe('RecentAddedFeature 最近添加插件', () => {
  let feature;
  let context;
  let globalEventBus;
  let scopedEventBus;
  let sentMessages;

  beforeEach(async () => {
    window.localStorage.clear();
    document.body.innerHTML = `
      <div id="sidebar">
        <div class="sidebar-panel">
          <div class="sidebar-section" id="recent-added-section">
            <h3 class="sidebar-section-title">
              <span>➕ 最近添加</span>
            </h3>
            <ul class="sidebar-list" id="recent-added-list">
              <li class="sidebar-empty">暂无添加记录</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    globalEventBus = new SimpleEventBus();
    scopedEventBus = globalEventBus;

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

    feature = new RecentAddedFeature();
    await feature.install(context);
  });

  afterEach(async () => {
    if (feature) {
      await feature.uninstall();
      feature = null;
    }
    document.body.innerHTML = '';
  });

  it('首次安装时读取空存储并显示占位', () => {
    const list = document.querySelector('#recent-added-list');
    expect(list).not.toBeNull();
    expect(list.querySelector('.sidebar-empty')).not.toBeNull();
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    expect(Array.isArray(stored)).toBe(true);
    expect(stored.length).toBe(0);
  });

  it('启动时会请求DB按创建时间降序加载最近添加，并以书名展示', () => {
    // 捕获最近的 search 请求
    const searchMsg = sentMessages.find(m => m && m.type === WEBSOCKET_MESSAGE_TYPES.SEARCH_PDF);
    expect(searchMsg).toBeTruthy();
    expect(Array.isArray(searchMsg?.data?.sort)).toBe(true);
    expect(searchMsg.data.sort[0]).toEqual({ field: 'created_at', direction: 'desc' });

    // 模拟后端回执（search:completed）
    const resp = {
      type: 'pdf-library:search:completed',
      status: 'success',
      request_id: searchMsg.request_id,
      data: {
        records: [
          { id: 'id1', title: 'T1', filename: 'f1.pdf', created_at: 100 },
          { id: 'id2', title: 'T2', filename: 'f2.pdf', created_at: 200 },
          { id: 'id3', title: 'T3', filename: 'f3.pdf', created_at: 150 }
        ]
      }
    };
    globalEventBus.emit('websocket:message:response', resp);

    const texts = Array.from(document.querySelectorAll('#recent-added-list .sidebar-item-text')).map(el => el.textContent);
    // 应使用书名展示，且顺序来自后端（desc），这里验证存在即可
    expect(texts).toContain('T1');
    expect(texts).toContain('T2');
    expect(texts).toContain('T3');
  });

  it('收到 add:completed 后写入存储并渲染到UI，随后 info:completed 更新列表显示书名，点击触发打开', () => {
    const fakeFile = { id: 'abc123', filename: 'A.pdf', path: 'C:/A.pdf' };
    const msg = {
      type: WEBSOCKET_MESSAGE_TYPES.ADD_PDF_COMPLETED,
      status: 'success',
      data: { file: fakeFile },
      request_id: 'rid-1'
    };
    globalEventBus.emit('websocket:message:response', msg);

    // 存储
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe('abc123');
    expect(stored[0].filename).toBe('A.pdf');

    // UI 初始使用文件名
    const items = document.querySelectorAll('#recent-added-list .sidebar-item');
    expect(items.length).toBe(1);
    expect(items[0].querySelector('.sidebar-item-text').textContent).toBe('A.pdf');

    // 模拟详情回执，更新为书名展示
    const infoResp = {
      type: 'pdf-library:info:completed',
      status: 'success',
      data: { id: 'abc123', title: 'A-Title' }
    };
    globalEventBus.emit('websocket:message:response', infoResp);
    const items2 = document.querySelectorAll('#recent-added-list .sidebar-item');
    expect(items2[0].querySelector('.sidebar-item-text').textContent).toBe('A-Title');

    // 点击打开
    items2[0].click();
    const openMsg = sentMessages.find(m => m && m.type === WEBSOCKET_MESSAGE_TYPES.OPEN_PDF);
    expect(openMsg).toBeTruthy();
    expect(openMsg.data && openMsg.data.file_id).toBe('abc123');
  });

  it('重复添加相同文件应提升到顶部且不重复', () => {
    const f1 = { id: 'id1', filename: 'f1.pdf', path: 'C:/f1.pdf' };
    const f2 = { id: 'id2', filename: 'f2.pdf', path: 'C:/f2.pdf' };
    globalEventBus.emit('websocket:message:response', { type: WEBSOCKET_MESSAGE_TYPES.ADD_PDF_COMPLETED, status: 'success', data: { file: f1 } });
    globalEventBus.emit('websocket:message:response', { type: WEBSOCKET_MESSAGE_TYPES.ADD_PDF_COMPLETED, status: 'success', data: { file: f2 } });
    // 再次添加 f1，应移动到顶部
    globalEventBus.emit('websocket:message:response', { type: WEBSOCKET_MESSAGE_TYPES.ADD_PDF_COMPLETED, status: 'success', data: { file: f1 } });

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    expect(stored.length).toBe(2);
    expect(stored[0].id).toBe('id1');
    expect(stored[1].id).toBe('id2');
  });
});
