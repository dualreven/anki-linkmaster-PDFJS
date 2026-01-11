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

describe("new-card-scheduler bootstrap install summary (H) - contract regression", () => {
  test("存在失败 feature：输出安装摘要（logger.info），并 toast 提示失败", async () => {
    const originalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = FakeWebSocket;

    // 故意缺少 .toolbar-controls，触发 legacy feature install 失败
    document.body.innerHTML = `
      <div id="planner-sidebar"></div>
      <div class="main-content">
        <div id="planner-layout-switcher"></div>
        <div id="planner-workspace"></div>
      </div>
    `;

    const eventBus = new EventBus({ moduleName: `ncs-test-${Date.now()}`, enableValidation: true });
    const notification = { showInfo: jest.fn(), showError: jest.fn() };
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

    const runner = await bootstrapNewCardSchedulerAppFeature({
      rootEl: document.getElementById("planner-workspace"),
      eventBus,
      clientId: "ncs-test-client",
      wsUrl: "ws://localhost:12345",
      enableWindowControls: false,
      notification,
      logger
    });

    expect(runner).toEqual(expect.objectContaining({ destroy: expect.any(Function) }));

    // 安装摘要（人类可读）
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("[NCS Bootstrap] install summary"));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("registered"));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("installed"));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("failed"));

    // 失败 toast
    expect(notification.showError).toHaveBeenCalledWith("有 feature 安装失败（详见日志）", 3500);

    await runner.destroy();
    eventBus.destroy();

    document.body.innerHTML = "";
    globalThis.WebSocket = originalWebSocket;
  });
});

