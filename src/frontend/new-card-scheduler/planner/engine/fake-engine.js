function assertNonEmptyStringArrayOrThrow(arr, name) {
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

function normalizeFaceOrThrow(face) {
  const f = String(face || "").toUpperCase();
  if (f !== "Q" && f !== "A") {
    throw new Error(`face 必须为 'Q' 或 'A'，当前=${String(face)}`);
  }
  return f;
}

function cloneCards(cards) {
  return cards.map((c) => ({
    tempId: c.tempId,
    title: c.title,
    Q: [...c.Q],
    A: [...c.A]
  }));
}

function createCard({ tempId, title = "" } = {}) {
  if (typeof tempId !== "string" || !tempId.trim()) {
    throw new Error("tempId 必须是非空字符串");
  }
  if (typeof title !== "string") {
    throw new Error("title 必须是 string");
  }
  return { tempId, title, Q: [], A: [] };
}

function reorderOrThrow(list, fromIndex, toIndex) {
  const from = Number(fromIndex);
  const to = Number(toIndex);
  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    throw new Error("reorderCards: fromIndex/toIndex 必须是整数");
  }
  if (from < 0 || from >= list.length) {
    throw new Error("reorderCards: fromIndex 越界");
  }
  if (to < 0 || to >= list.length) {
    throw new Error("reorderCards: toIndex 越界");
  }
  if (from === to) {
    return list;
  }
  const out = [...list];
  const [moved] = out.splice(from, 1);
  out.splice(to, 0, moved);
  return out;
}

function getCardIndexByTempIdOrThrow(cards, tempId) {
  if (typeof tempId !== "string" || !tempId.trim()) {
    throw new Error("tempId 必须是非空字符串");
  }
  const idx = cards.findIndex((c) => c.tempId === tempId);
  if (idx < 0) {
    throw new Error(`未找到 tempId=${tempId} 对应的草稿卡`);
  }
  return idx;
}

function applyIngestOrThrow(state, payload) {
  const op = payload?.op;
  const annotationIds = payload?.annotationIds;

  if (!op || typeof op !== "object") {
    throw new Error("op 必须是对象");
  }

  const kind = String(op.kind || "");
  const target = op.target;
  if (!target || typeof target !== "object") {
    throw new Error("op.target 必须是对象");
  }

  assertNonEmptyStringArrayOrThrow(annotationIds, "annotationIds");
  const next = {
    cards: cloneCards(state.cards),
    selectedTempId: state.selectedTempId
  };

  const ensureNewCardSelected = () => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const card = createCard({ tempId, title: "" });
    next.cards.push(card);
    next.selectedTempId = card.tempId;
    return card;
  };

  const resolveTargetCardIndexOrThrow = () => {
    const tKind = String(target.kind || "");
    if (tKind === "new") {
      const card = ensureNewCardSelected();
      return getCardIndexByTempIdOrThrow(next.cards, card.tempId);
    }
    if (tKind === "last") {
      if (next.cards.length === 0) {
        const card = ensureNewCardSelected();
        return getCardIndexByTempIdOrThrow(next.cards, card.tempId);
      }
      if (!next.selectedTempId) {
        return next.cards.length - 1;
      }
      const selIdx = getCardIndexByTempIdOrThrow(next.cards, next.selectedTempId);
      if (selIdx === 0) {
        throw new Error("target=last: 选中的是第 0 张，无法取上一张");
      }
      return selIdx - 1;
    }
    if (tKind === "new-index") {
      const x = target.x;
      const idx = Number(x);
      if (!Number.isInteger(idx) || idx < 0) {
        throw new Error("target=new-index: x 必须是 >=0 的整数");
      }
      if (idx >= next.cards.length) {
        throw new Error(`target=new-index: 第 ${idx} 张不存在`);
      }
      next.selectedTempId = next.cards[idx].tempId;
      return idx;
    }
    if (tKind === "card-id") {
      const tempId = target.tempId;
      const idx = getCardIndexByTempIdOrThrow(next.cards, tempId);
      next.selectedTempId = tempId;
      return idx;
    }
    throw new Error(`未知 target.kind=${String(target.kind)}`);
  };

  if (kind === "all-to-one") {
    const face = normalizeFaceOrThrow(op.face);
    const idx = resolveTargetCardIndexOrThrow();
    next.cards[idx][face].push(...annotationIds);
    return next;
  }

  if (kind === "one-per-new") {
    const face = normalizeFaceOrThrow(op.face);
    for (const annId of annotationIds) {
      const card = ensureNewCardSelected();
      card[face].push(annId);
    }
    return next;
  }

  if (kind === "alternate-faces") {
    const startFace = op.startFace ? normalizeFaceOrThrow(op.startFace) : "Q";
    let face = startFace;

    // 规则：必要时自动创建新卡（在当前没有卡时先创建 1 张）
    if (next.cards.length === 0) {
      ensureNewCardSelected();
    }
    let idx = resolveTargetCardIndexOrThrow();

    for (const annId of annotationIds) {
      if (idx >= next.cards.length) {
        idx = resolveTargetCardIndexOrThrow();
      }
      next.cards[idx][face].push(annId);
      face = face === "Q" ? "A" : "Q";

      // 交替写入：当刚写入 A 后，下一个 token 需要新卡（保证 QA 成对落在同一卡的直觉）
      if (face === startFace && annId !== annotationIds[annotationIds.length - 1]) {
        idx = resolveTargetCardIndexOrThrow();
      }
    }

    return next;
  }

  throw new Error(`未知 op.kind=${kind}`);
}

function validateFinalCardsOrThrow(cards) {
  if (!Array.isArray(cards)) {
    throw new Error("cards 必须是数组");
  }
  for (let i = 0; i < cards.length; i += 1) {
    const c = cards[i];
    if (!c || typeof c !== "object") {
      throw new Error(`cards[${i}] 必须是对象`);
    }
    if (typeof c.title !== "string") {
      throw new Error(`cards[${i}].title 必须为 string`);
    }
    if (!Array.isArray(c.Q) || !Array.isArray(c.A)) {
      throw new Error(`cards[${i}] 必须包含数组字段 Q/A`);
    }
    for (const v of c.Q) {
      if (typeof v !== "string") {
        throw new Error(`cards[${i}].Q 元素必须为 string`);
      }
    }
    for (const v of c.A) {
      if (typeof v !== "string") {
        throw new Error(`cards[${i}].A 元素必须为 string`);
      }
    }
    if (c.Q.length === 0 && c.A.length === 0) {
      throw new Error(`cards[${i}] 无意义：Q/A 同时为空`);
    }
  }
}

/**
 * FakeEngine：供 H 任务 UI/测试独立推进。
 * 注意：算法实现最终由 G 负责替换，本文件只保证契约行为与 Fail-Fast。
 */
export function createFakeEngine() {
  /** @type {{cards:Array<any>, selectedTempId:(string|null)}} */
  let state = {
    cards: [createCard({ tempId: "temp-1", title: "" })],
    selectedTempId: null
  };
  let nextTempId = 2;

  const getState = () => ({
    draftCardTempIds: state.cards.map((c) => c.tempId),
    selectedTempId: state.selectedTempId
  });

  const getCardsForView = () => state.cards.map((c) => ({
    tempId: c.tempId,
    title: c.title,
    QCount: c.Q.length,
    ACount: c.A.length
  }));

  const getDraftCardsSnapshotOrThrow = () => state.cards.map((c) => ({
    tempId: c.tempId,
    title: c.title,
    Q: [...c.Q],
    A: [...c.A]
  }));

  const setSelected = (tempIdOrNull) => {
    if (tempIdOrNull === null) {
      state = { ...state, selectedTempId: null };
      return;
    }
    const idx = getCardIndexByTempIdOrThrow(state.cards, tempIdOrNull);
    void idx;
    state = { ...state, selectedTempId: tempIdOrNull };
  };

  const renameCard = (tempId, title) => {
    const idx = getCardIndexByTempIdOrThrow(state.cards, tempId);
    if (typeof title !== "string") {
      throw new Error("title 必须是 string");
    }
    const cards = cloneCards(state.cards);
    cards[idx].title = title;
    state = { ...state, cards };
  };

  const deleteCard = (tempId) => {
    const idx = getCardIndexByTempIdOrThrow(state.cards, tempId);
    const cards = cloneCards(state.cards);
    cards.splice(idx, 1);
    const selectedTempId = state.selectedTempId === tempId ? null : state.selectedTempId;
    state = { ...state, cards, selectedTempId };
  };

  const reorderCards = (fromIndex, toIndex) => {
    const cards = reorderOrThrow(cloneCards(state.cards), fromIndex, toIndex);
    state = { ...state, cards };
  };

  const createEmptyCardOrThrow = () => {
    const tempId = `temp-${nextTempId}`;
    nextTempId += 1;
    const cards = [...cloneCards(state.cards), createCard({ tempId, title: "" })];
    state = { ...state, cards, selectedTempId: tempId };
    return tempId;
  };

  const resetDraftCardsOrThrow = () => {
    state = { ...state, cards: [], selectedTempId: null };
    nextTempId = 1;
  };

  const dispatchIngest = ({ op, annotationIds }) => {
    state = applyIngestOrThrow(state, { op, annotationIds });
  };

  const toFinalCards = () => {
    const cards = state.cards.map((c) => ({
      title: c.title,
      Q: [...c.Q],
      A: [...c.A]
    }));
    validateFinalCardsOrThrow(cards);
    return cards;
  };

  return {
    getState,
    getCardsForView,
    getDraftCardsSnapshotOrThrow,
    createEmptyCardOrThrow,
    resetDraftCardsOrThrow,
    dispatchIngest,
    setSelected,
    renameCard,
    deleteCard,
    reorderCards,
    toFinalCards,
  };
}
