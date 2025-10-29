/**
 * WebSocketAdapter - annotation/anchor 导航消息处理测试
 */
import { WebSocketAdapter } from '../websocket-adapter.js';
import { EventBus } from '../../../common/event/event-bus.js';
import { PDF_VIEWER_EVENTS } from '../../../common/event/pdf-viewer-constants.js';

describe('WebSocketAdapter navigate (annotation/anchor)', () => {
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

  test('annotation 模式应发射 ANNOTATION.NAVIGATION.JUMP_REQUESTED（annotation_id）', () => {
    const spy = jest.fn();
    eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED, spy);

    adapter.handleMessage({
      type: 'pdf-viewer:navigate:requested',
      request_id: 'req-2',
      data: {
        to: { viewer_id: 'vwr_x' },
        target: { type: 'annotation', annotation_id: 'ann-xyz' },
        options: { highlight: true }
      }
    });

    expect(spy).toHaveBeenCalledWith(
      { annotationId: 'ann-xyz', highlight: true },
      expect.any(Object)
    );
  });

  test('anchor 模式应发射 ANNOTATION.NAVIGATION.JUMP_REQUESTED（从 anchor_id 提取）', () => {
    const spy = jest.fn();
    eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED, spy);

    adapter.handleMessage({
      type: 'pdf-viewer:navigate:requested',
      request_id: 'req-3',
      data: {
        to: { pdf_uuid: 'deadbeefcafe' },
        target: { type: 'anchor', anchor_id: 'pdfanchor-aaaaaaaaaaaa' }
      }
    });

    expect(spy).toHaveBeenCalledWith(
      { annotationId: 'pdfanchor-aaaaaaaaaaaa', highlight: false },
      expect.any(Object)
    );
  });
});

