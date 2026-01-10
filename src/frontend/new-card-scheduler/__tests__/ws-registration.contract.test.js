import { EventBus } from "../../common/event/event-bus.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../common/event/event-constants.js";

import { installWsRegistrationWiringOrThrow } from "../wiring/ws-registration.js";

describe("new-card-scheduler ws registration wiring (G) - contract regression", () => {
  test("连接建立后会发送 client:register:requested（无 to），且 payload 合法", async () => {
    const eventBus = new EventBus({ moduleName: `ncs-test-${Date.now()}`, enableValidation: true });
    const wsClient = { send: jest.fn() };
    const onStatus = jest.fn();

    const uninstall = installWsRegistrationWiringOrThrow({
      eventBus,
      wsClient,
      clientId: "new-card-scheduler",
      timeoutMs: 5000,
      onStatus
    });

    eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED, { ok: true }, { actorId: "test" });

    const msg = wsClient.send.mock.calls[0][0];
    expect(msg).toEqual(expect.objectContaining({
      type: WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_REQUESTED,
      data: expect.objectContaining({
        client_id: "new-card-scheduler",
        client_type: expect.any(Array),
      })
    }));
    expect("to" in msg).toBe(false);

    eventBus.emit(
      WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
      { type: WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_COMPLETED, request_id: msg.request_id, data: { ok: true } },
      { actorId: "test" }
    );

    await new Promise((r) => setTimeout(r, 0));
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({ status: "ok" }));

    uninstall();
    eventBus.destroy();
  });

  test("注册失败时状态为 failed 且可观测（onStatus + showError）", async () => {
    const eventBus = new EventBus({ moduleName: `ncs-test-${Date.now()}`, enableValidation: true });
    const wsClient = { send: jest.fn() };
    const notification = { showError: jest.fn() };
    const onStatus = jest.fn();

    const uninstall = installWsRegistrationWiringOrThrow({
      eventBus,
      wsClient,
      clientId: "new-card-scheduler",
      timeoutMs: 5000,
      notification,
      onStatus
    });

    eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED, { ok: true }, { actorId: "test" });
    const msg = wsClient.send.mock.calls[0][0];

    eventBus.emit(
      WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
      {
        type: WEBSOCKET_MESSAGE_TYPES.CLIENT_REGISTER_FAILED,
        request_id: msg.request_id,
        error: { message: "409 conflict" }
      },
      { actorId: "test" }
    );

    await new Promise((r) => setTimeout(r, 0));
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
    expect(notification.showError).toHaveBeenCalled();

    uninstall();
    eventBus.destroy();
  });
});

