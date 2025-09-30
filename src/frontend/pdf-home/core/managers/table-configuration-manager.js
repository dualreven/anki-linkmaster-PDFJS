/**
 * @file 表格配置管理器
 * @module TableConfigurationManager
 * @description 专门处理表格配置、初始化和事件绑定
 */

import { TableWrapper } from '../../table-wrapper.js';
import { PDF_MANAGEMENT_EVENTS } from "../../../common/event/event-constants.js";
import { getLogger } from "../../../common/utils/logger.js";

/**
 * 表格配置管理器类
 * @class TableConfigurationManager
 */
export class TableConfigurationManager {
  #logger;
  #eventBus;
  #tableConfig;
  #tableWrapper = null;
  #uiManager;

  /**
   * 构造函数
   * @param {Object} eventBus - 事件总线
   * @param {Object} uiManager - UI管理器引用
   */
  constructor(eventBus, uiManager) {
    this.#eventBus = eventBus;
    this.#uiManager = uiManager;
    this.#logger = getLogger("TableConfigurationManager");
    this.#setupDefaultTableConfiguration();
  }

  /**
   * 设置默认表格配置
   * @private
   */
  #setupDefaultTableConfiguration() {
    this.#tableConfig = {
      columns: [
        { title: "File", field: "filename", widthGrow: 2 },
        { title: "Title", field: "title", widthGrow: 3 },
        { title: "Pages", field: "page_count", hozAlign: "center", width: 80 },
        { title: "Cards", field: "cards_count", hozAlign: "center", width: 80 },
      ],
      selectable: true,
      layout: "fitColumns",
      rowDblClick: (e, row) => {
        try {
          const rowData = row.getData();
          if (rowData && (rowData.id || rowData.filename)) {
            this.#logger.info(`Row double-clicked, opening PDF: ${rowData.filename}`, rowData);
            this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, rowData.id || rowData.filename, {
              actorId: 'TableConfigurationManager'
            });
          } else {
            this.#logger.warn("Row data is missing id or filename", rowData);
          }
        } catch (error) {
          this.#logger.error("Error in rowDblClick handler", error);
        }
      },
    };

    this.#logger.info("Default table configuration setup completed");
  }

  /**
   * 设置表格事件监听
   */
  setupEventListeners() {
    // Listen for PDF list updates to trigger table initialization
    this.#eventBus.on(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, (pdfs) => {
      this.#logger.info(`pdf:list:updated received, count=${pdfs.length}`);
      this.#initializeTableIfNeeded();
    }, { subscriberId: "TableConfigurationManager" });

    // Listen for single file addition to add row incrementally
    this.#eventBus.on("pdf:file:added", (newPdf) => {
      this.#logger.info(`[阶段4] 收到新文件添加事件:`, newPdf.filename);
      if (this.#tableWrapper) {
        this.#logger.info(`[阶段4] 增量添加行到表格顶部`);
        this.#tableWrapper.addRow(newPdf, true); // 添加到顶部
      } else {
        this.#logger.warn(`[阶段4] 表格未初始化，无法增量添加行`);
      }
    }, { subscriberId: "TableConfigurationManager" });
  }

  /**
   * 当PDF数据到达时初始化表格
   * @private
   */
  #initializeTableIfNeeded() {
    if (this.#tableWrapper) {
      this.#logger.debug("Table already initialized, skipping");
      return;
    }

    const tableContainer = document.querySelector('#pdf-table-container');
    if (!tableContainer) {
      this.#logger.warn('Table container #pdf-table-container not found; cannot initialize table');
      return;
    }

    this.#logger.info("Initializing table with PDF data available");

    try {
      // Create TableWrapper with stored configuration
      this.#tableWrapper = new TableWrapper(tableContainer, this.#tableConfig);

      // Set up event bindings after table creation
      this.#setupTableEventBindings();

      // Provide the table instance to UIManager
      if (this.#uiManager) {
        this.#uiManager.pdfTable = this.#tableWrapper;
        this.#logger.info("Table instance provided to UIManager");
      }

      this.#logger.info("Table initialization completed successfully");
    } catch (error) {
      this.#logger.error("Failed to initialize table:", error);
    }
  }

  /**
   * 设置表格事件绑定
   * @private
   */
  #setupTableEventBindings() {
    if (!this.#tableWrapper || !this.#tableWrapper.tabulator) {
      this.#logger.warn("TableWrapper or Tabulator instance not available for event binding");
      return;
    }

    const tabulator = this.#tableWrapper.tabulator;

    // Diagnostic event bindings
    tabulator.on("rowSelectionChanged", (data, rows) => {
      this.#logger.debug("底层 Tabulator rowSelectionChanged 事件触发", data);
    });

    // Enhanced row double-click handling with defensive programming
    tabulator.on("rowDblClick", (e, row) => {
      try {
        this.#logger.info("🔗 [双击] Tabulator rowDblClick 事件触发");

        const data = row && typeof row.getData === 'function' ? row.getData() : null;
        this.#logger.info("🔗 [双击] 行数据:", data);

        if (data && (data.id || data.filename)) {
          this.#logger.info(`🔗 [双击] 发送 PDF 打开事件: ${data.filename || data.id}`);
          this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, data.id || data.filename, {
            actorId: 'TableConfigurationManager'
          });
        } else {
          this.#logger.warn("🔗 [双击] 行数据缺少 id 或 filename", data);
        }
      } catch (error) {
        this.#logger.error("🔗 [双击] rowDblClick 事件处理出错:", error);
      }
    });

    this.#logger.info("Tabulator 事件绑定完成（包含双击修复）");
  }

  /**
   * 获取表格配置
   * @returns {Object} 表格配置
   */
  getTableConfig() {
    return { ...this.#tableConfig };
  }

  /**
   * 获取表格包装器实例
   * @returns {TableWrapper|null} 表格包装器实例
   */
  getTableWrapper() {
    return this.#tableWrapper;
  }

  /**
   * 更新表格配置
   * @param {Object} newConfig - 新的配置项
   */
  updateTableConfig(newConfig) {
    this.#tableConfig = { ...this.#tableConfig, ...newConfig };
    this.#logger.info("Table configuration updated");
  }

  /**
   * 检查表格是否已初始化
   * @returns {boolean} 是否已初始化
   */
  isTableInitialized() {
    return this.#tableWrapper !== null;
  }

  /**
   * 获取表格状态信息
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      tableInitialized: this.isTableInitialized(),
      hasTableConfig: this.#tableConfig !== null,
      configColumns: this.#tableConfig?.columns?.length || 0,
      tableWrapperType: this.#tableWrapper?.constructor?.name || null
    };
  }

  /**
   * 销毁表格管理器
   */
  destroy() {
    this.#logger.info("Destroying TableConfigurationManager");

    if (this.#tableWrapper) {
      try {
        this.#tableWrapper.destroy();
      } catch (error) {
        this.#logger.error("Error destroying table wrapper:", error);
      }
      this.#tableWrapper = null;
    }

    this.#tableConfig = null;
    this.#logger.info("TableConfigurationManager destroyed");
  }
}