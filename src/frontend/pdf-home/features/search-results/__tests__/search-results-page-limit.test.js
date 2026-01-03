import { describe, it, expect } from "@jest/globals";
import { resolveEffectivePageLimit, truncateResultsByPageLimit } from "../search-results-page-limit.js";

describe("search-results-page-limit", () => {
  it("resolveEffectivePageLimit prefers page.limit", () => {
    expect(resolveEffectivePageLimit({ page: { limit: 5 }, lastRequestedPageLimit: 99 })).toBe(5);
  });

  it("resolveEffectivePageLimit falls back to lastRequestedPageLimit when page.limit missing", () => {
    expect(resolveEffectivePageLimit({ page: { offset: 0 }, lastRequestedPageLimit: 7 })).toBe(7);
  });

  it("truncateResultsByPageLimit truncates when effective limit exists", () => {
    const records = Array.from({ length: 10 }, (_, i) => ({ id: `id-${i}` }));
    const { results, effectiveLimit } = truncateResultsByPageLimit({ results: records, page: { limit: 3 }, lastRequestedPageLimit: null });
    expect(effectiveLimit).toBe(3);
    expect(results.length).toBe(3);
    expect(results[0].id).toBe("id-0");
    expect(results[2].id).toBe("id-2");
  });

  it("truncateResultsByPageLimit returns full list when no limit", () => {
    const records = Array.from({ length: 4 }, (_, i) => ({ id: `id-${i}` }));
    const { results, effectiveLimit } = truncateResultsByPageLimit({ results: records, page: null, lastRequestedPageLimit: null });
    expect(effectiveLimit).toBe(null);
    expect(results.length).toBe(4);
  });
});

