/**
 * @file global-event-registry.anchor.test.js
 * 验证全局事件白名单包含关键 WS 与 Anchor 事件
 */

import { isGlobalEventAllowed } from '../global-event-registry.js';

describe('global-event-registry (anchor/ws)', () => {
  it('应放行 websocket:message:received', () => {
    expect(isGlobalEventAllowed('websocket:message:received')).toBe(true);
  });

  it('应放行 anchor:list:completed', () => {
    expect(isGlobalEventAllowed('anchor:list:completed')).toBe(true);
  });
});

