/**
 * @file PDF List 功能域入口
 * @module features/pdf-list
 * @description
 * PDF 列表管理功能域，提供 PDF 记录的列表展示、增删改查、搜索过滤等功能。
 *
 * 实现了 IFeature 接口，可通过 FeatureRegistry 进行注册和管理。
 *
 * @example
 * import { PDFListFeature } from './features/pdf-list/index.js';
 * import { FeatureRegistry } from './core/feature-registry.js';
 *
 * const registry = new FeatureRegistry({ container });
 * registry.register(new PDFListFeature());
 * await registry.install('pdf-list');
 */

import { PDFListFeatureConfig } from './feature.config.js';
import { getLogger } from '../../../common/utils/logger.js';
import { createListState, ListStateHelpers } from './state/list-state.js';
import { PDF_LIST_EVENTS, EventDataFactory } from './events.js';
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from '../../../common/event/event-constants.js';
import { showSuccess, showError } from '../../../common/utils/notification.js';
import { pending as toastPending, success as toastSuccess, warning as toastWarning, error as toastError, dismissById as toastDismiss } from '../../../common/utils/thirdparty-toast.js';

/**
 * PDF List 功能域类
 * @class PDFListFeature
 * @implements {IFeature}
 */
export class PDFListFeature {
  // 删除流程的 pending 记录（一次仅允许一个批量删除在途）
  #pendingDeleteRid = null;
  #pendingDeleteCount = 0;
  /**
   * 功能上下文（在 install 时注入）
   * @type {import('../../../common/micro-service/feature-registry.js').FeatureContext|null}
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
   * UI 管理器
   * @type {Object|null}
   * @private
   */
  #uiManager = null;

  /**
   * WebSocket 客户端
   * @type {Object|null}
   * @private
   */
  #wsClient = null;

  /**
   * 列表状态（由 StateManager 管理）
   * @type {Object|null}
   * @private
   */
  #state = null;

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

  /**
   * 多文件添加的聚合状态
   * @type {{expected:number, processed:number, success:number, failed:number}|null}
   * @private
   */
  #pendingAdd = null;

  // 添加流程的 Toast 待结算映射（按 request_id 关联）
  #pendingToastsByRid = new Map();

  // 删除流程的 pending 记录（一次仅允许一个批量删除在途）
  
  #pendingDeleteToast = null; // { removedCount:number, failedCount:number, failedMap?:object }
  #pendingDeleteError = null; // { rid:string, message:string }
  #pendingDeleteErrorTimer = null;

  // ==================== IFeature 接口实现 ====================

  /**
   * 功能名称（唯一标识）
   * @returns {string}
   */
  get name() {
    return PDFListFeatureConfig.name;
  }

  /**
   * 功能版本
   * @returns {string}
   */
  get version() {
    return PDFListFeatureConfig.version;
  }

  /**
   * 功能依赖列表
   * @returns {string[]}
   */
  get dependencies() {
    return PDFListFeatureConfig.dependencies;
  }

  /**
   * 安装功能（初始化逻辑）
   * @param {import('../../../common/micro-service/feature-registry.js').FeatureContext} context - 功能上下文
   * @returns {Promise<void>}
   */
  async install(context) {
    this.#context = context;
    this.#scopedEventBus = context.scopedEventBus;
    this.#logger = context.logger || getLogger(`Feature.${this.name}`);

    this.#logger.info(`Installing ${this.name} v${this.version}...`);

    try {
      // 1. 从容器中获取必要的服务
      this.#logger.debug('Step 1: Setting up services...');
      await this.#setupServices(context);

      // 2. 注册事件监听器
      this.#logger.debug('Step 2: Registering event listeners...');
      this.#registerEventListeners();

      // 3. 初始化 UI（暂时禁用以专注于搜索栏UI设计）
      this.#logger.debug('Step 3: Initializing UI... (DISABLED for UI design phase)');
      // await this.#initializeUI();

      // 4. 标记为已启用
      this.#enabled = true;

      // 5. 请求初始PDF列表数据
      this.#logger.debug('Step 5: Requesting initial PDF list...');
      this.#requestPdfList();

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
   * 卸载功能（清理逻辑）
   * @param {import('../../../common/micro-service/feature-registry.js').FeatureContext} context - 功能上下文
   * @returns {Promise<void>}
   */
  async uninstall(context) {
    this.#logger.info(`Uninstalling ${this.name}...`);

    try {
      // 1. 取消所有事件监听
      this.#unregisterEventListeners();

      // 2. 清理 UI
      await this.#cleanupUI();

      // 3. 清理服务引用
      this.#wsClient = null;
      this.#uiManager = null;
      this.#state = null;

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

    // 取消事件监听
    this.#unregisterEventListeners();

    this.#enabled = false;
    this.#logger.info(`${this.name} disabled`);
  }

  // ==================== 私有方法 ====================

  // ===== 工具方法 =====
  #generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  #basename(filepath) {
    if (!filepath) return '';
    const norm = String(filepath).replace(/\\/g, '/');
    const idx = norm.lastIndexOf('/');
    return idx >= 0 ? norm.slice(idx + 1) : norm;
  }

  // 从多种来源收集当前选中的 PDF id 列表（兼容多种UI实现）
  #collectSelectedIds() {
    const ids = new Set();

    // 1) 优先：状态管理的 selectedIndices → items
    try {
      const selectedIndices = this.#state?.selectedIndices || [];
      const items = this.#state?.items || [];
      if (Array.isArray(selectedIndices) && selectedIndices.length > 0 && Array.isArray(items)) {
        selectedIndices.forEach(i => {
          const it = items[i];
          if (it && (it.id || it.filename)) ids.add(it.id || it.filename);
        });
      }
    } catch (_) {}

    // 2) 搜索结果列表中的勾选框（.search-result-checkbox:checked）
    try {
      if (ids.size === 0) {
        const checked = document.querySelectorAll('.search-result-checkbox:checked');
        checked.forEach(el => { const id = el?.dataset?.id || el?.value; if (id) ids.add(id); });
      }
    } catch (_) {}

    // 3) 兜底：搜索结果中被点击选中的单项（.search-result-item.selected[data-id]）
    try {
      if (ids.size === 0) {
        const sel = document.querySelector('.search-result-item.selected');
        const id = sel?.getAttribute?.('data-id');
        if (id) ids.add(id);
      }
    } catch (_) {}

    return Array.from(ids);
  }

  /**
   * 设置服务依赖
   * @param {import('../../../common/micro-service/feature-registry.js').FeatureContext} context - 功能上下文
   * @private
   */
  async #setupServices(context) {
    // 从全局容器中获取服务
    const globalContainer = context.container;

    // 1. 获取 WebSocket 客户端（如果存在）
    if (globalContainer && globalContainer.has && globalContainer.has('wsClient')) {
      this.#wsClient = globalContainer.get('wsClient');
      this.#logger.debug('WSClient service acquired from container');
    }

    // 2. 获取 StateManager 并创建功能域状态
    if (globalContainer && globalContainer.has && globalContainer.has('stateManager')) {
      const stateManager = globalContainer.get('stateManager');
      this.#state = createListState(stateManager);
      this.#logger.debug('List state created via StateManager');

      // 3. 设置状态监听器
      this.#setupStateWatchers();
    } else {
      this.#logger.warn('StateManager not available, feature will run without state management');
    }

    // 注意：这里只是获取服务引用，实际的初始化逻辑应该在服务层处理
  }

  /**
   * 设置状态监听器
   * @private
   */
  #setupStateWatchers() {
    if (!this.#state) {
      this.#logger.warn('State not available, skipping state watchers setup');
      return;
    }

    // 监听列表数据变化
    this.#state.subscribe('items', (newItems, oldItems) => {
      this.#logger.debug(`List items changed: ${oldItems?.length || 0} -> ${newItems?.length || 0}`);

      // 更新表格显示
      if (this.#uiManager && newItems) {
        this.#logger.debug('Updating table with new items:', newItems.length);
        this.#uiManager.setData(newItems);
      }

      this.#scopedEventBus?.emit(PDF_LIST_EVENTS.DATA_CHANGED, {
        items: newItems,
        previousCount: oldItems?.length || 0,
        currentCount: newItems?.length || 0
      });
    });

    // 监听选中项变化
    this.#state.subscribe('selectedIndices', (newIndices, oldIndices) => {
      this.#logger.debug(`Selection changed: ${oldIndices?.length || 0} -> ${newIndices?.length || 0} items selected`);
      const items = this.#state?.items || [];
      const selectedItems = (newIndices || []).map(index => items[index]).filter(Boolean);

      this.#scopedEventBus?.emit(
        PDF_LIST_EVENTS.SELECTION_CHANGED,
        EventDataFactory.createSelectionChangedData(newIndices || [], selectedItems)
      );
    });

    // 监听加载状态变化
    this.#state.subscribe('isLoading', (isLoading) => {
      this.#logger.debug(`Loading state changed: ${isLoading}`);
      if (isLoading) {
        this.#scopedEventBus?.emit(PDF_LIST_EVENTS.DATA_LOAD_STARTED);
      }
    });

    // 监听排序列变化
    this.#state.subscribe('sortColumn', (newSortColumn, oldSortColumn) => {
      this.#logger.debug(`Sort column changed: ${oldSortColumn} -> ${newSortColumn}`);
      this.#scopedEventBus?.emit(
        PDF_LIST_EVENTS.SORT_CHANGED,
        EventDataFactory.createSortChangedData(newSortColumn, this.#state.sortDirection)
      );
    });

    // 监听排序方向变化
    this.#state.subscribe('sortDirection', (newDirection, oldDirection) => {
      this.#logger.debug(`Sort direction changed: ${oldDirection} -> ${newDirection}`);
      this.#scopedEventBus?.emit(
        PDF_LIST_EVENTS.SORT_CHANGED,
        EventDataFactory.createSortChangedData(this.#state.sortColumn, newDirection)
      );
    });

    // 监听过滤条件变化
    this.#state.subscribe('filters', (newFilters, oldFilters) => {
      this.#logger.debug('Filters changed:', newFilters);
      this.#scopedEventBus?.emit(
        PDF_LIST_EVENTS.FILTER_CHANGED,
        EventDataFactory.createFilterChangedData(newFilters)
      );
    });

    this.#logger.debug('State watchers configured');
  }

  /**
   * 设置按钮事件监听器
   * @private
   */
  #setupButtonListeners() {
    // 获取按钮元素
    const addPdfBtn = document.getElementById('add-pdf-btn');
    const batchAddBtn = document.getElementById('batch-add-btn');
    const batchDeleteBtn = document.getElementById('batch-delete-btn');
    const searchResultsDeleteBtn = document.querySelector('.batch-btn-delete');

    // 添加PDF按钮
    if (addPdfBtn) {
      const handleAddClick = () => this.#handleAddPdf();
      addPdfBtn.addEventListener('click', handleAddClick);
      this.#unsubscribers.push(() => addPdfBtn.removeEventListener('click', handleAddClick));
      this.#logger.debug('Add PDF button listener registered');
    }

    // 批量添加按钮
    if (batchAddBtn) {
      const handleBatchAddClick = () => this.#handleBatchAdd();
      batchAddBtn.addEventListener('click', handleBatchAddClick);
      this.#unsubscribers.push(() => batchAddBtn.removeEventListener('click', handleBatchAddClick));
      this.#logger.debug('Batch add button listener registered');
    }

    // 批量删除按钮
    if (batchDeleteBtn) {
      const handleBatchDeleteClick = () => this.#handleBatchDelete();
      batchDeleteBtn.addEventListener('click', handleBatchDeleteClick);
      this.#unsubscribers.push(() => batchDeleteBtn.removeEventListener('click', handleBatchDeleteClick));
      this.#logger.debug('Batch delete button listener registered (by id)');
    }
    // 搜索结果头部的“删除”按钮（🗑️ 删除）
    if (searchResultsDeleteBtn) {
      const handleBatchDeleteClick2 = () => this.#handleBatchDelete();
      searchResultsDeleteBtn.addEventListener('click', handleBatchDeleteClick2);
      this.#unsubscribers.push(() => searchResultsDeleteBtn.removeEventListener('click', handleBatchDeleteClick2));
      this.#logger.debug('Batch delete button listener registered (.batch-btn-delete)');
    }
  }

  /**
   * 处理添加PDF
   * @private
   */
  async #handleAddPdf() {
    this.#logger.info('Add PDF button clicked');

    try {
      // 动态导入 QWebChannelBridge
      const { QWebChannelBridge } = await import('../../qwebchannel/qwebchannel-bridge.js');

      // 创建或获取桥接实例
      const bridge = new QWebChannelBridge();

      // 初始化连接
      this.#logger.info('Initializing QWebChannel...');
      await bridge.initialize();

      // 调用文件选择对话框
      this.#logger.info('Opening file selection dialog...');
      const files = await bridge.selectFiles({
        multiple: true,
        fileType: 'pdf'
      });

      if (!files || files.length === 0) {
        this.#logger.info('User cancelled file selection');
        toastWarning('未选择任何文件');
        return;
      }

      this.#logger.info(`User selected ${files.length} files`);
      this.#pendingAdd = { expected: files.length, processed: 0, success: 0, failed: 0 };

      // 循环发送多个单文件请求（后端期望单个filepath参数）
      for (const filepath of files) {
        const rid = this.#generateRequestId();
        const base = this.#basename(filepath);
        // 使用第三方 toast：右上角粘性“导入中”
        toastPending(rid, '导入中');
        this.#pendingToastsByRid.set(rid, { base, filepath });
        this.#scopedEventBus?.emitGlobal('websocket:message:send', {
          type: 'pdf-library:add:records',
          request_id: rid,
          data: {
            filepath: filepath  // 后端期望单个文件路径
          },
          source: 'add-button'
        });
        this.#logger.debug(`File path sent to backend: ${filepath}`);
      }

      this.#logger.info(`${files.length} file requests sent to backend`);

    } catch (error) {
      this.#logger.error('Add PDF failed:', error);
      toastError(`添加文件失败: ${error.message}`);
    }
  }

  /**
   * 处理批量添加
   * @private
   */
  async #handleBatchAdd() {
    this.#logger.info('Batch add button clicked');

    try {
      // 动态导入 QWebChannelBridge
      const { QWebChannelBridge } = await import('../../qwebchannel/qwebchannel-bridge.js');

      // 创建或获取桥接实例
      const bridge = new QWebChannelBridge();

      // 初始化连接
      this.#logger.info('Initializing QWebChannel...');
      await bridge.initialize();

      // 调用文件选择对话框（批量模式）
      this.#logger.info('Opening batch file selection dialog...');
      const files = await bridge.selectFiles({
        multiple: true,
        fileType: 'pdf'
      });

      if (!files || files.length === 0) {
        this.#logger.info('User cancelled batch file selection');
        toastWarning('未选择任何文件');
        return;
      }

      this.#logger.info(`User selected ${files.length} files in batch mode`);
      this.#pendingAdd = { expected: files.length, processed: 0, success: 0, failed: 0 };

      // 循环发送多个单文件请求（后端期望单个filepath参数）
      for (const filepath of files) {
        const rid = this.#generateRequestId();
        const base = this.#basename(filepath);
        toastPending(rid, '导入中');
        this.#pendingToastsByRid.set(rid, { base, filepath });
        this.#scopedEventBus?.emitGlobal('websocket:message:send', {
          type: 'pdf-library:add:records',
          request_id: rid,
          data: {
            filepath: filepath  // 后端期望单个文件路径
          },
          source: 'batch-add-button'
        });
        this.#logger.debug(`Batch file path sent to backend: ${filepath}`);
      }

      this.#logger.info(`${files.length} batch file requests sent to backend`);

    } catch (error) {
      this.#logger.error('Batch add failed:', error);
      toastError(`批量添加文件失败: ${error.message}`);
    }
  }

  /**
   * 处理批量删除按钮点击事件
   *
   * 功能流程：
   * 1. 从状态管理器获取用户当前选中的PDF文件列表
   * 2. 验证选中项的有效性（是否为空、是否存在于数据中）
   * 3. 弹出确认对话框，要求用户确认删除操作
   * 4. 通过EventBus向后端发送WebSocket删除请求
   * 5. 等待后端响应并更新UI（在 #registerEventListeners 中处理）
   *
   * 架构说明：
   * - 遵循功能域模块化架构，只能通过EventBus与其他模块通信
   * - 不直接调用后端API，而是发送事件到WebSocket适配器
   * - 删除结果通过事件回调处理（见 #registerEventListeners 中的 websocket:message:response 监听器）
   *
   * 状态管理：
   * - 选中状态由 StateManager 管理（this.#state.selectedIndices）
   * - 删除成功后会自动清空选中状态，防止重复删除
   * - 表格数据通过增量更新（deleteRow）保持同步
   *
   * 错误处理：
   * - 未选中文件时显示错误提示
   * - 选中项数据异常时显示错误提示
   * - 用户取消删除时记录日志并退出
   *
   * @private
   * @async
   * @fires ScopedEventBus#websocket:message:send - 发送删除请求到后端
   * @listens ScopedEventBus#websocket:message:response - 接收删除结果（在 #registerEventListeners 中）
   */
  async #handleBatchDelete() {
    this.#logger.info('Batch delete button clicked');

    // ==================== 第一步：获取选中的行数据 ====================
    const selectedIds = this.#collectSelectedIds();

    // ==================== 第二步：验证选中项 ====================
    // 检查用户是否选中了至少一个文件
    if (!selectedIds || selectedIds.length === 0) {
      this.#logger.warn('No items selected for deletion');
      try { toastError('请先选择要删除的PDF文件'); } catch (_) { showError('请先选择要删除的PDF文件'); }
      return;
    }

    this.#logger.info(`Collected ${selectedIds.length} selected ids for deletion`);

    // ==================== 第三步：用户确认 ====================
    // 弹出原生确认对话框，显示将要删除的文件数量
    // 这是防止误操作的最后一道防线
    const confirmMsg = `确定要删除选中的 ${selectedIds.length} 个PDF文件吗？`;
    if (!confirm(confirmMsg)) {
      this.#logger.info('User cancelled deletion');
      return;
    }

    // 记录详细的删除日志，便于追踪和调试
    this.#logger.info(`Deleting ${selectedIds.length} files`, selectedIds);

    // ==================== 第四步：发送删除请求 ====================
    // 架构说明：
    // - 不直接调用 WebSocket API，而是通过事件总线发送全局事件
    // - 由 websocket-adapter 功能域统一处理 WebSocket 通信
    // - 这种解耦设计使得功能域之间互不依赖，可独立开发和测试
    //
    // 消息协议：
    // - type: 'pdf-library:remove:records' - 后端识别的删除操作类型
    // - data.file_ids: 要删除的文件ID数组（后端通过ID精确定位文件）
    //
    // 后续流程：
    // 1. websocket-adapter 接收事件并发送到后端
    // 2. 后端执行删除操作并返回结果
    // 3. websocket-adapter 收到响应后发送 'websocket:message:response' 事件
    // 4. 本功能域的监听器（见 #registerEventListeners L640-678）处理响应
    // 5. 删除成功后使用 tabulator.deleteRow() 增量更新表格
    // 6. 清空选中状态（this.#state.selectedIndices = []）
    const rid = this.#generateRequestId();
    this.#pendingDeleteRid = rid;
    this.#pendingDeleteCount = selectedIds.length;
    try { toastPending(rid, `删除中（${selectedIds.length}个文件）`); } catch (_) {}

    this.#scopedEventBus?.emitGlobal(WEBSOCKET_EVENTS.MESSAGE.SEND, {
      type: WEBSOCKET_MESSAGE_TYPES.REMOVE_PDF,
      request_id: rid,
      data: {
        file_ids: selectedIds
      },
      source: 'pdf-list-batch-delete'
    });

    // 注意：删除请求是异步的，不在此处等待响应
    // 响应处理在 #registerEventListeners 方法中的 'websocket:message:response' 监听器
  }

  /**
   * 注册事件监听器
   * @private
   */
  #registerEventListeners() {
    if (!this.#scopedEventBus) {
      this.#logger.warn('ScopedEventBus not available, skipping event registration');
      return;
    }

    // 设置按钮事件监听器
    this.#setupButtonListeners();

    const { local, global } = PDFListFeatureConfig.config.events;

    // 监听本地事件（功能域内部事件）
    // 监听选择变化事件，更新state
    const unsubSelectionChanged = this.#scopedEventBus.on(PDF_LIST_EVENTS.SELECTION_CHANGED, (data) => {
      this.#logger.debug('Selection changed:', data);
      if (this.#state && data.selectedIndices) {
        this.#state.selectedIndices = data.selectedIndices;
      }
    });
    this.#unsubscribers.push(unsubSelectionChanged);

    // 监听表格行选中事件
    const unsubRowSelected = this.#scopedEventBus.on(local.ROW_SELECTED, (data) => {
      this.#logger.debug('Row selected:', data);
      // TODO: 处理行选中逻辑
    });
    this.#unsubscribers.push(unsubRowSelected);

    // 监听表格行双击事件
    const unsubRowDblClick = this.#scopedEventBus.on(local.ROW_DOUBLE_CLICK, (data) => {
      this.#logger.debug('Row double-clicked:', data);

      // 触发全局事件：PDF 打开请求
      this.#scopedEventBus.emitGlobal(global.OPEN_REQUESTED, {
        filename: data.filename,
        path: data.path
      });
    });
    this.#unsubscribers.push(unsubRowDblClick);

    // 监听全局事件（如果需要响应其他功能域的事件）
    // 示例：监听 PDF 编辑器的更新事件
    // 事件名称格式：{module}:{action}:{status}
    const unsubGlobalUpdate = this.#scopedEventBus.onGlobal('editor:record:updated', (data) => {
      this.#logger.debug('PDF record updated by editor:', data);
      // TODO: 刷新列表中的对应行
    });
    this.#unsubscribers.push(unsubGlobalUpdate);

    // 监听WebSocket的PDF列表消息 (通用response事件)
    const unsubWebSocketResponse = this.#scopedEventBus.onGlobal('websocket:message:response', (data) => {
      this.#logger.debug('Received WebSocket response:', data);

      if (data?.status === 'error') {
        const errorMessage = data?.message || data?.error?.message || '操作失败';
        const rid = data?.request_id;
        const isAddFlow = typeof data?.type === 'string' && data.type.startsWith('pdf-library:add:');

        // 1) 添加流程错误（按 pendingToastsByRid 识别）
        if (isAddFlow || (rid && this.#pendingToastsByRid.has(rid))) {
          if (rid && this.#pendingToastsByRid.has(rid)) {
            const { base } = this.#pendingToastsByRid.get(rid) || {};
            toastDismiss(rid);
            toastError(`${base}-导入失败-${errorMessage}`);
            this.#pendingToastsByRid.delete(rid);
          } else {
            toastError(`添加文件失败: ${errorMessage}`);
          }
          return;
        }

        // 2) 删除流程错误（标准失败类型）
                if (typeof data?.type === 'string' && data.type === WEBSOCKET_MESSAGE_TYPES.REMOVE_PDF_FAILED) {
          if (this.#pendingDeleteRid && rid && rid === this.#pendingDeleteRid) {
            try { toastDismiss(this.#pendingDeleteRid); } catch (_) {}
            this.#pendingDeleteRid = null;
            this.#pendingDeleteCount = 0;
          } else {
            this.#logger.warn('忽略非当前请求的删除失败响应', { request_id: rid, pending: this.#pendingDeleteRid, errorMessage });
          }
          return;
        }

        // 3) 其他非本功能域错误：仅记录日志，避免干扰用户（防止误报“删除失败”）
        this.#logger.warn('忽略非本流程的错误消息', { type: data?.type, request_id: rid, errorMessage });
        return;
      }

      // 添加调试日志，检查响应数据结构
      if (data && data.data) {
        this.#logger.debug('Response data keys:', Object.keys(data.data));
        this.#logger.debug('Has added_files:', 'added_files' in data.data);
        this.#logger.debug('Has removed_files:', 'removed_files' in data.data);
        this.#logger.debug('Has files:', 'files' in data.data);
      }

      // 检查是否是“列表完成”响应（严格按类型过滤，避免误将搜索结果当作列表数据渲染）
      if (
        data &&
        typeof data.type === 'string' &&
        data.type === WEBSOCKET_MESSAGE_TYPES.PDF_LIST_COMPLETED &&
        data.data && Array.isArray(data.data.files)
      ) {
        this.#logger.info(`Received PDF list from WebSocket: ${data.data.files.length} files`);

        // 更新状态中的items (直接设置属性，而不是调用set方法)
        if (this.#state) {
          this.#state.items = data.data.files;
          this.#state.isLoading = false;

          // 发出数据加载完成事件
          this.#scopedEventBus?.emit(
            PDF_LIST_EVENTS.DATA_LOAD_COMPLETED,
            EventDataFactory.createDataLoadedData(data.data.files, data.data.files.length)
          );
        }
      }

      // 处理单个文件添加响应（后端返回 data.file 对象）
      if (data && data.type === 'pdf-library:add:completed' && data.data && data.data.file && data.status === 'success') {
        if (data.request_id && this.#pendingToastsByRid.has(data.request_id)) {
          const { base } = this.#pendingToastsByRid.get(data.request_id) || {};
          toastDismiss(data.request_id);
          toastSuccess(`${base}-导入成功`);
          this.#pendingToastsByRid.delete(data.request_id);
        }
        this.#logger.info(`File added successfully: ${data.data.file.filename}`);

        if (this.#pendingAdd && typeof this.#pendingAdd.expected === 'number') {
          this.#pendingAdd.processed += 1;
          this.#pendingAdd.success += 1;
          if (this.#pendingAdd.processed >= this.#pendingAdd.expected) {
            const { success, failed, expected } = this.#pendingAdd;
            if (failed > 0 && success === 0) {
              toastError(`添加完成：全部失败 ${failed}/${expected}`);
            } else if (failed > 0) {
              toastError(`添加完成：成功 ${success} 个，失败 ${failed} 个`);
            } else {
              toastSuccess(`成功添加 ${success} 个文件`);
            }
            this.#pendingAdd = null;
          }
        } else {
          toastSuccess('成功添加 1 个文件');
        }

        // 重新请求完整列表以更新表格（因为后端返回的信息不完整）
        this.#scopedEventBus?.emitGlobal('websocket:message:send', {
          type: 'pdf-library:list:records'
        });
      }

      // 处理添加失败
      if (data && data.type === 'pdf-library:add:failed') {
        const errMsg = (data?.error?.message) || data?.message || '添加失败';
        if (data.request_id && this.#pendingToastsByRid.has(data.request_id)) {
          const { base } = this.#pendingToastsByRid.get(data.request_id) || {};
          toastDismiss(data.request_id);
          toastError(`${base}-导入失败-${errMsg}`);
          this.#pendingToastsByRid.delete(data.request_id);
        } else {
          toastError(`添加文件失败: ${errMsg}`);
        }
      }

      // 处理批量添加响应（如果后端支持）
      if (data && data.data && Array.isArray(data.data.added_files)) {
        this.#logger.info(`Files added: ${data.data.added_files.length} successful, ${data.data.failed_files?.length || 0} failed`);

        // 显示添加结果
        if (data.data.failed_files && data.data.failed_files.length > 0) {
          toastError(`添加完成：成功 ${data.data.added_files.length} 个，失败 ${data.data.failed_files.length} 个`);
        } else if (data.data.added_files.length > 0) {
          toastSuccess(`成功添加 ${data.data.added_files.length} 个文件`);
        }

        // 重新请求完整列表以更新视图
        this.#scopedEventBus?.emitGlobal('websocket:message:send', {
          type: 'pdf-library:list:records'
        });
      }

      // 处理批量删除响应（标准协议）
      if (typeof data?.type === 'string' && data.type === WEBSOCKET_MESSAGE_TYPES.REMOVE_PDF_COMPLETED) {
        const removedIds = Array.isArray(data?.data?.removed_files) ? data.data.removed_files : [];
        const failedMap = (data?.data && typeof data.data.failed_files === 'object') ? (data.data.failed_files || {}) : {};
        const failedCount = Object.keys(failedMap).length;
        const rid = data?.request_id;

        // 若先前记录了失败，且现在收到成功，则清理失败pending，优先以成功为准
        if (this.#pendingDeleteError && this.#pendingDeleteError.rid === rid) {
          this.#pendingDeleteError = null;
          try { if (this.#pendingDeleteErrorTimer) clearTimeout(this.#pendingDeleteErrorTimer); } catch (_) {}
          this.#pendingDeleteErrorTimer = null;
        }

        // 延后结果提示：避免立刻被 SearchFeature 的 hideAll() 清除
        this.#pendingDeleteToast = { removedCount: removedIds.length, failedCount, failedMap };

        // 清空选中并刷新当前视图（优先刷新搜索结果）
        if (this.#state) {
          this.#state.selectedIndices = [];
        }
        this.#refreshAfterDeletion();
        return;
      }

      // 兼容：pdfTable_server 批量删除响应（type='batch_pdf_removed'，data.removed 为对象数组，data.failed 为数组）
      if (typeof data?.type === 'string' && data.type === 'batch_pdf_removed') {
        const removedArr = Array.isArray(data?.data?.removed) ? data.data.removed : [];
        const removedIds = removedArr.map(r => r?.id || r).filter(Boolean);
        const failedArr = Array.isArray(data?.data?.failed) ? data.data.failed : [];
        const failedMap = {};
        failedArr.forEach((f, idx) => { failedMap[String(f?.id || f || idx)] = '删除失败'; });
        const failedCount = Object.keys(failedMap).length;
        const rid = data?.request_id;

        if (this.#pendingDeleteError && this.#pendingDeleteError.rid === rid) {
          this.#pendingDeleteError = null;
          try { if (this.#pendingDeleteErrorTimer) clearTimeout(this.#pendingDeleteErrorTimer); } catch (_) {}
          this.#pendingDeleteErrorTimer = null;
        }

        this.#pendingDeleteToast = { removedCount: removedIds.length, failedCount, failedMap };

        if (this.#state) this.#state.selectedIndices = [];
        this.#refreshAfterDeletion();
        return;
      }

      // 兼容：pdfTable_server 单文件删除响应（type='pdf_removed'，data.removed=true，data.file.id）
      if (typeof data?.type === 'string' && data.type === 'pdf_removed') {
        const removedOne = data?.data?.removed === true;
        const fileId = data?.data?.file?.id;
        const rid = data?.request_id;
        if (this.#pendingDeleteRid && rid && rid === this.#pendingDeleteRid) { try { toastDismiss(this.#pendingDeleteRid); } catch (_) {} this.#pendingDeleteRid = null; }
        if (this.#pendingDeleteError && this.#pendingDeleteError.rid === rid) {
          this.#pendingDeleteError = null;
          try { if (this.#pendingDeleteErrorTimer) clearTimeout(this.#pendingDeleteErrorTimer); } catch (_) {}
          this.#pendingDeleteErrorTimer = null;
        }
        this.#pendingDeleteToast = { removedCount: removedOne ? 1 : 0, failedCount: removedOne ? 0 : 1 };
        if (this.#state) this.#state.selectedIndices = [];
        this.#refreshAfterDeletion();
        return;
      }

      // 兼容旧逻辑：如果只看到 data.data.removed_files 也按删除成功处理
      if (data && data.data && Array.isArray(data.data.removed_files)) {
        const removed = data.data.removed_files;
        try { if (this.#pendingDeleteRid) toastDismiss(this.#pendingDeleteRid); } catch (_) {}
        this.#pendingDeleteRid = null;
        // 延后结果提示
        this.#pendingDeleteToast = { removedCount: removed.length, failedCount: 0 };
        if (this.#state) this.#state.selectedIndices = [];
        this.#refreshAfterDeletion();
      }
    });
    this.#unsubscribers.push(unsubWebSocketResponse);

    // 在搜索结果更新后再显示“删除完成”的 toast，避免被 SearchFeature 的 hideAll() 立即销毁
    const unsubSearchUpdated = this.#scopedEventBus.onGlobal('search:results:updated', () => {
      // 兜底：无论完成事件是否带有 request_id，刷新后确保关闭“删除中”pending
      try { if (this.#pendingDeleteRid) toastDismiss(this.#pendingDeleteRid); } catch (_) {}
      this.#pendingDeleteRid = null;
      this.#pendingDeleteCount = 0;
      if (!this.#pendingDeleteToast) return;
      const { removedCount, failedCount, failedMap } = this.#pendingDeleteToast || {};
      this.#pendingDeleteToast = null;
      // 延后到事件循环尾部，确保先执行 hideAll()
            setTimeout(() => {
        try {
          const entries = failedMap ? Object.entries(failedMap) : [];
          // 非致命（幂等）原因过滤：包含“不存在/not found”的不计入失败统计
          const isNonFatal = (pair) => {
            try {
              const s = String(pair && pair[1] || '').toLowerCase();
              return s.includes('不存在') || s.includes('not found');
            } catch { return false; }
          };
          const fatalEntries = entries.filter(e => !isNonFatal(e));
          const effectiveFailed = Math.max(0, fatalEntries.length);
          const MAX_SHOW = 5;
          const pairs = fatalEntries.slice(0, MAX_SHOW).map(([id, msg]) => (id + ':') + String(msg || '未知原因'));
          const overflow = fatalEntries.length > MAX_SHOW ? (' 等' + (fatalEntries.length - MAX_SHOW) + '项') : '';
          const summary = pairs.length ? pairs.join('；') + overflow : '';

          if (removedCount > 0 && effectiveFailed === 0) {
            toastSuccess('成功删除 ' + removedCount + ' 个文件');
          } else if (removedCount > 0 && effectiveFailed > 0) {
            toastWarning('删除完成：成功 ' + removedCount + ' 个，失败 ' + effectiveFailed + ' 个' + (summary ? ' - ' + summary : ''));
          } else if (removedCount === 0 && effectiveFailed > 0) {
            toastError('删除失败 - ' + (summary || '未知原因'));
          } else {
            toastWarning('未删除任何文件');
          }
        } catch (_) {}
      }, 0);
    }, { subscriberId: `pdf-list:${Date.now().toString(36)}:${Math.random().toString(36).slice(2,6)}:search-results-updated` });
    this.#unsubscribers.push(unsubSearchUpdated);

    // 兜底：将 WSClient 未专门路由的 add completed/failed 通过 unknown 转发到 response
    const unsubUnknown = this.#scopedEventBus.onGlobal('websocket:message:unknown', (msg) => {
      if (!msg || typeof msg.type !== 'string') return;
      if (msg.type === 'pdf-library:add:completed' || msg.type === 'pdf-library:add:failed') {
        this.#scopedEventBus?.emitGlobal('websocket:message:response', msg);
      }
    });
    this.#unsubscribers.push(unsubUnknown);

    // 也监听专门的pdf_list消息（如果后端发送）
    const unsubWebSocketList = this.#scopedEventBus.onGlobal('websocket:message:list', (data) => {
      this.#logger.info('Received PDF list from WebSocket (list event):', data);

      // 处理两种数据格式：
      // 1. 标准格式：data.data.files (后端广播的格式)
      // 2. 简化格式：data.items (旧格式，保持兼容)
      let items = null;

      if (data && data.data && Array.isArray(data.data.files)) {
        // 后端广播格式：{ data: { files: [...] } }
        items = data.data.files;
        this.#logger.info(`Received list in standard format: ${items.length} files`);
      } else if (data && Array.isArray(data.items)) {
        // 旧格式：{ items: [...] }
        items = data.items;
        this.#logger.info(`Received list in legacy format: ${items.length} items`);
      }

      // 更新状态中的items
      if (this.#state && items) {
        this.#logger.info(`✅ Updating table with ${items.length} items`);
        this.#state.items = items;
        this.#state.isLoading = false;

        // 触发表格更新（使用 uiManager.setData）
        this.#uiManager?.setData(items);

        // 发出数据加载完成事件
        this.#scopedEventBus?.emit(
          PDF_LIST_EVENTS.DATA_LOAD_COMPLETED,
          EventDataFactory.createDataLoadedData(items, items.length)
        );
      } else {
        this.#logger.warn('Invalid PDF list data received:', data);
        if (this.#state) {
          this.#state.isLoading = false;
        }
      }
    });
    this.#unsubscribers.push(unsubWebSocketList);

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
   * 初始化 UI
   * @private
   */
  async #initializeUI() {
    try {
      this.#logger.debug('Initializing PDF list UI');

      // 1. 获取表格容器
      const tableContainer = document.querySelector('#pdf-table-container');
      if (!tableContainer) {
        this.#logger.warn('PDF table container not found, skipping UI initialization');
        return;
      }

      // 2. 动态导入 PDFTable 组件
      const { PDFTable } = await import('./components/pdf-table.js');

      // 3. 创建 PDFTable 实例
      this.#uiManager = new PDFTable({
        container: tableContainer,
        state: this.#state,
        eventBus: this.#scopedEventBus
      });

      // 4. 初始化组件
      await this.#uiManager.initialize();

      this.#logger.debug('PDF list UI initialized successfully');

    } catch (error) {
      this.#logger.error('Failed to initialize PDF list UI:', error);
      throw error;
    }
  }

  /**
   * 清理 UI
   * @private
   */
  async #cleanupUI() {
    if (this.#uiManager) {
      try {
        if (typeof this.#uiManager.destroy === 'function') {
          await this.#uiManager.destroy();
        }
        this.#uiManager = null;
        this.#logger.debug('UI cleaned up successfully');
      } catch (error) {
        this.#logger.warn('Error cleaning up UI:', error);
        this.#uiManager = null;
      }
    }
  }

  /**
   * 请求PDF列表数据
   * @private
   */
  #requestPdfList() {
    if (!this.#scopedEventBus) {
      this.#logger.warn('Cannot request PDF list: ScopedEventBus not available');
      return;
    }

    this.#logger.info('Requesting PDF list from backend...');

    // 设置加载状态 (直接设置属性)
    if (this.#state) {
      this.#state.isLoading = true;
    }

    // 发送WebSocket消息请求PDF列表
    this.#scopedEventBus.emitGlobal(WEBSOCKET_EVENTS.MESSAGE.SEND, {
      type: WEBSOCKET_MESSAGE_TYPES.GET_PDF_LIST
    });

    this.#logger.debug('PDF list request sent');
  }

  // ==================== 公开方法（供外部调用） ====================

  /**
   * 刷新 PDF 列表
   * @returns {Promise<void>}
   */
  async refreshList() {
    if (!this.#enabled) {
      this.#logger.warn('Cannot refresh list: feature is disabled');
      return;
    }

    this.#logger.info('Refreshing PDF list...');

    try {
      // 1. 设置加载状态
      if (this.#state) {
        ListStateHelpers.setLoading(this.#state, true);
      }

      // 2. 触发数据加载请求事件
      this.#scopedEventBus?.emit(PDF_LIST_EVENTS.DATA_LOAD_REQUESTED);

      // TODO: 实际的列表刷新逻辑（将在后续迁移中实现）
      // 1. 通过 WebSocket 请求后端数据
      // 2. 接收数据后更新状态
      // 3. 状态变化会自动触发 DATA_CHANGED 事件

      this.#logger.info('PDF list refresh initiated');
    } catch (error) {
      this.#logger.error('Failed to refresh PDF list:', error);

      if (this.#state) {
        ListStateHelpers.setError(this.#state, error);
        ListStateHelpers.setLoading(this.#state, false);
      }

      this.#scopedEventBus?.emit(PDF_LIST_EVENTS.DATA_LOAD_FAILED, {
        error: error.message,
        timestamp: Date.now()
      });

      throw error;
    }
  }

  // ==================== 辅助：删除后刷新 ====================
  #refreshAfterDeletion() {
    try {
      // 若存在搜索框，则优先按照当前搜索词刷新结果列表
      const input = document.querySelector('.search-input');
      const searchText = input ? String(input.value || '').trim() : '';
      if (searchText !== '' || input) {
        // 触发搜索，以刷新“搜索结果列表”
        this.#scopedEventBus?.emitGlobal('search:query:requested', { searchText });
        this.#logger.info('Triggered search refresh after deletion', { searchText });
        return;
      }
    } catch (e) {
      this.#logger.warn('Search refresh after deletion failed, fallback to list reload', e);
    }
    // 兜底：请求完整列表
    this.#scopedEventBus?.emitGlobal(WEBSOCKET_EVENTS.MESSAGE.SEND, {
      type: WEBSOCKET_MESSAGE_TYPES.GET_PDF_LIST
    });
  }

  /**
   * 获取选中的记录
   * @returns {Object[]} 选中的记录数组
   */
  getSelectedRecords() {
    if (!this.#state) {
      this.#logger.warn('State not available, returning empty array');
      return [];
    }

    const items = this.#state.items || [];
    const selectedIndices = this.#state.selectedIndices || [];
    const selectedRecords = selectedIndices.map(index => items[index]).filter(Boolean);

    this.#logger.debug(`Retrieved ${selectedRecords.length} selected records`);
    return selectedRecords;
  }

  /**
   * 设置过滤条件
   * @param {Object} filters - 过滤条件
   */
  setFilters(filters) {
    if (!this.#enabled) {
      this.#logger.warn('Cannot set filters: feature is disabled');
      return;
    }

    if (!this.#state) {
      this.#logger.warn('State not available, cannot set filters');
      return;
    }

    this.#logger.debug('Setting filters:', filters);

    // 使用 ListStateHelpers 更新过滤条件
    ListStateHelpers.setFilters(this.#state, filters);

    // 状态变化会自动触发 FILTER_CHANGED 事件
    // 实际的过滤逻辑将在表格组件中实现
  }
}

/**
 * 创建 PDF List 功能域实例的工厂函数
 * @returns {PDFListFeature}
 */
export function createPDFListFeature() {
  return new PDFListFeature();
}

export default PDFListFeature;






