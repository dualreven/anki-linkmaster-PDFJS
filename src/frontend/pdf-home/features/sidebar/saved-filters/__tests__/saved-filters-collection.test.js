import { buildSavedFilterSignature, upsertSavedFilter } from "../saved-filters-collection.js";

describe("saved-filters-collection", () => {
  test("buildSavedFilterSignature: same content -> same signature", () => {
    const a = { searchText: "k", filters: { type: "fuzzy", keywords: ["a"] }, sort: [{ field: "id", direction: "asc" }] };
    const b = { searchText: "k", filters: { type: "fuzzy", keywords: ["a"] }, sort: [{ field: "id", direction: "asc" }] };
    expect(buildSavedFilterSignature(a)).toBe(buildSavedFilterSignature(b));
  });

  test("upsertSavedFilter: same content -> update ts and move to front", () => {
    const base = { id: "sf_1", name: "A", searchText: "k", filters: { type: "fuzzy", keywords: ["a"] }, sort: [], ts: 1 };
    const savedFilters = [base, { id: "sf_2", name: "B", searchText: "x", filters: null, sort: [], ts: 2 }];
    const next = upsertSavedFilter({
      savedFilters,
      newFilter: { id: "sf_new", name: "NEWNAME", searchText: "k", filters: { type: "fuzzy", keywords: ["a"] }, sort: [] },
      maxItems: 50,
      nowMs: 999
    });

    expect(next[0].id).toBe("sf_1");
    expect(next[0].name).toBe("NEWNAME");
    expect(next[0].ts).toBe(999);
    expect(next.length).toBe(2);
  });

  test("upsertSavedFilter: new item -> insert and truncate", () => {
    const savedFilters = [
      { id: "sf_1", name: "A", searchText: "a", filters: null, sort: [], ts: 1 },
      { id: "sf_2", name: "B", searchText: "b", filters: null, sort: [], ts: 2 }
    ];
    const next = upsertSavedFilter({
      savedFilters,
      newFilter: { id: "sf_3", name: "C", searchText: "c", filters: null, sort: [], ts: 3 },
      maxItems: 2,
      nowMs: 3
    });
    expect(next.length).toBe(2);
    expect(next[0].id).toBe("sf_3");
    expect(next[1].id).toBe("sf_1");
  });
});

