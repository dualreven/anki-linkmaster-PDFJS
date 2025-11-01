/**
 * @file 心跳消息契约与白名单断言（避免直接引入 WSClient 触发 import.meta）
 */
import { WEBSOCKET_MESSAGE_TYPES } from "../../event/event-constants.js";
import { AllowedGlobalEvents } from "../../event/global-event-registry.js";

describe("Heartbeat 契约", () => {
  test("事件常量声明正确", () => {
    expect(WEBSOCKET_MESSAGE_TYPES.HEARTBEAT_REQUESTED).toBe("system:heartbeat:requested");
    expect(WEBSOCKET_MESSAGE_TYPES.HEARTBEAT_COMPLETED).toBe("system:heartbeat:completed");
  });

  test("全局事件白名单包含两种心跳事件", () => {
    expect(AllowedGlobalEvents.has("system:heartbeat:requested")).toBe(true);
    expect(AllowedGlobalEvents.has("system:heartbeat:completed")).toBe(true);
  });
});
