import { countLines, computeViolations } from "../frontend-line-limit.js";

describe("scripts/ci/frontend-line-limit.js", () => {
  test("countLines handles LF/CRLF and trailing newline", () => {
    expect(countLines("")).toBe(0);
    expect(countLines("a")).toBe(1);
    expect(countLines("a\n")).toBe(1);
    expect(countLines("a\n\n")).toBe(2);
    expect(countLines("a\r\nb\r\n")).toBe(2);
    expect(countLines("a\r\nb")).toBe(2);
  });

  test("computeViolations blocks new > limit and baseline growth", () => {
    const baseline = {
      "src/frontend/a.js": 600
    };

    const fileLineCounts = {
      "src/frontend/a.js": 601,
      "src/frontend/b.js": 501,
      "src/frontend/c.js": 500
    };

    expect(
      computeViolations({
        fileLineCounts,
        baseline,
        limit: 500
      })
    ).toEqual([
      {
        type: "grown-baseline",
        path: "src/frontend/a.js",
        baselineLines: 600,
        lines: 601
      },
      {
        type: "new-over-limit",
        path: "src/frontend/b.js",
        limit: 500,
        lines: 501
      }
    ]);
  });
});
