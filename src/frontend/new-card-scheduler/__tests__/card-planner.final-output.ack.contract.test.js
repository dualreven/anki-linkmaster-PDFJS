import { EventBus } from "../../common/event/event-bus.js";
import { WEBSOCKET_EVENTS } from "../../common/event/event-constants.js";

import { createFakeEngine } from "../planner/engine/fake-engine.js";
import { createCardPlannerApp } from "../planner/app.js";
import { CARD_PLANNER_MESSAGE_TYPES } from "../planner/card-planner-message-types.js";

function setupDom() {
  document.body.innerHTML = `
    <div id="planner-layout-switcher"></div>
    <div id="planner-workspace"></div>
  `;
  return {
    root: document.getElementById("planner-workspace"),
    button: () => Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "发射最终制卡信息"),
  };
}

describe("card-planner final-output ack UI (H) - contract regression", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("点击发射：携带 request_id/timestamp；收到 completed：toast 成功", () => {
    const { root, button } = setupDom();
    const engine = createFakeEngine();
    engine.dispatchIngest({
      op: { kind: "all-to-one", target: { kind: "card-id", tempId: "temp-1" }, face: "Q" },
      annotationIds: ["ann_1"]
    });

    const wsClient = { send: jest.fn() };
    const notification = { showInfo: jest.fn(), showError: jest.fn() };
    const eventBus = new EventBus({ moduleName: `ncs-test-${Date.now()}`, enableValidation: true });

    const app = createCardPlannerApp({
      root,
      engine,
      wsClient,
      eventBus,
      logger: { info: jest.fn(), warn: jest.fn() },
      notification
    });

    const btn = button();
    expect(btn).toBeTruthy();
    btn.click();

    expect(wsClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CARD_PLANNER_MESSAGE_TYPES.FINAL_OUTPUT_REQUESTED,
        request_id: expect.any(String),
        timestamp: expect.any(Number),
        data: expect.objectContaining({
          cards: expect.any(Array)
        })
      })
    );

    const lastCall = wsClient.send.mock.calls[0][0];
    const rid = lastCall.request_id;

    eventBus.emit(
      WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
      {
        type: CARD_PLANNER_MESSAGE_TYPES.FINAL_OUTPUT_COMPLETED,
        request_id: rid,
        data: { count: 1 }
      },
      { actorId: "test" }
    );

    expect(notification.showInfo).toHaveBeenCalled();
    expect(notification.showError).not.toHaveBeenCalled();

    app.dispose();
    eventBus.destroy();
  });

  test("收到 failed：toast 失败（显示原因）", () => {
    const { root, button } = setupDom();
    const engine = createFakeEngine();
    engine.dispatchIngest({
      op: { kind: "all-to-one", target: { kind: "card-id", tempId: "temp-1" }, face: "Q" },
      annotationIds: ["ann_1"]
    });

    const wsClient = { send: jest.fn() };
    const notification = { showInfo: jest.fn(), showError: jest.fn() };
    const eventBus = new EventBus({ moduleName: `ncs-test-${Date.now()}`, enableValidation: true });

    const app = createCardPlannerApp({
      root,
      engine,
      wsClient,
      eventBus,
      logger: { info: jest.fn(), warn: jest.fn() },
      notification
    });

    button().click();
    const rid = wsClient.send.mock.calls[0][0].request_id;

    eventBus.emit(
      WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
      {
        type: CARD_PLANNER_MESSAGE_TYPES.FINAL_OUTPUT_FAILED,
        request_id: rid,
        error: { message: "bad payload" }
      },
      { actorId: "test" }
    );

    expect(notification.showError).toHaveBeenCalledWith(expect.stringContaining("bad payload"), expect.any(Number));

    app.dispose();
    eventBus.destroy();
  });

  test("dispose 后：回执不再触发 toast", () => {
    const { root, button } = setupDom();
    const engine = createFakeEngine();
    engine.dispatchIngest({
      op: { kind: "all-to-one", target: { kind: "card-id", tempId: "temp-1" }, face: "Q" },
      annotationIds: ["ann_1"]
    });

    const wsClient = { send: jest.fn() };
    const notification = { showInfo: jest.fn(), showError: jest.fn() };
    const eventBus = new EventBus({ moduleName: `ncs-test-${Date.now()}`, enableValidation: true });

    const app = createCardPlannerApp({
      root,
      engine,
      wsClient,
      eventBus,
      logger: { info: jest.fn(), warn: jest.fn() },
      notification
    });

    button().click();
    const rid = wsClient.send.mock.calls[0][0].request_id;

    app.dispose();

    eventBus.emit(
      WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
      {
        type: CARD_PLANNER_MESSAGE_TYPES.FINAL_OUTPUT_COMPLETED,
        request_id: rid,
        data: { count: 1 }
      },
      { actorId: "test" }
    );

    expect(notification.showInfo).toHaveBeenCalledTimes(1);

    eventBus.destroy();
  });
});
