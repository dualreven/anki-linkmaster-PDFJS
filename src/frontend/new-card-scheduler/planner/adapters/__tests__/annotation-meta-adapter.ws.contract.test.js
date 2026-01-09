import { EventBus } from "../../../../common/event/event-bus.js";
import { WEBSOCKET_EVENTS } from "../../../../common/event/event-constants.js";

import { CARD_PLANNER_MESSAGE_TYPES } from "../../card-planner-message-types.js";
import { createAnnotationMetaAdapter } from "../annotation-meta-adapter.js";

describe("annotation meta adapter (ws) - contract regression", () => {
  test("收到 annotation:bulk-get:completed 后 resolve annotations", async () => {
    const eventBus = new EventBus({ moduleName: `ncs-test-${Date.now()}`, enableValidation: true });

    const wsClient = {
      send: jest.fn((req) => {
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
      })
    };

    const adapter = createAnnotationMetaAdapter({
      mode: "ws",
      wsClient,
      eventBus,
      timeoutMs: 250,
      logger: { warn: jest.fn() }
    });

    const p = adapter.getBulkOrThrow(["ann_1", "ann_2"]);

    expect(wsClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CARD_PLANNER_MESSAGE_TYPES.ANNOTATION_BULK_GET_REQUESTED,
        data: { ann_ids: ["ann_1", "ann_2"] }
      })
    );

    await expect(p).resolves.toEqual([
      expect.objectContaining({ id: "ann_1", title: "t_ann_1", type: "note" }),
      expect.objectContaining({ id: "ann_2", title: "t_ann_2", type: "note" })
    ]);

    eventBus.destroy();
  });
});

