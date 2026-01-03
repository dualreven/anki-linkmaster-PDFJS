import { describe, expect, jest, test } from "@jest/globals";
import { createScreenshotAnnotationCard } from "./card-renderer.js";

describe("screenshot/card-renderer", () => {
  test("prefers imageData and wires button callbacks", () => {
    const onJump = jest.fn();
    const onAddComment = jest.fn();
    const getImageUrl = jest.fn(() => "http://example.invalid/fallback.png");
    const escapeHtml = jest.fn((t) => String(t));
    const formatDate = jest.fn(() => "2026/01/01 00:00");

    const annotation = {
      id: "s-1",
      type: "screenshot",
      pageNumber: 3,
      createdAt: "2026-01-01T00:00:00.000Z",
      comments: [{ id: "c1" }],
      data: {
        imageData: "data:image/png;base64,AAA",
        imagePath: "/data/screenshots/s-1.png",
        description: "hello"
      }
    };

    const card = createScreenshotAnnotationCard({
      annotation,
      icon: "📷",
      displayName: "截图",
      getImageUrl,
      escapeHtml,
      formatDate,
      onJump,
      onAddComment
    });

    expect(card.dataset.annotationId).toBe("s-1");
    expect(card.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,AAA");
    expect(getImageUrl).not.toHaveBeenCalled();

    card.querySelector(".jump-btn").click();
    expect(onJump).toHaveBeenCalledWith("s-1");

    card.querySelector(".comment-btn").click();
    expect(onAddComment).toHaveBeenCalledWith("s-1");
  });

  test("uses getImageUrl when imageData missing", () => {
    const getImageUrl = jest.fn((p) => `http://example.invalid${p}`);

    const annotation = {
      id: "s-2",
      type: "screenshot",
      pageNumber: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      comments: [],
      data: {
        imagePath: "/data/screenshots/s-2.png"
      }
    };

    const card = createScreenshotAnnotationCard({
      annotation,
      icon: "📷",
      displayName: "截图",
      getImageUrl,
      escapeHtml: (t) => String(t),
      formatDate: () => "x",
      onJump: () => {},
      onAddComment: () => {}
    });

    expect(getImageUrl).toHaveBeenCalledWith("/data/screenshots/s-2.png");
    expect(card.querySelector("img")?.getAttribute("src")).toBe("http://example.invalid/data/screenshots/s-2.png");
  });
});

