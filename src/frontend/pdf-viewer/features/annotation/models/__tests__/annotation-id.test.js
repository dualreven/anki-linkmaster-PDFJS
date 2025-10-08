// @jest-environment jsdom
/* eslint-env jest */

import { Annotation, AnnotationType } from "../annotation.js";

describe("Annotation ID generation", () => {
  test("auto-generated ID matches new pattern", () => {
    const ann = new Annotation({
      type: AnnotationType.SCREENSHOT,
      pageNumber: 1,
      data: {
        rect: { x: 10, y: 10, width: 100, height: 50 },
        imagePath: "C:/tmp/test.png"
      },
      comments: []
    });

    const pattern = /^pdfannotation-[0-9a-fA-F]{8}$/;
    expect(ann.id).toMatch(pattern);
    const randomPart = ann.id.split("-")[1];
    expect(randomPart.length).toBe(8);
  });
});
