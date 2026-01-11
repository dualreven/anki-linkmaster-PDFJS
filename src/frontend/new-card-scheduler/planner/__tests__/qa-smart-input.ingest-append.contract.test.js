import { EventBus } from "../../../common/event/event-bus.js";
import { WEBSOCKET_EVENTS } from "../../../common/event/event-constants.js";

import { createCardsEngine } from "../cards-model.js";
import { createPlannerWorkspaceUI } from "../ui/workspace.js";
import { installMsgCenterWiring } from "../wiring/msgcenter-wiring.js";
import { CARD_PLANNER_MESSAGE_TYPES } from "../card-planner-message-types.js";

describe("card-planner qa smart input (F) - ingest append contract", () => {
  test("收到 ingest:requested：engine 追加后 UI 显示必须为 [[id]]", () => {
    document.body.innerHTML = `<div id="planner-workspace"></div>`;

    const engine = createCardsEngine();
    const tempId = engine.createEmptyCardOrThrow();

    const eventBus = new EventBus({ moduleName: `ncs-test-${Date.now()}`, enableValidation: true });
    const wsClient = { send: jest.fn() };
    const notification = { showInfo: jest.fn(), showError: jest.fn() };

    const root = document.getElementById("planner-workspace");
    const ui = createPlannerWorkspaceUI({
      root,
      engine,
      getCardMetaPreview: () => ({ Q: [], A: [] }),
      notification
    });

    const uninstall = installMsgCenterWiring({
      eventBus,
      wsClient,
      engine,
      logger: { warn: jest.fn() },
      notification,
      render: () => ui.render(),
    });

    eventBus.emit(
      WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
      {
        type: CARD_PLANNER_MESSAGE_TYPES.INGEST_REQUESTED,
        request_id: "rid_ingest_qa_1",
        data: {
          op: { kind: "all-to-one", target: { kind: "card-id", tempId }, face: "A" },
          annotation_ids: ["ann_x"]
        }
      },
      { actorId: "test" }
    );

    const row = root.querySelector(`[data-temp-id="${tempId}"]`);
    const aTextarea = row.querySelector("[data-testid='qa-smart-textarea-A']");
    expect(aTextarea.value).toContain("[[ann_x]]");

    expect(wsClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CARD_PLANNER_MESSAGE_TYPES.INGEST_COMPLETED,
        request_id: "rid_ingest_qa_1"
      })
    );

    uninstall();
    ui.dispose();
    eventBus.destroy();
    document.body.innerHTML = "";
  });
});
