import { CARD_PLANNER_MESSAGE_TYPES } from "./card-planner-message-types.js";
import { createPlannerWorkspaceUI } from "./ui/workspace.js";
import { installPasteWiring } from "./wiring/paste-wiring.js";
import { installMsgCenterWiring } from "./wiring/msgcenter-wiring.js";
import { createAnnotationMetaAdapter } from "./adapters/annotation-meta-adapter.js";

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

function mountFinalOutputButton({ engine, wsClient, notification }) {
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

      wsClient.send({
        type: CARD_PLANNER_MESSAGE_TYPES.FINAL_OUTPUT_REQUESTED,
        data: payload
      });

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

  const metaAdapter = createAnnotationMetaAdapter({
    mode: "mock",
    wsClient,
    eventBus,
    logger
  });

  const shadowByTempId = new Map();
  const metaByAnnId = new Map();

  const ensureShadow = (tempId) => {
    if (!shadowByTempId.has(tempId)) {
      shadowByTempId.set(tempId, { Q: [], A: [] });
    }
    return shadowByTempId.get(tempId);
  };

  const onAfterIngestApplied = async ({ tempId, face, annotationIds }) => {
    if (typeof tempId !== "string" || !tempId.trim()) {
      return;
    }
    const f = String(face || "").toUpperCase();
    if (f !== "Q" && f !== "A") {
      return;
    }
    if (!Array.isArray(annotationIds) || annotationIds.length === 0) {
      return;
    }

    const shadow = ensureShadow(tempId);
    shadow[f].push(...annotationIds);

    try {
      const annotations = await metaAdapter.getBulkOrThrow(annotationIds);
      for (const a of annotations) {
        const id = a?.id;
        if (typeof id === "string" && id.trim()) {
          metaByAnnId.set(id, a);
        }
      }
    } catch (e) {
      logger?.warn?.("[CardPlanner] annotation meta fetch failed (ignored for dev)", e);
    }
  };

  const getCardMetaPreview = (tempId) => {
    const shadow = shadowByTempId.get(tempId);
    const q = Array.isArray(shadow?.Q) ? shadow.Q : [];
    const a = Array.isArray(shadow?.A) ? shadow.A : [];
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

  // UI 按钮：发射最终制卡信息
  mountFinalOutputButton({ engine, wsClient, notification });

  // Wiring：粘贴插入（Ctrl+V）
  const uninstallPaste = installPasteWiring({
    engine,
    getPasteFocus: () => workspace.getPasteFocus(),
    render: () => workspace.render(),
    notification,
    onAfterIngestApplied: async (info) => {
      await onAfterIngestApplied(info);
      workspace.render();
    }
  });

  // Wiring：MsgCenter 消息收发（按契约第 7 节）
  const uninstallMsgCenter = installMsgCenterWiring({
    eventBus,
    wsClient,
    engine,
    logger,
    onAfterIngestApplied: async (info) => {
      await onAfterIngestApplied(info);
      workspace.render();
    }
  });

  logger?.info?.("[CardPlanner] app mounted");

  return {
    dispose() {
      try { uninstallPaste?.(); } catch { /* ignore */ }
      try { uninstallMsgCenter?.(); } catch { /* ignore */ }
      try { workspace?.dispose?.(); } catch { /* ignore */ }
      logger?.info?.("[CardPlanner] app disposed");
    }
  };
}
