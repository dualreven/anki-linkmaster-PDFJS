// UTF-8 with explicit
// SMOKE: 关键事件常量存在性检查（不触发真实网络/GUI）
import { WEBSOCKET_MESSAGE_TYPES } from '../../common/event/event-constants.js';

describe('SMOKE - Event constants presence', () => {
  test('viewer register and navigate constants exist', () => {
    expect(WEBSOCKET_MESSAGE_TYPES).toBeTruthy();
    const keys = [
      'VIEWER_REGISTER_REQUESTED',
      'VIEWER_REGISTER_COMPLETED',
      'VIEWER_REGISTER_FAILED',
      'VIEWER_NAVIGATE_REQUESTED',
      'VIEWER_NAVIGATE_COMPLETED',
      'VIEWER_NAVIGATE_FAILED',
    ];
    for (const k of keys) {
      expect(WEBSOCKET_MESSAGE_TYPES[k]).toEqual(expect.any(String));
      expect(WEBSOCKET_MESSAGE_TYPES[k].length).toBeGreaterThan(0);
    }
  });

  test('debug-info read callbacks exist (completed/failed)', () => {
    const keys = ['DEBUG_INFO_READ_COMPLETED', 'DEBUG_INFO_READ_FAILED'];
    for (const k of keys) {
      expect(WEBSOCKET_MESSAGE_TYPES[k]).toEqual(expect.any(String));
    }
  });
});
