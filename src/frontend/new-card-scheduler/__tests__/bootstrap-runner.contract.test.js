import { EventBus } from "../../common/event/event-bus.js";

import { bootstrapNewCardSchedulerAppFeature } from "../bootstrap/app-bootstrap-feature.js";

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url;
  readyState = FakeWebSocket.CONNECTING;
  onopen = null;
  onmessage = null;
  onerror = null;
  onclose = null;

  #listeners = new Map();

  constructor(url) {
    this.url = url;
  }

  addEventListener(type, handler) {
    if (!this.#listeners.has(type)) {
      this.#listeners.set(type, new Set());
    }
    this.#listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    const set = this.#listeners.get(type);
    if (!set) {
      return;
    }
    set.delete(handler);
  }

  send() {
    // noop (test stub)
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
  }
}

describe("new-card-scheduler bootstrap runner (G) - contract regression", () => {
  test("bootstrap 返回 destroy()，且 destroy() 可重复调用不抛异常", async () => {
    const originalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = FakeWebSocket;

    document.body.innerHTML = `
      <div class="toolbar-controls"></div>
      <div id="window-controls-slot"></div>
      <div id="planner-sidebar"></div>
      <div class="main-content">
        <div id="planner-layout-switcher"></div>
        <div id="planner-workspace"></div>
      </div>
    `;

    const eventBus = new EventBus({ moduleName: `ncs-test-${Date.now()}`, enableValidation: true });
    const notification = { showInfo: jest.fn(), showError: jest.fn() };

    const runner = await bootstrapNewCardSchedulerAppFeature({
      rootEl: document.getElementById("planner-workspace"),
      eventBus,
      clientId: "ncs-test-client",
      wsUrl: "ws://localhost:12345",
      enableWindowControls: false,
      notification
    });

    expect(runner).toEqual(expect.objectContaining({ destroy: expect.any(Function) }));

    await runner.destroy();
    await runner.destroy();

    eventBus.destroy();

    document.body.innerHTML = "";
    globalThis.WebSocket = originalWebSocket;
  });
});

