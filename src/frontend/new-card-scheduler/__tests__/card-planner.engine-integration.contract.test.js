import { EventBus } from "../../common/event/event-bus.js";
import { WEBSOCKET_EVENTS } from "../../common/event/event-constants.js";
import { createCardsEngine } from "../planner/cards-model.js";
import { createCardPlannerApp } from "../planner/app.js";
import { CARD_PLANNER_MESSAGE_TYPES } from "../planner/card-planner-message-types.js";

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

    delete globalThis.__NCS_DISABLE_AUTO_BOOTSTRAP__;
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
