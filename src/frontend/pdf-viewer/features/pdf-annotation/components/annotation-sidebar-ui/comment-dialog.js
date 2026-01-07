import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";
import { showSuccess } from "../../../../../common/utils/notification.js";
import { Comment } from "../../../../../common/models/comment.js";

/**
 * 显示标注评论对话框（从 AnnotationSidebarUI 抽离）
 * @param {Object} params
 * @param {string} params.annotationId
 * @param {(annotationId:string)=>any|null} params.getAnnotationById
 * @param {Object} params.eventBus
 * @param {Object} params.logger
 * @param {(imagePath:string)=>string} params.getImageUrl
 */
export function showAnnotationCommentDialog({
  annotationId,
  getAnnotationById,
  eventBus,
  logger,
  getImageUrl,
}) {
  const annotation = typeof getAnnotationById === "function"
    ? getAnnotationById(annotationId)
    : null;
  if (!annotation) {
    logger.warn(`Annotation not found: ${annotationId}`);
    return;
  }

  /** @type {Array<any>} */
  const comments = Array.isArray(annotation.comments) ? [...annotation.comments] : [];

  const overlay = document.createElement("div");
  overlay.style.cssText = [
    "position: fixed",
    "top: 0",
    "left: 0",
    "right: 0",
    "bottom: 0",
    "background: rgba(0, 0, 0, 0.5)",
    "display: flex",
    "align-items: center",
    "justify-content: center",
    "z-index: 10000",
  ].join(";");

  const dialog = document.createElement("div");
  dialog.style.cssText = [
    "background: #fff",
    "border-radius: 8px",
    "padding: 20px",
    "width: 500px",
    "max-width: 90%",
    "max-height: 80vh",
    "display: flex",
    "flex-direction: column",
    "box-shadow: 0 4px 20px rgba(0,0,0,0.3)",
  ].join(";");

  const title = document.createElement("div");
  const commentCount = comments.length;
  title.textContent = commentCount > 0 ? `评论 (${commentCount})` : "添加评论";
  title.style.cssText = [
    "font-size: 16px",
    "font-weight: 500",
    "margin-bottom: 12px",
    "color: #333",
  ].join(";");

  const annotationContent = document.createElement("div");
  annotationContent.style.cssText = [
    "background: #f9f9f9",
    "border: 1px solid #e8e8e8",
    "border-radius: 6px",
    "padding: 12px",
    "margin-bottom: 12px",
    "max-height: 200px",
    "overflow-y: auto",
  ].join(";");

  const typeIcon = annotation.getTypeIcon();
  const typeLabel = document.createElement("div");
  typeLabel.style.cssText = [
    "font-size: 12px",
    "color: #666",
    "margin-bottom: 8px",
    "font-weight: 500",
  ].join(";");

  switch (annotation.type) {
  case "screenshot": {
    typeLabel.textContent = `${typeIcon} 截图标注`;
    annotationContent.appendChild(typeLabel);

    if (annotation.data.description) {
      const desc = document.createElement("div");
      desc.textContent = annotation.data.description;
      desc.style.cssText = ["font-size: 14px", "color: #333", "margin-bottom: 8px"].join(";");
      annotationContent.appendChild(desc);
    }

    if (annotation.data.imagePath || annotation.data.imageData) {
      const img = document.createElement("img");
      img.src = annotation.data.imageData ? annotation.data.imageData : getImageUrl(annotation.data.imagePath);
      img.style.cssText = ["max-width: 100%", "border-radius: 4px", "display: block"].join(";");
      img.onerror = () => {
        img.style.display = "none";
        const errorTip = document.createElement("div");
        errorTip.textContent = "图片加载失败";
        errorTip.style.cssText = [
          "color: #999",
          "font-size: 12px",
          "padding: 8px",
          "text-align: center",
        ].join(";");
        img.parentElement.appendChild(errorTip);
      };
      annotationContent.appendChild(img);
    }
    break;
  }

  case "text-highlight": {
    typeLabel.textContent = `${typeIcon} 文本高亮`;
    annotationContent.appendChild(typeLabel);

    const highlightText = document.createElement("div");
    highlightText.textContent = `"${annotation.data.selectedText}"`;
    highlightText.style.cssText = [
      "font-size: 14px",
      "color: #333",
      "line-height: 1.6",
      "font-style: italic",
      "padding: 8px",
      `background: ${(annotation.data.highlightColor || "#ffff00")}40`,
      "border-radius: 4px",
    ].join(";");
    annotationContent.appendChild(highlightText);

    if (annotation.data.note) {
      const note = document.createElement("div");
      note.textContent = `笔记: ${annotation.data.note}`;
      note.style.cssText = [
        "font-size: 13px",
        "color: #666",
        "margin-top: 8px",
        "padding-top: 8px",
        "border-top: 1px solid #e8e8e8",
      ].join(";");
      annotationContent.appendChild(note);
    }
    break;
  }

  case "comment": {
    typeLabel.textContent = `${typeIcon} 批注`;
    annotationContent.appendChild(typeLabel);

    const commentText = document.createElement("div");
    commentText.textContent = annotation.data.content;
    commentText.style.cssText = ["font-size: 14px", "color: #333", "line-height: 1.6"].join(";");
    annotationContent.appendChild(commentText);
    break;
  }

  default: {
    typeLabel.textContent = `${typeIcon} 标注`;
    annotationContent.appendChild(typeLabel);
    break;
  }
  }

  const metaContainer = document.createElement("div");
  metaContainer.style.cssText = [
    "margin-top: 12px",
    "padding-top: 8px",
    "border-top: 1px dashed #e0e0e0",
    "display: flex",
    "flex-direction: column",
    "gap: 8px",
  ].join(";");

  const titleRow = document.createElement("div");
  titleRow.style.cssText = "display:flex;align-items:center;gap:8px;";
  const titleLabelEl = document.createElement("label");
  titleLabelEl.textContent = "标题";
  titleLabelEl.style.cssText = "font-size:13px;color:#555;flex:0 0 auto;";
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.value = annotation.title || "";
  titleInput.placeholder = "为此标注起一个标题（可选）";
  titleInput.style.cssText = [
    "flex:1",
    "padding:4px 8px",
    "border:1px solid #ddd",
    "border-radius:4px",
    "font-size:13px",
    "box-sizing:border-box",
  ].join(";");
  titleRow.appendChild(titleLabelEl);
  titleRow.appendChild(titleInput);

  const tagsRow = document.createElement("div");
  tagsRow.style.cssText = "display:flex;align-items:center;gap:8px;";
  const tagsLabelEl = document.createElement("label");
  tagsLabelEl.textContent = "Tags";
  tagsLabelEl.style.cssText = "font-size:13px;color:#555;flex:0 0 auto;";
  const tagsInput = document.createElement("input");
  tagsInput.type = "text";
  const existingTags = Array.isArray(annotation.tags) ? annotation.tags.join(" ") : annotation.tagsText || "";
  tagsInput.value = existingTags;
  tagsInput.placeholder = "Tags（占位：暂未接搜索与持久化）";
  tagsInput.style.cssText = [
    "flex:1",
    "padding:4px 8px",
    "border:1px solid #ddd",
    "border-radius:4px",
    "font-size:13px",
    "box-sizing:border-box",
  ].join(";");
  tagsRow.appendChild(tagsLabelEl);
  tagsRow.appendChild(tagsInput);

  let initialTitle = annotation.title || "";

  metaContainer.appendChild(titleRow);
  metaContainer.appendChild(tagsRow);

  const idInfo = document.createElement("div");
  idInfo.textContent = `标注ID: ${annotationId}`;
  idInfo.style.cssText = [
    "font-size: 12px",
    "color: #999",
    "margin-bottom: 16px",
    "font-family: monospace",
  ].join(";");

  const commentsContainer = document.createElement("div");
  commentsContainer.style.cssText = [
    "flex: 1",
    "overflow-y: auto",
    "margin-bottom: 16px",
    "border: 1px solid #f0f0f0",
    "border-radius: 4px",
    "max-height: 300px",
  ].join(";");

  const renderComments = () => {
    commentsContainer.innerHTML = "";
    if (comments.length > 0) {
      comments.forEach((comment) => {
        const commentItem = document.createElement("div");
        commentItem.style.cssText = [
          "padding: 12px",
          "border-bottom: 1px solid #f0f0f0",
          "background: #fafafa",
        ].join(";");

        const commentContent = document.createElement("div");
        commentContent.textContent = comment.content;
        commentContent.style.cssText = [
          "font-size: 14px",
          "color: #333",
          "margin-bottom: 8px",
          "word-wrap: break-word",
        ].join(";");

        const commentTime = document.createElement("div");
        if (typeof comment?.getFormattedDate === "function") {
          commentTime.textContent = comment.getFormattedDate();
        } else {
          const d = new Date(comment?.createdAt || Date.now());
          commentTime.textContent = d.toLocaleString("zh-CN");
        }
        commentTime.style.cssText = ["font-size: 12px", "color: #999"].join(";");

        commentItem.appendChild(commentContent);
        commentItem.appendChild(commentTime);
        commentsContainer.appendChild(commentItem);
      });
      return;
    }

    const emptyTip = document.createElement("div");
    emptyTip.textContent = "暂无评论";
    emptyTip.style.cssText = [
      "padding: 20px",
      "text-align: center",
      "color: #999",
      "font-size: 14px",
    ].join(";");
    commentsContainer.appendChild(emptyTip);
  };
  renderComments();

  const textarea = document.createElement("textarea");
  textarea.placeholder = "请输入新评论...";
  textarea.style.cssText = [
    "width: 100%",
    "min-height: 80px",
    "padding: 8px",
    "border: 1px solid #ddd",
    "border-radius: 4px",
    "font-size: 14px",
    "font-family: inherit",
    "resize: vertical",
    "margin-bottom: 16px",
    "box-sizing: border-box",
  ].join(";");

  const buttonContainer = document.createElement("div");
  buttonContainer.style.cssText = ["display: flex", "justify-content: flex-end", "gap: 8px"].join(";");

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "✖️";
  cancelBtn.setAttribute("aria-label", "取消");
  cancelBtn.style.cssText = [
    "padding: 6px 16px",
    "border: 1px solid #ddd",
    "background: #fff",
    "border-radius: 4px",
    "cursor: pointer",
    "font-size: 14px",
    "color: #666",
  ].join(";");

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.textContent = "✅";
  confirmBtn.setAttribute("aria-label", "确定");
  confirmBtn.style.cssText = [
    "padding: 6px 16px",
    "border: none",
    "background: #2196f3",
    "border-radius: 4px",
    "cursor: pointer",
    "font-size: 14px",
    "color: #fff",
  ].join(";");

  const closeDialog = () => {
    overlay.remove();
  };

  const refreshComments = () => {
    renderComments();
    const nextCount = comments.length;
    title.textContent = nextCount > 0 ? `评论 (${nextCount})` : "添加评论";
  };

  const submitComment = () => {
    const content = textarea.value.trim();
    const currentTitle = titleInput.value.trim();

    const titleChanged = currentTitle !== (initialTitle || "");
    const hasComment = content !== "";

    if (!titleChanged && !hasComment) {
      logger.warn("没有更改", { toast: { type: "warn", ms: 3000 } });
      return;
    }

    if (titleChanged) {
      showSuccess("✓ 标注已更新", 2000);
      eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.UPDATE, {
        id: annotationId,
        changes: { title: currentTitle || null },
      });
    }

    if (hasComment) {
      const createdAt = new Date().toISOString();

      // Command -> Manager -> Store -> View（Sidebar 不再依赖 COMMENT.ADDED/CRUD 事件驱动 UI）
      eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.COMMENT.ADD, {
        annotationId,
        content,
        createdAt,
      });

      // 对话框内部做本地 UI 更新（避免等待 store/网络回执）
      try {
        comments.push(new Comment({ annotationId, content, createdAt }));
      } catch (e) {
        // fail-fast：Comment 构造不应失败；但这里不阻塞已发出的 command
        logger.warn("[AnnotationCommentDialog] Failed to build local comment model", e);
      }

      refreshComments();
      textarea.value = "";

      if (!titleChanged) {
        showSuccess("✓ 评论已添加", 2000);
      }
      textarea.focus();
    }
  };

  cancelBtn.addEventListener("click", closeDialog);
  confirmBtn.addEventListener("click", submitComment);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeDialog();
    }
  });

  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      submitComment();
    }
  });

  buttonContainer.appendChild(cancelBtn);
  buttonContainer.appendChild(confirmBtn);
  dialog.appendChild(title);
  dialog.appendChild(annotationContent);
  dialog.appendChild(metaContainer);
  dialog.appendChild(idInfo);
  dialog.appendChild(commentsContainer);
  dialog.appendChild(textarea);
  dialog.appendChild(buttonContainer);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  textarea.focus();
}
