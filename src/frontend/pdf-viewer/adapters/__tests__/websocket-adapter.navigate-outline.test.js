/**
 * WebSocketAdapter - outline 导航消息处理测试
 */
// stub logger to avoid import.meta in jest（配合 moduleNameMapper 去掉 .js 扩展）
jest.mock('../../common/utils/logger', () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })
}), { virtual: true });
jest.mock('../../../common/utils/logger', () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })
}), { virtual: true });

let WebSocketAdapter;
const { PDF_VIEWER_EVENTS } = require('../../../common/event/pdf-viewer-constants.js');

describe('WebSocketAdapter navigate (outline)', () => {
  let eventBus;
  let mockWSClient;
  let adapter;

  beforeEach(() => {
    jest.isolateModules(() => {
      WebSocketAdapter = require('../websocket-adapter.js').WebSocketAdapter;
    });
    eventBus = {
      _h: {},
      on: function (evt, fn) { this._h[evt] = fn; return () => {}; },
      onGlobal: function (evt, fn) { this._h[evt] = fn; return () => {}; },
      emit: function (evt, data, meta) { if (this._h[evt]) this._h[evt](data, meta); },
      destroy: function () { this._h = {}; }
    };
    mockWSClient = {
      send: jest.fn(),
      isConnected: jest.fn(() => true)
    };
    adapter = new WebSocketAdapter(mockWSClient, eventBus);
    adapter.setupMessageHandlers();
    adapter.onInitialized();
  });

  afterEach(() => {
    adapter?.destroy();
    eventBus?.destroy();
  });

  test('应当把 pdf-viewer:navigate:requested (outline) 转为 BOOKMARK.NAVIGATE_BY_ID.REQUESTED', () => {
    const spy = jest.fn();
    eventBus.on(PDF_VIEWER_EVENTS.BOOKMARK.NAVIGATE_BY_ID.REQUESTED, spy);

    adapter.handleMessage({
      type: 'pdf-viewer:navigate:requested',
      request_id: 'req-1',
      data: {
        to: { pdf_uuid: 'deadbeefcafe' },
        target: { type: 'outline', outline_item_id: 'outline-123' },
        options: {}
      }
    });

    expect(spy).toHaveBeenCalledWith(
      { outlineItemId: 'outline-123' },
      expect.any(Object)
    );
  });
});
