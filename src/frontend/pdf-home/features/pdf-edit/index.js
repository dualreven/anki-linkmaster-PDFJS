/**
 * @file PDF Edit 功能域入口
 * @module features/pdf-edit
 * @description
 * PDF记录编辑功能域，提供通过模态框编辑PDF元数据的功能
 *
 * 实现了IFeature接口，可通过FeatureRegistry进行注册和管理
 *
 * 详细拆分说明：`docs/standards/pdf-edit-feature.md`
 */

import { PDF_EDIT_FEATURE_CONFIG } from "./feature.config.js";
// import { PDF_EDIT_EVENTS, createEditRequestedData, createEditCompletedData } from "./events.js";
import { PDF_MANAGEMENT_EVENTS, SEARCH_EVENTS } from "../../../common/event/event-constants.js";
import { showInfo, showSuccess, showError } from "../../../common/utils/notification.js";
import { getLogger } from "../../../common/utils/logger.js";
import { ModalManager } from "./components/modal-manager.js";
import { createSubscriptionBag } from "../../../common/event/subscription-bag.js";
import { buildPdfEditFormHTML, escapeHtml } from "./pdf-edit-form-template.js";
import { createPdfEditFormComponents } from "./pdf-edit-form-components.js";
import { bindPdfEditResetActions } from "./pdf-edit-reset-actions.js";
import { showPdfEditGlobalError, showPdfEditGlobalWarning } from "./pdf-edit-global-notifications.js";
import { runPdfEditSubmitFlow } from "./pdf-edit-submit-flow.js";

// 导入样式
import "./styles/modal.css";
import "./styles/form-components.css";

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
  #subscriptionBag = null;

  #modalManager = null;
  #currentRecord = null;
  #formComponents = {};
  #editButton = null;
  #awaitingSuccess = false;
  #awaitingTimer = null;

  // ==================== IFeature 接口实现 ====================

  /** @returns {string} */
  get name() {
    return PDF_EDIT_FEATURE_CONFIG.name;
  }

  /** @returns {string} */
  get version() {
    return PDF_EDIT_FEATURE_CONFIG.version;
  }

  /** @returns {string} */
  get description() {
    return PDF_EDIT_FEATURE_CONFIG.description;
  }

  /** @returns {string[]} */
  get dependencies() {
    return PDF_EDIT_FEATURE_CONFIG.dependencies;
  }

  /** @param {import('../../../common/micro-service/feature-registry.js').FeatureContext} context */
  async install(context) {
    this.#context = context;
    this.#scopedEventBus = context.scopedEventBus;
    this.#logger = context.logger || getLogger(`Feature.${this.name}`);

    this.#logger.info(`Installing ${this.name} v${this.version}...`);

    try {
      // 初始化订阅袋（统一管理 WS/事件/DOM 订阅）
      this.#subscriptionBag = createSubscriptionBag({ loggerName: `Feature.${this.name}.Subscriptions` });

      // 1. 获取全局事件总线和WebSocket客户端
      this.#logger.debug("Step 1: Setting up services...");
      await this.#setupServices(context);

      // 2. 注册事件监听器
      this.#logger.debug("Step 2: Registering event listeners...");
      this.#registerEventListeners();

      // 3. 初始化UI
      this.#logger.debug("Step 3: Initializing UI...");
      await this.#initializeUI();

      // 4. 标记为已启用
      this.#enabled = true;

      this.#logger.info(`${this.name} installed successfully`);
    } catch (error) {
      this.#logger.error(`Failed to install ${this.name}`, error);
      throw error;
    }
  }

  /** @param {import('../../../common/micro-service/feature-registry.js').FeatureContext} context */
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

  /** @param {Object} context */
  async #setupServices(context) {
    const globalContainer = context.container;

    // 从容器获取全局事件总线
    if (globalContainer && globalContainer.has && globalContainer.has("eventBus")) {
      this.#globalEventBus = globalContainer.get("eventBus");
      this.#logger.debug("EventBus service acquired from container");
    } else {
      throw new Error("Global EventBus not available in container");
    }

    // 从容器获取WebSocket客户端
    if (globalContainer && globalContainer.has && globalContainer.has("wsClient")) {
      this.#wsClient = globalContainer.get("wsClient");
      this.#logger.debug("WSClient service acquired from container");
    } else {
      this.#logger.warn("WSClient not available, edit submission may not work");
    }

    this.#logger.debug("Services setup completed");
  }

  /** 注册事件监听器 */
  #registerEventListeners() {
    // 监听全局编辑请求事件（来自pdf-table）
    const unsubEditRequested = this.#globalEventBus.on(
      PDF_MANAGEMENT_EVENTS.EDIT.REQUESTED,
      this.#handleEditRequested.bind(this)
    );
    if (this.#subscriptionBag) {
      this.#subscriptionBag.add(unsubEditRequested);
    }

    // 监听全局编辑完成事件（来自后端，经 WebSocketHandler 转换为领域事件）
    const unsubEditCompleted = this.#globalEventBus.on(
      PDF_MANAGEMENT_EVENTS.EDIT.COMPLETED,
      this.#handleEditCompleted.bind(this)
    );
    if (this.#subscriptionBag) {
      this.#subscriptionBag.add(unsubEditCompleted);
    }

    // 监听编辑失败领域事件（由 WebSocketHandler 在 handleResponse 中发出）
    const unsubEditFailed = this.#globalEventBus.on(
      PDF_MANAGEMENT_EVENTS.EDIT.FAILED,
      (payload) => {
        try {
          const msg = payload?.errorMessage || "操作失败";
          showError(`更新失败-${msg}`, 5000);
        } catch (e) {
          this.#logger?.warn?.("[PDFEditFeature] showError toast failed when handling EDIT.FAILED", e);
        }
        this.#awaitingSuccess = false;
        if (this.#awaitingTimer) {
          clearTimeout(this.#awaitingTimer);
          this.#awaitingTimer = null;
        }
      }
    );
    if (this.#subscriptionBag) {
      this.#subscriptionBag.add(unsubEditFailed);
    }

    // 在搜索结果刷新后，再显示“更新完成”，避免被 SearchFeature.hideAll() 立即 destroy
    const unsubSearchUpdated = this.#globalEventBus.on(SEARCH_EVENTS.RESULTS.UPDATED, () => {
      if (this.#awaitingSuccess) {
        this.#awaitingSuccess = false;
        if (this.#awaitingTimer) { clearTimeout(this.#awaitingTimer); this.#awaitingTimer = null; }
        try { showSuccess("更新完成", 3500); } catch (e) { void e; }
      }
    }, { subscriberId: `pdf-edit:${Date.now().toString(36)}:${Math.random().toString(36).slice(2,6)}:search-results-updated` });
    if (this.#subscriptionBag) {
      this.#subscriptionBag.add(unsubSearchUpdated);
    }

    this.#logger.debug("Event listeners registered");
  }

  /** 取消事件监听器 */
  #unregisterEventListeners() {
    if (!this.#subscriptionBag) {
      this.#logger.debug("No subscription bag to clear for PDFEditFeature");
      return;
    }

    this.#subscriptionBag.clear();
    this.#logger.debug("Event listeners unregistered");
  }

  /** 初始化UI */
  async #initializeUI() {
    // 创建模态框管理器
    this.#modalManager = new ModalManager({
      eventBus: this.#globalEventBus
    });

    // 获取header编辑按钮并绑定事件
    this.#editButton = document.getElementById("edit-pdf-btn");
    if (this.#editButton) {
      const handleEditClick = this.#handleEditButtonClick.bind(this);
      this.#editButton.addEventListener("click", handleEditClick);
      if (this.#subscriptionBag) {
        this.#subscriptionBag.add(() => this.#editButton.removeEventListener("click", handleEditClick));
      }
      // 按钮默认是disabled状态，点击时会检查选中状态
      this.#editButton.disabled = false;  // 启用按钮，让用户可以点击
      this.#logger.debug("Edit button bound");
    } else {
      this.#logger.warn("Edit button not found in DOM");
    }

    this.#logger.debug("UI initialized");
  }

  /**
   * 显示确认对话框（替代 window.confirm）
   * @private
   * @param {string} title
   * @param {string} message
   * @returns {Promise<boolean>} 是否确认
   */
  async #confirm(title, message) {
    return new Promise((resolve) => {
      try {
        this.#modalManager.show({
          title: title || "确认操作",
          content: `<div style="padding:8px 0;white-space:pre-line;">${escapeHtml(message || "")}</div>`,
          confirmText: "确定",
          cancelText: "取消",
          onConfirm: async () => { resolve(true); return true; },
          onCancel: async () => { resolve(false); },
        });
      } catch (e) {
        // 如果弹框失败，不阻塞主流程，视为取消
        try { this.#logger.warn("Confirm dialog failed, treat as cancelled", e); } catch (_) { void _; }
        resolve(false);
      }
    });
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

    this.#logger.debug("UI cleaned up");
  }

  /**
   * 显示全局错误消息（Toast形式）
   * @private
   * @param {string} message - 错误消息
   */
  #showGlobalError(message) {
    showPdfEditGlobalError({ message, showError, logger: this.#logger });
  }

  /**
   * 显示全局警告消息（Toast形式）
   * @private
   * @param {string} message - 警告消息
   */
  #showGlobalWarning(message) {
    showPdfEditGlobalWarning({ message, showError, logger: this.#logger });
  }

  /**
   * 处理编辑按钮点击
   * @private
   */
  #handleEditButtonClick() {
    try {
      this.#logger.info("Edit button clicked");

      // 从容器获取状态管理器
      const globalContainer = this.#context.container;
      let stateManager = null;

      if (globalContainer && globalContainer.has && globalContainer.has("stateManager")) {
        stateManager = globalContainer.get("stateManager");
        this.#logger.debug("StateManager acquired from container");
      }

      if (stateManager) {
        // 从状态管理器获取 pdf-list 的状态
        const listState = stateManager.getState("pdf-list");

        if (listState) {
          const selectedIndices = listState.selectedIndices || [];
          const items = listState.items || [];

          this.#logger.debug(`Selected indices: ${selectedIndices.length}, Total items: ${items.length}`);

          if (selectedIndices.length === 0) {
            this.#logger.warn("No row selected");
            this.#showGlobalError("请先选择一条PDF记录");
            return;
          }

          if (selectedIndices.length > 1) {
            this.#logger.warn("Multiple rows selected, only editing the first one");
            this.#showGlobalWarning("您选择了多条记录，将只编辑第一条");
          }

          // 获取第一个选中行的数据
          const firstIndex = selectedIndices[0];
          const rowData = items[firstIndex];

          if (!rowData) {
            this.#logger.error(`Item at index ${firstIndex} not found`);
            this.#showGlobalError("无法获取选中的PDF记录");
            return;
          }

          this.#logger.info("Editing record:", rowData.filename || rowData.id);
          this.#handleEditRequested(rowData);
          return;
        } else {
          this.#logger.warn("pdf-list state not found in StateManager");
        }
      }

      // 如果无法获取状态，提示用户
      this.#logger.error("StateManager not available or pdf-list state not found");
      this.#showGlobalError("系统未正确初始化，请刷新页面");

    } catch (error) {
      this.#logger.error("Error handling edit button click:", error);
      this.#logger.error("Error stack:", error.stack);
      this.#showGlobalError("获取选中记录失败，请重试");
    }
  }

  /**
   * 处理编辑请求事件
   * @private
   * @param {Object} record - PDF记录对象
   */
  async #handleEditRequested(record) {
    this.#logger.info("Edit requested for record:", record.filename || record.id);

    this.#currentRecord = record;

    // 构建表单内容
    const formHTML = buildPdfEditFormHTML(record);

    // 显示模态框（等待DOM渲染完成）
    await this.#modalManager.show({
      title: "编辑PDF记录",
      content: formHTML,
      onConfirm: this.#handleFormSubmit.bind(this),
      onCancel: this.#handleFormCancel.bind(this),
      confirmText: "保存",
      cancelText: "取消"
    });

    // 等待模态框DOM完全渲染（使用requestAnimationFrame确保DOM已准备好）
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // 初始化表单组件
    this.#formComponents = createPdfEditFormComponents(record);
    bindPdfEditResetActions({
      record,
      wsClient: this.#wsClient,
      confirm: this.#confirm.bind(this),
      showGlobalError: this.#showGlobalError.bind(this),
      showGlobalWarning: this.#showGlobalWarning.bind(this),
    });
  }

  /**
   * 处理表单提交
   * @private
   */
  #handleFormSubmit() {
    runPdfEditSubmitFlow({
      currentRecord: this.#currentRecord,
      formComponents: this.#formComponents,
      scopedEventBus: this.#scopedEventBus,
      wsClient: this.#wsClient,
      logger: this.#logger,
      showInfo,
      showError,
      showSuccess,
      hideModal: () => this.#modalManager.hide(),
      emitEditStarted: (updates) => {
        this.#scopedEventBus.emitGlobal(
          PDF_MANAGEMENT_EVENTS.EDIT.STARTED,
          {
            pdf_id: this.#currentRecord.pdf_id || this.#currentRecord.id,
            filename: this.#currentRecord.filename,
            updates,
          },
          { actorId: "PDFEditFeature" },
        );
      },
      getAwaitingSuccess: () => this.#awaitingSuccess,
      clearAwaitingSuccess: () => { this.#awaitingSuccess = false; },
      setAwaitingTimer: (timer) => { this.#awaitingTimer = timer; },
    });
  }

  /**
   * 处理表单取消
   * @private
   */
  #handleFormCancel() {
    this.#logger.info("Edit cancelled");
    this.#currentRecord = null;
  }

  /**
   * 处理编辑完成事件
   * @private
   * @param {Object} data - 编辑完成数据
   */
  #handleEditCompleted(data) {
    this.#logger.info("Edit completed:", data);
    // TODO: 显示成功提示或更新UI
  }

}

/**
 * 导出功能实例（供FeatureRegistry使用）
 */
export default PDFEditFeature;

