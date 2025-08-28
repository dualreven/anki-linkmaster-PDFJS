/**
 * UI管理器模块
 * 负责UI渲染和交互处理
 */

// 导入DOM工具模块
import { DOMUtils } from "../utils/dom-utils.js";

// 导入事件常量
import {
  PDF_MANAGEMENT_EVENTS,
  WEBSOCKET_EVENTS,
  UI_EVENTS,
} from "./event-constants.js";

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

    this.#initializeElements();
    this.#setupEventListeners();
    this.#setupGlobalEventListeners();
  }

  /**
   * 销毁实例，清理事件监听
   */
  destroy() {
    this.#logger.info("Destroying UIManager and unsubscribing from events.");
    this.#unsubscribeFunctions.forEach((unsub) => unsub());
    this.#unsubscribeFunctions = [];
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
   * 设置UI组件的事件监听
   */
  #setupEventListeners() {
    if (this.#elements.addPdfBtn) {
      const listener = () => this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED);
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
    const { pdfTableContainer, emptyState } = this.#elements;

    if (!pdfTableContainer) return;

    DOMUtils.empty(pdfTableContainer);

    if (loading) {
      const loadingDiv = DOMUtils.createElement("div", { className: "loading" }, "正在加载...");
      DOMUtils.appendChild(pdfTableContainer, loadingDiv);
      DOMUtils.hide(emptyState);
    } else if (pdfs.length === 0) {
      DOMUtils.show(emptyState);
    } else {
      DOMUtils.hide(emptyState);
      const tableHeader = this.#createPDFListHeader();
      DOMUtils.appendChild(pdfTableContainer, tableHeader);
      pdfs.forEach((pdf) => {
        const pdfItem = this.#createPDFItem(pdf);
        DOMUtils.appendChild(pdfTableContainer, pdfItem);
      });
    }
  }

  #createPDFListHeader() {
    // ... implementation for creating header ...
    return DOMUtils.createElement("div", { className: "pdf-list-header" });
  }

  #createPDFItem(pdf) {
    // ... implementation for creating item ...
    const item = DOMUtils.createElement("div", { className: "pdf-item" });
    DOMUtils.addEventListener(item, "click", (event) => this.#handlePDFItemAction(event));
    return item;
  }

  #handlePDFItemAction(event) {
    const button = DOMUtils.closest(event.target, "button");
    if (!button) return;

    const action = DOMUtils.getAttribute(button, "data-action");
    const filename = DOMUtils.getAttribute(button, "data-filename");

    if (!action || !filename) return;

    event.preventDefault();
    event.stopPropagation();

    switch (action) {
      case "open":
        this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, filename);
        break;
      case "remove":
        if (confirm("确定要删除这个PDF文件吗？")) {
          this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, filename);
        }
        break;
    }
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
