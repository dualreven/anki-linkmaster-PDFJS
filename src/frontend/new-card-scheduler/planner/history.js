function cloneStateOrThrow(state) {
  if (!state || typeof state !== "object") {
    throw new Error("state 必须是对象");
  }
  const cards = state.cards;
  if (!Array.isArray(cards)) {
    throw new Error("state.cards 必须是数组");
  }
  return {
    cards: cards.map((c) => ({ Q: [...c.Q], A: [...c.A] })),
    activeIndex: Number.isInteger(state.activeIndex) ? state.activeIndex : -1
  };
}

export function createHistory(initialState) {
  const past = [];
  const future = [];
  let present = cloneStateOrThrow(initialState);

  return {
    get() {
      return cloneStateOrThrow(present);
    },
    replace(nextState) {
      present = cloneStateOrThrow(nextState);
      past.length = 0;
      future.length = 0;
      return this.get();
    },
    push(nextState) {
      past.push(cloneStateOrThrow(present));
      present = cloneStateOrThrow(nextState);
      future.length = 0;
      return this.get();
    },
    canUndo() {
      return past.length > 0;
    },
    canRedo() {
      return future.length > 0;
    },
    undo() {
      if (past.length === 0) {
        throw new Error("没有可撤销的操作");
      }
      const prev = past.pop();
      future.push(cloneStateOrThrow(present));
      present = prev;
      return this.get();
    },
    redo() {
      if (future.length === 0) {
        throw new Error("没有可重做的操作");
      }
      const next = future.pop();
      past.push(cloneStateOrThrow(present));
      present = next;
      return this.get();
    }
  };
}

