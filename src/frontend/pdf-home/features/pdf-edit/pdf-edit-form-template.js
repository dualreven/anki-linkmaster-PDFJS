export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text ?? "");
  return div.innerHTML;
}

/**
 * @param {object} record
 * @returns {string}
 */
export function buildPdfEditFormHTML(record) {
  return `
      <form id="pdf-edit-form" class="pdf-edit-form">
        <div class="form-group">
          <label for="edit-filename">文件名</label>
          <input
            type="text"
            id="edit-filename"
            name="filename"
            value="${escapeHtml(record?.filename || "")}"
            readonly
            class="readonly"
          />
        </div>

        <div class="form-group">
          <label for="edit-title">书名</label>
          <input
            type="text"
            id="edit-title"
            name="title"
            value="${escapeHtml(record?.title || "")}"
            placeholder="请输入书名..."
          />
        </div>

        <div class="form-group">
          <label for="edit-author">作者</label>
          <input
            type="text"
            id="edit-author"
            name="author"
            value="${escapeHtml(record?.author || "")}"
            placeholder="请输入作者..."
          />
        </div>

        <div class="form-group">
          <label for="edit-subject">主题</label>
          <input
            type="text"
            id="edit-subject"
            name="subject"
            value="${escapeHtml(record?.subject || "")}"
            placeholder="请输入主题..."
          />
        </div>

        <div class="form-group">
          <label for="edit-keywords">关键词</label>
          <input
            type="text"
            id="edit-keywords"
            name="keywords"
            value="${escapeHtml(record?.keywords || "")}"
            placeholder="请输入关键词（用逗号分隔）..."
          />
        </div>

        <div class="form-group">
          <label for="edit-rating">评分</label>
          <div id="edit-rating" class="star-rating-container"></div>
        </div>

        <div class="form-group">
          <label for="edit-tags">标签</label>
          <div id="edit-tags" class="tags-input-container"></div>
        </div>

        <div class="form-group">
          <label for="edit-notes">备注</label>
          <textarea
            id="edit-notes"
            name="notes"
            rows="4"
            placeholder="添加备注..."
          >${escapeHtml(record?.notes || "")}</textarea>
        </div>

        <div class="form-group">
          <label>重置工具</label>
          <div class="reset-actions" style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" id="reset-bookmarks-btn" title="清空后端书签，下次打开查看器将自动从PDF源重新导入">重置书签</button>
            <button type="button" id="reset-annotations-btn" disabled title="等待后端支持后启用">重置标注</button>
            <button type="button" id="reset-reading-btn" title="将阅读进度与总时长清零">重置阅读进度</button>
          </div>
          <small style="color:#666; display:block; margin-top:6px;">重置书签会清空当前数据库书签；下次打开PDF查看器时，会自动从PDF原生书签导入并保存。</small>
        </div>
      </form>
    `;
}

