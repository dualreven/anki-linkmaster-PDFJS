import { applyImportOrThrow, createEmptyCard, moveTokenOrThrow } from "../cards-model.js";

describe("new-card-scheduler cards-model import", () => {
  test("merge-new-card inserts one card and appends tokens to face", () => {
    const state = { cards: [], activeIndex: -1 };
    const next = applyImportOrThrow(state, {
      schemaVersion: 1,
      op: { kind: "merge-new-card", face: "Q" },
      tokens: ["[[a]]", "[[b]]"]
    });
    expect(next.cards).toEqual([{ Q: ["[[a]]", "[[b]]"], A: [] }]);
    expect(next.activeIndex).toBe(0);
  });

  test("one-per-token creates N cards", () => {
    const state = { cards: [], activeIndex: -1 };
    const next = applyImportOrThrow(state, {
      schemaVersion: 1,
      op: { kind: "one-per-token", face: "A" },
      tokens: ["[[a]]", "[[b]]"]
    });
    expect(next.cards).toEqual([
      { Q: [], A: ["[[a]]"] },
      { Q: [], A: ["[[b]]"] }
    ]);
    expect(next.activeIndex).toBe(0);
  });

  test("append-last-card requires existing card", () => {
    const state = { cards: [], activeIndex: -1 };
    expect(() => applyImportOrThrow(state, {
      schemaVersion: 1,
      op: { kind: "append-last-card", face: "Q" },
      tokens: ["[[a]]"]
    })).toThrow();
  });

  test("moveTokenOrThrow moves or copies between faces", () => {
    const base = { cards: [createEmptyCard()], activeIndex: 0 };
    base.cards[0].Q.push("[[a]]", "[[b]]");

    const moved = moveTokenOrThrow(base, {
      copy: false,
      from: { cardIndex: 0, face: "Q", tokenIndex: 0 },
      to: { cardIndex: 0, face: "A", tokenIndex: 0 }
    });
    expect(moved.cards[0]).toEqual({ Q: ["[[b]]"], A: ["[[a]]"] });

    const copied = moveTokenOrThrow(base, {
      copy: true,
      from: { cardIndex: 0, face: "Q", tokenIndex: 1 },
      to: { cardIndex: 0, face: "A" }
    });
    expect(copied.cards[0]).toEqual({ Q: ["[[a]]", "[[b]]"], A: ["[[b]]"] });
  });
});

