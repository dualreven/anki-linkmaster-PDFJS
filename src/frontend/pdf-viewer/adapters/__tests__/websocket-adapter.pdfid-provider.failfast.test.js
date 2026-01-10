/** @jest-environment jsdom */

import { describe, test, expect } from "@jest/globals";
import { WebSocketAdapter } from "../websocket-adapter.js";
import { EventBus } from "../../../common/event/event-bus.js";

describe("WebSocketAdapter — pdfIdProvider fail-fast", () => {
  test("未注入 pdfIdProvider 时，构造应直接 throw", () => {
    const eventBus = new EventBus({ enableValidation: false });
    const wsClient = { request: () => {}, send: () => {} };
    expect(() => new WebSocketAdapter(wsClient, eventBus)).toThrow("WebSocketAdapter: pdfIdProvider is required");
  });
});

