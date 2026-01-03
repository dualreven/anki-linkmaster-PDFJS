import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";

export function createCommentAnnotationCard({
  annotation,
  icon,
  eventBus,
  commentMarker,
  confirmDeleteAsync,
  logger,
  documentRef = document
}) {
  const card = documentRef.createElement("div");
  card.className = "annotation-card comment-card";
  card.dataset.annotationId = annotation.id;

  card.style.cssText = `
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 8px;
    margin-bottom: 12px;
    background: white;
    cursor: pointer;
    transition: box-shadow 0.2s;
  `;

  card.innerHTML = `
    <div class="card-header" style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 20px;">${icon}</span>
        <span style="font-weight: bold; color: #333;">批注</span>
      </div>
      <span style="font-size: 12px; color: #999;">第${annotation.pageNumber}页</span>
    </div>
    <div class="card-content" style="color: #555; font-size: 14px; line-height: 1.5; margin-bottom: 8px;">
      ${annotation.data.content || "无内容"}
    </div>
    <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center;">
      <span style="font-size: 12px; color: #999;">${annotation.getFormattedDate()}</span>
      <div class="card-actions" style="display: flex; gap: 8px;">
        <button class="jump-btn" style="padding: 4px 12px; border: 1px solid #2196F3; border-radius: 4px; background: white; color: #2196F3; cursor: pointer; font-size: 12px;">
          跳转
        </button>
        <button class="delete-btn" style="padding: 4px 12px; border: 1px solid #f44336; border-radius: 4px; background: white; color: #f44336; cursor: pointer; font-size: 12px;">
          删除
        </button>
      </div>
    </div>
  `;

  card.addEventListener("click", (e) => {
    if (!e.target.classList.contains("jump-btn") && !e.target.classList.contains("delete-btn")) {
      commentMarker.highlightMarker(annotation.id);
    }
  });

  card.addEventListener("mouseenter", () => {
    card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
  });

  card.addEventListener("mouseleave", () => {
    card.style.boxShadow = "none";
  });

  const jumpBtn = card.querySelector(".jump-btn");
  jumpBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    eventBus.emitGlobal(
      PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED,
      { id: annotation.id },
      { actorId: "CommentTool" }
    );
  });

  const deleteBtn = card.querySelector(".delete-btn");
  deleteBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const ok = await confirmDeleteAsync({ message: "确定要删除这条批注吗？" });
    if (!ok) {
      logger?.debug?.("[CommentTool] delete cancelled");
      return;
    }
    eventBus.emit(
      PDF_VIEWER_EVENTS.ANNOTATION.DELETE,
      { id: annotation.id },
      { actorId: "CommentTool" }
    );
  });

  return card;
}

