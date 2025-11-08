// @jest-environment jsdom
/* eslint-env jest */

import { Annotation, AnnotationType } from "../annotation.js";

describe("Annotation ID generation", () => {
  test("auto-generated ID matches base64url16 pattern", () => {
    const ann = new Annotation({
      type: AnnotationType.SCREENSHOT,
      pageNumber: 1,
      data: {
        // 新规范：截图标注必须提供百分比矩形 rectPercent（禁止像素 rect 兜底）
        rectPercent: { xPercent: 10, yPercent: 10, widthPercent: 25, heightPercent: 12.5 },
        imageHash: "1234567890abcdef1234567890abcdef",
        imagePath: "C:/tmp/test.png"
      },
      comments: []
    });

    const pattern = /^pdfannotation-[A-Za-z0-9_-]{16}$/;
    expect(ann.id).toMatch(pattern);
    const randomPart = ann.id.slice("pdfannotation-".length);
    expect(randomPart.length).toBe(16);
  });
});
