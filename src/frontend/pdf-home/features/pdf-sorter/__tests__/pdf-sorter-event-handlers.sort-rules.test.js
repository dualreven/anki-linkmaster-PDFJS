import {
  buildBackendSortRulesFromMultiSortConfigs,
  buildBackendSortRulesFromWeightedFormula,
} from "../pdf-sorter-event-handlers.js";

describe("pdf-sorter-event-handlers: build backend sort rules", () => {
  test("multi-sort configs -> normalized rules", () => {
    expect(buildBackendSortRulesFromMultiSortConfigs(null)).toEqual([]);
    expect(buildBackendSortRulesFromMultiSortConfigs([])).toEqual([]);

    const rules = buildBackendSortRulesFromMultiSortConfigs([
      { field: "title", direction: "ASC" },
      { field: "created_at", direction: "desc" },
      { field: 123, direction: "invalid" },
      {},
    ]);

    expect(rules).toEqual([
      { field: "title", direction: "asc" },
      { field: "created_at", direction: "desc" },
      { field: "123", direction: "asc" },
      { field: "", direction: "asc" },
    ]);
  });

  test("weighted formula -> backend rule", () => {
    expect(buildBackendSortRulesFromWeightedFormula("x+y")).toEqual([
      { field: "weighted", direction: "desc", formula: "x+y" },
    ]);
    expect(buildBackendSortRulesFromWeightedFormula(null)).toEqual([
      { field: "weighted", direction: "desc", formula: "" },
    ]);
  });
});

