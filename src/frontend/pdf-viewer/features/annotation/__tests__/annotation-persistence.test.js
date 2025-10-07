/**
 * @file Annotation 持久化行为测试
 */

import { EventBus } from '../../../../../common/event/event-bus.js';
import { createScopedEventBus } from '../../../../../common/event/scoped-event-bus.js';
import { PDF_VIEWER_EVENTS } from '../../../../../common/event/pdf-viewer-constants.js';
import { WEBSOCKET_MESSAGE_TYPES } from '../../../../../common/event/event-constants.js';

import { AnnotationManager } from '../core/annotation-manager.js';
import { Annotation } from '../models/annotation.js';

describe('AnnotationManager 持久化', () => {
  let globalBus;
  let scopedBus;
  let manager;
  let wsClient;

  beforeEach(() => {
    // 全局事件总线（关闭验证，便于测试）
    globalBus = new EventBus({ enableValidation: false, moduleName: 'pdf-viewer' });
    scopedBus = createScopedEventBus(globalBus, 'annotation-test');

    // Mock wsClient
    wsClient = {
      request: jest.fn().mockResolvedValue({})
    };

    const container = {
      getDependencies: () => ({ wsClient }),
    };

    manager = new AnnotationManager(scopedBus, null, container);
  });

  test('在 LOAD 后 CREATE 会发送 annotation:save:requested', async () => {
    // 设置 PDF ID
    scopedBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD, { pdfId: '0fda6ae76b06' }, { actorId: 'test' });

    // 触发创建
    const ann = Annotation.createComment(1, { x: 0.5, y: 0.5 }, 'hello');
    scopedBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.CREATE, { annotation: ann }, { actorId: 'test' });

    // 等待异步请求结算
    await new Promise((r) => setTimeout(r, 10));

    expect(wsClient.request).toHaveBeenCalled();
    const [type, payload] = wsClient.request.mock.calls.find(([t]) => t === WEBSOCKET_MESSAGE_TYPES.ANNOTATION_SAVE) || [];
    expect(type).toBe(WEBSOCKET_MESSAGE_TYPES.ANNOTATION_SAVE);
    expect(payload).toBeTruthy();
    expect(payload.pdf_uuid).toBe('0fda6ae76b06');
    expect(payload.annotation?.type).toBe('comment');
  });

  test('LOAD 会发送 annotation:list:requested', async () => {
    scopedBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD, { pdfId: '0fda6ae76b06' }, { actorId: 'test' });
    await new Promise((r) => setTimeout(r, 10));

    const called = wsClient.request.mock.calls.some(([t]) => t === WEBSOCKET_MESSAGE_TYPES.ANNOTATION_LIST);
    expect(called).toBe(true);
  });
});

