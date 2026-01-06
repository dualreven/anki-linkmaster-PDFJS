import { createCommentAnnotation } from "../comment-annotation-factory.js";

describe("comment annotation factory — regression", () => {
  test("comment annotation must include data.position for backend validation", () => {
    const ann = createCommentAnnotation({
      pageNumber: 1,
      xPercent: 12.5,
      yPercent: 34.75,
      content: "hello",
    });

    expect(ann?.type).toBe("comment");
    expect(ann?.data?.position).toBeTruthy();
    expect(typeof ann.data.position.x).toBe("number");
    expect(typeof ann.data.position.y).toBe("number");
  });
});

