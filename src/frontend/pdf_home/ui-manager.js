/**
 * UI管理器（迁移到 pdf-home）
 */
import { DOMUtils } from "../common/utils/dom-utils.js";
import {
  PDF_MANAGEMENT_EVENTS,
  WEBSOCKET_EVENTS,
  UI_EVENTS,
} from "../common/event/event-constants.js";
import { getLogger } from "../common/utils/logger.js";

export class UIManager {
  #state;
  #elements;
  #eventBus;
  #logger;
  #unsubscribeFunctions = [];

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("UIManager");
    this.#state = {
      pdfs: [],
      loading: false,
      websocketConnected: false,
      error: null,
    };
  }

  initialize() {
    this.#logger.info("Initializing UI Manager...");
    this.#initializeElements();
    this.#setupEventListeners();
    this.#setupGlobalEventListeners();
    this.#initializePDFTable();
    this.#logger.info("UI Manager initialized successfully.");
  }

  destroy() {
    this.#logger.info("Destroying UIManager and unsubscribing from events.");
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
        const { pdfs } = this.#state;
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

  #setupEventListeners() {
    if (this.#elements.addPdfBtn) {
      const listener = () => { this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, {}, {
        actorId: 'UIManager'
      }); };
      DOMUtils.addEventListener(this.#elements.addPdfBtn, "click", listener);
      this.#unsubscribeFunctions.push(() => DOMUtils.removeEventListener(this.#elements.addPdfBtn, "click", listener));
    }
    if (this.#elements.batchAddBtn) {
      const listener = () => this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, { isBatch: true }, {
        actorId: 'UIManager'
      });
      DOMUtils.addEventListener(this.#elements.batchAddBtn, "click", listener);
      this.#unsubscribeFunctions.push(() => DOMUtils.removeEventListener(this.#elements.batchAddBtn, "click", listener));
    }
    if (this.#elements.batchDeleteBtn) {
      const listener = () => this.#handleBatchDelete();
      DOMUtils.addEventListener(this.#elements.batchDeleteBtn, "click", listener);
      this.#unsubscribeFunctions.push(() => DOMUtils.removeEventListener(this.#elements.batchDeleteBtn, "click", listener));
    }
    if (this.#elements.testPdfViewerBtn) {
      const listener = () => this.#handleTestPdfViewer();
      DOMUtils.addEventListener(this.#elements.testPdfViewerBtn, "click", listener);
      this.#unsubscribeFunctions.push(() => DOMUtils.removeEventListener(this.#elements.testPdfViewerBtn, "click", listener));
    }
    if (this.#elements.debugBtn) {
      const listener = () => this.#toggleDebugStatus();
      DOMUtils.addEventListener(this.#elements.debugBtn, "click", listener);
      this.#unsubscribeFunctions.push(() => DOMUtils.removeEventListener(this.#elements.debugBtn, "click", listener));
    }
    const handleTableAction = (event) => {
      const btn = event.target && event.target.closest ? event.target.closest('button') : null;
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      const rowId = btn.getAttribute('data-row-id') || btn.getAttribute('data-rowid');
      const filename = btn.getAttribute('data-filename') || btn.getAttribute('data-filepath') || null;

      this.#logger.info(`Table action triggered: action=${action}, rowId=${rowId}, filename=${filename}`);

      if (action) {
        event.preventDefault();
        event.stopPropagation();
        switch (action) {
          case 'open':
            this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, rowId || filename, {
              actorId: 'UIManager'
            });
            break;
          case 'delete':
          case 'remove':
            // 使用新的对话框管理器
            if (window.dialogManager) {
              window.dialogManager.confirm("确定要删除这个PDF文件吗？").then(confirmed => {
                if (confirmed) {
                  const payload = rowId || filename;
                  this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, payload, {
                    actorId: 'UIManager'
                  });
                }
              });
            } else {
              // 降级到原生confirm
              if (confirm("确定要删除这个PDF文件吗？")) {
                const payload = rowId || filename;
                this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, payload, {
                  actorId: 'UIManager'
                });
              }
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
      if (event.ctrlKey && event.key === "d") { event.preventDefault(); this.#toggleDebugStatus(); }
      if (event.ctrlKey && event.key === "n") { event.preventDefault(); this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, undefined, {
        actorId: 'UIManager'
      }); }
    };
    DOMUtils.addEventListener(document, "keydown", handleKeyDown);
    this.#unsubscribeFunctions.push(() => DOMUtils.removeEventListener(document, "keydown", handleKeyDown));
  }

  #updatePDFList(pdfs) {
    this.#logger.info("Updating PDF list UI");
    this.#state.pdfs = pdfs;
    this.#render();
  }

  #setLoading(loading) { this.#state.loading = loading; this.#render(); }
  #setWebSocketConnected(connected) { this.#state.websocketConnected = connected; this.#render(); }

  #render() { this.#renderPDFList(); this.#updateDebugStatus(); }

  #renderPDFList() {
    const { pdfs, loading } = this.#state;
    const { emptyState, pdfTableContainer } = this.#elements;

    // ==================== 修改开始 (3/3) ====================
    // 隐藏外部的、独立的 empty-state div，因为Tabulator现在自己管理空状态了
    DOMUtils.hide(emptyState);
    // 始终显示表格容器
    DOMUtils.show(pdfTableContainer);

    if (loading) {
      // 我们可以创建一个"加载中"的placeholder，但目前为了简单，
      // 暂时不清空数据，保持旧数据直到新数据加载完成。
      // 或者，如果你想显示加载状态：
      // if (this.pdfTable) { this.pdfTable.setData([]); } // 清空数据会显示placeholder
      this.#logger.info("UI is in loading state.");
    } else {
      if (this.pdfTable) {
        // 不管pdfs是空数组还是有数据，直接交给setData处理
        // TableWrapper内部的Tabulator会根据数据是否为空来决定显示数据行还是placeholder
        const tableData = pdfs.map(pdf => ({ ...pdf, size: pdf.size || 0, modified_time: pdf.modified_time || '', page_count: pdf.page_count || 0, annotations_count: pdf.annotations_count || 0, cards_count: pdf.cards_count || 0, importance: pdf.importance || 'medium' }));
        
        this.pdfTable.setData(tableData).catch(error => { // setData现在是TableWrapper的方法
            this.#logger.error("Failed to load data into PDF table:", error);
        });
      } else {
        this.#logger.warn("PDF table instance not found, cannot render PDF list.");
      }
    }
    // ==================== 修改结束 (3/3) ====================
  }

  async #handleBatchDelete() {
    // 优先使用 TableWrapper 提供的 API 获取选中的行（该方法已被正规化为 plain objects）
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
 
          // 收集所有选中的文件标识（优先 id -> filename -> file_id）
          const selectedFiles = selectedRows.map(row => {
            // row 可能是 plain object
            if (!row) return '';
            return row.id || row.filename || row.file_id || row.fileId || '';
          }).filter(Boolean);
 
          if (selectedFiles.length === 0) {
            this.showError("无法获取选中的文件信息");
            return;
          }
 
          // 作为批量请求发送，避免竞态条件
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
 
    // 如果 TableWrapper API 不可用或未返回选中项，回退到 DOM 检测：
    // 支持多种 checkbox 类名：pdf-item-checkbox, pdf-table-checkbox, pdf-table-row-select（TableWrapper 回退模式）
    let checkboxes = Array.from(DOMUtils.findAllElements(".pdf-item-checkbox:checked") || []);
    if (checkboxes.length === 0) {
      checkboxes = Array.from(DOMUtils.findAllElements('.pdf-table-checkbox:checked') || []);
    }
    if (checkboxes.length === 0) {
      checkboxes = Array.from(DOMUtils.findAllElements('.pdf-table-row-select:checked') || []);
    }
 
    // 如果仍为空，尝试检测 Tabulator 的选中行 DOM（并从行元素中找 data-row-id / data-filename）
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
 
    if (checkboxes.length === 0) { this.showError("请先选择要删除的PDF文件"); return; }

    // 使用新的对话框管理器
    if (window.dialogManager) {
      const confirmed = await window.dialogManager.confirm(`确定要删除选中的 ${checkboxes.length} 个PDF文件吗？`);
      if (!confirmed) return;
    } else {
      // 降级到原生confirm
      if (!confirm(`确定要删除选中的 ${checkboxes.length} 个PDF文件吗？`)) return;
    }
 
    // 收集所有选中的文件
    const selectedFiles = [];
    checkboxes.forEach(checkbox => {
      // 优先使用明确的 filename 属性
      let filename = DOMUtils.getAttribute(checkbox, "data-filename") || DOMUtils.getAttribute(checkbox, "data-filepath") || (checkbox.dataset && (checkbox.dataset.filename || checkbox.dataset.filepath));
      if (!filename) {
        const rowId = (checkbox.dataset && (checkbox.dataset.rowId || checkbox.dataset.rowid)) || DOMUtils.getAttribute(checkbox, 'data-row-id') || DOMUtils.getAttribute(checkbox, 'data-rowid');
        if (rowId && Array.isArray(this.#state?.pdfs)) {
          const entry = this.#state.pdfs.find(p => String(p.id) === String(rowId) || String(p.filename) === String(rowId));
          filename = entry ? entry.filename : rowId;
        } else {
          filename = rowId;
        }
      }
      if (filename) selectedFiles.push(filename);
    });
 
    // 作为批量请求发送，避免竞态条件
    this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.BATCH.REQUESTED, {
      files: selectedFiles,
      timestamp: Date.now()
    }, {
      actorId: 'UIManager'
    });
  }

  #handleTestPdfViewer() {
    this.#logger.info("测试PDF查看器按钮被点击");

    // 使用 data/pdfs 目录下的测试PDF文件
    // 注意：只传递文件名，路径由后端处理
    const testPdfPath = "test.pdf";

    this.#logger.info(`请求打开测试PDF: ${testPdfPath} (从 data/pdfs 目录)`);

    // 触发PDF查看器启动事件
    this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, testPdfPath, {
      actorId: 'UIManager',
      source: 'test-button',
      expectedLocation: 'data/pdfs/'
    });

    this.showSuccess("正在启动PDF查看器...");
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
    DOMUtils.setHTML(this.#elements.debugContent, `...`);
  }

  showError(message) {
    DOMUtils.showError(message);
  }

  showSuccess(message) {
    DOMUtils.showSuccess(message);
  }

}
