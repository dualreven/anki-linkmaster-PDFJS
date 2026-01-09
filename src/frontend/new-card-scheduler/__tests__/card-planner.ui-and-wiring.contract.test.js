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
    root: document.getElementById("planner-workspace")
  };
}

function createClipboardData(text) {
  return {
    getData: (type) => (type === "text/plain" ? text : "")
  };
}

describe("card-planner UI & MsgCenter wiring (H) - contract regression", () => {
  test("未选中时 Ctrl+V：提示无效且阻止默认行为", () => {
    const { root } = setupDom();
    const engine = createFakeEngine();
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

    const ev = new KeyboardEvent("keydown", { key: "v", ctrlKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(notification.showError).toHaveBeenCalled();
    expect(wsClient.send).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: CARD_PLANNER_MESSAGE_TYPES.INGEST_REQUESTED })
    );

    app.dispose();
    eventBus.destroy();
  });

  test("选中+点击 Q/A 设置粘贴焦点：粘贴后调用 engine.dispatchIngest 且 face 正确", () => {
    const { root } = setupDom();
    const engine = createFakeEngine();
    const spyDispatch = jest.spyOn(engine, "dispatchIngest");
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

    const qBtn = root.querySelector("button[title=\"点击设置粘贴焦点：Q\"]");
    expect(qBtn).toBeTruthy();
    qBtn.click();

    const pasteQ = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pasteQ, "clipboardData", { value: createClipboardData("ann_1;ann_2") });
    document.dispatchEvent(pasteQ);

    expect(spyDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        op: expect.objectContaining({ face: "Q" }),
        annotationIds: ["ann_1", "ann_2"]
      })
    );

    const aBtn = root.querySelector("button[title=\"点击设置粘贴焦点：A\"]");
    expect(aBtn).toBeTruthy();
    aBtn.click();

    const pasteA = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pasteA, "clipboardData", { value: createClipboardData("ann_3") });
    document.dispatchEvent(pasteA);

    expect(spyDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        op: expect.objectContaining({ face: "A" }),
        annotationIds: ["ann_3"]
      })
    );

    app.dispose();
    eventBus.destroy();
  });

  test("状态请求响应：payload 必须含 selectedTempId", () => {
    const { root } = setupDom();
    const engine = createFakeEngine();
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

    // 选中第一张卡（通过点击 Q 也会选中）
    const qBtn = root.querySelector("button[title=\"点击设置粘贴焦点：Q\"]");
    qBtn.click();

    eventBus.emit(
      WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
      { type: CARD_PLANNER_MESSAGE_TYPES.STATE_GET_REQUESTED, request_id: "rid_state_1", data: {} },
      { actorId: "test" }
    );

    expect(wsClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CARD_PLANNER_MESSAGE_TYPES.STATE_GET_COMPLETED,
        request_id: "rid_state_1",
        data: expect.objectContaining({
          draftCardTempIds: expect.any(Array),
          selectedTempId: expect.any(String)
        })
      })
    );

    app.dispose();
    eventBus.destroy();
  });

  test("UI 调用：拖拽排序/删除/命名会调用 engine 对应方法", () => {
    const { root } = setupDom();
    const engine = createFakeEngine();
    const spyRename = jest.spyOn(engine, "renameCard");
    const spyDelete = jest.spyOn(engine, "deleteCard");
    const spyReorder = jest.spyOn(engine, "reorderCards");
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

    const titleInput = root.querySelector("input[type='text']");
    expect(titleInput).toBeTruthy();
    titleInput.value = "t1";
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(spyRename).toHaveBeenCalled();

    const row = root.querySelector("[data-temp-id]");
    expect(row).toBeTruthy();
    const dropEv = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(dropEv, "dataTransfer", { value: { getData: () => "0" } });
    row.dispatchEvent(dropEv);
    expect(spyReorder).toHaveBeenCalled();

    const deleteBtn = Array.from(root.querySelectorAll("button")).find((b) => b.textContent === "删除");
    expect(deleteBtn).toBeTruthy();
    deleteBtn.click();
    expect(spyDelete).toHaveBeenCalled();

    app.dispose();
    eventBus.destroy();
  });
});
