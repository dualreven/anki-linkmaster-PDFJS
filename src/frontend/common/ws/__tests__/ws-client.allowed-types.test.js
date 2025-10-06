/**
 * @file WSClient 允许的出站类型 - 契约断言
 * 确认 record-update:requested 已加入常量并允许发送
 */

import { WEBSOCKET_MESSAGE_TYPES } from '../../event/event-constants.js';

describe('WEBSOCKET_MESSAGE_TYPES - record update', () => {
  test('声明了 pdf-library:record-update:requested', () => {
    expect(WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_REQUESTED).toBe(
      'pdf-library:record-update:requested'
    );
  });

  test('声明了 pdf-library:record-update:completed/failed', () => {
    expect(WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_COMPLETED).toBe(
      'pdf-library:record-update:completed'
    );
    expect(WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_FAILED).toBe(
      'pdf-library:record-update:failed'
    );
  });
});
