import { showError } from "../../../../../common/utils/notification.js";
import { AnnotationType } from "../../models/index.js";

/**
 * 创建标注卡片 DOM（从 AnnotationSidebarUI 抽离）
 * @param {Object} params
 * @param {any} params.annotation
 * @param {Object} params.logger
 * @param {(imagePath:string)=>string} params.getImageUrl
 * @param {(annotationId:string)=>void} params.onJumpClick
 * @param {(annotationId:string)=>void} params.onDeleteClick
 * @param {(annotationId:string)=>void} params.onCommentClick
 * @param {(annotationId:string)=>Promise<void>} params.onCopyIdClick
 * @returns {HTMLElement}
 */
export function createAnnotationCardElement({
  annotation,
  logger,
  getImageUrl,
  onJumpClick,
  onDeleteClick,
  onCommentClick,
  onCopyIdClick,
}) {
  const card = document.createElement("div");
  card.className = "annotation-card";
  card.dataset.annotationId = annotation.id;
  card.style.cssText = [
    "border: 1px solid #e0e0e0",
    "border-radius: 8px",
    "padding: 12px",
    "margin-bottom: 12px",
    "background: #fff",
    "transition: all 0.2s",
    "cursor: pointer",
  ].join(";");

  card.addEventListener("mouseenter", () => {
    card.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
    card.style.borderColor = "#bbb";
  });
  card.addEventListener("mouseleave", () => {
    card.style.boxShadow = "none";
    card.style.borderColor = "#e0e0e0";
  });

  const header = document.createElement("div");
  header.style.cssText = [
    "display: flex",
    "align-items: center",
    "justify-content: space-between",
    "margin-bottom: 8px",
  ].join(";");

  const typeInfo = document.createElement("div");
  typeInfo.style.cssText = "display: flex; align-items: center; gap: 6px;";

  const typeIcon = document.createElement("span");
  typeIcon.textContent = annotation.getTypeIcon();
  typeIcon.style.fontSize = "18px";

  const pageInfo = document.createElement("span");
  pageInfo.textContent = `P.${annotation.pageNumber}`;
  pageInfo.style.cssText = "font-size: 12px; color: #666; font-weight: 500;";

  typeInfo.appendChild(typeIcon);
  typeInfo.appendChild(pageInfo);

  const actions = document.createElement("div");
  actions.style.cssText = "display: flex; align-items: center; gap: 6px;";

  const jumpBtn = document.createElement("button");
  jumpBtn.type = "button";
  jumpBtn.textContent = "🧭";
  jumpBtn.title = "跳转到标注位置";
  jumpBtn.className = "annotation-jump-btn";
  jumpBtn.style.cssText = [
    "border: 1px solid #ddd",
    "background: #fff",
    "border-radius: 4px",
    "padding: 4px 8px",
    "cursor: pointer",
    "font-size: 14px",
    "color: #666",
    "transition: all 0.2s",
  ].join(";");
  jumpBtn.addEventListener("mouseenter", () => {
    jumpBtn.style.background = "#e3f2fd";
    jumpBtn.style.borderColor = "#2196f3";
    jumpBtn.style.color = "#2196f3";
  });
  jumpBtn.addEventListener("mouseleave", () => {
    jumpBtn.style.background = "#fff";
    jumpBtn.style.borderColor = "#ddd";
    jumpBtn.style.color = "#666";
  });
  jumpBtn.setAttribute("aria-label", "跳转到标注位置");
  jumpBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onJumpClick(annotation.id);
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.textContent = "🗑️";
  deleteBtn.title = "删除标注";
  deleteBtn.className = "annotation-delete-btn";
  deleteBtn.dataset.action = "delete";
  deleteBtn.style.cssText = [
    "border: 1px solid #f44336",
    "background: #fff",
    "border-radius: 4px",
    "padding: 4px 8px",
    "cursor: pointer",
    "font-size: 12px",
    "color: #f44336",
    "transition: all 0.2s",
  ].join(";");
  deleteBtn.addEventListener("mouseenter", () => {
    deleteBtn.style.background = "#f44336";
    deleteBtn.style.color = "#fff";
  });
  deleteBtn.addEventListener("mouseleave", () => {
    deleteBtn.style.background = "#fff";
    deleteBtn.style.color = "#f44336";
  });
  deleteBtn.setAttribute("aria-label", "删除标注");
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onDeleteClick(annotation.id);
  });

  actions.appendChild(jumpBtn);
  actions.appendChild(deleteBtn);

  header.appendChild(typeInfo);
  header.appendChild(actions);

  const content = document.createElement("div");
  content.className = "annotation-card-content";
  content.style.cssText = [
    "font-size: 14px",
    "color: #333",
    "line-height: 1.5",
    "margin-bottom: 8px",
    "word-wrap: break-word",
  ].join(";");

  if (annotation.type === AnnotationType.SCREENSHOT) {
    if (annotation.data.imageData || annotation.data.imagePath) {
      const img = document.createElement("img");
      img.src = annotation.data.imageData ? annotation.data.imageData : getImageUrl(annotation.data.imagePath);
      img.alt = "截图";
      img.style.cssText = ["width: 100%", "height: auto", "border-radius: 4px", "margin-bottom: 8px"].join(";");
      content.appendChild(img);
    }
    if (annotation.data.description) {
      const desc = document.createElement("div");
      desc.textContent = annotation.data.description;
      desc.style.color = "#666";
      content.appendChild(desc);
    }
  } else if (annotation.type === AnnotationType.TEXT_HIGHLIGHT) {
    const text = document.createElement("div");
    text.textContent = `"${annotation.data.selectedText}"`;
    text.style.cssText = [
      `background: ${annotation.data.highlightColor}33`,
      `border-left: 3px solid ${annotation.data.highlightColor}`,
      "padding: 6px 8px",
      "border-radius: 4px",
      "font-style: italic",
    ].join(";");
    content.appendChild(text);

    if (annotation.data.note) {
      const note = document.createElement("div");
      note.textContent = annotation.data.note;
      note.style.cssText = "margin-top: 6px; color: #666; font-size: 13px;";
      content.appendChild(note);
    }
  } else if (annotation.type === AnnotationType.COMMENT) {
    const text = document.createElement("div");
    text.textContent = annotation.data.content;
    content.appendChild(text);
  }

  const footer = document.createElement("div");
  footer.style.cssText = [
    "display: flex",
    "align-items: center",
    "justify-content: space-between",
    "font-size: 12px",
    "color: #999",
    "padding-top: 8px",
    "border-top: 1px solid #f0f0f0",
    "gap: 8px",
  ].join(";");

  const copyIdBtn = document.createElement("button");
  copyIdBtn.type = "button";
  copyIdBtn.textContent = "📋";
  copyIdBtn.title = `复制ID: ${annotation.id}`;
  copyIdBtn.className = "annotation-copy-id-btn";
  copyIdBtn.style.cssText = [
    "border: 1px solid #ddd",
    "background: #fff",
    "border-radius: 4px",
    "cursor: pointer",
    "font-size: 12px",
    "padding: 2px 8px",
    "color: #666",
    "transition: all 0.2s",
  ].join(";");
  copyIdBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await onCopyIdClick(annotation.id);
    } catch (error) {
      logger.error("Copy click handler failed:", error);
      showError("✗ 复制失败", 3000);
    }
  });
  copyIdBtn.addEventListener("mouseenter", () => {
    copyIdBtn.style.background = "#e3f2fd";
    copyIdBtn.style.borderColor = "#2196f3";
    copyIdBtn.style.color = "#2196f3";
  });
  copyIdBtn.addEventListener("mouseleave", () => {
    copyIdBtn.style.background = "#fff";
    copyIdBtn.style.borderColor = "#ddd";
    copyIdBtn.style.color = "#666";
  });
  copyIdBtn.setAttribute("aria-label", "复制标注ID");

  const rightSection = document.createElement("div");
  rightSection.style.cssText = ["display: flex", "align-items: center", "gap: 8px", "margin-left: auto"].join(";");

  const time = document.createElement("span");
  time.textContent = annotation.getFormattedDate();
  time.style.color = "#999";

  const commentBtn = document.createElement("button");
  commentBtn.type = "button";
  const commentCount = annotation.getCommentCount();
  commentBtn.textContent = commentCount > 0 ? `💬 ${commentCount}` : "💬";
  commentBtn.title = commentCount > 0 ? `${commentCount}条评论` : "添加评论";
  commentBtn.className = "annotation-comment-btn";
  commentBtn.style.cssText = [
    "border: 1px solid #ddd",
    "background: #fff",
    "border-radius: 4px",
    "cursor: pointer",
    "font-size: 12px",
    "padding: 2px 8px",
    "color: #666",
    "transition: all 0.2s",
  ].join(";");
  commentBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onCommentClick(annotation.id);
  });
  commentBtn.addEventListener("mouseenter", () => {
    commentBtn.style.background = "#e3f2fd";
    commentBtn.style.borderColor = "#2196f3";
    commentBtn.style.color = "#2196f3";
  });
  commentBtn.addEventListener("mouseleave", () => {
    commentBtn.style.background = "#fff";
    commentBtn.style.borderColor = "#ddd";
    commentBtn.style.color = "#666";
  });
  commentBtn.setAttribute("aria-label", commentCount > 0 ? `查看评论（${commentCount}）` : "添加评论");

  rightSection.appendChild(time);
  rightSection.appendChild(commentBtn);

  footer.appendChild(copyIdBtn);
  footer.appendChild(rightSection);

  card.appendChild(header);
  card.appendChild(content);
  card.appendChild(footer);

  return card;
}

