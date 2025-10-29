/**
 * WebSocketAdapter - outline 导航消息处理测试
 */
import { WebSocketAdapter } from '../websocket-adapter.js';
import { EventBus } from '../../../common/event/event-bus.js';
import { PDF_VIEWER_EVENTS } from '../../../common/event/pdf-viewer-constants.js';

describe('WebSocketAdapter navigate (outline)', () => {
  let eventBus;
  let mockWSClient;
  let adapter;

  beforeEach(() => {
    eventBus = new EventBus({ enableValidation: false });
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

