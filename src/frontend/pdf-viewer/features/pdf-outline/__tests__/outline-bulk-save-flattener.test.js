import { flattenOutlineTreeForBulkSave } from "../outline-bulk-save-flattener.js";

describe("outline-bulk-save-flattener", () => {
  test("flattens tree with parent_id/order and clamps page/position", () => {
    let seq = 0;
    const generateOutlineId = () => `oid_${++seq}`;

    const items = [
      {
        id: "tmp_root",
        name: " Root ",
        pageAt: 2,
        position: 101,
        children: [
          { id: "tmp_c1", name: "C1", pageAt: 0, position: -1, children: [] },
          { id: "tmp_c2", name: "C2", pageAt: 3, position: null }
        ]
      }
    ];

    const flat = flattenOutlineTreeForBulkSave(items, { generateOutlineId });
    expect(flat.length).toBe(3);

    const root = flat[0];
    expect(root.outline_id).toBe("oid_1");
    expect(root.parent_id).toBeNull();
    expect(root.order).toBe(0);
    expect(root.name).toBe("Root");
    expect(root.page_at).toBe(2);
    expect(root.position).toBe(100);

    const c1 = flat[1];
    expect(c1.outline_id).toBe("oid_2");
    expect(c1.parent_id).toBe("oid_1");
    expect(c1.order).toBe(0);
    expect(c1.page_at).toBe(1);
    expect(c1.position).toBe(0);

    const c2 = flat[2];
    expect(c2.outline_id).toBe("oid_3");
    expect(c2.parent_id).toBe("oid_1");
    expect(c2.order).toBe(1);
    expect(c2.page_at).toBe(3);
    expect(c2.position).toBeNull();
  });

  test("throws on duplicate temp ids", () => {
    let seq = 0;
    const generateOutlineId = () => `oid_${++seq}`;
    expect(() => flattenOutlineTreeForBulkSave(
      [{ id: "dup", children: [{ id: "dup" }] }],
      { generateOutlineId }
    )).toThrow("duplicate node.id");
  });
});

