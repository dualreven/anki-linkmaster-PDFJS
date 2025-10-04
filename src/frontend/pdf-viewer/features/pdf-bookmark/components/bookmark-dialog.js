/**
 * @file BookmarkDialog 书签对话框组件
 * @module features/pdf-bookmark/components/bookmark-dialog
 * @description 提供书签添加、编辑、删除确认的对话框UI
 */

import { getLogger } from '../../../../common/utils/logger.js';

/**
 * BookmarkDialog 对话框组件类
 * @class BookmarkDialog
 */
export class BookmarkDialog {
  /**
   * 日志记录器
   * @type {import('../../../../common/utils/logger.js').Logger}
   * @private
   */
  #logger;

  /**
   * 对话框容器元素
   * @type {HTMLElement|null}
   * @private
   */
  #dialog = null;

  /**
   * 当前对话框模式
   * @type {'add'|'edit'|'delete'|null}
   * @private
   */
  #mode = null;

  /**
   * 当前书签数据（编辑/删除时使用）
   * @type {Object|null}
   * @private
   */
  #currentBookmark = null;

  /**
   * 回调函数
   * @type {Object}
   * @private
   */
  #callbacks = {
    onConfirm: null,
    onCancel: null
  };

  constructor() {
    this.#logger = getLogger('BookmarkDialog');
  }

  /**
   * 显示添加书签对话框
   * @param {Object} options - 选项
   * @param {number} options.currentPage - 当前页码
   * @param {Function} options.onConfirm - 确认回调 (bookmarkData) => void
   * @param {Function} [options.onCancel] - 取消回调
   * @returns {void}
   */
  showAdd({ currentPage, onConfirm, onCancel }) {
    this.#mode = 'add';
    this.#callbacks.onConfirm = onConfirm;
    this.#callbacks.onCancel = onCancel;

    this.#dialog = this.#createDialog({
      title: '添加书签',
      content: this.#createAddEditForm({ pageNumber: currentPage }),
      buttons: [
        { text: '取消', onClick: () => this.#handleCancel() },
        { text: '添加', onClick: () => this.#handleAddConfirm(), primary: true }
      ]
    });

    document.body.appendChild(this.#dialog);
    this.#logger.info('Add bookmark dialog shown');
  }

  /**
   * 显示编辑书签对话框
   * @param {Object} options - 选项
   * @param {Object} options.bookmark - 书签对象
   * @param {Function} options.onConfirm - 确认回调 (updates) => void
   * @param {Function} [options.onCancel] - 取消回调
   * @returns {void}
   */
  showEdit({ bookmark, onConfirm, onCancel }) {
    this.#mode = 'edit';
    this.#currentBookmark = bookmark;
    this.#callbacks.onConfirm = onConfirm;
    this.#callbacks.onCancel = onCancel;

    this.#dialog = this.#createDialog({
      title: '编辑书签',
      content: this.#createAddEditForm(bookmark),
      buttons: [
        { text: '取消', onClick: () => this.#handleCancel() },
        { text: '保存', onClick: () => this.#handleEditConfirm(), primary: true }
      ]
    });

    document.body.appendChild(this.#dialog);
    this.#logger.info(`Edit bookmark dialog shown: ${bookmark.id}`);
  }

  /**
   * 显示删除确认对话框
   * @param {Object} options - 选项
   * @param {Object} options.bookmark - 书签对象
   * @param {number} [options.childCount] - 子书签数量
   * @param {Function} options.onConfirm - 确认回调 (cascadeDelete) => void
   * @param {Function} [options.onCancel] - 取消回调
   * @returns {void}
   */
  showDelete({ bookmark, childCount = 0, onConfirm, onCancel }) {
    this.#mode = 'delete';
    this.#currentBookmark = bookmark;
    this.#callbacks.onConfirm = onConfirm;
    this.#callbacks.onCancel = onCancel;

    const message = childCount > 0
      ? `确定删除书签"${bookmark.name}"吗？\n该书签包含 ${childCount} 个子书签，将一起被删除。`
      : `确定删除书签"${bookmark.name}"吗？`;

    this.#dialog = this.#createDialog({
      title: '删除书签',
      content: this.#createDeleteConfirm(message),
      buttons: [
        { text: '取消', onClick: () => this.#handleCancel() },
        { text: '删除', onClick: () => this.#handleDeleteConfirm(), primary: true, danger: true }
      ]
    });

    document.body.appendChild(this.#dialog);
    this.#logger.info(`Delete bookmark dialog shown: ${bookmark.id}`);
  }

  /**
   * 创建对话框容器
   * @param {Object} config - 配置
   * @param {string} config.title - 标题
   * @param {HTMLElement} config.content - 内容元素
   * @param {Array} config.buttons - 按钮配置
   * @returns {HTMLElement} 对话框元素
   * @private
   */
  #createDialog({ title, content, buttons }) {
    // 遮罩层
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    // 对话框
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      min-width: 400px;
      max-width: 600px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    `;

    // 标题栏
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px 20px;
      border-bottom: 1px solid #e0e0e0;
      font-size: 18px;
      font-weight: bold;
    `;
    header.textContent = title;

    // 内容区域
    const body = document.createElement('div');
    body.style.cssText = `
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    `;
    body.appendChild(content);

    // 按钮区域
    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 12px 20px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    `;

    buttons.forEach(({ text, onClick, primary, danger }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = text;
      btn.style.cssText = `
        padding: 8px 16px;
        border: 1px solid ${danger ? '#d32f2f' : (primary ? '#1976d2' : '#ccc')};
        border-radius: 4px;
        background-color: ${danger ? '#d32f2f' : (primary ? '#1976d2' : 'white')};
        color: ${primary || danger ? 'white' : '#333'};
        cursor: pointer;
        font-size: 14px;
      `;
      btn.addEventListener('click', onClick);

      btn.addEventListener('mouseenter', () => {
        if (danger) {
          btn.style.backgroundColor = '#b71c1c';
        } else if (primary) {
          btn.style.backgroundColor = '#1565c0';
        } else {
          btn.style.backgroundColor = '#f5f5f5';
        }
      });

      btn.addEventListener('mouseleave', () => {
        if (danger) {
          btn.style.backgroundColor = '#d32f2f';
        } else if (primary) {
          btn.style.backgroundColor = '#1976d2';
        } else {
          btn.style.backgroundColor = 'white';
        }
      });

      footer.appendChild(btn);
    });

    dialog.appendChild(header);
    dialog.appendChild(body);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);

    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.#handleCancel();
      }
    });

    // ESC键关闭
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.#handleCancel();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    return overlay;
  }

  /**
   * 创建添加/编辑表单
   * @param {Object} data - 书签数据
   * @returns {HTMLElement} 表单元素
   * @private
   */
  #createAddEditForm(data) {
    const form = document.createElement('div');
    form.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

    // 书签名称
    form.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <label style="font-weight: bold; font-size: 14px;">书签名称</label>
        <input
          type="text"
          id="bookmark-name"
          value="${data.name || (data.pageNumber ? `第 ${data.pageNumber} 页` : '')}"
          placeholder="请输入书签名称"
          style="padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;"
        />
      </div>

      <div style="display: flex; flex-direction: column; gap: 4px;">
        <label style="font-weight: bold; font-size: 14px;">书签类型</label>
        <div style="display: flex; gap: 16px;">
          <label style="display: flex; align-items: center; gap: 4px;">
            <input type="radio" name="bookmark-type" value="page" ${(data.type === 'page' || !data.type) ? 'checked' : ''} />
            <span>当前页</span>
          </label>
          <label style="display: flex; align-items: center; gap: 4px;">
            <input type="radio" name="bookmark-type" value="region" ${data.type === 'region' ? 'checked' : ''} />
            <span>精确区域</span>
          </label>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 4px;">
        <label style="font-weight: bold; font-size: 14px;">目标页码</label>
        <input
          type="number"
          id="bookmark-page"
          value="${data.pageNumber || 1}"
          min="1"
          style="padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;"
        />
      </div>
    `;

    return form;
  }

  /**
   * 创建删除确认内容
   * @param {string} message - 确认消息
   * @returns {HTMLElement} 内容元素
   * @private
   */
  #createDeleteConfirm(message) {
    const content = document.createElement('div');
    content.style.cssText = 'font-size: 14px; line-height: 1.6; white-space: pre-wrap;';
    content.textContent = message;
    return content;
  }

  /**
   * 处理添加确认
   * @private
   */
  #handleAddConfirm() {
    const name = document.getElementById('bookmark-name').value.trim();
    const type = document.querySelector('input[name="bookmark-type"]:checked').value;
    const pageNumber = parseInt(document.getElementById('bookmark-page').value, 10);

    if (!name) {
      alert('请输入书签名称');
      return;
    }

    if (!pageNumber || pageNumber < 1) {
      alert('请输入有效的页码');
      return;
    }

    const bookmarkData = {
      name,
      type,
      pageNumber
    };

    // 如果是region类型，添加区域信息（当前实现使用默认值）
    if (type === 'region') {
      bookmarkData.region = {
        scrollX: 0,
        scrollY: 0,
        zoom: 1
      };
    }

    if (this.#callbacks.onConfirm) {
      this.#callbacks.onConfirm(bookmarkData);
    }

    this.close();
  }

  /**
   * 处理编辑确认
   * @private
   */
  #handleEditConfirm() {
    const name = document.getElementById('bookmark-name').value.trim();
    const type = document.querySelector('input[name="bookmark-type"]:checked').value;
    const pageNumber = parseInt(document.getElementById('bookmark-page').value, 10);

    if (!name) {
      alert('请输入书签名称');
      return;
    }

    if (!pageNumber || pageNumber < 1) {
      alert('请输入有效的页码');
      return;
    }

    const updates = {
      name,
      type,
      pageNumber
    };

    if (type === 'region') {
      updates.region = this.#currentBookmark.region || {
        scrollX: 0,
        scrollY: 0,
        zoom: 1
      };
    }

    if (this.#callbacks.onConfirm) {
      this.#callbacks.onConfirm(updates);
    }

    this.close();
  }

  /**
   * 处理删除确认
   * @private
   */
  #handleDeleteConfirm() {
    if (this.#callbacks.onConfirm) {
      // cascadeDelete = true (级联删除子书签)
      this.#callbacks.onConfirm(true);
    }

    this.close();
  }

  /**
   * 处理取消
   * @private
   */
  #handleCancel() {
    if (this.#callbacks.onCancel) {
      this.#callbacks.onCancel();
    }

    this.close();
  }

  /**
   * 关闭对话框
   * @returns {void}
   */
  close() {
    if (this.#dialog && this.#dialog.parentNode) {
      this.#dialog.parentNode.removeChild(this.#dialog);
    }

    this.#dialog = null;
    this.#mode = null;
    this.#currentBookmark = null;
    this.#callbacks = { onConfirm: null, onCancel: null };

    this.#logger.info('Dialog closed');
  }
}

export default BookmarkDialog;
