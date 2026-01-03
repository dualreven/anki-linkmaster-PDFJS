import { describe, it, expect } from "@jest/globals";

import { DEFAULT_TRANSLATION_HISTORY_MAX, prependTranslationHistory } from "../components/translator-history.js";

describe("translator-history", () => {
  it("prependTranslationHistory: prepends data with timestamp and returns currentTranslation", () => {
    const history = [{ original: "a", translation: "A", timestamp: 1 }];
    const data = { original: "b", translation: "B" };

    const result = prependTranslationHistory(history, data, { now: () => 123 });

    expect(result.currentTranslation).toBe(data);
    expect(result.history).toHaveLength(2);
    expect(result.history[0]).toEqual({ original: "b", translation: "B", timestamp: 123 });
    expect(result.history[1]).toEqual(history[0]);
  });

  it("prependTranslationHistory: does not mutate input history", () => {
    const history = [{ original: "a", translation: "A", timestamp: 1 }];
    const historySnapshot = JSON.parse(JSON.stringify(history));

    prependTranslationHistory(history, { original: "b", translation: "B" }, { now: () => 2 });

    expect(history).toEqual(historySnapshot);
  });

  it("prependTranslationHistory: truncates to DEFAULT_TRANSLATION_HISTORY_MAX by default", () => {
    const history = Array.from({ length: DEFAULT_TRANSLATION_HISTORY_MAX + 10 }, (_, i) => ({
      original: `o${i}`,
      translation: `t${i}`,
      timestamp: i
    }));

    const result = prependTranslationHistory(history, { original: "new", translation: "NEW" }, { now: () => 999 });

    expect(result.history).toHaveLength(DEFAULT_TRANSLATION_HISTORY_MAX);
    expect(result.history[0].timestamp).toBe(999);
  });

  it("prependTranslationHistory: supports custom max", () => {
    const history = [{ original: "a", translation: "A", timestamp: 1 }];
    const result = prependTranslationHistory(history, { original: "b", translation: "B" }, { now: () => 2, max: 1 });
    expect(result.history).toHaveLength(1);
    expect(result.history[0].timestamp).toBe(2);
  });

  it("prependTranslationHistory: throws on invalid inputs", () => {
    expect(() => prependTranslationHistory(null, { a: 1 })).toThrow(/history must be an array/);
    expect(() => prependTranslationHistory([], null)).toThrow(/data must be an object/);
    expect(() => prependTranslationHistory([], { a: 1 }, { now: 123 })).toThrow(/options\.now must be a function/);
    expect(() => prependTranslationHistory([], { a: 1 }, { now: () => "x" })).toThrow(/now\(\) must return a number/);
    expect(() => prependTranslationHistory([], { a: 1 }, { max: 0 })).toThrow(/options\.max must be a positive number/);
  });
});
