function normalizeFaceOrThrow(face, label = "face") {
  const f = String(face || "").toUpperCase();
  if (f !== "Q" && f !== "A") {
    throw new Error(`${label} 必须为 'Q' 或 'A'，当前=${String(face)}`);
  }
  return f;
}

function validateAnnotationIdOrThrow(annotationId) {
  if (typeof annotationId !== "string") {
    throw new Error(`annotation-id 必须为 string，当前=${String(annotationId)}`);
  }
  if (annotationId !== annotationId.trim()) {
    throw new Error(`annotation-id 不允许包含首尾空白：${JSON.stringify(annotationId)}`);
  }
  if (!annotationId) {
    throw new Error("annotation-id 不能为空");
  }
  if (annotationId.includes("\n") || annotationId.includes("\r")) {
    throw new Error("annotation-id 不允许包含换行");
  }
}

function normalizeAnnotationIdsOrThrow(annotationIds) {
  if (!Array.isArray(annotationIds)) {
    throw new Error("annotation_ids 必须是数组");
  }
  const out = [];
  for (const id of annotationIds) {
    validateAnnotationIdOrThrow(id);
    out.push(id);
  }
  return out;
}

function createDraftCardOrThrow(tempId) {
  if (typeof tempId !== "string" || !tempId) {
    throw new Error("tempId 必须为非空 string");
  }
  return {
    tempId,
    title: "",
    Q: [],
    A: []
  };
}

function cloneFinalCardOrThrow(card) {
  if (!card || typeof card !== "object") {
    throw new Error("card 必须是对象");
  }
  if (typeof card.title !== "string") {
    throw new Error("card.title 必须为 string");
  }
  if (!Array.isArray(card.Q) || !Array.isArray(card.A)) {
    throw new Error("card.Q/card.A 必须为数组");
  }
  return {
    title: card.title,
    Q: [...card.Q],
    A: [...card.A]
  };
}

function validateTitleOrThrow(title) {
  if (typeof title !== "string") {
    throw new Error(`title 必须为 string，当前=${String(title)}`);
  }
}

function validateTargetOrThrow(target) {
  if (!target || typeof target !== "object") {
    throw new Error("target 必须是对象");
  }
  const kind = String(target.kind || "");
  if (kind !== "new" && kind !== "last" && kind !== "new-index" && kind !== "card-id") {
    throw new Error(`target.kind 无效：${String(target.kind)}`);
  }
  if (kind === "new-index") {
    const x = target.x;
    if (!Number.isInteger(x) || x < 0) {
      throw new Error(`target.x 必须为 >=0 的整数，当前=${String(x)}`);
    }
  }
  if (kind === "card-id") {
    if (typeof target.tempId !== "string" || !target.tempId) {
      throw new Error("target.tempId 必须为非空 string");
    }
  }
  return kind;
}

function validateOpOrThrow(op) {
  if (!op || typeof op !== "object") {
    throw new Error("op 必须是对象");
  }
  const kind = String(op.kind || "");
  if (kind !== "all-to-one" && kind !== "one-per-new" && kind !== "alternate-faces") {
    throw new Error(`op.kind 无效：${String(op.kind)}`);
  }
  const targetKind = validateTargetOrThrow(op.target);

  if (kind === "alternate-faces") {
    // face 必须忽略（契约要求）；startFace 可选
    return { kind, targetKind };
  }

  normalizeFaceOrThrow(op.face);
  return { kind, targetKind };
}

function createTempId(nextTempId) {
  return `temp-${nextTempId}`;
}

export class CardsEngine {
  #cards = [];
  #selectedTempId = null;
  #createdSeqByTempId = new Map();
  #nextCreatedSeq = 1;
  #nextTempId = 1;

  // 兼容 UI 侧最小接口（H 任务定义）：统一用这些无 *OrThrow 后缀的方法对接。
  // 约束：Fail-Fast；任何非法输入直接抛错（不做兜底）。
  getState() {
    return this.getStateOrThrow();
  }

  getCardsForView() {
    return this.#cards.map((c) => ({
      tempId: c.tempId,
      title: c.title,
      QCount: c.Q.length,
      ACount: c.A.length
    }));
  }

  dispatchIngest({ op, annotationIds }) {
    return this.ingestOrThrow({
      op,
      annotation_ids: annotationIds
    });
  }

  setSelected(tempIdOrNull) {
    return this.selectCardOrThrow(tempIdOrNull);
  }

  renameCard(tempId, title) {
    return this.renameCardTitleOrThrow(tempId, title);
  }

  deleteCard(tempId) {
    return this.deleteCardOrThrow(tempId);
  }

  reorderCards(fromIndex, toIndex) {
    return this.reorderCardsOrThrow({ fromIndex, toIndex });
  }

  toFinalCards() {
    return this.toFinalCardsOrThrow();
  }

  createCardOrThrow() {
    const tempId = createTempId(this.#nextTempId);
    this.#nextTempId += 1;

    const card = createDraftCardOrThrow(tempId);
    this.#cards.push(card);
    this.#createdSeqByTempId.set(tempId, this.#nextCreatedSeq);
    this.#nextCreatedSeq += 1;
    return tempId;
  }

  deleteCardOrThrow(tempId) {
    const index = this.#getCardIndexByTempIdOrThrow(tempId);
    this.#cards.splice(index, 1);
    this.#createdSeqByTempId.delete(tempId);
    if (this.#selectedTempId === tempId) {
      this.#selectedTempId = null;
    }
  }

  renameCardTitleOrThrow(tempId, title) {
    validateTitleOrThrow(title);
    const index = this.#getCardIndexByTempIdOrThrow(tempId);
    this.#cards[index].title = title;
  }

  reorderCardsOrThrow({ fromIndex, toIndex }) {
    if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) {
      throw new Error("fromIndex/toIndex 必须为整数");
    }
    if (fromIndex < 0 || fromIndex >= this.#cards.length) {
      throw new Error(`fromIndex 越界：${String(fromIndex)}`);
    }
    if (toIndex < 0 || toIndex >= this.#cards.length) {
      throw new Error(`toIndex 越界：${String(toIndex)}`);
    }
    if (fromIndex === toIndex) {
      return;
    }
    const [card] = this.#cards.splice(fromIndex, 1);
    this.#cards.splice(toIndex, 0, card);
  }

  selectCardOrThrow(tempIdOrNull) {
    if (tempIdOrNull === null) {
      this.#selectedTempId = null;
      return;
    }
    if (typeof tempIdOrNull !== "string" || !tempIdOrNull) {
      throw new Error("selectedTempId 必须为 string 或 null");
    }
    this.#getCardIndexByTempIdOrThrow(tempIdOrNull);
    this.#selectedTempId = tempIdOrNull;
  }

  getStateOrThrow() {
    return {
      draftCardTempIds: this.#cards.map((c) => c.tempId),
      selectedTempId: this.#selectedTempId
    };
  }

  toFinalCardsOrThrow() {
    return this.#cards.map(cloneFinalCardOrThrow);
  }

  ingestOrThrow(request) {
    const op = request?.op;
    const { kind } = validateOpOrThrow(op);
    const annotationIds = normalizeAnnotationIdsOrThrow(request?.annotation_ids);

    if (kind === "all-to-one") {
      const face = normalizeFaceOrThrow(op.face);
      const targetIndex = this.#resolveTargetIndexOrThrow(op.target);
      this.#cards[targetIndex][face].push(...annotationIds);
      return;
    }

    if (kind === "one-per-new") {
      const face = normalizeFaceOrThrow(op.face);
      for (const id of annotationIds) {
        const tempId = this.createCardOrThrow();
        const index = this.#getCardIndexByTempIdOrThrow(tempId);
        this.#cards[index][face].push(id);
      }
      return;
    }

    if (kind === "alternate-faces") {
      const startFace = normalizeFaceOrThrow(op.startFace ?? "Q", "startFace");
      const targetIndex = this.#resolveTargetIndexOrThrow(op.target);

      for (let i = 0; i < annotationIds.length; i += 1) {
        const cardOffset = Math.floor(i / 2);
        const face = (i % 2 === 0) ? startFace : (startFace === "Q" ? "A" : "Q");
        const requiredIndex = targetIndex + cardOffset;
        this.#ensureCardIndexExistsOrThrow(requiredIndex);
        this.#cards[requiredIndex][face].push(annotationIds[i]);
      }
      return;
    }

    throw new Error(`未知 op.kind=${String(op?.kind)}`);
  }

  #ensureCardIndexExistsOrThrow(index) {
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(`card index 无效：${String(index)}`);
    }
    while (this.#cards.length <= index) {
      this.createCardOrThrow();
    }
  }

  #getCardIndexByTempIdOrThrow(tempId) {
    if (typeof tempId !== "string" || !tempId) {
      throw new Error("tempId 必须为非空 string");
    }
    const index = this.#cards.findIndex((c) => c.tempId === tempId);
    if (index < 0) {
      throw new Error(`草稿卡不存在：tempId=${tempId}`);
    }
    return index;
  }

  #getMostRecentlyCreatedCardIndexOrThrow() {
    if (this.#cards.length <= 0) {
      throw new Error("当前没有草稿卡");
    }
    let bestIndex = -1;
    let bestSeq = -1;
    for (let i = 0; i < this.#cards.length; i += 1) {
      const tempId = this.#cards[i].tempId;
      const seq = this.#createdSeqByTempId.get(tempId);
      if (!Number.isInteger(seq)) {
        throw new Error(`createdSeq 丢失：tempId=${tempId}`);
      }
      if (seq > bestSeq) {
        bestSeq = seq;
        bestIndex = i;
      }
    }
    if (bestIndex < 0) {
      throw new Error("无法定位最近创建的草稿卡");
    }
    return bestIndex;
  }

  #resolveTargetIndexOrThrow(target) {
    const kind = validateTargetOrThrow(target);

    if (kind === "new") {
      const tempId = this.createCardOrThrow();
      return this.#getCardIndexByTempIdOrThrow(tempId);
    }

    if (kind === "new-index") {
      const x = target.x;
      if (x >= this.#cards.length) {
        throw new Error(`newIndex(${x}) 越界：当前卡片数=${this.#cards.length}`);
      }
      return x;
    }

    if (kind === "card-id") {
      return this.#getCardIndexByTempIdOrThrow(target.tempId);
    }

    if (kind === "last") {
      if (this.#selectedTempId === null) {
        if (this.#cards.length <= 0) {
          const tempId = this.createCardOrThrow();
          return this.#getCardIndexByTempIdOrThrow(tempId);
        }
        return this.#getMostRecentlyCreatedCardIndexOrThrow();
      }

      const selectedIndex = this.#getCardIndexByTempIdOrThrow(this.#selectedTempId);
      if (selectedIndex <= 0) {
        throw new Error("last：当前选中为第 0 张卡片，没有上一张");
      }
      return selectedIndex - 1;
    }

    throw new Error(`未知 target.kind=${String(target?.kind)}`);
  }
}

export function createCardsEngine() {
  return new CardsEngine();
}
