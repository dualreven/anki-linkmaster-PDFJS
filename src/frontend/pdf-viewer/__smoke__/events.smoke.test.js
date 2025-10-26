// UTF-8 with explicit \n\n
// SMOKE: 关键事件常量存在性检查（不触发真实网络/GUI）\n
import { WEBSOCKET_MESSAGE_TYPES } from '../../common/event/event-constants.js';\n
\n
describe('SMOKE - Event constants presence', () => {\n
  test('viewer register and navigate constants exist', () => {\n
    expect(WEBSOCKET_MESSAGE_TYPES).toBeTruthy();\n
    const keys = [\n
      'VIEWER_REGISTER_REQUESTED',\n
      'VIEWER_REGISTER_COMPLETED',\n
      'VIEWER_REGISTER_FAILED',\n
      'VIEWER_NAVIGATE_REQUESTED',\n
      'VIEWER_NAVIGATE_COMPLETED',\n
      'VIEWER_NAVIGATE_FAILED',\n
    ];\n
    for (const k of keys) {\n
      expect(WEBSOCKET_MESSAGE_TYPES[k]).toEqual(expect.any(String));\n
      expect(WEBSOCKET_MESSAGE_TYPES[k].length).toBeGreaterThan(0);\n
    }\n
  });\n
\n
  test('debug-info read callbacks exist (completed/failed)', () => {\n
    const keys = ['DEBUG_INFO_READ_COMPLETED', 'DEBUG_INFO_READ_FAILED'];\n
    for (const k of keys) {\n
      expect(WEBSOCKET_MESSAGE_TYPES[k]).toEqual(expect.any(String));\n
    }\n
  });\n
});\n
\n
