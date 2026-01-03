/**
 * ScreenshotTool 的标注卡片渲染（从 screenshot/index.js 抽离）
 */

/**
 * @param {Object} params
 * @param {Object} params.annotation
 * @param {string} params.icon
 * @param {string} params.displayName
 * @param {(path:string)=>string} params.getImageUrl
 * @param {(text:string)=>string} params.escapeHtml
 * @param {(isoString:string)=>string} params.formatDate
 * @param {(annotationId:string)=>void} params.onJump
 * @param {(annotationId:string)=>void} params.onAddComment
 * @returns {HTMLDivElement}
 */
export function createScreenshotAnnotationCard({
  annotation,
  icon,
  displayName,
  getImageUrl,
  escapeHtml,
  formatDate,
  onJump,
  onAddComment
}) {
  if (!annotation || typeof annotation !== "object") {
    throw new Error("[ScreenshotCard] annotation is required");
  }
  if (typeof annotation.id !== "string" || !annotation.id.trim()) {
    throw new Error("[ScreenshotCard] annotation.id must be a non-empty string");
  }
  if (!annotation.data || typeof annotation.data !== "object") {
    throw new Error("[ScreenshotCard] annotation.data is required");
  }
  if (!Array.isArray(annotation.comments)) {
    throw new Error("[ScreenshotCard] annotation.comments must be an array");
  }
  if (typeof icon !== "string") {
    throw new Error("[ScreenshotCard] icon must be a string");
  }
  if (typeof displayName !== "string") {
    throw new Error("[ScreenshotCard] displayName must be a string");
  }
  if (typeof getImageUrl !== "function") {
    throw new Error("[ScreenshotCard] getImageUrl must be a function");
  }
  if (typeof escapeHtml !== "function") {
    throw new Error("[ScreenshotCard] escapeHtml must be a function");
  }
  if (typeof formatDate !== "function") {
    throw new Error("[ScreenshotCard] formatDate must be a function");
  }
  if (typeof onJump !== "function") {
    throw new Error("[ScreenshotCard] onJump must be a function");
  }
  if (typeof onAddComment !== "function") {
    throw new Error("[ScreenshotCard] onAddComment must be a function");
  }

  const card = document.createElement("div");
  card.className = "annotation-card screenshot-card";
  card.dataset.annotationId = annotation.id;
  card.dataset.annotationType = annotation.type;

  const imageData = annotation.data.imageData;
  const imagePath = annotation.data.imagePath;

  const imageUrl = (typeof imageData === "string" && imageData)
    ? imageData
    : getImageUrl(imagePath);

  card.innerHTML = `
    <div class="annotation-card-header" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="annotation-icon" style="font-size: 18px;">${icon}</span>
        <span class="annotation-type" style="font-weight: 600; color: #333;">${displayName}标注</span>
      </div>
      <button class="card-menu-btn" style="border: none; background: transparent; cursor: pointer; font-size: 16px;">⋮</button>
    </div>
    <div class="annotation-card-body" style="padding: 12px;">
      <img
        src="${imageUrl}"
        alt="截图"
        class="screenshot-thumbnail"
        style="max-width: 100%; border-radius: 4px; margin-bottom: 8px; display: block;"
        onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22100%22><rect fill=%22%23ddd%22 width=%22200%22 height=%22100%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23999%22>加载失败</text></svg>'"
      >
      ${annotation.data.description ? `<p class="annotation-description" style="color: #666; font-size: 14px; margin: 8px 0;">${escapeHtml(annotation.data.description)}</p>` : ""}
      <div class="annotation-meta" style="display: flex; gap: 12px; font-size: 12px; color: #999; margin-top: 8px;">
        <span>📄 P.${annotation.pageNumber}</span>
        <span>🕒 ${formatDate(annotation.createdAt)}</span>
      </div>
    </div>
    <div class="annotation-card-footer" style="display: flex; gap: 8px; padding: 8px; border-top: 1px solid #eee;">
      <button class="jump-btn" data-annotation-id="${annotation.id}" style="flex: 1; padding: 6px; border: 1px solid #2196f3; background: white; color: #2196f3; border-radius: 4px; cursor: pointer;">→ 跳转</button>
      <button class="comment-btn" data-annotation-id="${annotation.id}" style="flex: 1; padding: 6px; border: 1px solid #ddd; background: white; color: #666; border-radius: 4px; cursor: pointer;">💬 ${annotation.comments.length}条评论</button>
    </div>
  `;

  const jumpButton = card.querySelector(".jump-btn");
  if (!jumpButton) {
    throw new Error("[ScreenshotCard] jump button not found");
  }
  jumpButton.addEventListener("click", () => onJump(annotation.id));

  const commentButton = card.querySelector(".comment-btn");
  if (!commentButton) {
    throw new Error("[ScreenshotCard] comment button not found");
  }
  commentButton.addEventListener("click", () => onAddComment(annotation.id));

  return card;
}

