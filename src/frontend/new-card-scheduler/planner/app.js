import { CARD_PLANNER_MESSAGE_TYPES } from "./card-planner-message-types.js";
import { generateRequestId } from "../../common/ws/ws-client-requests.js";
import { WEBSOCKET_EVENTS } from "../../common/event/event-constants.js";
import { createPlannerWorkspaceUI } from "./ui/workspace.js";
import { installPasteWiring } from "./wiring/paste-wiring.js";
import { installMsgCenterWiring } from "./wiring/msgcenter-wiring.js";
import { createAnnotationMetaAdapter } from "./adapters/annotation-meta-adapter.js";

function assertNonEmptyStringArrayOrThrow(arr, name) {
  if (!Array.isArray(arr)) {
    throw new Error(`${name} 必须是数组`);
  }
  if (arr.length === 0) {
    throw new Error(`${name} 不能为空数组`);
  }
  for (let i = 0; i < arr.length; i += 1) {
    const v = arr[i];
    if (typeof v !== "string" || !v.trim()) {
      throw new Error(`${name}[${i}] 必须为非空字符串`);
    }
  }
}

function validateFinalOutputPayloadOrThrow(payload) {
  const cards = payload?.cards;
  if (!Array.isArray(cards)) {
    throw new Error("final-output payload.cards 必须是数组");
  }
  for (let i = 0; i < cards.length; i += 1) {
    const c = cards[i];
    if (!c || typeof c !== "object") {
      throw new Error(`final-output cards[${i}] 必须是对象`);
    }
    if (typeof c.title !== "string") {
      throw new Error(`final-output cards[${i}].title 必须为 string`);
    }
    if (!Array.isArray(c.Q) || !Array.isArray(c.A)) {
      throw new Error(`final-output cards[${i}] 必须包含数组字段 Q/A`);
    }
    for (const v of c.Q) {
      if (typeof v !== "string") {
        throw new Error(`final-output cards[${i}].Q 元素必须为 string`);
      }
    }
    for (const v of c.A) {
      if (typeof v !== "string") {
        throw new Error(`final-output cards[${i}].A 元素必须为 string`);
      }
    }
  }
}

function mountFinalOutputButton({ engine, wsClient, notification, onRequestSent }) {
  const slot = document.getElementById("planner-layout-switcher");
  if (!slot) {
    throw new Error("缺少 #planner-layout-switcher，无法挂载操作按钮");
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn";
  btn.textContent = "发射最终制卡信息";
  btn.title = "向 MsgCenter 发射 card-planner:final-output:requested";

  btn.addEventListener("click", () => {
    try {
      const cards = engine.toFinalCards();
      const payload = { cards };
      validateFinalOutputPayloadOrThrow(payload);

      const rid = generateRequestId();
      const timestamp = Date.now();

      wsClient.send({
        type: CARD_PLANNER_MESSAGE_TYPES.FINAL_OUTPUT_REQUESTED,
        request_id: rid,
        timestamp,
        to: "backend",
        data: payload
      });

      try { onRequestSent?.({ requestId: rid, cardsCount: cards.length }); } catch { /* ignore */ }
      notification?.showInfo?.(`已发射最终制卡信息：${cards.length} 张`, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      notification?.showError?.(`发射失败：${msg}`, 3500);
    }
  });

  slot.innerHTML = "";
  slot.appendChild(btn);
}

export function createCardPlannerApp({ root, engine, wsClient, eventBus, logger, notification }) {
  if (!root) {
    throw new Error("createCardPlannerApp: root 必填");
  }
  if (!engine) {
    throw new Error("createCardPlannerApp: engine 必填");
  }
  if (!wsClient) {
    throw new Error("createCardPlannerApp: wsClient 必填");
  }
  if (!eventBus) {
    throw new Error("createCardPlannerApp: eventBus 必填");
  }
  if (!notification || typeof notification.showInfo !== "function" || typeof notification.showError !== "function") {
    throw new Error("createCardPlannerApp: notification.showInfo/showError 必填");
  }

  const metaAdapter = createAnnotationMetaAdapter({
    mode: "ws",
    wsClient,
    eventBus,
    logger
  });

  const metaByAnnId = new Map();
  const metaErrorToast = {
    lastMessage: null,
    lastTs: 0
  };

  const onAfterIngestApplied = async ({ annotationIds }) => {
    assertNonEmptyStringArrayOrThrow(annotationIds, "annotationIds");
    try {
      const annotations = await metaAdapter.getBulkOrThrow(annotationIds);
      for (const a of annotations) {
        const id = a?.id;
        if (typeof id === "string" && id.trim()) {
          metaByAnnId.set(id, a);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger?.warn?.("[CardPlanner] annotation meta fetch failed", e);
      try {
        const now = Date.now();
        const toastMsg = `标注元信息拉取失败：${msg}`;
        const withinWindow = metaErrorToast.lastMessage === toastMsg && (now - metaErrorToast.lastTs) < 2000;
        if (!withinWindow) {
          metaErrorToast.lastMessage = toastMsg;
          metaErrorToast.lastTs = now;
          notification?.showError?.(toastMsg, 3500);
        }
      } catch {
        // ignore
      }
    }
  };

  const getCardMetaPreview = (tempId) => {
    const snapshot = engine.getDraftCardsSnapshotOrThrow();
    const card = snapshot.find((c) => c.tempId === tempId);
    if (!card) {
      throw new Error(`getCardMetaPreview: 未找到 tempId=${tempId} 的草稿卡`);
    }
    const q = Array.isArray(card.Q) ? card.Q : [];
    const a = Array.isArray(card.A) ? card.A : [];
    return {
      Q: q.map((id) => metaByAnnId.get(id) || { id, title: id, type: "unknown" }),
      A: a.map((id) => metaByAnnId.get(id) || { id, title: id, type: "unknown" }),
    };
  };

  const workspace = createPlannerWorkspaceUI({
    root,
    engine,
    getCardMetaPreview,
    notification
  });

  let lastFinalOutputRequestId = null;
  const unsubscribeFinalOutputAck = eventBus.on(
    WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
    (msg) => {
      const type = String(msg?.type || "");
      const rid = msg?.request_id;
      if (!lastFinalOutputRequestId) {
        return;
      }
      if (rid !== lastFinalOutputRequestId) {
        return;
      }

      if (type === CARD_PLANNER_MESSAGE_TYPES.FINAL_OUTPUT_COMPLETED) {
        lastFinalOutputRequestId = null;
        const count = Number.isFinite(msg?.data?.count)
          ? Number(msg.data.count)
          : (Array.isArray(msg?.data?.cards) ? msg.data.cards.length : null);
        const text = typeof msg?.data?.message === "string" ? msg.data.message : "";
        const suffix = count !== null ? `：${count} 张` : "";
        const main = text.trim() ? text.trim() : `最终制卡信息已确认${suffix}`;
        notification.showInfo(main, 2500);
        return;
      }

      if (type === CARD_PLANNER_MESSAGE_TYPES.FINAL_OUTPUT_FAILED) {
        lastFinalOutputRequestId = null;
        const errMsg = msg?.error?.message || msg?.data?.message || "未知原因";
        notification.showError(`最终制卡信息失败：${errMsg}`, 3500);
      }
    },
    { subscriberId: "CardPlanner.FinalOutputAck" }
  );

  // UI 按钮：发射最终制卡信息
  mountFinalOutputButton({
    engine,
    wsClient,
    notification,
    onRequestSent: ({ requestId }) => {
      lastFinalOutputRequestId = requestId;
    }
  });

  // Wiring：粘贴插入（Ctrl+V）
  const uninstallPaste = installPasteWiring({
    engine,
    getPasteFocus: () => workspace.getPasteFocus(),
    render: () => workspace.render(),
    notification,
    onAfterIngestApplied: async (info) => {
      await onAfterIngestApplied(info);
    },
  });

  // Wiring：MsgCenter 消息收发（按契约第 7 节）
  const uninstallMsgCenter = installMsgCenterWiring({
    eventBus,
    wsClient,
    engine,
    logger,
    notification,
    render: () => workspace.render(),
    onAfterIngestApplied: async (info) => {
      await onAfterIngestApplied(info);
    }
  });

  logger?.info?.("[CardPlanner] app mounted");

  return {
    dispose() {
      try { unsubscribeFinalOutputAck?.(); } catch { /* ignore */ }
      try { uninstallPaste?.(); } catch { /* ignore */ }
      try { uninstallMsgCenter?.(); } catch { /* ignore */ }
      try { workspace?.dispose?.(); } catch { /* ignore */ }
      logger?.info?.("[CardPlanner] app disposed");
    }
  };
}
