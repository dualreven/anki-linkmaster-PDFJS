/**
 * @file PDF Edit 功能域入口
 * @module features/pdf-edit
 * @description
 * PDF记录编辑功能域，提供通过模态框编辑PDF元数据的功能
 *
 * 实现了IFeature接口，可通过FeatureRegistry进行注册和管理
 */

import { PDF_EDIT_FEATURE_CONFIG } from './feature.config.js';
import { PDF_EDIT_EVENTS, createEditRequestedData, createEditCompletedData } from './events.js';
import { PDF_MANAGEMENT_EVENTS, WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from '../../../common/event/event-constants.js';
import { showInfo as notifyInfo, showSuccess as notifySuccess, showError as notifyError } from '../../../common/utils/notification.js';
import { getLogger } from '../../../common/utils/logger.js';
import { ModalManager } from './components/modal-manager.js';
import { StarRating } from './components/star-rating.js';
import { TagsInput } from './components/tags-input.js';

// 导入样式
import './styles/modal.css';
import './styles/form-components.css';

/**
 * PDF Edit 功能域类
 * @class PDFEditFeature
 * @implements {IFeature}
 */
export class PDFEditFeature {
  // 私有字段
  #context = null;
  #scopedEventBus = null;
  #globalEventBus = null;
  #wsClient = null;
  #logger = null;
  #enabled = false;
  #unsubscribers = [];

  // UI组件
  #modalManager = null;
  #currentRecord = null;
  #formComponents = {};
  #editButton = null;
  #awaitingSuccess = false;
  #awaitingTimer = null;

  // ==================== IFeature 接口实现 ====================

  /**
   * 功能名称（唯一标识）
   * @returns {string}
   */
  get name() {
    return PDF_EDIT_FEATURE_CONFIG.name;
  }

  /**
   * 功能版本
   * @returns {string}
   */
  get version() {
    return PDF_EDIT_FEATURE_CONFIG.version;
  }

  /**
   * 功能描述
   * @returns {string}
   */
  get description() {
    return PDF_EDIT_FEATURE_CONFIG.description;
  }

  /**
   * 功能依赖
   * @returns {string[]}
   */
  get dependencies() {
    return PDF_EDIT_FEATURE_CONFIG.dependencies;
  }

  /**
   * 安装功能
   * @param {import('../../../common/micro-service/feature-registry.js').FeatureContext} context - 功能上下文
   * @returns {Promise<void>}
   */
  async install(context) {
    this.#context = context;
    this.#scopedEventBus = context.scopedEventBus;
    this.#logger = context.logger || getLogger(`Feature.${this.name}`);

    this.#logger.info(`Installing ${this.name} v${this.version}...`);

    try {
      // 1. 获取全局事件总线和WebSocket客户端
      this.#logger.debug('Step 1: Setting up services...');
      await this.#setupServices(context);

      // 2. 注册事件监听器
      this.#logger.debug('Step 2: Registering event listeners...');
      this.#registerEventListeners();

      // 3. 初始化UI
      this.#logger.debug('Step 3: Initializing UI...');
      await this.#initializeUI();

      // 4. 标记为已启用
      this.#enabled = true;

      this.#logger.info(`${this.name} installed successfully`);
    } catch (error) {
      // 详细的错误日志
      this.#logger.error(`Failed to install ${this.name}:`);
      this.#logger.error(`Error name: ${error.name}`);
      this.#logger.error(`Error message: ${error.message}`);
      this.#logger.error(`Error stack: ${error.stack}`);
      throw error;
    }
  }

  /**
   * 卸载功能
   * @param {import('../../../common/micro-service/feature-registry.js').FeatureContext} context - 功能上下文
   * @returns {Promise<void>}
   */
  async uninstall(context) {
    this.#logger.info(`Uninstalling ${this.name}...`);

    try {
      // 1. 取消所有事件监听
      this.#unregisterEventListeners();

      // 2. 清理UI
      await this.#cleanupUI();

      // 3. 清理服务引用
      this.#globalEventBus = null;
      this.#wsClient = null;
      this.#currentRecord = null;

      // 4. 标记为未启用
      this.#enabled = false;

      this.#logger.info(`${this.name} uninstalled successfully`);
    } catch (error) {
      this.#logger.error(`Failed to uninstall ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * 启用功能
   * @returns {Promise<void>}
   */
  async enable() {
    if (this.#enabled) {
      this.#logger.debug(`${this.name} is already enabled`);
      return;
    }

    this.#logger.info(`Enabling ${this.name}...`);
    this.#registerEventListeners();
    this.#enabled = true;
    this.#logger.info(`${this.name} enabled`);
  }

  /**
   * 禁用功能
   * @returns {Promise<void>}
   */
  async disable() {
    if (!this.#enabled) {
      this.#logger.debug(`${this.name} is already disabled`);
      return;
    }

    this.#logger.info(`Disabling ${this.name}...`);
    this.#unregisterEventListeners();
    this.#enabled = false;
    this.#logger.info(`${this.name} disabled`);
  }

  // ==================== 私有方法 ====================

  /**
   * 设置服务
   * @private
   * @param {Object} context - 功能上下文
   */
  async #setupServices(context) {
    const globalContainer = context.container;

    // 从容器获取全局事件总线
    if (globalContainer && globalContainer.has && globalContainer.has('eventBus')) {
      this.#globalEventBus = globalContainer.get('eventBus');
      this.#logger.debug('EventBus service acquired from container');
    } else {
      throw new Error('Global EventBus not available in container');
    }

    // 从容器获取WebSocket客户端
    if (globalContainer && globalContainer.has && globalContainer.has('wsClient')) {
      this.#wsClient = globalContainer.get('wsClient');
      this.#logger.debug('WSClient service acquired from container');
    } else {
      this.#logger.warn('WSClient not available, edit submission may not work');
    }

    this.#logger.debug('Services setup completed');
  }

  /**
   * 注册事件监听器
   * @private
   */
  #registerEventListeners() {
    // 监听全局编辑请求事件（来自pdf-table）
    const unsubEditRequested = this.#globalEventBus.on(
      PDF_MANAGEMENT_EVENTS.EDIT.REQUESTED,
      this.#handleEditRequested.bind(this)
    );
    this.#unsubscribers.push(unsubEditRequested);

    // 监听全局编辑完成事件（来自后端）
    const unsubEditCompleted = this.#globalEventBus.on(
      PDF_MANAGEMENT_EVENTS.EDIT.COMPLETED,
      this.#handleEditCompleted.bind(this)
    );
    this.#unsubscribers.push(unsubEditCompleted);

    // 监听通用 WebSocket 消息（仅处理失败；成功延后到搜索刷新后再提示）
    const unsubWsAny = this.#globalEventBus.on(
      WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
      (message) => {
        try {
          const t = String(message?.type || '');
          if (t === WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_COMPLETED) {
            // 标记等待在刷新后显示成功提示
            this.#awaitingSuccess = true;
          } else if (t === WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_FAILED) {
            const msg = message?.message || message?.error?.message || '操作失败';
            try { notifyError(`更新失败-${msg}`, 5000); } catch (_) {}
            this.#awaitingSuccess = false;
            if (this.#awaitingTimer) { clearTimeout(this.#awaitingTimer); this.#awaitingTimer = null; }
          }
        } catch (_) {}
      }
    );
    this.#unsubscribers.push(unsubWsAny);

    // 在搜索结果刷新后，再显示“更新完成”，避免被 SearchFeature.hideAll() 立即 destroy
    const unsubSearchUpdated = this.#globalEventBus.on('search:results:updated', () => {
      if (this.#awaitingSuccess) {
        this.#awaitingSuccess = false;
        if (this.#awaitingTimer) { clearTimeout(this.#awaitingTimer); this.#awaitingTimer = null; }
        try { notifySuccess('更新完成', 3500); } catch (_) {}
      }
    });
    this.#unsubscribers.push(unsubSearchUpdated);

    this.#logger.debug('Event listeners registered');
  }

  /**
   * 取消事件监听器
   * @private
   */
  #unregisterEventListeners() {
    this.#unsubscribers.forEach(unsub => unsub());
    this.#unsubscribers = [];
    this.#logger.debug('Event listeners unregistered');
  }

  /**
   * 初始化UI
   * @private
   */
  async #initializeUI() {
    // 创建模态框管理器
    this.#modalManager = new ModalManager({
      eventBus: this.#globalEventBus
    });

    // 获取header编辑按钮并绑定事件
    this.#editButton = document.getElementById('edit-pdf-btn');
    if (this.#editButton) {
      const handleEditClick = this.#handleEditButtonClick.bind(this);
      this.#editButton.addEventListener('click', handleEditClick);
      // 添加到unsubscribers以便清理
      this.#unsubscribers.push(() => this.#editButton.removeEventListener('click', handleEditClick));
      // 按钮默认是disabled状态，点击时会检查选中状态
      this.#editButton.disabled = false;  // 启用按钮，让用户可以点击
      this.#logger.debug('Edit button bound');
    } else {
      this.#logger.warn('Edit button not found in DOM');
    }

    this.#logger.debug('UI initialized');
  }

  /**
   * 清理UI
   * @private
   */
  async #cleanupUI() {
    if (this.#modalManager) {
      this.#modalManager.destroy();
      this.#modalManager = null;
    }

    // 清理表单组件
    Object.values(this.#formComponents).forEach(component => {
      if (component && component.destroy) {
        component.destroy();
      }
    });
    this.#formComponents = {};

    this.#logger.debug('UI cleaned up');
  }

  /**
   * 显示全局错误消息（Toast形式）
   * @private
   * @param {string} message - 错误消息
   */
  #showGlobalError(message) {
    const errorDiv = document.getElementById('global-error');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.classList.add('show');

      // 3秒后自动隐藏
      setTimeout(() => {
        errorDiv.classList.remove('show');
      }, 3000);
    }
  }

  /**
   * 显示全局警告消息（Toast形式）
   * @private
   * @param {string} message - 警告消息
   */
  #showGlobalWarning(message) {
    const errorDiv = document.getElementById('global-error');
    if (errorDiv) {
      // 临时改为警告样式
      errorDiv.classList.remove('toast-error');
      errorDiv.classList.add('toast-warning');
      errorDiv.textContent = message;
      errorDiv.classList.add('show');

      // 3秒后自动隐藏并恢复样式
      setTimeout(() => {
        errorDiv.classList.remove('show');
        setTimeout(() => {
          errorDiv.classList.remove('toast-warning');
          errorDiv.classList.add('toast-error');
        }, 300);
      }, 3000);
    }
  }

  /**
   * 处理编辑按钮点击
   * @private
   */
  #handleEditButtonClick() {
    try {
      this.#logger.info('Edit button clicked');

      // 从容器获取状态管理器
      const globalContainer = this.#context.container;
      let stateManager = null;

      if (globalContainer && globalContainer.has && globalContainer.has('stateManager')) {
        stateManager = globalContainer.get('stateManager');
        this.#logger.debug('StateManager acquired from container');
      }

      if (stateManager) {
        // 从状态管理器获取 pdf-list 的状态
        const listState = stateManager.getState('pdf-list');

        if (listState) {
          const selectedIndices = listState.selectedIndices || [];
          const items = listState.items || [];

          this.#logger.debug(`Selected indices: ${selectedIndices.length}, Total items: ${items.length}`);

          if (selectedIndices.length === 0) {
            this.#logger.warn('No row selected');
            this.#showGlobalError('请先选择一条PDF记录');
            return;
          }

          if (selectedIndices.length > 1) {
            this.#logger.warn('Multiple rows selected, only editing the first one');
            this.#showGlobalWarning('您选择了多条记录，将只编辑第一条');
          }

          // 获取第一个选中行的数据
          const firstIndex = selectedIndices[0];
          const rowData = items[firstIndex];

          if (!rowData) {
            this.#logger.error(`Item at index ${firstIndex} not found`);
            this.#showGlobalError('无法获取选中的PDF记录');
            return;
          }

          this.#logger.info('Editing record:', rowData.filename || rowData.id);
          this.#handleEditRequested(rowData);
          return;
        } else {
          this.#logger.warn('pdf-list state not found in StateManager');
        }
      }

      // 如果无法获取状态，提示用户
      this.#logger.error('StateManager not available or pdf-list state not found');
      this.#showGlobalError('系统未正确初始化，请刷新页面');

    } catch (error) {
      this.#logger.error('Error handling edit button click:', error);
      this.#logger.error('Error stack:', error.stack);
      this.#showGlobalError('获取选中记录失败，请重试');
    }
  }

  /**
   * 处理编辑请求事件
   * @private
   * @param {Object} record - PDF记录对象
   */
  async #handleEditRequested(record) {
    this.#logger.info('Edit requested for record:', record.filename || record.id);

    this.#currentRecord = record;

    // 构建表单内容
    const formHTML = this.#buildFormHTML(record);

    // 显示模态框（等待DOM渲染完成）
    await this.#modalManager.show({
      title: '编辑PDF记录',
      content: formHTML,
      onConfirm: this.#handleFormSubmit.bind(this),
      onCancel: this.#handleFormCancel.bind(this),
      confirmText: '保存',
      cancelText: '取消'
    });

    // 等待模态框DOM完全渲染（使用requestAnimationFrame确保DOM已准备好）
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // 初始化表单组件
    this.#initializeFormComponents(record);
    // 绑定重置操作按钮
    this.#bindResetActions(record);
  }

  /**
   * 构建表单HTML
   * @private
   * @param {Object} record - PDF记录对象
   * @returns {string} HTML字符串
   */
  #buildFormHTML(record) {
    return `
      <form id="pdf-edit-form" class="pdf-edit-form">
        <div class="form-group">
          <label for="edit-filename">文件名</label>
          <input
            type="text"
            id="edit-filename"
            name="filename"
            value="${this.#escapeHtml(record.filename || '')}"
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
            value="${this.#escapeHtml(record.title || '')}"
            placeholder="请输入书名..."
          />
        </div>

        <div class="form-group">
          <label for="edit-author">作者</label>
          <input
            type="text"
            id="edit-author"
            name="author"
            value="${this.#escapeHtml(record.author || '')}"
            placeholder="请输入作者..."
          />
        </div>

        <div class="form-group">
          <label for="edit-subject">主题</label>
          <input
            type="text"
            id="edit-subject"
            name="subject"
            value="${this.#escapeHtml(record.subject || '')}"
            placeholder="请输入主题..."
          />
        </div>

        <div class="form-group">
          <label for="edit-keywords">关键词</label>
          <input
            type="text"
            id="edit-keywords"
            name="keywords"
            value="${this.#escapeHtml(record.keywords || '')}"
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
          >${this.#escapeHtml(record.notes || '')}</textarea>
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

  /**
   * 绑定“重置”按钮行为
   * @param {Object} record
   * @private
   */
  #bindResetActions(record) {
    const fileId = record?.pdf_id || record?.id || record?.filename;
    const pdfUuid = record?.pdf_id || record?.id; // 期望是12位十六进制

    const warnInvalidId = () => {
      this.#showGlobalWarning('无法识别PDF ID，重置可能不会同步到后端');
    };

    // 重置书签：通过 BOOKMARK_SAVE 发送空集合
    const btnBookmarks = document.getElementById('reset-bookmarks-btn');
    if (btnBookmarks) {
      btnBookmarks.addEventListener('click', async () => {
        try {
          if (!pdfUuid) {
            warnInvalidId();
          }
          const ok = window.confirm('确定要重置书签吗？这将清空后端书签记录。\n下次打开PDF查看器时将从PDF原生书签重新导入。');
          if (!ok) return;
          if (!this.#wsClient) {
            this.#showGlobalError('WebSocket未连接，无法执行重置');
            return;
          }
          await this.#wsClient.request(
            WEBSOCKET_MESSAGE_TYPES.BOOKMARK_SAVE,
            { pdf_uuid: pdfUuid, bookmarks: [], root_ids: [] },
            { timeout: 8000 }
          );
          this.#showGlobalWarning('书签已重置。请重新打开PDF查看器以从源导入书签。');
        } catch (err) {
          this.#showGlobalError(`重置书签失败: ${err?.message || err}`);
        }
      });
    }

    // 重置阅读进度：通过 pdf-library:record-update:requested 将 visited_at/total_reading_time 清零
    const btnReading = document.getElementById('reset-reading-btn');
    if (btnReading) {
      btnReading.addEventListener('click', async () => {
        try {
          if (!fileId) {
            warnInvalidId();
          }
          const ok = window.confirm('确定要重置阅读进度吗？这将清零阅读时长与最近访问时间。');
          if (!ok) return;
          if (!this.#wsClient) {
            this.#showGlobalError('WebSocket未连接，无法执行重置');
            return;
          }
          await this.#wsClient.request(
            WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_REQUESTED,
            { file_id: fileId, updates: { total_reading_time: 0, visited_at: 0 } },
            { timeout: 8000 }
          );
          this.#showGlobalWarning('阅读进度已重置');
        } catch (err) {
          this.#showGlobalError(`重置阅读进度失败: ${err?.message || err}`);
        }
      });
    }
  }

  /**
   * 初始化表单组件
   * @private
   * @param {Object} record - PDF记录对象
   */
  #initializeFormComponents(record) {
    // 星级评分组件
    const ratingContainer = document.getElementById('edit-rating');
    this.#formComponents.rating = new StarRating({
      container: ratingContainer,
      value: record.rating || 0,
      maxStars: 5
    });

    // 标签输入组件
    const tagsContainer = document.getElementById('edit-tags');
    this.#formComponents.tags = new TagsInput({
      container: tagsContainer,
      tags: record.tags || [],
      placeholder: '添加标签...',
      maxTags: 10
    });
  }

  /**
   * 处理表单提交
   * @private
   */
  #handleFormSubmit() {
    this.#logger.info('=== FORM SUBMIT TRIGGERED ===');
    try {
      // 收集表单数据
      const updates = {
        title: document.getElementById('edit-title').value.trim(),
        author: document.getElementById('edit-author').value.trim(),
        subject: document.getElementById('edit-subject').value.trim(),
        keywords: document.getElementById('edit-keywords').value.trim(),
        rating: this.#formComponents.rating.getValue(),
        tags: this.#formComponents.tags.getTags(),
        notes: document.getElementById('edit-notes').value.trim()
      };

      this.#logger.info('Form data collected:', updates);
      this.#logger.info('Submitting edit for:', this.#currentRecord.pdf_id || this.#currentRecord.id);

      // 发送全局更新事件
      this.#scopedEventBus.emitGlobal(
        PDF_MANAGEMENT_EVENTS.EDIT.STARTED,
        {
          pdf_id: this.#currentRecord.pdf_id || this.#currentRecord.id,
          filename: this.#currentRecord.filename,
          updates
        },
        { actorId: 'PDFEditFeature' }
      );
      // Toast：更新中（与其他功能一致，短暂提示）
      try { notifyInfo('更新中', 1200); } catch (_) {}

      // 发送WebSocket消息到后端并等待结果
      (async () => {
        try {
          await this.#sendEditRequestToBackend(this.#currentRecord.pdf_id || this.#currentRecord.id, updates);
          // 刷新当前搜索结果（若存在搜索框），成功提示在刷新后显示
          try {
            const input = document.querySelector('.search-input');
            const searchText = (input && typeof input.value === 'string') ? input.value.trim() : '';
            this.#scopedEventBus.emitGlobal('search:query:requested', { searchText });
          } catch (_e) {
            // 忽略刷新异常
          }
          // 兜底：若未触发搜索刷新事件，延时显示成功
          this.#awaitingTimer = setTimeout(() => {
            if (this.#awaitingSuccess) {
              this.#awaitingSuccess = false;
              try { notifySuccess('更新完成', 3500); } catch (_) {}
            }
          }, 1200);
        } catch (err) {
          const msg = err?.message || '未知错误';
          try { notifyError(`更新失败-${msg}`, 5000); } catch (_) {}
        }
      })();

      // 关闭模态框（不阻塞等待）
      this.#modalManager.hide();

    } catch (error) {
      this.#logger.error('Form submission failed:', error);
      try { notifyError(`更新失败-${error?.message || '表单提交异常'}`, 5000); } catch (_) {}
    }
  }

  /**
   * 发送编辑请求到后端
   * @private
   * @param {string} fileId - 文件ID
   * @param {Object} updates - 更新数据
   */
  async #sendEditRequestToBackend(fileId, updates) {
    this.#logger.info('=== Sending edit request to backend ===', { fileId, updates });
    try {
      // 使用标准契约：pdf-library:record-update:requested
      if (this.#wsClient) {
        await this.#wsClient.request(
          WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_REQUESTED,
          { file_id: fileId, updates: updates },
          { timeout: 8000 }
        );
        this.#logger.info('PDF record update request sent via WSClient');
      } else {
        // 兜底：通过全局事件发送（保持向后兼容）
        const message = {
          type: WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_REQUESTED,
          request_id: `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          data: { file_id: fileId, updates }
        };
        this.#scopedEventBus.emitGlobal(WEBSOCKET_EVENTS.MESSAGE.SEND, message, { actorId: 'PDFEditFeature' });
        this.#logger.info('PDF record update emitted via EventBus');
      }

    } catch (error) {
      this.#logger.error('Failed to send edit request:', error);
      try { this.#logger.error('Error details:', error.stack); } catch (_) {}
      throw (error instanceof Error ? error : new Error(error?.message || '编辑请求失败'));
    }
  }

  /**
   * 处理表单取消
   * @private
   */
  #handleFormCancel() {
    this.#logger.info('Edit cancelled');
    this.#currentRecord = null;
  }

  /**
   * 处理编辑完成事件
   * @private
   * @param {Object} data - 编辑完成数据
   */
  #handleEditCompleted(data) {
    this.#logger.info('Edit completed:', data);
    // TODO: 显示成功提示或更新UI
  }

  /**
   * HTML转义
   * @private
   * @param {string} text - 要转义的文本
   * @returns {string} 转义后的文本
   */
  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

/**
 * 导出功能实例（供FeatureRegistry使用）
 */
export default PDFEditFeature;


