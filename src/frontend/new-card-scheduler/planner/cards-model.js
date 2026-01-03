import { isValidAnnoToken } from "./token-utils.js";

export function createEmptyCard() {
  return { Q: [], A: [] };
}

export function validateCardsOrThrow(cards) {
  if (!Array.isArray(cards)) {
    throw new Error("cards 必须是数组");
  }
  for (let cardIndex = 0; cardIndex < cards.length; cardIndex += 1) {
    const card = cards[cardIndex];
    if (!card || typeof card !== "object") {
      throw new Error(`cards[${cardIndex}] 必须是对象`);
    }
    if (!Array.isArray(card.Q) || !Array.isArray(card.A)) {
      throw new Error(`cards[${cardIndex}] 必须包含数组字段 Q/A`);
    }
    if (card.Q.length <= 0) {
      throw new Error(`cards[${cardIndex}].Q 不能为空（每张卡必须至少有一个 Q token）`);
    }
    for (const token of card.Q) {
      if (!isValidAnnoToken(token)) {
        throw new Error(`cards[${cardIndex}].Q 存在非法 token: ${String(token)}`);
      }
    }
    for (const token of card.A) {
      if (!isValidAnnoToken(token)) {
        throw new Error(`cards[${cardIndex}].A 存在非法 token: ${String(token)}`);
      }
    }
  }
}

export function createExportPayloadOrThrow({ cards }) {
  validateCardsOrThrow(cards);
  return {
    schemaVersion: 1,
    cards
  };
}

function normalizeFaceOrThrow(face) {
  const f = String(face || "").toUpperCase();
  if (f !== "Q" && f !== "A") {
    throw new Error(`face 必须为 'Q' 或 'A'，当前=${String(face)}`);
  }
  return f;
}

function normalizeTokensOrThrow(tokens) {
  if (!Array.isArray(tokens)) {
    throw new Error("tokens 必须是数组");
  }
  const out = [];
  for (const t of tokens) {
    if (!isValidAnnoToken(t)) {
      throw new Error(`非法 token: ${String(t)}`);
    }
    out.push(t);
  }
  if (out.length === 0) {
    throw new Error("tokens 不能为空");
  }
  return out;
}

export function applyImportOrThrow(state, importRequest) {
  const cards = Array.isArray(state?.cards) ? state.cards : [];
  const activeIndex = Number.isInteger(state?.activeIndex) ? state.activeIndex : -1;

  const op = importRequest?.op;
  if (!op || typeof op !== "object") {
    throw new Error("importRequest.op 必须是对象");
  }

  const kind = String(op.kind || "");
  const face = normalizeFaceOrThrow(op.face);
  const tokens = normalizeTokensOrThrow(importRequest?.tokens);

  if (kind === "merge-new-card") {
    const nextCards = cards.map((c) => ({ Q: [...c.Q], A: [...c.A] }));
    const newCard = createEmptyCard();
    newCard[face].push(...tokens);
    nextCards.push(newCard);
    return { cards: nextCards, activeIndex: nextCards.length - 1 };
  }

  if (kind === "one-per-token") {
    const nextCards = cards.map((c) => ({ Q: [...c.Q], A: [...c.A] }));
    for (const token of tokens) {
      const newCard = createEmptyCard();
      newCard[face].push(token);
      nextCards.push(newCard);
    }
    return { cards: nextCards, activeIndex: nextCards.length - tokens.length };
  }

  if (kind === "append-last-card") {
    if (cards.length <= 0) {
      throw new Error("append-last-card 需要至少存在 1 张卡片");
    }
    const nextCards = cards.map((c) => ({ Q: [...c.Q], A: [...c.A] }));
    nextCards[nextCards.length - 1][face].push(...tokens);
    return { cards: nextCards, activeIndex: nextCards.length - 1 };
  }

  if (kind === "append-active-card") {
    if (cards.length <= 0) {
      throw new Error("append-active-card 需要至少存在 1 张卡片");
    }
    if (!Number.isInteger(activeIndex) || activeIndex < 0 || activeIndex >= cards.length) {
      throw new Error("append-active-card 需要一个有效的 activeIndex");
    }
    const nextCards = cards.map((c) => ({ Q: [...c.Q], A: [...c.A] }));
    nextCards[activeIndex][face].push(...tokens);
    return { cards: nextCards, activeIndex };
  }

  throw new Error(`未知导入操作 kind=${kind}`);
}

export function moveTokenOrThrow(state, move) {
  const cards = Array.isArray(state?.cards) ? state.cards : [];
  if (!Array.isArray(cards) || cards.length === 0) {
    throw new Error("当前没有卡片，无法移动 token");
  }

  const from = move?.from;
  const to = move?.to;
  const copy = !!move?.copy;
  if (!from || !to) {
    throw new Error("moveToken 需要 from/to");
  }

  const fromCardIndex = Number(from.cardIndex);
  const fromFace = normalizeFaceOrThrow(from.face);
  const fromTokenIndex = Number(from.tokenIndex);
  const toCardIndex = Number(to.cardIndex);
  const toFace = normalizeFaceOrThrow(to.face);
  const toTokenIndex = Number.isInteger(to.tokenIndex) ? to.tokenIndex : null;

  if (!Number.isInteger(fromCardIndex) || fromCardIndex < 0 || fromCardIndex >= cards.length) {
    throw new Error("from.cardIndex 无效");
  }
  if (!Number.isInteger(toCardIndex) || toCardIndex < 0 || toCardIndex >= cards.length) {
    throw new Error("to.cardIndex 无效");
  }

  const fromList = cards[fromCardIndex][fromFace];
  if (!Array.isArray(fromList)) {
    throw new Error("from.face 列表不存在");
  }
  if (!Number.isInteger(fromTokenIndex) || fromTokenIndex < 0 || fromTokenIndex >= fromList.length) {
    throw new Error("from.tokenIndex 无效");
  }

  const token = fromList[fromTokenIndex];
  if (!isValidAnnoToken(token)) {
    throw new Error("from.token 不是合法 token");
  }

  const nextCards = cards.map((c) => ({ Q: [...c.Q], A: [...c.A] }));

  if (!copy) {
    nextCards[fromCardIndex][fromFace].splice(fromTokenIndex, 1);
  }

  const targetList = nextCards[toCardIndex][toFace];
  if (!Array.isArray(targetList)) {
    throw new Error("to.face 列表不存在");
  }

  if (toTokenIndex === null) {
    targetList.push(token);
  } else {
    if (!Number.isInteger(toTokenIndex) || toTokenIndex < 0 || toTokenIndex > targetList.length) {
      throw new Error("to.tokenIndex 无效");
    }
    targetList.splice(toTokenIndex, 0, token);
  }

  return {
    cards: nextCards,
    activeIndex: Number.isInteger(state?.activeIndex) ? state.activeIndex : -1
  };
}

