import { EventBus } from "../../common/event/event-bus.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../common/event/event-constants.js";
import { getWsStatusLabelOrThrow, mountWsStatusPanelOrThrow, WS_STATUS } from "../ui/ws-status-panel.js";

describe("new-card-scheduler ws status panel (G) - contract regression", () => {
  test("getWsStatusLabelOrThrow: 覆盖 connected vs failed", () => {
    expect(getWsStatusLabelOrThrow(WS_STATUS.CONNECTED)).toBe("connected");
    expect(getWsStatusLabelOrThrow(WS_STATUS.FAILED)).toBe("failed");
  });

  test("panel: connected vs failed 文案可观测", () => {
    document.body.innerHTML = "<div class=\"toolbar-controls\"></div>";
    const toolbarEl = document.querySelector(".toolbar-controls");
    const eventBus = new EventBus({ moduleName: `ncs-test-${Date.now()}`, enableValidation: true });
    const wsClient = { isConnected: () => false };

    const panel = mountWsStatusPanelOrThrow({
      toolbarEl,
      clientId: "new-card-scheduler",
      eventBus,
      wsClient
    });

    panel.setConnecting();
    expect(toolbarEl.textContent).toContain("ws=connecting");
    expect(toolbarEl.textContent).toContain("reg=unknown");
    expect(toolbarEl.textContent).toContain("anno_meta=idle");

    eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED, { ok: true }, { actorId: "test" });
    expect(toolbarEl.textContent).toContain("ws=connected");

    eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.FAILED, new Error("boom"), { actorId: "test" });
    expect(toolbarEl.textContent).toContain("ws=failed");
    expect(toolbarEl.textContent).toContain("ws_error=boom");

    panel.destroy();
    eventBus.destroy();
  });

  test("panel: client register completed/failed 可观测", () => {
    document.body.innerHTML = "<div class=\"toolbar-controls\"></div>";
    const toolbarEl = document.querySelector(".toolbar-controls");
    const eventBus = new EventBus({ moduleName: `ncs-test-${Date.now()}`, enableValidation: true });
    const wsClient = { isConnected: () => true };

    const panel = mountWsStatusPanelOrThrow({
      toolbarEl,
      clientId: "new-card-scheduler",
      eventBus,
      wsClient
    });

    expect(toolbarEl.textContent).toContain("ws=connected");
    expect(toolbarEl.textContent).toContain("reg=unknown");
    expect(toolbarEl.textContent).toContain("anno_meta=idle");

    eventBus.emit(
      WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
      { type: WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_COMPLETED, data: { client_id: "new-card-scheduler" } },
      { actorId: "test" }
    );
    expect(toolbarEl.textContent).toContain("reg=ok");

    eventBus.emit(
      WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
      {
        type: WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_FAILED,
        data: { client_id: "new-card-scheduler" },
        error: { message: "register boom" }
      },
      { actorId: "test" }
    );
    expect(toolbarEl.textContent).toContain("reg=failed");
    expect(toolbarEl.textContent).toContain("reg_error=register boom");

    panel.destroy();
    eventBus.destroy();
  });

  test("panel: anno_meta idle→loading→failed 可观测", () => {
    document.body.innerHTML = "<div class=\"toolbar-controls\"></div>";
    const toolbarEl = document.querySelector(".toolbar-controls");
    const eventBus = new EventBus({ moduleName: `ncs-test-${Date.now()}`, enableValidation: true });
    const wsClient = { isConnected: () => true };

    const panel = mountWsStatusPanelOrThrow({
      toolbarEl,
      clientId: "new-card-scheduler",
      eventBus,
      wsClient
    });

    expect(toolbarEl.textContent).toContain("anno_meta=idle");

    panel.setAnnoMetaLoading("rid_1");
    expect(toolbarEl.textContent).toContain("anno_meta=loading");
    expect(toolbarEl.textContent).toContain("anno_rid=rid_1");

    panel.setAnnoMetaFailed("rid_1", new Error("timeout"));
    expect(toolbarEl.textContent).toContain("anno_meta=failed");
    expect(toolbarEl.textContent).toContain("anno_error=timeout");

    panel.destroy();
    eventBus.destroy();
  });

  test("panel: 自检按钮点击会 emit MSG_CENTER.STATUS.REQUEST", () => {
    document.body.innerHTML = "<div class=\"toolbar-controls\"></div>";
    const toolbarEl = document.querySelector(".toolbar-controls");
    const eventBus = new EventBus({ moduleName: `ncs-test-${Date.now()}`, enableValidation: true });
    const wsClient = { isConnected: () => true };

    const emitSpy = jest.spyOn(eventBus, "emit");

    const panel = mountWsStatusPanelOrThrow({
      toolbarEl,
      clientId: "new-card-scheduler",
      eventBus,
      wsClient
    });

    const btn = toolbarEl.querySelector("[data-testid=\"ncs-ws-selfcheck\"]");
    expect(btn).toBeTruthy();
    btn.click();

    expect(emitSpy).toHaveBeenCalledWith(
      WEBSOCKET_EVENTS.MSG_CENTER.STATUS.REQUEST,
      expect.any(Object),
      expect.any(Object)
    );

    panel.destroy();
    eventBus.destroy();
  });

  test("panel: 收到 MSG_CENTER.STATUS.RESPONSE 后渲染 url/readyState/reconnectAttempts", () => {
    document.body.innerHTML = "<div class=\"toolbar-controls\"></div>";
    const toolbarEl = document.querySelector(".toolbar-controls");
    const eventBus = new EventBus({ moduleName: `ncs-test-${Date.now()}`, enableValidation: true });
    const wsClient = { isConnected: () => true };

    const panel = mountWsStatusPanelOrThrow({
      toolbarEl,
      clientId: "new-card-scheduler",
      eventBus,
      wsClient
    });

    eventBus.emit(
      WEBSOCKET_EVENTS.MSG_CENTER.STATUS.RESPONSE,
      { url: "ws://127.0.0.1:12345", readyState: 1, reconnectAttempts: 2 },
      { actorId: "test" }
    );

    expect(toolbarEl.textContent).toContain("ws_url=ws://127.0.0.1:12345");
    expect(toolbarEl.textContent).toContain("ws_readyState=1");
    expect(toolbarEl.textContent).toContain("ws_reconnectAttempts=2");

    panel.destroy();
    eventBus.destroy();
  });
});
