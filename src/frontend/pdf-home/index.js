/**
 * @file 应用主入口，负责模块的初始化、协调和生命周期管理。
 * @module PDFHomeApp
 */

import { EventBus } from "../common/event/event-bus.js";
import TableWrapper from './table-wrapper.js';
import { APP_EVENTS, PDF_MANAGEMENT_EVENTS } from "../common/event/event-constants.js";
import Logger, { LogLevel } from "../common/utils/logger.js";
import { ErrorHandler } from "../common/error/error-handler.js";
import { UIManager } from "./ui-manager.js";
import PDFManager from "../common/pdf/pdf-manager.js";
import WSClient from "../common/ws/ws-client.js";

/**
 * @class PDFHomeApp
 * @description 应用的核心协调器，管理所有模块的生命周期。
 */
class PDFHomeApp {
  #logger;
  #eventBus;
  #errorHandler;
  #websocketManager;
  #pdfManager;
  #uiManager;
  #initialized = false;

  constructor() {
    this.#logger = new Logger("PDFHomeApp");
    this.#eventBus = new EventBus({
      enableValidation: true,
      logLevel: LogLevel.DEBUG,
    });
    this.#errorHandler = new ErrorHandler(this.#eventBus);
    this.#websocketManager = new WSClient("ws://localhost:8765", this.#eventBus);
    this.#pdfManager = new PDFManager(this.#eventBus);
    this.#uiManager = new UIManager(this.#eventBus);
  }

  /**
   * 初始化所有应用模块。
   */
  async initialize() {
    try {
      this.#logger.info("Initializing PDF Home App...");
      this.#setupGlobalErrorHandling();
      
      // Initialize table wrapper (Tabulator) BEFORE UIManager so UIManager can attach to it
      const tableContainer = document.querySelector('#pdf-table-container');
      if (tableContainer) {
          this.tableWrapper = new TableWrapper(tableContainer, {
          columns: [
            {
              formatter: "rowSelection",
              titleFormatter: "rowSelection", 
              titleFormatterParams: {
                rowRange: "active" // 只显示当前页的全选
              },
              hozAlign: "center",
              headerSort: false,
              width: 50, // 增加宽度
              cellClick: function(e, cell) {
                e.stopPropagation(); // 防止事件冒泡
              }
            },
            { title: "File", field: "filename", widthGrow: 2 },
            { title: "Title", field: "title", widthGrow: 3 },
            { title: "Pages", field: "page_count", hozAlign: "center", width: 80 },
            { title: "Cards", field: "cards_count", hozAlign: "center", width: 80 },
            // { 
            //   title: "Actions", 
            //   hozAlign: "center", 
            //   headerSort: false,
            //   formatter: actionButtonsFormatter,
            //   width: 150,
            // }
          ],
          selectable: true,
          // selectableRows: true,
          // selectableCheck: function(row) {
          //   // 可选：添加选择条件检查
          //   return true; // 允许所有行被选择
          // },
          layout: "fitColumns",
        });


                // ==================== 诊断代码开始 ====================
        
        // 1. 检查 TableWrapper 内部的 Tabulator 实例是否存在
        if (this.tableWrapper && this.tableWrapper.tabulator) {

          // 2. 直接在原始 Tabulator 实例上绑定事件，绕过我们自己的 .on() 封装
          // this.tableWrapper.tabulator.on("rowSelectionChanged", (data, rows) => {
          //   console.log(
          //     "%c !!! 诊断: 底层 Tabulator rowSelectionChanged 事件触发了 !!!",
          //     "color: green; font-weight: bold;",
          //     data
          //   );
          // });
          
          // this.tableWrapper.tabulator.on("cellClick", (e, cell) => {
          //    console.log(
          //     "%c !!! 诊断: 底层 Tabulator cellClick 事件触发了 !!!",
          //     "color: blue; font-weight: bold;",
          //     cell.getValue()
          //   );
          // });

          this.#logger.info("诊断: 已直接在底层 Tabulator 实例上绑定 'rowSelectionChanged' 和 'cellClick' 事件。");

        } else {
          this.#logger.error("诊断失败: 无法访问到 this.tableWrapper.tabulator！这说明 TableWrapper 初始化可能失败了。");
        }
        
        // ==================== 诊断代码结束 ====================


        // // 我们自己封装的事件监听器暂时保持原样，用于对比
        // this.tableWrapper.on('rowSelectionChanged', (data, rows) => {
        //   this.#logger.info('我们封装的 on() -> rowSelectionChanged 触发了。');
        // });



        // Bridge Tabulator events to our event bus
        // Use Tabulator's cellClick event signature: function(e, cell) -> cell.getRow().getData()
        
        // 确保 Tabulator 完全初始化后再绑定事件
        setTimeout(() => {
          if (this.tableWrapper && this.tableWrapper.tabulator) {
            // 绑定选择变化事件
            this.tableWrapper.tabulator.on("rowSelectionChanged", (data, rows) => {
              console.log("行选择发生变化:", data, rows);
              try {
                const selected = Array.isArray(data) ? data.map(r => r.id || r.filename) : [];
                this.#eventBus.emit('ui:selection:changed', selected, { actorId: 'PDFHomeApp' });
              } catch (err) {
                this.#logger.warn('Error handling rowSelectionChanged', err);
              }
            });

            // 绑定行点击事件（用于切换选择状态）
            this.tableWrapper.tabulator.on("rowClick", (e, row) => {
              console.log("行被点击:", row.getData());
              // 切换行的选择状态
              if (row.isSelected()) {
                row.deselect();
              } else {
                row.select();
              }
            });

            // 绑定单元格点击事件（用于操作按钮）
            this.tableWrapper.tabulator.on("cellClick", (e, cell) => {
              const cellElement = cell.getElement();
              const button = e.target.closest('button[data-action]');
               
              if (button) {
                e.stopPropagation(); // 防止触发行选择
                const action = button.getAttribute('data-action');
                const rowData = cell.getRow().getData();
                 
                if (action === 'open') {
                  this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, rowData.id || rowData.filename);
                } else if (action === 'delete') {
                  if (confirm('确定要删除这个PDF文件吗？')) {
                    this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, rowData.id || rowData.filename);
                  }
                }
              }
            });

            this.#logger.info("Tabulator 事件绑定完成");
          }
        }, 100); // 给 Tabulator 一些时间完成初始化
        
        // this.tableWrapper.on('cellClick', (e, cell) => {
        //   try {
        //     // cell may be Tabulator.CellComponent
        //     const rowData = (cell && typeof cell.getRow === 'function') ? cell.getRow().getData() : null;
        //     if (!rowData) return;
        //     const el = e && e.target ? e.target : null;
        //     const actionBtn = el && el.closest ? el.closest('button[data-action]') : null;
        //     if (actionBtn) {
        //       const action = actionBtn.getAttribute('data-action');
        //       const rowId = rowData.id || rowData.filename || '';
        //       if (action === 'open') {
        //         this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, rowId);
        //       } else if (action === 'delete') {
        //         if (confirm('确定要删除这个PDF文件吗？')) {
        //           this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, rowId);
        //         }
        //       }
        //     }
        //   } catch (err) {
        //     this.#logger.warn('Error handling table cellClick', err);
        //   }
        // });
        // rowSelectionChanged
        // this.tableWrapper.on('rowSelectionChanged', (data, rows) => {
        //   try {
        //     const selected = Array.isArray(data) ? data.map(r => r.id || r.filename) : [];
        //     this.#eventBus.emit('ui:selection:changed', selected, { actorId: 'PDFHomeApp' });
        //   } catch (err) { this.#logger.warn('Error handling rowSelectionChanged', err); }
        // });
        

        // Subscribe to pdf list updates from event bus
        this.#eventBus.on('pdf:list:updated', (pdfs) => {
          try {
            const mapped = Array.isArray(pdfs) ? pdfs.map(p => ({ ...p })) : [];
            this.#logger.info(`pdf:list:updated received, count=${mapped.length}`);
            if (mapped.length > 0) this.#logger.debug('sample item:', mapped[0]);
            if (this.tableWrapper) {
              this.tableWrapper.setData(mapped);
            } else {
              this.#logger.warn('TableWrapper not initialized when pdf:list:updated received');
            }
          } catch (e) {
            this.#logger.error('Failed to update table wrapper data', e);
          }
        }, { subscriberId: 'PDFHomeApp' });

        // Provide the table instance to UIManager before it initializes
        this.#uiManager.pdfTable = this.tableWrapper;
      } else {
        this.#logger.warn('Table container #pdf-table-container not found; skipping TableWrapper init');
      }

      this.#pdfManager.initialize();
      this.#uiManager.initialize(); // UIManager now has its own initialization logic

      this.#websocketManager.connect();
      
      this.#initialized = true;
      this.#logger.info("PDF Home App initialized successfully.");
      this.#eventBus.emit(APP_EVENTS.INITIALIZATION.COMPLETED, undefined, { actorId: 'PDFHomeApp' });
    } catch (error) {
      this.#logger.error("Application initialization failed.", error);
      this.#errorHandler.handleError(error, "App.initialize");
    }
  }

  /**
   * 销毁应用，清理所有资源。
   */
  destroy() {
    this.#logger.info("Destroying PDF Home App...");
    this.#pdfManager.destroy();
    this.#uiManager.destroy();
    this.#websocketManager.disconnect();
    this.#eventBus.destroy();
    this.#logger.info("PDF Home App destroyed.");
  }


  #setupGlobalErrorHandling() {
    window.addEventListener("unhandledrejection", (event) => {
      this.#logger.error("Unhandled Promise Rejection:", event.reason);
      this.#errorHandler.handleError(event.reason, "UnhandledPromiseRejection");
    });

    window.addEventListener("error", (event) => {
      this.#logger.error("Global Error:", event.error);
      this.#errorHandler.handleError(event.error, "GlobalError");
    });
  }

  /**
   * 获取应用的公开状态快照。
   * @returns {object} 应用的当前状态。
   */
  getState() {
    return {
      initialized: this.#initialized,
      websocketConnected: this.#websocketManager.isConnected(),
      pdfCount: this.#pdfManager.getPDFs().length,
    };
  }

  // Expose EventBus for testing and external integrations
  getEventBus() {
    return this.#eventBus;
  }
}

// ===== 应用启动 =====
document.addEventListener("DOMContentLoaded", async () => {
  const app = new PDFHomeApp();
  const index_logger = new Logger("pdf-home/index.js");
  try {
    await app.initialize();
    window.app = {
        getState: () => app.getState(),
        destroy: () => app.destroy(),
        _internal: app // For advanced debugging
    };
    index_logger.info("PDF Home App started. Use window.app.getState() for status.");

    // run lightweight integration tests automatically and log result (non-blocking)
    /* Integration tests disabled by default. To run manually, import and call from console or devtools.
    try {
      const { runIntegrationTests } = await import('./integration-tests.js');
      const bus = (typeof app.getEventBus === 'function') ? app.getEventBus() : (app._eventBus || null);
      runIntegrationTests(bus, app).then(result => console.info('Integration tests result:', result)).catch(e => console.warn('Integration tests failed', e));
    } catch (e) {
      // ignore if tests cannot run in current environment
    }
    */
  } catch (error) {
    index_logger.error("Failed to start PDF Home App:", error);
  }
});
