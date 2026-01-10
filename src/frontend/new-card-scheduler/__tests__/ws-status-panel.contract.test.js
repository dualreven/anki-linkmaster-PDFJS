import { EventBus } from "../../common/event/event-bus.js";
import { WEBSOCKET_EVENTS } from "../../common/event/event-constants.js";
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

    eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED, { ok: true }, { actorId: "test" });
    expect(toolbarEl.textContent).toContain("ws=connected");

    eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.FAILED, new Error("boom"), { actorId: "test" });
    expect(toolbarEl.textContent).toContain("ws=failed");
    expect(toolbarEl.textContent).toContain("error=boom");

    panel.destroy();
    eventBus.destroy();
  });
});
