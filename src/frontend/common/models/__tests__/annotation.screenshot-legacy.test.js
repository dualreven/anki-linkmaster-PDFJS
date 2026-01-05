import { Annotation, AnnotationType } from "../annotation.js";

describe("Annotation screenshot legacy schema compatibility", () => {
  test("legacy screenshot with only rect should still construct", () => {
    expect(() => {
      // legacy: rect in pixels, no rectPercent
      // 数据来源：旧库 screenshot 记录只保存 rect
      new Annotation({
        id: "ann_legacy_rect_only",
        type: AnnotationType.SCREENSHOT,
        pageNumber: 1,
        data: {
          rect: { left: 10, top: 20, width: 120, height: 80 },
          imagePath: "/tmp/legacy.png",
          imageHash: "0123456789abcdef0123456789abcdef",
          description: "legacy screenshot",
        },
      });
    }).not.toThrow();
  });

  test("screenshot without rectPercent and rect should be rejected", () => {
    expect(() => {
      new Annotation({
        id: "ann_missing_rect",
        type: AnnotationType.SCREENSHOT,
        pageNumber: 1,
        data: {
          imagePath: "/tmp/x.png",
          imageHash: "0123456789abcdef0123456789abcdef",
        },
      });
    }).toThrow(/requires .*rect/i);
  });
});

