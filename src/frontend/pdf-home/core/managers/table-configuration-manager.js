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
        // 学习管理字段 (扩展 - 2025-10-02)
        {
          title: "Rating",
          field: "rating",
          hozAlign: "center",
          width: 100,
          formatter: (cell) => this.#formatRating(cell)
        },
        {
          title: "Reviews",
          field: "review_count",
          hozAlign: "center",
          width: 80,
          formatter: (cell) => this.#formatReviewCount(cell)
        },
        {
          title: "Last Access",
          field: "last_accessed_at",
          hozAlign: "center",
          width: 120,
          formatter: (cell) => this.#formatLastAccessed(cell)
        },
        {
          title: "Reading Time",
          field: "total_reading_time",
          hozAlign: "center",
          width: 120,
          formatter: (cell) => this.#formatReadingTime(cell)
        },
        {
          title: "Due Date",
          field: "due_date",
          hozAlign: "center",
          width: 120,
          formatter: (cell) => this.#formatDueDate(cell)
        },
        {
          title: "Visible",
          field: "is_visible",
          hozAlign: "center",
          width: 80,
          formatter: (cell) => this.#formatVisibility(cell)
        },
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

    // Listen for single file removal to delete row incrementally
    this.#eventBus.on("pdf:file:removed", (removedPdf) => {
      this.#logger.info(`[删除-阶段4] 收到文件删除事件:`, removedPdf.filename);
      if (this.#tableWrapper) {
        this.#logger.info(`[删除-阶段4] 增量删除表格行`);
        this.#tableWrapper.deleteRow(removedPdf.id); // 根据ID删除
      } else {
        this.#logger.warn(`[删除-阶段4] 表格未初始化，无法增量删除行`);
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
   * 格式化评分字段 (星星显示)
   * @private
   * @param {Object} cell - Tabulator单元格对象
   * @returns {string} HTML字符串
   */
  #formatRating(cell) {
    const value = cell.getValue();
    if (value === undefined || value === null || value === 0) {
      return '<span style="color: #999;">-</span>';
    }
    const stars = '★'.repeat(value) + '☆'.repeat(5 - value);
    return `<span style="color: #ffa500;">${stars}</span>`;
  }

  /**
   * 格式化复习次数
   * @private
   * @param {Object} cell - Tabulator单元格对象
   * @returns {string} HTML字符串
   */
  #formatReviewCount(cell) {
    const value = cell.getValue();
    if (value === undefined || value === null || value === 0) {
      return '<span style="color: #999;">-</span>';
    }
    return `<span style="color: #4CAF50;">${value}</span>`;
  }

  /**
   * 格式化最后访问时间 (相对时间)
   * @private
   * @param {Object} cell - Tabulator单元格对象
   * @returns {string} HTML字符串
   */
  #formatLastAccessed(cell) {
    const value = cell.getValue();
    if (!value || value === 0) {
      return '<span style="color: #999;">Never</span>';
    }

    const now = Math.floor(Date.now() / 1000);
    const diff = now - value;

    let timeStr;
    if (diff < 60) {
      timeStr = 'Just now';
    } else if (diff < 3600) {
      timeStr = `${Math.floor(diff / 60)}m ago`;
    } else if (diff < 86400) {
      timeStr = `${Math.floor(diff / 3600)}h ago`;
    } else if (diff < 2592000) {
      timeStr = `${Math.floor(diff / 86400)}d ago`;
    } else {
      const date = new Date(value * 1000);
      timeStr = date.toLocaleDateString();
    }

    return `<span style="color: #2196F3;">${timeStr}</span>`;
  }

  /**
   * 格式化阅读时长
   * @private
   * @param {Object} cell - Tabulator单元格对象
   * @returns {string} HTML字符串
   */
  #formatReadingTime(cell) {
    const value = cell.getValue();
    if (!value || value === 0) {
      return '<span style="color: #999;">-</span>';
    }

    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);

    let timeStr;
    if (hours > 0) {
      timeStr = `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      timeStr = `${minutes}m`;
    } else {
      timeStr = `${value}s`;
    }

    return `<span style="color: #9C27B0;">${timeStr}</span>`;
  }

  /**
   * 格式化到期日期
   * @private
   * @param {Object} cell - Tabulator单元格对象
   * @returns {string} HTML字符串
   */
  #formatDueDate(cell) {
    const value = cell.getValue();
    if (!value || value === 0) {
      return '<span style="color: #999;">-</span>';
    }

    const now = Math.floor(Date.now() / 1000);
    const date = new Date(value * 1000);
    const dateStr = date.toLocaleDateString();

    let color = '#666';
    if (value < now) {
      color = '#f44336'; // 过期 - 红色
    } else if (value < now + 86400 * 3) {
      color = '#ff9800'; // 即将到期 - 橙色
    } else {
      color = '#4CAF50'; // 未到期 - 绿色
    }

    return `<span style="color: ${color};">${dateStr}</span>`;
  }

  /**
   * 格式化可见性
   * @private
   * @param {Object} cell - Tabulator单元格对象
   * @returns {string} HTML字符串
   */
  #formatVisibility(cell) {
    const value = cell.getValue();
    if (value === undefined || value === null) {
      return '<span style="color: #4CAF50;">✓</span>';
    }
    return value
      ? '<span style="color: #4CAF50;">✓</span>'
      : '<span style="color: #f44336;">✗</span>';
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