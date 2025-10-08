// @jest-environment jsdom
/* eslint-env jest */

import { Annotation, AnnotationType } from "../annotation.js";

describe("Annotation ID generation", () => {
  test("auto-generated ID matches base64url16 pattern", () => {
    const ann = new Annotation({
      type: AnnotationType.SCREENSHOT,
      pageNumber: 1,
      data: {
        rect: { x: 10, y: 10, width: 100, height: 50 },
        imagePath: "C:/tmp/test.png"
      },
      comments: []
    });

    const pattern = /^pdfannotation-[A-Za-z0-9_-]{16}$/;
    expect(ann.id).toMatch(pattern);
    const randomPart = ann.id.split("-")[1];
    expect(randomPart.length).toBe(16);
  });
});
