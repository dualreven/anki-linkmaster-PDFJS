/**
 * @file PDF Editor 功能域入口
 * @module features/pdf-editor
 * @description
 * PDF 记录编辑器功能域，提供 PDF 记录的编辑功能（星标、标签、备注等）。
 *
 * 实现了 IFeature 接口，可通过 FeatureRegistry 进行注册和管理。
 *
 * @example
 * import { PDFEditorFeature } from './features/pdf-editor/index.js';
 * import { FeatureRegistry } from './core/feature-registry.js';
 *
 * const registry = new FeatureRegistry({ container });
 * registry.register(new PDFListFeature());
 * registry.register(new PDFEditorFeature()); // 依赖 pdf-list
 * await registry.installAll();
 */

import { PDFEditorFeatureConfig } from './feature.config.js';
import { getLogger } from '../../../common/utils/logger.js';

/**
 * PDF Editor 功能域类
 * @class PDFEditorFeature
 * @implements {IFeature}
 */
export class PDFEditorFeature {
  /**
   * 功能上下文（在 install 时注入）
   * @type {import('../../core/feature-registry.js').FeatureContext|null}
   * @private
   */
  #context = null;

  /**
   * 作用域事件总线
   * @type {import('../../common/event/scoped-event-bus.js').ScopedEventBus|null}
   * @private
   */
  #scopedEventBus = null;

  /**
   * 日志记录器
   * @type {import('../../common/utils/logger.js').Logger|null}
   * @private
   */
  #logger = null;

  /**
   * 模态对话框 DOM 元素
   * @type {HTMLElement|null}
   * @private
   */
  #modalElement = null;

  /**
   * 当前编辑的记录
   * @type {Object|null}
   * @private
   */
  #currentRecord = null;

  /**
   * 事件取消订阅函数列表
   * @type {Function[]}
   * @private
   */
  #unsubscribers = [];

  /**
   * 功能是否已启用
   * @type {boolean}
   * @private
   */
  #enabled = false;

  // ==================== IFeature 接口实现 ====================

  /**
   * 功能名称（唯一标识）
   * @returns {string}
   */
  get name() {
    return PDFEditorFeatureConfig.name;
  }

  /**
   * 功能版本
   * @returns {string}
   */
  get version() {
    return PDFEditorFeatureConfig.version;
  }

  /**
   * 功能依赖列表
   * @returns {string[]}
   */
  get dependencies() {
    return PDFEditorFeatureConfig.dependencies;
  }

  /**
   * 安装功能（初始化逻辑）
   * @param {import('../../core/feature-registry.js').FeatureContext} context - 功能上下文
   * @returns {Promise<void>}
   */
  async install(context) {
    this.#context = context;
    this.#scopedEventBus = context.scopedEventBus;
    this.#logger = context.logger || getLogger(`Feature.${this.name}`);

    this.#logger.info(`Installing ${this.name} v${this.version}...`);

    try {
      // 1. 创建模态对话框 UI
      this.#createModalUI();

      // 2. 注册事件监听器
      this.#registerEventListeners();

      // 3. 标记为已启用
      this.#enabled = true;

      this.#logger.info(`${this.name} installed successfully`);
    } catch (error) {
      this.#logger.error(`Failed to install ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * 卸载功能（清理逻辑）
   * @param {import('../../core/feature-registry.js').FeatureContext} context - 功能上下文
   * @returns {Promise<void>}
   */
  async uninstall(context) {
    this.#logger.info(`Uninstalling ${this.name}...`);

    try {
      // 1. 取消所有事件监听
      this.#unregisterEventListeners();

      // 2. 销毁模态对话框 UI
      this.#destroyModalUI();

      // 3. 清理状态
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
   * 启用功能（可选）
   * @returns {Promise<void>}
   */
  async enable() {
    if (this.#enabled) {
      this.#logger.debug(`${this.name} is already enabled`);
      return;
    }

    this.#logger.info(`Enabling ${this.name}...`);

    // 重新注册事件监听器
    this.#registerEventListeners();

    this.#enabled = true;
    this.#logger.info(`${this.name} enabled`);
  }

  /**
   * 禁用功能（可选）
   * @returns {Promise<void>}
   */
  async disable() {
    if (!this.#enabled) {
      this.#logger.debug(`${this.name} is already disabled`);
      return;
    }

    this.#logger.info(`Disabling ${this.name}...`);

    // 关闭编辑器（如果打开）
    this.closeEditor();

    // 取消事件监听
    this.#unregisterEventListeners();

    this.#enabled = false;
    this.#logger.info(`${this.name} disabled`);
  }

  // ==================== 私有方法 ====================

  /**
   * 注册事件监听器
   * @private
   */
  #registerEventListeners() {
    if (!this.#scopedEventBus) {
      this.#logger.warn('ScopedEventBus not available, skipping event registration');
      return;
    }

    const { global } = PDFEditorFeatureConfig.config.events;

    // 监听全局编辑请求事件（来自 pdf-list）
    const unsubEditRequested = this.#scopedEventBus.onGlobal(global.EDIT_REQUESTED, (data) => {
      this.#logger.debug('Edit requested for record:', data);
      this.openEditor(data);
    });
    this.#unsubscribers.push(unsubEditRequested);

    this.#logger.debug(`Registered ${this.#unsubscribers.length} event listeners`);
  }

  /**
   * 取消事件监听器
   * @private
   */
  #unregisterEventListeners() {
    this.#unsubscribers.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (error) {
        this.#logger.warn('Failed to unsubscribe event listener:', error);
      }
    });

    this.#unsubscribers = [];
    this.#logger.debug('All event listeners unregistered');
  }

  /**
   * 创建模态对话框 UI
   * @private
   */
  #createModalUI() {
    const { containerId } = PDFEditorFeatureConfig.config.ui;

    // 检查是否已存在
    if (document.getElementById(containerId)) {
      this.#logger.warn('Modal UI already exists, skipping creation');
      return;
    }

    // 创建模态对话框容器
    const modal = document.createElement('div');
    modal.id = containerId;
    modal.className = 'pdf-editor-modal';
    modal.style.cssText = `
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      justify-content: center;
      align-items: center;
    `;

    // 创建模态对话框内容
    const content = document.createElement('div');
    content.className = 'pdf-editor-modal-content';
    content.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      max-width: ${PDFEditorFeatureConfig.config.editor.modalWidth};
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    `;

    // 创建标题
    const title = document.createElement('h2');
    title.textContent = '编辑 PDF 记录';
    title.style.marginTop = '0';
    content.appendChild(title);

    // 创建表单
    const form = document.createElement('form');
    form.id = 'pdf-editor-form';

    // TODO: 根据配置动态生成表单字段
    form.innerHTML = `
      <div style="margin-bottom: 15px;">
        <label>星标：</label>
        <input type="number" name="star" min="0" max="5" value="0" />
      </div>
      <div style="margin-bottom: 15px;">
        <label>标签：</label>
        <input type="text" name="tags" placeholder="输入标签" />
      </div>
      <div style="margin-bottom: 15px;">
        <label>备注：</label>
        <textarea name="notes" rows="4" style="width: 100%;"></textarea>
      </div>
      <div style="margin-bottom: 15px;">
        <label>
          <input type="checkbox" name="archived" />
          归档
        </label>
      </div>
      <div style="text-align: right;">
        <button type="button" id="pdf-editor-cancel-btn" style="margin-right: 10px;">取消</button>
        <button type="submit" id="pdf-editor-submit-btn">保存</button>
      </div>
    `;

    content.appendChild(form);
    modal.appendChild(content);
    document.body.appendChild(modal);

    this.#modalElement = modal;

    // 绑定事件
    const cancelBtn = modal.querySelector('#pdf-editor-cancel-btn');
    const submitBtn = modal.querySelector('#pdf-editor-submit-btn');

    cancelBtn?.addEventListener('click', () => this.closeEditor());
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.#handleFormSubmit(e.target);
    });

    this.#logger.debug('Modal UI created');
  }

  /**
   * 销毁模态对话框 UI
   * @private
   */
  #destroyModalUI() {
    if (this.#modalElement) {
      this.#modalElement.remove();
      this.#modalElement = null;
      this.#logger.debug('Modal UI destroyed');
    }
  }

  /**
   * 处理表单提交
   * @param {HTMLFormElement} form - 表单元素
   * @private
   */
  async #handleFormSubmit(form) {
    if (!this.#currentRecord) {
      this.#logger.warn('No record to update');
      return;
    }

    try {
      const formData = new FormData(form);
      const updatedData = {
        id: this.#currentRecord.id,
        filename: this.#currentRecord.filename,
        star: parseInt(formData.get('star') || '0', 10),
        tags: formData.get('tags') || '',
        notes: formData.get('notes') || '',
        archived: formData.get('archived') === 'on'
      };

      this.#logger.info('Submitting updated record:', updatedData);

      // 触发本地事件
      this.#scopedEventBus?.emit(PDFEditorFeatureConfig.config.events.local.FORM_SUBMITTED, updatedData);

      // 触发全局事件（通知其他功能域）
      this.#scopedEventBus?.emitGlobal(PDFEditorFeatureConfig.config.events.global.RECORD_UPDATED, updatedData);

      // TODO: 通过 WebSocket 发送到后端

      // 关闭编辑器
      this.closeEditor();

    } catch (error) {
      this.#logger.error('Failed to submit form:', error);

      // 触发验证失败事件
      this.#scopedEventBus?.emit(
        PDFEditorFeatureConfig.config.events.local.FORM_VALIDATION_FAILED,
        { error }
      );
    }
  }

  // ==================== 公开方法（供外部调用） ====================

  /**
   * 打开编辑器
   * @param {Object} record - 要编辑的记录
   */
  openEditor(record) {
    if (!this.#enabled) {
      this.#logger.warn('Cannot open editor: feature is disabled');
      return;
    }

    if (!this.#modalElement) {
      this.#logger.error('Modal element not found');
      return;
    }

    this.#logger.info('Opening editor for record:', record);

    this.#currentRecord = record;

    // 填充表单数据
    const form = this.#modalElement.querySelector('#pdf-editor-form');
    if (form) {
      form.star.value = record.star || 0;
      form.tags.value = record.tags || '';
      form.notes.value = record.notes || '';
      form.archived.checked = record.archived || false;
    }

    // 显示模态对话框
    this.#modalElement.style.display = 'flex';

    // 触发编辑器打开事件
    this.#scopedEventBus?.emit(PDFEditorFeatureConfig.config.events.local.EDITOR_OPENED, record);
  }

  /**
   * 关闭编辑器
   */
  closeEditor() {
    if (!this.#modalElement) {
      return;
    }

    this.#logger.info('Closing editor');

    // 隐藏模态对话框
    this.#modalElement.style.display = 'none';

    // 清空表单
    const form = this.#modalElement.querySelector('#pdf-editor-form');
    if (form) {
      form.reset();
    }

    // 触发编辑器关闭事件
    this.#scopedEventBus?.emit(PDFEditorFeatureConfig.config.events.local.EDITOR_CLOSED, this.#currentRecord);

    this.#currentRecord = null;
  }
}

/**
 * 创建 PDF Editor 功能域实例的工厂函数
 * @returns {PDFEditorFeature}
 */
export function createPDFEditorFeature() {
  return new PDFEditorFeature();
}

export default PDFEditorFeature;
