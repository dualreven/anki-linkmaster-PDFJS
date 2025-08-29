/**
 * UI管理器模块
 * 负责UI渲染和交互处理
 */

// 导入DOM工具模块
import { DOMUtils } from "../utils/dom-utils.js";

// 导入PDF表格模块
import PDFTable from "../../common/pdf-table/index.js";

// 导入事件常量
import {
  PDF_MANAGEMENT_EVENTS,
  WEBSOCKET_EVENTS,
  UI_EVENTS,
} from "../event/event-constants.js";

// 导入日志模块
import Logger from "../utils/logger.js";

/**
 * UI管理器类
 */
export class UIManager {
  #state;
  #elements;
  #eventBus;
  #logger;
  #unsubscribeFunctions = [];

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = new Logger("UIManager");
    this.#state = {
      pdfs: [],
      loading: false,
      websocketConnected: false,
      error: null,
    };
  }

  /**
   * 初始化UI管理器
   */
  initialize() {
    this.#logger.info("Initializing UI Manager...");
    this.#initializeElements();
    this.#setupEventListeners();
    this.#setupGlobalEventListeners();
    
    // 初始化PDF表格
    this.#initializePDFTable();
    this.#logger.info("UI Manager initialized successfully.");
    
  }

  /**
   * 销毁实例，清理事件监听
   */
  destroy() {
    this.#logger.info("Destroying UIManager and unsubscribing from events.");
    this.#unsubscribeFunctions.forEach((unsub) => unsub());
    this.#unsubscribeFunctions = [];
    
    // 销毁PDF表格
    if (this.pdfTable && typeof this.pdfTable.destroy === 'function') {
      this.pdfTable.destroy();
    }
  }

  /**
   * 初始化DOM元素
   */
  #initializeElements() {
    this.#elements = {
      container: DOMUtils.findElement(".container"),
      addPdfBtn: DOMUtils.getElementById("add-pdf-btn"),
      batchAddBtn: DOMUtils.getElementById("batch-add-btn"),
      batchDeleteBtn: DOMUtils.getElementById("batch-delete-btn"),
      debugBtn: DOMUtils.getElementById("debug-btn"),
      debugStatus: DOMUtils.getElementById("debug-status"),
      debugContent: DOMUtils.getElementById("debug-content"),
      pdfTableContainer: DOMUtils.getElementById("pdf-table-container"),
      emptyState: DOMUtils.getElementById("empty-state"),
    };
  }

  /**
   * 初始化PDF表格
   */
  #initializePDFTable() {
    if (this.#elements.pdfTableContainer) {
      // 配置PDF表格
      const tableConfig = {
        columns: [
          {
            id: 'filename',
            title: '文件名',
            field: 'filename',
            width: 200,
            align: 'left',
            sortable: false, // 禁用排序功能
            filterable: false, // 禁用筛选功能
            visible: true
          },
          {
            id: 'title',
            title: '标题',
            field: 'title',
            width: 200,
            align: 'left',
            sortable: false, // 禁用排序功能
            filterable: false, // 禁用筛选功能
            visible: true
          },
          {
            id: 'size',
            title: '大小',
            field: 'size',
            width: 100,
            align: 'right',
            sortable: false, // 禁用排序功能
            filterable: false, // 禁用筛选功能
            visible: true,
            formatter: 'fileSizeFormatter'
          },
          {
            id: 'modified_time',
            title: '修改时间',
            field: 'modified_time',
            width: 150,
            align: 'center',
            sortable: false, // 禁用排序功能
            filterable: false, // 禁用筛选功能
            visible: true,
            formatter: 'dateFormatter'
          },
          {
            id: 'page_count',
            title: '页数',
            field: 'page_count',
            width: 80,
            align: 'right',
            sortable: false, // 禁用排序功能
            filterable: false, // 禁用筛选功能
            visible: true
          },
          {
            id: 'actions',
            title: '操作',
            field: 'actions',
            width: 120,
            align: 'center',
            sortable: false, // 禁用排序功能
            filterable: false, // 禁用筛选功能
            visible: true,
            renderer: (value, row) => this.#createActionButtons(row)
          }
        ],
        sortable: false, // 禁用排序功能
        filterable: false, // 禁用筛选功能
        pagination: false, // 禁用分页功能
        selectable: false, // 禁用选择功能
        exportEnabled: false, // 禁用导出功能
        searchEnabled: false // 禁用搜索功能
      };

      // 创建PDF表格实例
      this.pdfTable = new PDFTable(this.#elements.pdfTableContainer, tableConfig);
      this.#logger.info("PDF table instance created at:", this.#elements.pdfTableContainer);
      // 在初始化时一次性设置表格相关事件监听
      this.#setupTableEventListeners();
      // 初始化表格
      this.pdfTable.initialize().catch(error => {
        this.#logger.error("Failed to initialize PDF table:", error);
      });
    }
  }

  /**
   * 设置PDF表格实例的事件监听（初始化时注册）
   */
  #setupTableEventListeners() {
    if (!this.pdfTable) return;

    const handleDataChange = () => {
      this.#logger.debug("Table data changed, ensuring UI consistency.");
      try {
        const { pdfs } = this.#state;
        if (pdfs && pdfs.length > 0) {
          DOMUtils.hide(this.#elements.emptyState);
          DOMUtils.show(this.#elements.pdfTableContainer);
        } else {
          DOMUtils.show(this.#elements.emptyState);
        }

        // Defensive cleanup: remove internal empty-state nodes if present
        const internalEmptyStates = DOMUtils.findAllElements('.pdf-table-empty-state', this.#elements.pdfTableContainer);
        Array.from(internalEmptyStates).forEach(el => el.remove());
        if (this.pdfTable.tableWrapper) this.pdfTable.tableWrapper.style.display = '';
        if (this.pdfTable.tableWrapper?.parentElement) this.pdfTable.tableWrapper.parentElement.style.display = '';
      } catch (e) {
        this.#logger.warn("Could not perform defensive cleanup after table render.", e);
      }
    };

    // 监听表格内部的 'data-loaded' 事件
    this.pdfTable.events.on('data-loaded', handleDataChange);
    this.#unsubscribeFunctions.push(() => this.pdfTable.events.off && this.pdfTable.events.off('data-loaded', handleDataChange));

    // 监听EventBus的表格数据变化事件（尝试使用返回的取消函数，否则备用 off）
    const unsubEventBus = this.#eventBus.on('pdf:table:data-changed', handleDataChange);
    if (typeof unsubEventBus === 'function') {
      this.#unsubscribeFunctions.push(unsubEventBus);
    } else if (typeof this.#eventBus.off === 'function') {
      this.#unsubscribeFunctions.push(() => this.#eventBus.off('pdf:table:data-changed', handleDataChange));
    }
  }

  /**
   * 设置UI组件的事件监听
   */
  #setupEventListeners() {
    if (this.#elements.addPdfBtn) {
      const listener = () => {
        // 对于QtWebEngine项目，后端会处理文件选择
        // 只需要发送添加PDF请求，后端会弹出文件选择器
        this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, {});
      };
      DOMUtils.addEventListener(this.#elements.addPdfBtn, "click", listener);
      this.#unsubscribeFunctions.push(() => DOMUtils.removeEventListener(this.#elements.addPdfBtn, "click", listener));
    }

    if (this.#elements.batchAddBtn) {
        const listener = () => this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, { isBatch: true });
        DOMUtils.addEventListener(this.#elements.batchAddBtn, "click", listener);
        this.#unsubscribeFunctions.push(() => DOMUtils.removeEventListener(this.#elements.batchAddBtn, "click", listener));
    }

    if (this.#elements.batchDeleteBtn) {
      const listener = () => this.#handleBatchDelete();
      DOMUtils.addEventListener(this.#elements.batchDeleteBtn, "click", listener);
      this.#unsubscribeFunctions.push(() => DOMUtils.removeEventListener(this.#elements.batchDeleteBtn, "click", listener));
    }

    if (this.#elements.debugBtn) {
      const listener = () => this.#toggleDebugStatus();
      DOMUtils.addEventListener(this.#elements.debugBtn, "click", listener);
      this.#unsubscribeFunctions.push(() => DOMUtils.removeEventListener(this.#elements.debugBtn, "click", listener));
    }
    
    // 添加对PDF表格操作按钮的事件监听（使用事件委托并支持内部元素触发）
    const handleTableAction = (event) => {
      const btn = event.target.closest && event.target.closest('button');
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      const rowId = btn.getAttribute('data-row-id');
      let filename = btn.getAttribute('data-filename');

      // 如果没有直接提供 filename，尝试通过 rowId 在 state 中查找
      if (!filename && rowId && Array.isArray(this.#state.pdfs)) {
        const row = this.#state.pdfs.find(p => p.id === rowId);
        if (row) filename = row.filename || row.filepath || null;
      }

      const normalizedAction = action === 'delete' ? 'remove' : action;

      if (normalizedAction && (filename || rowId)) {
        event.preventDefault();
        event.stopPropagation();

        // Build file payload with id/filename/filepath when available
        const filePayload = { id: rowId || null, filename: filename || null };
        if (rowId && Array.isArray(this.#state.pdfs)) {
          const row = this.#state.pdfs.find(p => p.id === rowId);
          if (row) {
            if (row.filepath) filePayload.filepath = row.filepath;
            if (!filePayload.filename && row.filename) filePayload.filename = row.filename;
          }
        }

        // Log action for debugging
        this.#logger && this.#logger.info && this.#logger.info('Table action triggered', { action: normalizedAction, rowId, filePayload });

        switch (normalizedAction) {
          case 'open':
            this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, filePayload);
            break;
          case 'remove':
            if (confirm("确定要删除这个PDF文件吗？")) {
              this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, filePayload);
            }
            break;
        }
      }
    };

    if (this.#elements.pdfTableContainer) {
      DOMUtils.addEventListener(this.#elements.pdfTableContainer, 'click', handleTableAction);
      this.#unsubscribeFunctions.push(() => DOMUtils.removeEventListener(this.#elements.pdfTableContainer, 'click', handleTableAction));
    }
 }

  /**
   * 设置全局事件监听
   */
  #setupGlobalEventListeners() {
    const listeners = [
      this.#eventBus.on(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, (pdfs) => this.#updatePDFList(pdfs)),
      this.#eventBus.on(WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED, () => this.#setWebSocketConnected(true)),
      this.#eventBus.on(WEBSOCKET_EVENTS.CONNECTION.CLOSED, () => this.#setWebSocketConnected(false)),
      this.#eventBus.on(UI_EVENTS.ERROR.SHOW, (errorInfo) => this.showError(errorInfo.message)),
      this.#eventBus.on(UI_EVENTS.SUCCESS.SHOW, (message) => this.showSuccess(message)),
    ];
    this.#unsubscribeFunctions.push(...listeners);

    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === "d") {
        event.preventDefault();
        this.#toggleDebugStatus();
      }
      if (event.ctrlKey && event.key === "n") {
        event.preventDefault();
        this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED);
      }
    };
    
    DOMUtils.addEventListener(document, "keydown", handleKeyDown);
    this.#unsubscribeFunctions.push(() => DOMUtils.removeEventListener(document, "keydown", handleKeyDown));
  }

  #updatePDFList(pdfs) {
    this.#logger.info("Updating PDF list UI");
    this.#state.pdfs = pdfs;
    this.#render();
  }

  #setLoading(loading) {
    this.#state.loading = loading;
    this.#render();
  }

  #setWebSocketConnected(connected) {
    this.#state.websocketConnected = connected;
    this.#render();
  }

  #render() {
    this.#renderPDFList();
    this.#updateDebugStatus();
  }

  #renderPDFList() {
    const { pdfs, loading } = this.#state;
    const { emptyState } = this.#elements;


    if (loading) {
      // 显示加载状态
      if (this.pdfTable) {
        this.pdfTable.displayEmptyState("正在加载...");
      }
      DOMUtils.hide(emptyState);
    } else if (pdfs.length === 0) {
      // 显示空状态
      if (this.pdfTable) {
        this.pdfTable.displayEmptyState();
      }
      DOMUtils.show(emptyState);
    } else {
      // 显示PDF列表
      DOMUtils.hide(emptyState);
      if (this.pdfTable) {
        // 转换数据格式以匹配pdf-table的期望格式
        const tableData = pdfs.map(pdf => ({
          ...pdf,
          size: pdf.size || 0,
          modified_time: pdf.modified_time || '',
          page_count: pdf.page_count || 0,
          annotations_count: pdf.annotations_count || 0,
          cards_count: pdf.cards_count || 0,
          importance: pdf.importance || 'medium'
        }));
        
        
        // 加载数据到表格
        // 先确保外部空状态隐藏，显示表格容器
        DOMUtils.hide(this.#elements.emptyState);
        DOMUtils.show(this.#elements.pdfTableContainer);

        this.pdfTable.loadData(tableData).catch(error => {
          this.#logger.error("Failed to load data into PDF table:", error);
        });

        
      } else {
        this.#logger.warn("PDF table instance not found, cannot render PDF list.");}
    }
  }

  #createPDFListHeader() {
    // This method is no longer used as we're using pdf-table for rendering
    return null;
  }

  #createPDFItem(pdf) {
    // This method is no longer used as we're using pdf-table for rendering
    return null;
  }

  #handlePDFItemAction(event) {
    // This method is no longer used as we're using pdf-table for rendering
    // The event handling is now done in #setupEventListeners
 }

  #handleBatchDelete() {
    const checkboxes = DOMUtils.findAllElements(".pdf-item-checkbox:checked");
    if (checkboxes.length === 0) {
      this.showError("请先选择要删除的PDF文件");
      return;
    }

    if (confirm(`确定要删除选中的 ${checkboxes.length} 个PDF文件吗？`)) {
      checkboxes.forEach(checkbox => {
        const filename = DOMUtils.getAttribute(checkbox, "data-filename");
        this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, filename);
      });
    }
  }

  /**
   * 上传文件并添加PDF记录
   * @param {Object} fileInfo - 文件信息
   */
  async #uploadAndAddPDF(fileInfo) {
    try {
      this.#logger.info("Starting file upload and PDF addition process...");
      
      // 对于QtWebEngine项目，文件选择由后端处理
      // 前端只需要发送添加PDF请求，后端会处理文件选择
      this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, fileInfo);
      
    } catch (error) {
      this.#logger.error("Failed to add PDF:", error);
      this.showError(`添加PDF文件失败: ${error.message}`);
    }
  }

  /**
   * 创建操作按钮
   * @param {Object} row - 表格行数据
   * @returns {string} 操作按钮的HTML
   */
  #createActionButtons(row) {
    return `
      <div class="pdf-table-actions">
        <button class="btn small primary" data-action="open" data-filename="${row.filename}">打开</button>
        <button class="btn small danger" data-action="remove" data-filename="${row.filename}">删除</button>
      </div>
    `;
  }

  #toggleDebugStatus() {
    if (this.#elements.debugStatus) {
      const isVisible = DOMUtils.isVisible(this.#elements.debugStatus);
      if (isVisible) {
        DOMUtils.hide(this.#elements.debugStatus);
      } else {
        DOMUtils.show(this.#elements.debugStatus);
        this.#updateDebugStatus();
      }
    }
  }

  #updateDebugStatus() {
    if (!this.#elements.debugContent || !DOMUtils.isVisible(this.#elements.debugStatus)) return;
    
    const { pdfs, loading, websocketConnected } = this.#state;
    // ... implementation for updating debug status ...
    DOMUtils.setHTML(this.#elements.debugContent, `...`);
    
  }
  showError(message) {
    DOMUtils.showError(message);
  }

  showSuccess(message) {
    DOMUtils.showSuccess(message);
  }
  


}
