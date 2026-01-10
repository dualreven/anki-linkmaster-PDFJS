import { WEBSOCKET_EVENTS } from "../../../common/event/event-constants.js";
import { CARD_PLANNER_MESSAGE_TYPES } from "../card-planner-message-types.js";

function assertStringArrayOrThrow(arr, name) {
  if (!Array.isArray(arr)) {
    throw new Error(`${name} 必须是数组`);
  }
  for (let i = 0; i < arr.length; i += 1) {
    const v = arr[i];
    if (typeof v !== "string" || !v.trim()) {
      throw new Error(`${name}[${i}] 必须是非空字符串`);
    }
  }
}

function createRequestId() {
  return `ncs_bulk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeFailedMessage(msg) {
  const m = msg;
  const errMsg = m?.error?.message || m?.data?.message || m?.message;
  if (typeof errMsg === "string" && errMsg.trim()) {
    return errMsg.trim();
  }
  return "annotation:bulk-get 失败";
}

export function createAnnotationMetaAdapter({
  mode = "mock",
  wsClient,
  eventBus,
  timeoutMs = 2500,
  logger
} = {}) {
  const m = String(mode || "mock");
  if (m !== "mock" && m !== "ws") {
    throw new Error(`AnnotationMetaAdapter.mode 仅支持 mock|ws，当前=${m}`);
  }
  if (m === "ws") {
    if (!wsClient || typeof wsClient.send !== "function") {
      throw new Error("AnnotationMetaAdapter(mode=ws) 需要 wsClient.send");
    }
    if (!eventBus) {
      throw new Error("AnnotationMetaAdapter(mode=ws) 需要 eventBus");
    }
  }

  async function getBulkOrThrow(annIds) {
    assertStringArrayOrThrow(annIds, "annIds");

    if (m === "mock") {
      return annIds.map((id) => ({
        id,
        title: `(mock) ${id}`,
        type: "unknown"
      }));
    }

    const rid = createRequestId();
    const req = {
      type: CARD_PLANNER_MESSAGE_TYPES.ANNOTATION_BULK_GET_REQUESTED,
      request_id: rid,
      to: "backend",
      data: { ann_ids: annIds }
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        try { unsub(); } catch { /* ignore */ }
        reject(new Error("annotation:bulk-get 超时"));
      }, timeoutMs);

      const unsub = eventBus.on(
        WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
        (msg) => {
          const type = String(msg?.type || "");
          const respRid = msg?.request_id;
          if (respRid !== rid) {
            return;
          }

          if (type === CARD_PLANNER_MESSAGE_TYPES.ANNOTATION_BULK_GET_FAILED) {
            clearTimeout(timer);
            try { unsub(); } catch { /* ignore */ }
            reject(new Error(normalizeFailedMessage(msg)));
            return;
          }

          if (type !== CARD_PLANNER_MESSAGE_TYPES.ANNOTATION_BULK_GET_COMPLETED) {
            return;
          }

          const annotations = msg?.data?.annotations;
          if (!Array.isArray(annotations)) {
            reject(new Error("annotation:bulk-get:completed 缺少 data.annotations 数组"));
            return;
          }
          clearTimeout(timer);
          try { unsub(); } catch { /* ignore */ }
          resolve(annotations);
        },
        { subscriberId: `CardPlanner.AnnotationBulkGet.${rid}` }
      );

      try {
        wsClient.send(req);
      } catch (err) {
        clearTimeout(timer);
        try { unsub(); } catch { /* ignore */ }
        logger?.warn?.("[CardPlanner] annotation bulk-get send failed", err);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  return {
    mode: m,
    getBulkOrThrow
  };
}
