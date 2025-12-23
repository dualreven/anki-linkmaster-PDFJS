import { Annotation, AnnotationType } from "../annotation.js";

describe("Annotation comments from backend", () => {
  test("后端返回不含 annotationId 的评论也能正常构造", () => {
    const ann = new Annotation({
      id: "pdfannotation-Backend12345678",
      type: AnnotationType.COMMENT,
      pageNumber: 1,
      data: {
        position: { x: 0, y: 0 },
        content: "base comment",
      },
      comments: [
        {
          id: "c1",
          content: "from-backend",
          createdAt: "2025-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(ann.comments).toHaveLength(1);
    const c = ann.comments[0];
    expect(c.annotationId).toBe(ann.id);
    expect(c.content).toBe("from-backend");
  });
});

