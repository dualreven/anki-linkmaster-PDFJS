import { createCardsEngine } from "../cards-model.js";

describe("new-card-scheduler planner cards engine contract (v001)", () => {
  test("title 默认 '' 且出现在 toFinalCards 输出", () => {
    const engine = createCardsEngine();
    engine.createCardOrThrow();
    expect(engine.toFinalCardsOrThrow()).toEqual([{ title: "", Q: [], A: [] }]);
  });

  test("dispatchIngest({annotationIds}) 会映射为 ingest(annotation_ids)", () => {
    const engine = createCardsEngine();
    const tempId = engine.createCardOrThrow();
    engine.selectCardOrThrow(tempId);

    expect(() => engine.dispatchIngest({
      op: { kind: "all-to-one", target: { kind: "card-id", tempId }, face: "Q" },
      annotationIds: ["ann_1"]
    })).not.toThrow();

    expect(engine.toFinalCardsOrThrow()).toEqual([{ title: "", Q: ["ann_1"], A: [] }]);
  });

  test("删除卡片后不出现在输出数组", () => {
    const engine = createCardsEngine();
    const a = engine.createCardOrThrow();
    engine.renameCardTitleOrThrow(a, "a");
    const b = engine.createCardOrThrow();
    engine.renameCardTitleOrThrow(b, "b");
    engine.deleteCardOrThrow(a);
    expect(engine.toFinalCardsOrThrow()).toEqual([{ title: "b", Q: [], A: [] }]);
  });

  test("reorder 后输出顺序变化", () => {
    const engine = createCardsEngine();
    const a = engine.createCardOrThrow();
    engine.renameCardTitleOrThrow(a, "a");
    const b = engine.createCardOrThrow();
    engine.renameCardTitleOrThrow(b, "b");
    engine.reorderCardsOrThrow({ fromIndex: 0, toIndex: 1 });
    expect(engine.toFinalCardsOrThrow().map((c) => c.title)).toEqual(["b", "a"]);
  });

  test("newIndex(x)：x=0 可用；越界抛错", () => {
    const engine = createCardsEngine();
    engine.createCardOrThrow();
    expect(() => engine.ingestOrThrow({
      op: {
        kind: "all-to-one",
        target: { kind: "new-index", x: 0 },
        face: "Q"
      },
      annotation_ids: ["ann_1"]
    })).not.toThrow();

    expect(() => engine.ingestOrThrow({
      op: {
        kind: "all-to-one",
        target: { kind: "new-index", x: 1 },
        face: "Q"
      },
      annotation_ids: ["ann_1"]
    })).toThrow();
  });

  test("cardId(tempId)：不存在抛错", () => {
    const engine = createCardsEngine();
    expect(() => engine.ingestOrThrow({
      op: {
        kind: "all-to-one",
        target: { kind: "card-id", tempId: "temp-999" },
        face: "Q"
      },
      annotation_ids: ["ann_1"]
    })).toThrow();
  });

  test("last：未选中无卡/未选中有卡/已选中上一张；选中第0张抛错", () => {
    // 未选中无卡：创建新卡并作为 last
    {
      const engine = createCardsEngine();
      engine.ingestOrThrow({
        op: { kind: "all-to-one", target: { kind: "last" }, face: "Q" },
        annotation_ids: ["ann_1"]
      });
      expect(engine.toFinalCardsOrThrow()).toEqual([{ title: "", Q: ["ann_1"], A: [] }]);
    }

    // 未选中有卡：last=最近创建
    {
      const engine = createCardsEngine();
      const first = engine.createCardOrThrow();
      engine.renameCardTitleOrThrow(first, "first");
      const second = engine.createCardOrThrow();
      engine.renameCardTitleOrThrow(second, "second");
      engine.selectCardOrThrow(null);

      engine.ingestOrThrow({
        op: { kind: "all-to-one", target: { kind: "last" }, face: "Q" },
        annotation_ids: ["ann_x"]
      });

      expect(engine.toFinalCardsOrThrow()).toEqual([
        { title: "first", Q: [], A: [] },
        { title: "second", Q: ["ann_x"], A: [] }
      ]);
    }

    // 已选中：last=上一张
    {
      const engine = createCardsEngine();
      const first = engine.createCardOrThrow();
      engine.renameCardTitleOrThrow(first, "first");
      const second = engine.createCardOrThrow();
      engine.renameCardTitleOrThrow(second, "second");
      engine.selectCardOrThrow(second);

      engine.ingestOrThrow({
        op: { kind: "all-to-one", target: { kind: "last" }, face: "Q" },
        annotation_ids: ["ann_y"]
      });

      expect(engine.toFinalCardsOrThrow()).toEqual([
        { title: "first", Q: ["ann_y"], A: [] },
        { title: "second", Q: [], A: [] }
      ]);
    }

    // 选中第0张：抛错
    {
      const engine = createCardsEngine();
      const first = engine.createCardOrThrow();
      engine.selectCardOrThrow(first);
      expect(() => engine.ingestOrThrow({
        op: { kind: "all-to-one", target: { kind: "last" }, face: "Q" },
        annotation_ids: ["ann_z"]
      })).toThrow();
    }
  });

  test("alternate-faces(startFace=Q)：按 QAQA… 分配，必要时自动创建新卡，保持顺序不去重", () => {
    const engine = createCardsEngine();
    engine.ingestOrThrow({
      op: {
        kind: "alternate-faces",
        target: { kind: "new" },
        startFace: "Q"
      },
      annotation_ids: ["ann_1", "ann_1", "ann_2", "ann_2", "ann_3"]
    });

    expect(engine.toFinalCardsOrThrow()).toEqual([
      { title: "", Q: ["ann_1"], A: ["ann_1"] },
      { title: "", Q: ["ann_2"], A: ["ann_2"] },
      { title: "", Q: ["ann_3"], A: [] }
    ]);
  });
});
