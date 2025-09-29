/**
 * @file UI管理器主类，负责协调UI状态管理和事件处理
 * @module UIManager
 */

import { DOMUtils } from "../common/utils/dom-utils.js";
import { PDF_MANAGEMENT_EVENTS } from "../common/event/event-constants.js";
import { getLogger } from "../common/utils/logger.js";
import { UIStateManager } from "./ui/ui-state-manager.js";
import { UIEventHandlers } from "./ui/ui-event-handlers.js";

export class UIManager {
  #elements;
  #eventBus;
  #logger;
  #stateManager;
  #eventHandlers;
  #unsubscribeFunctions = [];

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("UIManager");
    this.#stateManager = new UIStateManager();
  }

  initialize() {
    this.#logger.info("Initializing UI Manager...");
    this.#initializeElements();
    this.#eventHandlers = new UIEventHandlers(this.#eventBus, this.#elements, this.#stateManager);
    this.#eventHandlers.setupEventListeners();
    this.#setupTableDataHandling();
    this.#initializePDFTable();
    this.#setupBatchDeleteHandler();
    this.#logger.info("UI Manager initialized successfully.");
  }

  destroy() {
    this.#logger.info("Destroying UIManager and unsubscribing from events.");
    this.#eventHandlers?.destroy();
    this.#unsubscribeFunctions.forEach((unsub) => unsub());
    this.#unsubscribeFunctions = [];
    if (this.pdfTable && typeof this.pdfTable.destroy === 'function') {
      this.pdfTable.destroy();
    }
  }

  #initializeElements() {
    this.#elements = {
      container: DOMUtils.findElement(".container"),
      addPdfBtn: DOMUtils.getElementById("add-pdf-btn"),
      batchAddBtn: DOMUtils.getElementById("batch-add-btn"),
      batchDeleteBtn: DOMUtils.getElementById("batch-delete-btn"),
      testPdfViewerBtn: DOMUtils.getElementById("test-pdf-viewer-btn"),
      debugBtn: DOMUtils.getElementById("debug-btn"),
      debugStatus: DOMUtils.getElementById("debug-status"),
      debugContent: DOMUtils.getElementById("debug-content"),
      pdfTableContainer: DOMUtils.getElementById("pdf-table-container"),
      emptyState: DOMUtils.getElementById("empty-state"),
    };
  }

  #setupTableDataHandling() {
    // 监听状态管理器的数据变化
    const unsubscribe = this.#eventBus.on(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, (pdfs) => {
      this.#stateManager.updatePDFList(pdfs);
      this.#renderPDFList();
    }, { subscriberId: 'UIManager' });

    this.#unsubscribeFunctions.push(unsubscribe);
  }

  #setupBatchDeleteHandler() {
    // 处理来自事件处理器的批量删除请求
    const unsubscribe = this.#eventBus.on('ui:batch-delete:requested', () => {
      this.#handleBatchDelete();
    }, { subscriberId: 'UIManager' });

    this.#unsubscribeFunctions.push(unsubscribe);
  }

  #initializePDFTable() {
    if (!this.#elements.pdfTableContainer) return;

    // Expect PDFHomeApp to inject a table instance (TableWrapper) as this.pdfTable before initialize()
    if (!this.pdfTable) {
      this.#logger.info("No injected pdfTable instance found; skipping table initialization. Integration should inject TableWrapper from PDFHomeApp.");
      return;
    }

    this.#logger.info("Using injected pdfTable instance for UI Manager.");
    this.#setupTableEventListeners();

    if (typeof this.pdfTable.initialize === 'function') {
      this.pdfTable.initialize().catch(error => {
        this.#logger.error("Failed to initialize injected pdfTable:", error);
      });
    }
  }

  #setupTableEventListeners() {
    if (!this.pdfTable) return;

    const handleDataChange = () => {
      this.#logger.debug("Table data changed, ensuring UI consistency.");
      try {
        const pdfs = this.#stateManager.getPDFs();
        if (pdfs && pdfs.length > 0) {
          DOMUtils.hide(this.#elements.emptyState);
          DOMUtils.show(this.#elements.pdfTableContainer);
        } else {
          DOMUtils.show(this.#elements.emptyState);
        }
        const internalEmptyStates = DOMUtils.findAllElements('.pdf-table-empty-state', this.#elements.pdfTableContainer);
        Array.from(internalEmptyStates).forEach(el => el.remove());
        // try to expose wrapper element if available
        if (this.pdfTable.tableWrapper) this.pdfTable.tableWrapper.style.display = '';
        if (this.pdfTable.tableWrapper?.parentElement) this.pdfTable.tableWrapper.parentElement.style.display = '';
      } catch (e) {
        this.#logger.warn("Could not perform defensive cleanup after table render.", e);
      }
    };

    // Support legacy PDFTable.events API or new TableWrapper.on API
    try {
      if (this.pdfTable.events && typeof this.pdfTable.events.on === 'function') {
        this.pdfTable.events.on('data-loaded', handleDataChange);
        this.#unsubscribeFunctions.push(() => this.pdfTable.events.off && this.pdfTable.events.off('data-loaded', handleDataChange));
      } else if (typeof this.pdfTable.on === 'function') {
        this.pdfTable.on('data-loaded', handleDataChange);
        this.#unsubscribeFunctions.push(() => this.pdfTable.off && this.pdfTable.off('data-loaded', handleDataChange));
      }
    } catch (e) {
      this.#logger.warn('Failed to attach to pdfTable data-loaded event', e);
    }

    const unsubEventBus = this.#eventBus.on('pdf:table:data-changed', handleDataChange);
    if (typeof unsubEventBus === 'function') this.#unsubscribeFunctions.push(unsubEventBus);
    else if (typeof this.#eventBus.off === 'function') this.#unsubscribeFunctions.push(() => this.#eventBus.off('pdf:table:data-changed', handleDataChange));
  }

  #renderPDFList() {
    const state = this.#stateManager.getState();
    const { pdfs, loading } = state;
    const { emptyState, pdfTableContainer } = this.#elements;

    // 隐藏外部的、独立的 empty-state div，因为Tabulator现在自己管理空状态了
    DOMUtils.hide(emptyState);
    // 始终显示表格容器
    DOMUtils.show(pdfTableContainer);

    if (loading) {
      this.#logger.info("UI is in loading state.");
    } else {
      if (this.pdfTable) {
        // 不管pdfs是空数组还是有数据，直接交给setData处理
        const tableData = pdfs.map(pdf => ({
          ...pdf,
          size: pdf.size || 0,
          modified_time: pdf.modified_time || '',
          page_count: pdf.page_count || 0,
          annotations_count: pdf.annotations_count || 0,
          cards_count: pdf.cards_count || 0,
          importance: pdf.importance || 'medium'
        }));

        this.pdfTable.setData(tableData).catch(error => {
          this.#logger.error("Failed to load data into PDF table:", error);
        });
      } else {
        this.#logger.debug("PDF table instance not yet initialized, skipping render.");
      }
    }
  }

  async #handleBatchDelete() {
    // 优先使用 TableWrapper 提供的 API 获取选中的行
    if (this.pdfTable && typeof this.pdfTable.getSelectedRows === 'function') {
      try {
        const selectedRows = this.pdfTable.getSelectedRows();
        if (Array.isArray(selectedRows) && selectedRows.length > 0) {
          // 使用新的对话框管理器
          if (window.dialogManager) {
            const confirmed = await window.dialogManager.confirm(`确定要删除选中的 ${selectedRows.length} 个PDF文件吗？`);
            if (!confirmed) return;
          } else {
            // 降级到原生confirm
            if (!confirm(`确定要删除选中的 ${selectedRows.length} 个PDF文件吗？`)) return;
          }

          // 收集所有选中的文件标识
          const selectedFiles = selectedRows.map(row => {
            if (!row) return '';
            return row.id || row.filename || row.file_id || row.fileId || '';
          }).filter(Boolean);

          if (selectedFiles.length === 0) {
            this.showError("无法获取选中的文件信息");
            return;
          }

          // 作为批量请求发送
          this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.BATCH.REQUESTED, {
            files: selectedFiles,
            timestamp: Date.now()
          }, {
            actorId: 'UIManager'
          });

          return;
        }
      } catch (e) {
        this.#logger.warn('Failed to read selection from pdfTable API', e);
      }
    }

    // 回退到DOM检测
    this.#handleBatchDeleteByDOM();
  }

  async #handleBatchDeleteByDOM() {
    // DOM检测逻辑（保持原有复杂逻辑）
    let checkboxes = Array.from(DOMUtils.findAllElements(".pdf-item-checkbox:checked") || []);
    if (checkboxes.length === 0) {
      checkboxes = Array.from(DOMUtils.findAllElements('.pdf-table-checkbox:checked') || []);
    }
    if (checkboxes.length === 0) {
      checkboxes = Array.from(DOMUtils.findAllElements('.pdf-table-row-select:checked') || []);
    }

    if (checkboxes.length === 0 && this.#elements.pdfTableContainer) {
      const tabulatorSelected = Array.from(DOMUtils.findAllElements('.tabulator-row.tabulator-selected', this.#elements.pdfTableContainer) || []);
      if (tabulatorSelected.length > 0) {
        tabulatorSelected.forEach(rowEl => {
          let rowId = rowEl.getAttribute('data-row-id') || rowEl.getAttribute('data-rowid') || (rowEl.dataset && (rowEl.dataset.rowId || rowEl.dataset.rowid));
          let filename = null;
          if (!rowId) {
            const cellWithRowId = rowEl.querySelector('[data-row-id], [data-rowid], [data-filename], [data-filepath]');
            if (cellWithRowId) {
              rowId = cellWithRowId.getAttribute('data-row-id') || cellWithRowId.getAttribute('data-rowid') || null;
              filename = cellWithRowId.getAttribute('data-filename') || cellWithRowId.getAttribute('data-filepath') || null;
            }
          }
          if (rowId || filename) {
            const fakeCheckbox = document.createElement('input');
            fakeCheckbox.type = 'checkbox';
            if (rowId) fakeCheckbox.dataset.rowId = rowId;
            if (filename) fakeCheckbox.dataset.filename = filename;
            checkboxes.push(fakeCheckbox);
          }
        });
      }
    }

    if (checkboxes.length === 0) {
      this.showError("请先选择要删除的PDF文件");
      return;
    }

    // 确认删除
    if (window.dialogManager) {
      const confirmed = await window.dialogManager.confirm(`确定要删除选中的 ${checkboxes.length} 个PDF文件吗？`);
      if (!confirmed) return;
    } else {
      if (!confirm(`确定要删除选中的 ${checkboxes.length} 个PDF文件吗？`)) return;
    }

    // 收集文件
    const selectedFiles = [];
    const pdfs = this.#stateManager.getPDFs();
    checkboxes.forEach(checkbox => {
      let filename = DOMUtils.getAttribute(checkbox, "data-filename") || DOMUtils.getAttribute(checkbox, "data-filepath") || (checkbox.dataset && (checkbox.dataset.filename || checkbox.dataset.filepath));
      if (!filename) {
        const rowId = (checkbox.dataset && (checkbox.dataset.rowId || checkbox.dataset.rowid)) || DOMUtils.getAttribute(checkbox, 'data-row-id') || DOMUtils.getAttribute(checkbox, 'data-rowid');
        if (rowId && Array.isArray(pdfs)) {
          const entry = pdfs.find(p => String(p.id) === String(rowId) || String(p.filename) === String(rowId));
          filename = entry ? entry.filename : rowId;
        } else {
          filename = rowId;
        }
      }
      if (filename) selectedFiles.push(filename);
    });

    // 发送批量删除请求
    this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.BATCH.REQUESTED, {
      files: selectedFiles,
      timestamp: Date.now()
    }, {
      actorId: 'UIManager'
    });
  }

  showError(message) {
    DOMUtils.showError(message);
    this.#stateManager.setError(message);
  }

  showSuccess(message) {
    DOMUtils.showSuccess(message);
    this.#stateManager.clearError();
  }
}