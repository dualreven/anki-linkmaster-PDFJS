/**
 * UI管理器模块 (moved)
 */
import { DOMUtils } from "../../pdf-home/utils/dom-utils.js";
import PDFTable from "../pdf-table/index.js";
import {
  PDF_MANAGEMENT_EVENTS,
  WEBSOCKET_EVENTS,
  UI_EVENTS,
} from "../event/event-constants.js";
import Logger from "../../pdf-home/utils/logger.js";

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
      debugBtn: DOMUtils.getElementById("debug-btn"),
      debugStatus: DOMUtils.getElementById("debug-status"),
      debugContent: DOMUtils.getElementById("debug-content"),
      pdfTableContainer: DOMUtils.getElementById("pdf-table-container"),
      emptyState: DOMUtils.getElementById("empty-state"),
    };
  }

  #initializePDFTable() {
    if (this.#elements.pdfTableContainer) {
      const tableConfig = {
        columns: [/* kept configuration omitted for brevity */],
        sortable: false,
        filterable: false,
        pagination: false,
        selectable: false,
        exportEnabled: false,
        searchEnabled: false
      };
      this.pdfTable = new PDFTable(this.#elements.pdfTableContainer, tableConfig);
      this.#logger.info("PDF table instance created at:", this.#elements.pdfTableContainer);
      this.#setupTableEventListeners();
      this.pdfTable.initialize().catch(error => {
        this.#logger.error("Failed to initialize PDF table:", error);
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
        if (this.pdfTable.tableWrapper) this.pdfTable.tableWrapper.style.display = '';
        if (this.pdfTable.tableWrapper?.parentElement) this.pdfTable.tableWrapper.parentElement.style.display = '';
      } catch (e) {
        this.#logger.warn("Could not perform defensive cleanup after table render.", e);
      }
    };
    this.pdfTable.events.on('data-loaded', handleDataChange);
    this.#unsubscribeFunctions.push(() => this.pdfTable.events.off && this.pdfTable.events.off('data-loaded', handleDataChange));
    const unsubEventBus = this.#eventBus.on('pdf:table:data-changed', handleDataChange);
    if (typeof unsubEventBus === 'function') this.#unsubscribeFunctions.push(unsubEventBus);
    else if (typeof this.#eventBus.off === 'function') this.#unsubscribeFunctions.push(() => this.#eventBus.off('pdf:table:data-changed', handleDataChange));
  }

  #setupEventListeners() {
    if (this.#elements.addPdfBtn) {
      const listener = () => { this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, {}); };
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
    const handleTableAction = (event) => {
      const btn = event.target && event.target.closest ? event.target.closest('button') : null;
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      const rowId = btn.getAttribute('data-row-id') || btn.getAttribute('data-rowid');
      const filename = btn.getAttribute('data-filename') || btn.getAttribute('data-filepath') || null;

      this.#logger.info(`Table action triggered: action=${action}, rowId=${rowId}, filename=${filename}`);
      try { console.info('TABLE_ACTION', { action, rowId, filename }); } catch (e) {}

      if (action) {
        event.preventDefault();
        event.stopPropagation();
        switch (action) {
          case 'open':
            this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, rowId || filename);
            break;
          case 'delete':
          case 'remove':
            if (confirm("确定要删除这个PDF文件吗？")) {
              const payload = rowId || filename;
              this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, payload);
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
      if (event.ctrlKey && event.key === "n") { event.preventDefault(); this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED); }
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
    const { emptyState } = this.#elements;
    if (loading) {
      if (this.pdfTable) { this.pdfTable.displayEmptyState("正在加载..."); }
      DOMUtils.hide(emptyState);
    } else if (pdfs.length === 0) {
      if (this.pdfTable) { this.pdfTable.displayEmptyState(); }
      DOMUtils.show(emptyState);
    } else {
      DOMUtils.hide(emptyState);
      if (this.pdfTable) {
        const tableData = pdfs.map(pdf => ({ ...pdf, size: pdf.size || 0, modified_time: pdf.modified_time || '', page_count: pdf.page_count || 0, annotations_count: pdf.annotations_count || 0, cards_count: pdf.cards_count || 0, importance: pdf.importance || 'medium' }));
        DOMUtils.hide(this.#elements.emptyState);
        DOMUtils.show(this.#elements.pdfTableContainer);
        this.pdfTable.loadData(tableData).catch(error => { this.#logger.error("Failed to load data into PDF table:", error); });
      } else { this.#logger.warn("PDF table instance not found, cannot render PDF list."); }
    }
  }

  #handleBatchDelete() {
    const checkboxes = DOMUtils.findAllElements(".pdf-item-checkbox:checked");
    if (checkboxes.length === 0) { this.showError("请先选择要删除的PDF文件"); return; }
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
