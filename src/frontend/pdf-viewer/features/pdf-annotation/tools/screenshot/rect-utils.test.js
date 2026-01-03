import { describe, expect, test } from "@jest/globals";
import { getRectFromPoints } from "./rect-utils.js";

describe("screenshot/rect-utils", () => {
  test("getRectFromPoints handles drag in any direction", () => {
    expect(getRectFromPoints({ x: 10, y: 20 }, { x: 40, y: 60 })).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40
    });

    expect(getRectFromPoints({ x: 40, y: 60 }, { x: 10, y: 20 })).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40
    });

    expect(getRectFromPoints({ x: 40, y: 20 }, { x: 10, y: 60 })).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40
    });
  });
});

