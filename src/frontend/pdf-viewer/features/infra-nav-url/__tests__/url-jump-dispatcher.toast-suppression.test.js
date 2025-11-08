/**
 * 目标：当 outlineItemId 为 undefined（URL未提供该参数）时，不应弹出与 outlineItemId 相关的 toast。
 * 方法：mock logger，调用 tryExecute({ pdfId })，断言与
 *  - "[URLJumpDispatcher] 检查outlineItemId"
 *  - "[URLJumpDispatcher] parsed keys"
 *  - "outlineItemId为空或未定义"
 * 相关的日志调用参数中不包含 { toast: ... }。
 */
// 先 mock logger（避免 import 触发真实模块加载）
const calls = [];
jest.mock("../../../../common/utils/logger.js", () => {
  const rec = {
    info: (...args) => { calls.push(["info", args]); },
    warn: (...args) => { calls.push(["warn", args]); },
    error: (...args) => { calls.push(["error", args]); },
  };
  return { getLogger: () => rec, __calls: calls };
}, { virtual: true });

import { URLJumpDispatcher } from "../components/url-jump-dispatcher.js";
import { EventBus } from "../../../../common/event/event-bus.js";
import * as LoggerMock from "../../../../common/utils/logger.js";

describe("URLJumpDispatcher - undefined outlineItemId 不弹 toast", () => {
  let eventBus;
  let nav;
  let dispatcher;

  beforeEach(() => {
    calls.length = 0;
    eventBus = new EventBus({ enableValidation: false });
    nav = { navigateTo: jest.fn(async () => ({ success: true })) };
    dispatcher = new URLJumpDispatcher({ eventBus, navigationService: nav });
  });

  afterEach(() => {
    eventBus?.destroy();
  });

  test("当未提供 outlineItemId（undefined）时，不弹出与其相关的 toast", async () => {
    // 不提供 outlineItemId 属性，模拟 URL 未包含该参数
    const parsed = { pdfId: "test-123" };
    const r = await dispatcher.tryExecute(parsed);
    expect(r).toEqual({ type: "none", success: true });

    const infoCalls = LoggerMock.__calls.filter(([lvl]) => lvl === "info").map(([, args]) => args);
    const targets = ["[URLJumpDispatcher] 检查outlineItemId", "[URLJumpDispatcher] parsed keys", "outlineItemId为空或未定义"];
    for (const args of infoCalls) {
      const msg = String(args[0] || "");
      if (targets.some(t => msg.includes(t))) {
        // 不应包含 toast 字段
        const hasToast = args.some(a => a && typeof a === "object" && Object.prototype.hasOwnProperty.call(a, "toast"));
        expect(hasToast).toBe(false);
      }
    }
  });

  test("当 outlineItemId 显式为 null 时，也不弹出与其相关的 toast", async () => {
    const parsed = { pdfId: "test-123", outlineItemId: null };
    const r = await dispatcher.tryExecute(parsed);
    expect(r).toEqual({ type: "none", success: true });

    const infoCalls = LoggerMock.__calls.filter(([lvl]) => lvl === "info").map(([, args]) => args);
    const targets = ["[URLJumpDispatcher] 检查outlineItemId", "[URLJumpDispatcher] parsed keys", "outlineItemId为空或未定义"];
    for (const args of infoCalls) {
      const msg = String(args[0] || "");
      if (targets.some(t => msg.includes(t))) {
        const hasToast = args.some(a => a && typeof a === "object" && Object.prototype.hasOwnProperty.call(a, "toast"));
        expect(hasToast).toBe(false);
      }
    }
  });
});
