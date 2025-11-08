/**
 * 测试专用事件常量（仅供 __tests__ 使用）
 * - 采用统一三段式命名，满足 custom/event-name-format
 * - 允许在本文件中使用字符串字面量（已在 ESLint 覆写中放行）
 */
export const TEST_EVENTS = {
  TEST: {
    EVENT: "test:event:triggered",
  },
  ERROR: {
    SYNC: "test:error:sync",
    ASYNC: "test:error:async",
  },
  GENERIC: {
    EVENT1: "test:generic:event1",
    EVENT2: "test:generic:event2",
    EVENT3: "test:generic:event3",
  },
};

export default TEST_EVENTS;

