import { EventBus } from "../../common/event/event-bus.js";
import { WEBSOCKET_EVENTS } from "../../common/event/event-constants.js";
import { createCardsEngine } from "../planner/cards-model.js";
import { createCardPlannerApp } from "../planner/app.js";
import { CARD_PLANNER_MESSAGE_TYPES } from "../planner/card-planner-message-types.js";
import { createFakeEngine } from "../planner/engine/fake-engine.js";

describe("card-planner engine integration (G) - contract regression", () => {
  function setupDom() {
    document.body.innerHTML = `
      <div id="planner-layout-switcher"></div>
      <div id="planner-workspace"></div>
    `;
    return {
      root: document.getElementById("planner-workspace")
    };
  }

  function installWsAutoReply({ wsClient, eventBus }) {
    wsClient.send.mockImplementation((req) => {
      if (req?.type !== CARD_PLANNER_MESSAGE_TYPES.ANNOTATION_BULK_GET_REQUESTED) {
        return;
      }

      const requestId = req?.request_id;
      const annIds = Array.isArray(req?.data?.ann_ids) ? req.data.ann_ids : [];

      eventBus.emit(
        WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
        {
          type: CARD_PLANNER_MESSAGE_TYPES.ANNOTATION_BULK_GET_COMPLETED,
          request_id: requestId,
          data: {
            annotations: annIds.map((id) => ({
              id,
              title: `t_${id}`,
              type: "note",
              pageNumber: 1,
              pdfId: "p1"
            }))
          }
        },
        { actorId: "test" }
      );
    });
  }

  function createClipboardData(text) {
    return {
      getData: (type) => (type === "text/plain" ? text : "")
    };
  }

  test("main.js 使用真实引擎工厂（createCardsEngine）", async () => {
    globalThis.__NCS_DISABLE_AUTO_BOOTSTRAP__ = true;
    const mod = await import("../main.js");
    const engine = mod.createPlannerEngineOrThrow();

    expect(typeof engine.getDraftCardsSnapshotOrThrow).toBe("function");
    expect(typeof engine.createEmptyCardOrThrow).toBe("function");

    delete globalThis.__NCS_DISABLE_AUTO_BOOTSTRAP__;
  });

  test("引擎接口一致性：FakeEngine/CardsEngine 都支持 createEmptyCardOrThrow()", () => {
    const fake = createFakeEngine();
    const real = createCardsEngine();

    expect(typeof fake.createEmptyCardOrThrow).toBe("function");
    expect(typeof real.createEmptyCardOrThrow).toBe("function");
    expect(typeof fake.resetDraftCardsOrThrow).toBe("function");
    expect(typeof real.resetDraftCardsOrThrow).toBe("function");
  });

  test("UI：点击“新建空卡”会新增卡片并选中，并 toast", () => {
    const { root } = setupDom();
    const engine = createCardsEngine();
    engine.createCardOrThrow();

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

    const before = engine.getState().draftCardTempIds.length;
    const btn = Array.from(root.querySelectorAll("button")).find((b) => b.textContent === "新建空卡");
    expect(btn).toBeTruthy();
    btn.click();

    const after = engine.getState().draftCardTempIds.length;
    expect(after).toBe(before + 1);
    expect(engine.getState().selectedTempId).toBeTruthy();
    expect(notification.showInfo).toHaveBeenCalled();

    app.dispose();
    eventBus.destroy();
  });

  test("UI：点击“清空草稿卡”后列表为空、selected=null、pasteFocus 被清空；再新建空卡仍可用", () => {
    const { root } = setupDom();
    const engine = createCardsEngine();
    engine.createCardOrThrow();
    engine.createCardOrThrow();

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

    const btnReset = Array.from(root.querySelectorAll("button")).find((b) => b.textContent === "清空草稿卡");
    expect(btnReset).toBeTruthy();
    btnReset.click();

    expect(engine.getState().draftCardTempIds).toEqual([]);
    expect(engine.getState().selectedTempId).toBe(null);
    expect(root.querySelectorAll("[data-temp-id]").length).toBe(0);
    expect(notification.showInfo).toHaveBeenCalled();

    const pasteAfterReset = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pasteAfterReset, "clipboardData", { value: createClipboardData("ann_1") });
    document.dispatchEvent(pasteAfterReset);
    expect(notification.showError).toHaveBeenCalled();

    const btnCreate = Array.from(root.querySelectorAll("button")).find((b) => b.textContent === "新建空卡");
    btnCreate.click();
    expect(engine.getState().draftCardTempIds.length).toBe(1);
    expect(engine.getState().selectedTempId).toBeTruthy();

    app.dispose();
    eventBus.destroy();
  });

  test("annotation meta 拉取失败 toast 去重：同一错误 2 秒内最多提示一次", async () => {
    const { root } = setupDom();
    const engine = createCardsEngine();
    engine.createCardOrThrow();

    const notification = { showInfo: jest.fn(), showError: jest.fn() };
    const eventBus = new EventBus({ moduleName: `ncs-test-${Date.now()}`, enableValidation: true });
    const wsClient = { send: jest.fn() };
    wsClient.send.mockImplementation((req) => {
      if (req?.type !== CARD_PLANNER_MESSAGE_TYPES.ANNOTATION_BULK_GET_REQUESTED) {
        return;
      }
      eventBus.emit(
        WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
        {
          type: CARD_PLANNER_MESSAGE_TYPES.ANNOTATION_BULK_GET_FAILED,
          request_id: req.request_id,
          error: { message: "INVALID_TO_FIELD" }
        },
        { actorId: "test" }
      );
    });

    const app = createCardPlannerApp({
      root,
      engine,
      wsClient,
      eventBus,
      logger: { info: jest.fn(), warn: jest.fn() },
      notification
    });

    const qBtn = root.querySelector("button[title=\"点击设置粘贴焦点：Q\"]");
    qBtn.click();

    const paste1 = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste1, "clipboardData", { value: createClipboardData("ann_1") });
    document.dispatchEvent(paste1);

    const paste2 = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste2, "clipboardData", { value: createClipboardData("ann_1") });
    document.dispatchEvent(paste2);

    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(notification.showError).toHaveBeenCalledTimes(1);
    expect(notification.showError).toHaveBeenCalledWith(expect.stringContaining("INVALID_TO_FIELD"), expect.any(Number));

    app.dispose();
    eventBus.destroy();
  });

  test("真实引擎：粘贴插入后 Q/A 计数与 meta 预览基于引擎数据同步更新", async () => {
    const { root } = setupDom();
    const engine = createCardsEngine();
    engine.createCardOrThrow();

    const wsClient = { send: jest.fn() };
    const notification = { showInfo: jest.fn(), showError: jest.fn() };
    const eventBus = new EventBus({ moduleName: `ncs-test-${Date.now()}`, enableValidation: true });
    installWsAutoReply({ wsClient, eventBus });

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

    // paste handler 为 async：等待下一轮事件循环使渲染完成。
    await new Promise((r) => setTimeout(r, 0));

    expect(root.querySelector("button[title=\"点击设置粘贴焦点：Q\"]").textContent).toBe("Q (2)");
    expect(root.textContent).toContain("t_ann_1 (note)");
    expect(root.textContent).toContain("t_ann_2 (note)");

    app.dispose();
    eventBus.destroy();
  });
});
