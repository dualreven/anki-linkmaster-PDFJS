import { describe, it, expect } from "@jest/globals";

import { formatFormulaFromTokens, hasSafeReference, parseFormulaToTokens } from "../components/weighted-sort-editor-formula.js";
import { WEIGHTED_SORT_FUNCTION_DEFINITIONS } from "../components/weighted-sort-editor-constants.js";

describe("weighted-sort-editor-formula", () => {
  const availableFields = [
    { field: "size", label: "文件大小", type: "number" },
    { field: "title", label: "书名", type: "string" }
  ];

  it("formatFormulaFromTokens: normalizes whitespace around operators and parentheses", () => {
    const tokens = [
      { type: "field", value: "size" },
      { type: "operator", value: "*" },
      { type: "number", value: "2" }
    ];
    expect(formatFormulaFromTokens(tokens)).toBe("size * 2");
  });

  it("parseFormulaToTokens: parses function calls as a single token", () => {
    const tokens = parseFormulaToTokens("max(size, 5)", {
      availableFields,
      functionDefinitions: WEIGHTED_SORT_FUNCTION_DEFINITIONS,
      logger: null
    });

    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toEqual({ type: "function", value: "max(size, 5)", name: "max" });
  });

  it("hasSafeReference: accepts field or function reference", () => {
    expect(hasSafeReference("size * 2", { availableFields, functionDefinitions: WEIGHTED_SORT_FUNCTION_DEFINITIONS })).toBe(true);
    expect(hasSafeReference("max(1, 2)", { availableFields, functionDefinitions: WEIGHTED_SORT_FUNCTION_DEFINITIONS })).toBe(true);
    expect(hasSafeReference("1 + 2", { availableFields, functionDefinitions: WEIGHTED_SORT_FUNCTION_DEFINITIONS })).toBe(false);
  });
});

