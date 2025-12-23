/**
 * @file WSClient.request 超时计时应在“实际发送”时开始（避免首开未连接时提前超时）
 */

import { EventBus } from "../../event/event-bus.js";
import { WEBSOCKET_MESSAGE_TYPES } from "../../event/event-constants.js";
import { WSClient } from "../ws-client.js";

describe("WSClient.request timeout", () => {
  /** @type {any} */
  let OriginalWebSocket;
  /** @type {any} */
  let lastSocket;

  class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    constructor(url) {
      this.url = url;
      this.readyState = FakeWebSocket.CONNECTING;
      this.sent = [];
      this.onopen = null;
      this.onmessage = null;
      this.onclose = null;
      this.onerror = null;
      this._listeners = { open: [], error: [] };
      lastSocket = this;
    }

    addEventListener(type, handler) {
      if (!this._listeners[type]) { this._listeners[type] = []; }
      this._listeners[type].push(handler);
    }

    removeEventListener(type, handler) {
      if (!this._listeners[type]) { return; }
      this._listeners[type] = this._listeners[type].filter((h) => h !== handler);
    }

    send(payload) {
      this.sent.push(payload);
    }

    close() {
      this.readyState = FakeWebSocket.CLOSED;
      try { this.onclose?.({ code: 1000, reason: "closed", wasClean: true }); } catch { /* ignore */ }
    }

    triggerOpen() {
      this.readyState = FakeWebSocket.OPEN;
      try { this._listeners.open.forEach((h) => h()); } catch { /* ignore */ }
      try { this.onopen?.(); } catch { /* ignore */ }
    }
  }

  beforeEach(() => {
    jest.useFakeTimers();
    OriginalWebSocket = global.WebSocket;
    global.WebSocket = FakeWebSocket;
    lastSocket = null;
  });

  afterEach(() => {
    global.WebSocket = OriginalWebSocket;
    jest.useRealTimers();
  });

  test("未连接时排队的 request 不应提前超时；应在连接后发送时开始计时", async () => {
    const eventBus = new EventBus({ enableValidation: false, moduleName: "test" });
    const wsClient = new WSClient("ws://localhost:12345/", eventBus, {
      client_name: "test-client",
      client_id: "t1",
      module: "test"
    });

    const promise = wsClient.request(
      WEBSOCKET_MESSAGE_TYPES.HEARTBEAT_REQUESTED,
      {},
      { timeout: 50 }
    );

    let settled = false;
    promise.then(() => { settled = true; }).catch(() => { settled = true; });

    // 连接尚未建立：推进时间也不应触发超时（timeout 应在真正 send 时才开始）
    jest.advanceTimersByTime(60);
    await Promise.resolve();
    expect(settled).toBe(false);

    const connectPromise = wsClient.connect();
    expect(lastSocket).toBeTruthy();
    lastSocket.triggerOpen();
    await connectPromise;

    // 连接建立后，队列中的请求会被发送，并从此刻开始计时
    expect(lastSocket.sent.length).toBeGreaterThan(0);

    jest.advanceTimersByTime(60);
    await expect(promise).rejects.toThrow("请求超时");
  });
});

