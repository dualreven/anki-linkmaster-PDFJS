import { describe, it, expect } from "@jest/globals";

import { computePositionFromPercent } from "../core/annotation-position-utils.js";

describe("annotation-position-utils", () => {
  it("computePositionFromPercent：应把百分比转换为像素并向下界限为0", () => {
    expect(computePositionFromPercent({ xPercent: 10, yPercent: 20 }, 200, 100)).toEqual({ x: 20, y: 20 });
    expect(computePositionFromPercent({ xPercent: -5, yPercent: -1 }, 200, 100)).toEqual({ x: 0, y: 0 });
  });
});

