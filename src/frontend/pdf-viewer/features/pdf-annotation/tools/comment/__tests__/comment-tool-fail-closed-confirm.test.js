import { createCommentAnnotationCard } from "../comment-tool-annotation-card.js";
import { confirmCommentDeleteAsync } from "../comment-tool-confirm-dialog.js";
import { PDF_VIEWER_EVENTS } from "../../../../../../common/event/pdf-viewer-constants.js";

describe("CommentTool confirm dialog (Fail-Closed)", () => {
  test("confirmCommentDeleteAsync 异常时返回 false", async () => {
    const ok = await confirmCommentDeleteAsync({
      message: "x",
      documentRef: {
        createElement() {
          throw new Error("boom");
        },
        body: { appendChild() {} }
      },
      logger: { error() {} }
    });
    expect(ok).toBe(false);
  });

  test("createCommentAnnotationCard 在 confirm=false 时不触发删除事件", async () => {
    document.body.innerHTML = "<div></div>";
    const emit = jest.fn();
    const card = createCommentAnnotationCard({
      annotation: {
        id: "a1",
        pageNumber: 1,
        data: { content: "c" },
        getFormattedDate() { return "d"; }
      },
      icon: "📝",
      eventBus: { emit, emitGlobal() {} },
      commentMarker: { highlightMarker() {} },
      confirmDeleteAsync: async () => false,
      logger: { debug() {} }
    });
    document.body.appendChild(card);
    const btn = card.querySelector(".delete-btn");
    btn.click();
    await Promise.resolve();
    expect(emit).not.toHaveBeenCalledWith(PDF_VIEWER_EVENTS.ANNOTATION.DELETE, expect.anything(), expect.anything());
  });
});

