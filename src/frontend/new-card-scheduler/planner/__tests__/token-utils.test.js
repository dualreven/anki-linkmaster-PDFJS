import { buildAnnoTokenOrThrow, isValidAnnoToken } from "../token-utils.js";

describe("new-card-scheduler token-utils", () => {
  test("buildAnnoTokenOrThrow builds [[id]] and rejects invalid ids", () => {
    expect(buildAnnoTokenOrThrow("abc")).toBe("[[abc]]");
    expect(() => buildAnnoTokenOrThrow("")).toThrow();
    expect(() => buildAnnoTokenOrThrow("  ")).toThrow();
    expect(() => buildAnnoTokenOrThrow("a\nb")).toThrow();
    expect(() => buildAnnoTokenOrThrow("a b")).toThrow();
    expect(() => buildAnnoTokenOrThrow("a]]b")).toThrow();
  });

  test("isValidAnnoToken enforces [[...]] without whitespace/newline and without inner ']]'", () => {
    expect(isValidAnnoToken("[[x]]")).toBe(true);
    expect(isValidAnnoToken("[[]]")).toBe(false);
    expect(isValidAnnoToken("[[ ]]")).toBe(false);
    expect(isValidAnnoToken("x")).toBe(false);
    expect(isValidAnnoToken("[[a\nb]]")).toBe(false);
    expect(isValidAnnoToken("[[a]]b]]")).toBe(false);
    expect(isValidAnnoToken("[[a]]]]")).toBe(false);
  });
});
