import { WEBSOCKET_EVENTS } from "../../../common/event/event-constants.js";
import { CARD_PLANNER_MESSAGE_TYPES } from "../card-planner-message-types.js";

function assertStringArrayOrThrow(arr, name) {
  if (!Array.isArray(arr)) {
    throw new Error(`${name} 必须是数组`);
  }
  for (let i = 0; i < arr.length; i += 1) {
    if (typeof arr[i] !== "string") {
      throw new Error(`${name}[${i}] 必须为 string`);
    }
  }
}

function respond(wsClient, { type, request_id, data, error }) {
  const msg = { type, request_id };
  if (data !== undefined) {
    msg.data = data;
  }
  if (error !== undefined) {
    msg.error = error;
  }
  wsClient.send(msg);
}

export function installMsgCenterWiring({
  eventBus,
  wsClient,
  engine,
  logger,
  notification = null,
  render = null,
  onAfterIngestApplied = null
}) {
  if (!eventBus) {
    throw new Error("installMsgCenterWiring: eventBus 必填");
  }
  if (!wsClient || typeof wsClient.send !== "function") {
    throw new Error("installMsgCenterWiring: wsClient.send 必填");
  }
  if (!engine) {
    throw new Error("installMsgCenterWiring: engine 必填");
  }
  if (notification !== null) {
    if (!notification || typeof notification !== "object") {
      throw new Error("installMsgCenterWiring: notification 必须为对象或 null");
    }
    if (typeof notification.showInfo !== "function" || typeof notification.showError !== "function") {
      throw new Error("installMsgCenterWiring: notification.showInfo/showError 必填（或传 null）");
    }
  }
  if (render !== null && typeof render !== "function") {
    throw new Error("installMsgCenterWiring: render 必须为函数或 null");
  }
  if (onAfterIngestApplied !== null && typeof onAfterIngestApplied !== "function") {
    throw new Error("installMsgCenterWiring: onAfterIngestApplied 必须为函数或 null");
  }

  const unsubscribe = eventBus.on(
    WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
    (message) => {
      const type = String(message?.type || "");
      const rid = message?.request_id;

      if (type === CARD_PLANNER_MESSAGE_TYPES.INGEST_REQUESTED) {
        try {
          const op = message?.data?.op;
          const annotationIds = message?.data?.annotation_ids;
          if (!op || typeof op !== "object") {
            throw new Error("ingest: data.op 必须为对象");
          }
          assertStringArrayOrThrow(annotationIds, "data.annotation_ids");

          engine.dispatchIngest({
            op,
            annotationIds
          });

          try {
            respond(wsClient, {
              type: CARD_PLANNER_MESSAGE_TYPES.INGEST_COMPLETED,
              request_id: rid,
              data: engine.getState()
            });
          } catch (e) {
            logger?.warn?.("[CardPlanner] ingest completed ack send failed", e);
          }

          try {
            const p = onAfterIngestApplied?.({ annotationIds, face: op?.face, op });
            if (p && typeof p.then === "function") {
              p.catch((e) => logger?.warn?.("[CardPlanner] onAfterIngestApplied failed", e));
            }
          } catch (e) {
            logger?.warn?.("[CardPlanner] onAfterIngestApplied failed", e);
          }

          try { render?.(); } catch { /* ignore */ }

          const face = String(op?.face || "").toUpperCase();
          const faceLabel = face === "Q" || face === "A" ? face : "Q/A";
          notification?.showInfo?.(`已注入 ${annotationIds.length} 个标注到 ${faceLabel}`, 2000);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger?.warn?.("[CardPlanner] ingest failed", err);
          try {
            respond(wsClient, {
              type: CARD_PLANNER_MESSAGE_TYPES.INGEST_FAILED,
              request_id: rid,
              error: { message: msg }
            });
          } catch (e) {
            logger?.warn?.("[CardPlanner] ingest failed ack send failed", e);
          }
          notification?.showError?.(`注入失败：${msg}`, 3500);
        }
        return;
      }

      if (type === CARD_PLANNER_MESSAGE_TYPES.STATE_GET_REQUESTED) {
        try {
          respond(wsClient, {
            type: CARD_PLANNER_MESSAGE_TYPES.STATE_GET_COMPLETED,
            request_id: rid,
            data: engine.getState()
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger?.warn?.("[CardPlanner] state:get failed", err);
          respond(wsClient, {
            // 契约未定义 state:get:failed：保持 completed 类型，但携带明确 error
            type: CARD_PLANNER_MESSAGE_TYPES.STATE_GET_COMPLETED,
            request_id: rid,
            error: { message: msg }
          });
        }
      }
    },
    { subscriberId: "CardPlanner.MsgCenterWiring" }
  );

  return () => {
    try { unsubscribe(); } catch { /* ignore */ }
  };
}
