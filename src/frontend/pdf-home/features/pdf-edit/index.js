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
import { PDF_MANAGEMENT_EVENTS, WEBSOCKET_EVENTS } from '../../../common/event/event-constants.js';
import { getLogger } from '../../../common/utils/logger.js';
import { ModalManager } from './components/modal-manager.js';
import { StarRating } from './components/star-rating.js';
import { TagsInput } from './components/tags-input.js';
import { ToggleSwitch } from './components/toggle-switch.js';

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
            alert('请先选择一条PDF记录');
            return;
          }

          if (selectedIndices.length > 1) {
            this.#logger.warn('Multiple rows selected, only editing the first one');
            alert('您选择了多条记录，将只编辑第一条');
          }

          // 获取第一个选中行的数据
          const firstIndex = selectedIndices[0];
          const rowData = items[firstIndex];

          if (!rowData) {
            this.#logger.error(`Item at index ${firstIndex} not found`);
            alert('无法获取选中的PDF记录');
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
      alert('系统未正确初始化，请刷新页面');

    } catch (error) {
      this.#logger.error('Error handling edit button click:', error);
      this.#logger.error('Error stack:', error.stack);
      alert('获取选中记录失败，请重试');
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
          <label for="edit-read-status">已读状态</label>
          <div id="edit-read-status" class="toggle-switch-container"></div>
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
      </form>
    `;
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

    // 已读状态开关
    const readStatusContainer = document.getElementById('edit-read-status');
    this.#formComponents.readStatus = new ToggleSwitch({
      container: readStatusContainer,
      checked: record.is_read || false,
      label: record.is_read ? '已读' : '未读',
      onChange: (checked) => {
        // 更新标签文本
        this.#formComponents.readStatus.setLabel(checked ? '已读' : '未读');
      }
    });
  }

  /**
   * 处理表单提交
   * @private
   */
  #handleFormSubmit() {
    console.log('🔥🔥🔥 FORM SUBMIT TRIGGERED! 🔥🔥🔥');
    try {
      // 收集表单数据
      const updates = {
        title: document.getElementById('edit-title').value.trim(),
        author: document.getElementById('edit-author').value.trim(),
        subject: document.getElementById('edit-subject').value.trim(),
        keywords: document.getElementById('edit-keywords').value.trim(),
        rating: this.#formComponents.rating.getValue(),
        tags: this.#formComponents.tags.getTags(),
        is_read: this.#formComponents.readStatus.isChecked(),
        notes: document.getElementById('edit-notes').value.trim()
      };

      console.log('📝 Form data collected:', updates);
      this.#logger.info('Submitting edit for:', this.#currentRecord.pdf_id || this.#currentRecord.id);
      this.#logger.debug('Updates:', updates);

      // 发送全局更新事件
      this.#globalEventBus.emitGlobal(
        PDF_MANAGEMENT_EVENTS.EDIT.STARTED,
        {
          pdf_id: this.#currentRecord.pdf_id || this.#currentRecord.id,
          filename: this.#currentRecord.filename,
          updates
        },
        { actorId: 'PDFEditFeature' }
      );

      // 发送WebSocket消息到后端
      this.#sendEditRequestToBackend(this.#currentRecord.pdf_id || this.#currentRecord.id, updates);

      // 关闭模态框
      this.#modalManager.hide();

    } catch (error) {
      this.#logger.error('Form submission failed:', error);
    }
  }

  /**
   * 发送编辑请求到后端
   * @private
   * @param {string} fileId - 文件ID
   * @param {Object} updates - 更新数据
   */
  #sendEditRequestToBackend(fileId, updates) {
    console.log('📤 Sending to backend:', { fileId, updates });
    try {
      this.#logger.info('Sending edit request to backend:', { fileId, updates });

      const message = {
        type: 'update_pdf',
        request_id: `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        data: {
          file_id: fileId,
          updates: updates
        }
      };
      console.log('📧 WebSocket message:', message);

      // 通过ScopedEventBus发送全局WebSocket消息（功能域架构标准方式）
      this.#scopedEventBus.emitGlobal(WEBSOCKET_EVENTS.MESSAGE.SEND, message, { actorId: 'PDFEditFeature' });

      console.log('✅ Message emitted via scopedEventBus.emitGlobal');

    } catch (error) {
      console.error('❌ Send error:', error);
      this.#logger.error('Failed to send edit request:', error);
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
