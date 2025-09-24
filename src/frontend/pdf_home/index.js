/**
 * @file 搴旂敤涓诲叆鍙ｏ紝璐熻矗妯″潡鐨勫垵濮嬪寲銆佸崗璋冨拰鐢熷懡鍛ㄦ湡绠＄悊銆?
 * @module PDFHomeApp
 */


import { createPDFHomeContainer } from "../common/container/app-container.js";
import { TableWrapper } from './table-wrapper.js';
import { APP_EVENTS, PDF_MANAGEMENT_EVENTS, UI_EVENTS, SYSTEM_EVENTS, WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../common/event/event-constants.js";
import { setGlobalWebSocketClient, LogLevel, getLogger } from "../common/utils/logger.js";
import { ErrorHandler } from "../common/error/error-handler.js";
import { UIManager } from "./ui-manager.js";
import PDFManager from "../common/pdf/pdf-manager.js";
import { createConsoleWebSocketBridge } from "../common/utils/console-websocket-bridge.js";
import { resolveWebSocketPort, DEFAULT_WS_PORT, resolveWebSocketPortSync } from "./utils/ws-port-resolver.js";
import { EventBus as EventBusClass } from "../common/event/event-bus.js";
import { initPdfHomeChannel } from './qwebchannel-bridge.js';

/**
 * @class PDFHomeApp
 * @description 搴旂敤鐨勬牳蹇冨崗璋冨櫒锛岀鐞嗘墍鏈夋ā鍧楃殑鐢熷懡鍛ㄦ湡銆?
 */
class PDFHomeApp {
  #logger;
  #eventBus;
  #errorHandler;
  #websocketManager;
  #pdfManager;
  #uiManager;
  #consoleBridge;
  #wsPort = DEFAULT_WS_PORT;
  #initialized = false;
  #coreGuard = null;
  #appContainer; // 搴旂敤瀹瑰櫒

  constructor(deps = {}) {
    // 濡傛灉浼犲叆浜嗗鍣紝浣跨敤瀹冿紱鍚﹀垯鍒涘缓鏂板鍣?
    if (deps.container) {
      this.#appContainer = deps.container;
    } else {
      // 鍒涘缓搴旂敤瀹瑰櫒锛岃В鍐冲惊鐜緷璧?
      this.#appContainer = createPDFHomeContainer({
        wsUrl: deps.wsUrl || `ws://localhost:${DEFAULT_WS_PORT}`,
        enableValidation: deps.enableValidation !== false
      });
    }

    // 浠庡鍣ㄨ幏鍙栦緷璧?
    const { logger, eventBus, wsClient } = this.#appContainer.getDependencies();
    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#websocketManager = wsClient;
    this.#coreGuard = deps.core?.guard || null;

    // 鍒涘缓鍏朵粬缁勪欢
    this.#errorHandler = new ErrorHandler(this.#eventBus);
    this.#pdfManager = new PDFManager(this.#eventBus);
    this.#uiManager = new UIManager(this.#eventBus);
    this.#wsPort = DEFAULT_WS_PORT;

    this.#consoleBridge = createConsoleWebSocketBridge('pdf-home', (message) => {
      if (this.#websocketManager?.isConnected()) {
        this.#websocketManager.send({ type: 'console_log', data: message });
      }
    });
  }
/**
  async #setupWebSocketClient() {
    if (this.#websocketManager) {
      return;
    }

    try {
      const resolvedPort = await resolveWebSocketPort({ logger: this.#logger, fallbackPort: this.#wsPort });
      if (Number.isInteger(resolvedPort) && resolvedPort > 0 && resolvedPort < 65536) {
        this.#wsPort = resolvedPort;
      } else {
        this.#logger.warn("Resolved WebSocket port invalid, using fallback", { resolvedPort });
      }
    } catch (error) {
      this.#logger.warn("Failed to resolve WebSocket port from log, using fallback", { error: error?.message || error });
    }

    const targetUrl = `ws://localhost:${this.#wsPort}`;
    this.#logger.info(`WebSocket client prepared for pdf-home: ${targetUrl}`);
  }

  /**
   * 鍒濆鍖栨墍鏈夊簲鐢ㄦā鍧椼€?
   */
  async initialize() {
    console.log("[DEBUG] PDFHomeApp.initialize() called");
    try {
      if (this.#coreGuard) this.#coreGuard();
      console.log("[DEBUG] About to log 'Initializing PDF Home App...'");
      this.#logger.info("Initializing PDF Home App...");
      console.log("[DEBUG] Setting up global error handling...");
      this.#setupGlobalErrorHandling();

      // Initialize table wrapper (Tabulator) BEFORE UIManager so UIManager can attach to it
      const tableContainer = document.querySelector('#pdf-table-container');
      if (tableContainer) {
          this.tableWrapper = new TableWrapper(tableContainer, {
          columns: [
            // 娉ㄦ剰锛氬綋鍓嶆湭鍚敤 Tabulator 鐨?SelectRow 妯″潡锛屼笂杩?formatter 浼氬湪閮ㄥ垎鎵撳寘褰㈡€佷笅鏃犳晥骞舵姤閿欍€?
            // 鏆傛椂绉婚櫎 rowSelection 鍒楋紝閬垮厤鍒濆鍖栧憡璀︼紱濡傞渶澶氶€夛紝璇锋敼鐢?table-wrapper.js 涓殑鍥為€€checkbox鏂规銆?
            // {
            //   formatter: "rowSelection",
            //   titleFormatter: "rowSelection",
            //   titleFormatterParams: {
            //     rowRange: "active"
            //   },
            //   hozAlign: "center",
            //   headerSort: false,
            //   width: 50,
            //   cellClick: function(e, cell) {
            //     e.stopPropagation();
            //   }
            // },
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
                 actorId: 'PDFHomeApp'
               });
             } else {
               this.#logger.warn("Row data is missing id or filename", rowData);
             }
           } catch (error) {
             this.#logger.error("Error in rowDblClick handler", error);
           }
          },
        });

        // ==================== 璇婃柇浠ｇ爜寮€濮?====================

        // 1. 妫€鏌?TableWrapper 鍐呴儴鐨?Tabulator 瀹炰緥鏄惁瀛樺湪
        if (this.tableWrapper && this.tableWrapper.tabulator) {

          // 2. 鐩存帴鍦ㄥ師濮?Tabulator 瀹炰緥涓婄粦瀹氫簨浠讹紝缁曡繃鎴戜滑鑷繁鐨?.on() 灏佽
          this.tableWrapper.tabulator.on("rowSelectionChanged", (data, rows) => {
            this.#logger.debug("搴曞眰 Tabulator rowSelectionChanged 浜嬩欢瑙﹀彂", data);
          });

          this.tableWrapper.tabulator.on("cellClick", (e, cell) => {
            this.#logger.debug("搴曞眰 Tabulator cellClick 浜嬩欢瑙﹀彂", { value: cell.getValue() });
          });

          this.#logger.info("璇婃柇: 宸茬洿鎺ュ湪搴曞眰 Tabulator 瀹炰緥涓婄粦瀹?'rowSelectionChanged' 鍜?'cellClick' 浜嬩欢銆?);

        } else {
          this.#logger.error("璇婃柇澶辫触: 鏃犳硶璁块棶鍒?this.tableWrapper.tabulator锛佽繖璇存槑 TableWrapper 鍒濆鍖栧彲鑳藉け璐ヤ簡銆?);
        }

        // ==================== 璇婃柇浠ｇ爜缁撴潫 ====================


        // 纭繚 Tabulator 瀹屽叏鍒濆鍖栧悗鍐嶇粦瀹氫簨浠?
        setTimeout(() => {
          if (this.tableWrapper && this.tableWrapper.tabulator) {

            // 缁戝畾閫夋嫨鍙樺寲浜嬩欢
            this.tableWrapper.tabulator.on("rowSelectionChanged", (selectedRows) => {
              this.#logger.debug("琛岄€夋嫨鍙戠敓鍙樺寲", selectedRows);
              try {
                const selectedIds = selectedRows.map(row => row.getData ? row.getData().id || row.getData().filename : row.id || row.filename);
                this.#eventBus.emit(UI_EVENTS.SELECTION.CHANGED, selectedIds, { actorId: 'PDFHomeApp' });
              } catch (err) {
                this.#logger.warn('Error handling rowSelectionChanged', err);
                this.#eventBus.emit(SYSTEM_EVENTS.ERROR.OCCURRED, {
                  type: 'table_error',
                  message: err.message,
                  details: { context: 'rowSelectionChanged', error: err }
                });
              }
            });

            // 缁戝畾琛岀偣鍑讳簨浠讹紙鐢ㄤ簬鍒囨崲閫夋嫨鐘舵€侊級
            // 娉ㄦ剰锛氬綋鍓嶆湭鍚敤 Tabulator 鐨?SelectRow 妯″潡锛宺ow 瀵硅薄涓嶄竴瀹氬惈 isSelected/select/deselect
            // 涓洪伩鍏嶆姤閿欙紝鏆傛椂浠呮墦鍗拌鏁版嵁锛屼笉鍋氶€夋嫨鍒囨崲锛涘悗缁闇€閫夋嫨鍔熻兘锛屽彲寮曞叆 SelectRow 妯″潡鎴栦娇鐢ㄦ垜浠湪 table-wrapper 鐨勫洖閫€checkbox鏂规銆?
            this.tableWrapper.tabulator.on("rowClick", (e, row) => {
              try {
                const data = row && typeof row.getData === 'function' ? row.getData() : null;
                this.#logger.debug("琛岃鐐瑰嚮", data);
              } catch (err) {
                this.#logger.warn("rowClick handler error", err);
              }
            });

            // 缁戝畾鍗曞厓鏍肩偣鍑讳簨浠讹紙鐢ㄤ簬鎿嶄綔鎸夐挳锛?
            this.tableWrapper.tabulator.on("cellClick", (e, cell) => {
              const cellElement = cell.getElement();
              const button = e.target.closest('button[data-action]');

              if (button) {
                // 鍙樆姝㈡寜閽偣鍑荤殑浜嬩欢浼犳挱锛屼絾淇濈暀鍙屽嚮浜嬩欢澶勭悊
                e.stopPropagation();
                e.preventDefault();
                const action = button.getAttribute('data-action');
                const rowData = cell.getRow().getData();

                if (action === 'open') {
                  this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, rowData.id || rowData.filename, {
                    actorId: 'PDFHomeApp'
                  });
                } else if (action === 'delete') {
                  if (confirm('纭畾瑕佸垹闄よ繖涓狿DF鏂囦欢鍚楋紵')) {
                    this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, rowData.id || rowData.filename, {
                      actorId: 'PDFHomeApp'
                    });
                  }
                }
              }
            });

            // 鍙屽嚮浜嬩欢缁戝畾宸插湪Tabulator閰嶇疆涓畬鎴愶紝鏃犻渶閲嶅缁戝畾
            // (绉婚櫎閲嶅鐨剅owDblClick缁戝畾浠ラ伩鍏嶅弻閲嶈Е鍙?

            // 绉婚櫎DOM绾у埆鍙屽嚮浜嬩欢澶勭悊鍣紝閬垮厤閲嶅瑙﹀彂
            // 鍙娇鐢═abulator鍐呯疆鐨剅owDblClick閰嶇疆澶勭悊鍙屽嚮浜嬩欢

            this.#logger.info("Tabulator 浜嬩欢缁戝畾瀹屾垚锛堝寘鍚弻鍑讳慨澶嶏級");
          }
        }, 100); // 缁?Tabulator 涓€浜涙椂闂村畬鎴愬垵濮嬪寲

        // Subscribe to pdf list updates from event bus
        this.#eventBus.on(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, (pdfs) => {
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

      // 鍒濆鍖栧簲鐢ㄥ鍣紝寤虹珛渚濊禆鍏崇郴
      if (!this.#appContainer.isInitialized()) {
        await this.#appContainer.initialize();

        // 浠庡鍣ㄨ幏鍙栨洿鏂板悗鐨勪緷璧栵紙濡傛灉瀹瑰櫒鍐呴儴鍒涘缓浜嗘柊鐨刉ebSocket瀹㈡埛绔級
        const { logger, eventBus, wsClient } = this.#appContainer.getDependencies();
        this.#logger = logger;
        this.#eventBus = eventBus;
        this.#websocketManager = wsClient;
      }

      // 璁剧疆鍏ㄥ眬WebSocket瀹㈡埛绔緵Logger浣跨敤
      setGlobalWebSocketClient(this.#websocketManager);
      // 鍦ㄨ繛鎺ュ墠娉ㄥ唽"杩炴帴寤虹珛"鐩戝惉锛岄伩鍏嶇珵鎬佷涪澶变簨浠?
      this.#eventBus.on('websocket:connection:established', () => {
        this.#logger.info("WebSocket connected, enabling console bridge");
        try { window.__earlyConsoleBridge?.disable?.(); } catch(_) {}
        this.#consoleBridge.enable();
        this.#logger.info("Logger WebSocket transmission enabled for pdf-home module");
      }, { subscriberId: 'PDFHomeApp' });
      if (!this.#websocketManager.isConnected()) {
        await this.#websocketManager.connect();
      }
      // 澶栭儴娉ㄥ叆璺緞锛氱洿鎺ヤ娇鐢ㄥ凡娉ㄥ叆鐨?WS/Logger/EventBus
      await this.#pdfManager.initialize();
      await this.#uiManager.initialize();
      await this.#setupQWebChannelIntegration(); // UIManager now has its own initialization logic

      this.#initialized = true;
      this.#logger.info("PDF Home App initialized successfully.");
      this.#eventBus.emit(APP_EVENTS.INITIALIZATION.COMPLETED, undefined, { actorId: 'PDFHomeApp' });

      // ====== 鑷妯″紡鍏ュ彛锛堟柟妗圓锛?=====
      try {
        // 鏆撮湶鑷姩鍖栨祴璇曢挬瀛?
        const autoTest = {
          lastResult: null,
          // 瑙﹀彂涓€娆¤嚜鍔ㄥ寲鍙屽嚮娴嬭瘯
          run: async () => {
            const result = {
              startedAt: new Date().toISOString(),
              errors: [],
              openRequestedFired: false,
              usedMockData: false,
              notes: []
            };

            // 1) 鎹曡幏 window 閿欒涓?console.error
            const errorHandler = (e) => {
              try {
                const msg = e?.message || e?.toString?.() || String(e);
                result.errors.push({ source: 'window.onerror', message: msg });
              } catch (_) {}
            };
            const origConsoleError = console.error;
            console.error = function(...args) {
              try { result.errors.push({ source: 'console.error', message: args.map(a => (a && a.message) ? a.message : String(a)).join(' ') }); } catch(_) {}
              return origConsoleError.apply(console, args);
            };

            window.addEventListener('error', errorHandler);

            // 2) 鐩戝惉 OPEN.REQUESTED 浜嬩欢鏄惁瑙﹀彂
            const unsubscribeOpen = this.#eventBus.on(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, (payload) => {
              try {
                result.openRequestedFired = true;
                result.notes.push('OPEN.REQUESTED captured with payload: ' + JSON.stringify(payload));
              } catch (_) {}
            }, { subscriberId: 'AutoTest' });

            // 3) 绛夊緟 Tabulator DOM 娓叉煋
            const waitForTableDom = async (timeoutMs = 5000) => {
              const start = Date.now();
              while (Date.now() - start < timeoutMs) {
                try {
                  const wrapper = this.tableWrapper?.tableWrapper || document.querySelector('#pdf-table-container .pdf-table-wrapper');
                  if (wrapper) {
                    const isTab = wrapper.classList?.contains?.('tabulator') || wrapper.querySelector('.tabulator, .tabulator-table');
                    if (isTab) return wrapper;
                  }
                } catch (_) {}
                await new Promise(r => setTimeout(r, 50));
              }
              throw new Error('Tabulator DOM not ready within timeout');
            };

            // 4) 鑻ユ病鏈夋暟鎹垯娉ㄥ叆涓€鏉?mock 鏁版嵁
            const ensureData = async () => {
              try {
                const dataLen = (() => {
                  try {
                    const d = this.tableWrapper?.tabulator?.getData?.();
                    return Array.isArray(d) ? d.length : 0;
                  } catch (_) { return 0; }
                })();
                if (dataLen === 0) {
                  result.usedMockData = true;
                  const mock = [{ id: 'auto-test.pdf', filename: 'auto-test.pdf', title: 'Auto Test PDF', page_count: 1, cards_count: 0 }];
                  await this.tableWrapper.setData(mock);
                  result.notes.push('Injected mock data for auto test');
                }
              } catch (e) {
                result.errors.push({ source: 'ensureData', message: e?.message || String(e) });
              }
            };

            // 5) 瑙﹀彂绗竴琛岀殑鍙屽嚮浜嬩欢
            const dispatchDblClick = async () => {
              try {
                const wrapper = this.tableWrapper?.tableWrapper || document.querySelector('#pdf-table-container .pdf-table-wrapper');
                if (!wrapper) throw new Error('table wrapper not found');
                // 鍏煎 Tabulator 涓嶅悓缁撴瀯锛屽皾璇曞绉嶉€夋嫨鍣?
                const rowEl = wrapper.querySelector('.tabulator-row') || wrapper.querySelector('.tabulator-tableHolder .tabulator-table .tabulator-row');
                if (!rowEl) throw new Error('no tabulator row found to double click');
                const evt = new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window });
                rowEl.dispatchEvent(evt);
                result.notes.push('Dispatched dblclick on first row');
              } catch (e) {
                result.errors.push({ source: 'dispatchDblClick', message: e?.message || String(e) });
              }
            };

            // 鎵ц娴佺▼
            try {
              await waitForTableDom(6000);
              await ensureData();
              await new Promise(r => setTimeout(r, 100)); // 缁欐覆鏌撶暀涓€鐐规椂闂?
              await dispatchDblClick();
              await new Promise(r => setTimeout(r, 200)); // 绛夊緟浜嬩欢鎬荤嚎澶勭悊
            } catch (e) {
              result.errors.push({ source: 'autoTestFlow', message: e?.message || String(e) });
            }

            // 娓呯悊鐩戝惉
            try { window.removeEventListener('error', errorHandler); } catch(_) {}
            try { console.error = origConsoleError; } catch(_) {}
            try { if (typeof unsubscribeOpen === 'function') unsubscribeOpen(); } catch(_) {}

            // 6) 鍒ゅ畾鎴愬姛鏉′欢锛氭棤 isSelected 閿欒锛屼笖 OPEN.REQUESTED 瑙﹀彂
            const hasIsSelectedError = result.errors.some(er => /isSelected/.test(er.message || ''));
            result.success = !hasIsSelectedError && result.openRequestedFired;
            result.finishedAt = new Date().toISOString();

            // 瀵瑰鏆撮湶缁撴灉骞舵墦鍗?
            autoTest.lastResult = result;
            window.__lastAutoTestResult = result;
            if (result.success) {
              this.#logger.info('[AutoTest] Success', result);
            } else {
              this.#logger.warn('[AutoTest] Failed', result);
            }
            return result;
          }
        };

        // 鏆撮湶鍒?window
        window.__pdfHomeAutoTest = autoTest;

        // 鑻ユ娴嬪埌鐜鍙橀噺锛堥€氳繃 window 娉ㄥ叆鐨勫竷灏斿€硷級鍒欒嚜鍔ㄦ墽琛?
        if (window.PDF_HOME_AUTO_TEST === true || window.PDF_HOME_AUTO_TEST === '1') {
          setTimeout(() => {
            try { autoTest.run(); } catch (e) { this.#logger.warn('AutoTest run failed to start', e); }
          }, 300);
        }
      } catch (e) {
        this.#logger.warn('AutoTest hook init failed', e);
      }
      // ====== 鑷妯″紡鍏ュ彛缁撴潫 ======
    } catch (error) {
      this.#logger.error("Application initialization failed.", error);
      this.#errorHandler.handleError(error, "App.initialize");
    }
  }

  /**
   * 閿€姣佸簲鐢紝娓呯悊鎵€鏈夎祫婧愩€?
   */
  destroy() {
    this.#logger.info("Destroying PDF Home App...");
    this.#pdfManager.destroy();
    this.#uiManager.destroy();
    this.#websocketManager?.disconnect();
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
   * 鑾峰彇搴旂敤鐨勫叕寮€鐘舵€佸揩鐓с€?
   * @returns {object} 搴旂敤鐨勫綋鍓嶇姸鎬併€?
   */
  getState() {
    return {
      initialized: this.#initialized,
      websocketConnected: this.#websocketManager?.isConnected?.() ?? false,
      pdfCount: this.#pdfManager.getPDFs().length,
    };
  }

  // Expose EventBus for testing and external integrations
  getEventBus() {
    return this.#eventBus;
  }

  // Expose logger for external access
  get logger() {
    return this.#logger;
  }

  // 渚濊禆娉ㄥ叆锛氬湪瀹炰緥鍖栧悗娉ㄥ叆鏍稿績缁勪欢锛圵S 鈫?Logger 鈫?EventBus锛?
  injectCore(deps = {}) {
    const { wsClient, logger, eventBus, core } = deps;
    if (!wsClient || !logger || !eventBus) {
      throw new Error('injectCore: wsClient/logger/eventBus all required');
    }
    this.#websocketManager = wsClient;
    this.#logger = logger;
    // 鑻ュ凡瀛樺湪鏃у疄渚嬶紝鍏堟竻鐞嗕互閬垮厤閲嶅璁㈤槄/娉勯湶
    try { this.#uiManager?.destroy?.(); } catch(_) {}
    try { this.#pdfManager?.destroy?.(); } catch(_) {}
    try { this.#errorHandler = null; } catch(_) {}
    // 浣跨敤鏂颁簨浠舵€荤嚎閲嶅缓渚濊禆妯″潡
    this.#eventBus = eventBus;
    this.#errorHandler = new ErrorHandler(this.#eventBus);
    this.#pdfManager = new PDFManager(this.#eventBus);
    this.#uiManager = new UIManager(this.#eventBus);
    this.#coreGuard = core && typeof core.guard === 'function' ? core.guard : null;
    // 缁戝畾 console 妗ユ帴渚濊禆鐨?WS
    // 锛坆ridge 宸插湪鏋勯€犱腑鍒涘缓锛屾澶勬棤闇€閲嶅缓锛?
  }
  async #setupQWebChannelIntegration() { try { this.#logger.info('QWebChannel integration disabled for list; using WebSocket.'); } catch (_) {} }
}

// ===== 搴旂敤鍚姩 =====
console.log("[DEBUG] Script loaded, waiting for DOMContentLoaded...");

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[DEBUG] DOMContentLoaded: bootstrap PDF Home App...");

  try {
    // 1) 瑙ｆ瀽WebSocket绔彛
    const wsPort = resolveWebSocketPortSync({ fallbackPort: DEFAULT_WS_PORT });
    const wsUrl = `ws://localhost:${wsPort}`;

    // 2) 鎻愬墠鍚敤涓€涓?鏃╂湡"console妗ユ帴鍣?
    try {
      const earlyBridge = createConsoleWebSocketBridge('pdf-home', (message) => {
        // 鍦ㄥ簲鐢ㄥ垵濮嬪寲鍓嶏紝鏆備笉鍙戦€乧onsole log
      });
      earlyBridge.enable();
      try { window.__earlyConsoleBridge = earlyBridge; } catch(_) {}
    } catch (_) {}

    // 3) 鍒涘缓搴旂敤瀹炰緥锛堜細鑷姩鍒涘缓瀹瑰櫒锛?
    const app = new PDFHomeApp({ wsUrl });

    console.log("[DEBUG] Starting app initialization...");
    await app.initialize();

    console.log("[DEBUG] App initialization completed, setting up window.app...");
    window.app = {
      getState: () => app.getState(),
      destroy: () => app.destroy(),
      _internal: app
    };

    // 浣跨敤getLogger鍒涘缓涓存椂logger鏉ヨ褰曞惎鍔ㄦ垚鍔?
    const logger = getLogger('pdf-home/app');
    logger.info("PDF Home App started. Use window.app.getState() for status.");
    console.log("[DEBUG] PDF Home App fully started");
  } catch (error) {
    console.error("[DEBUG] App bootstrap/initialization failed:", error);
    try {
      // 灏濊瘯鍒涘缓涓€涓复鏃秎ogger鏉ヨ褰曢敊璇?
      const tempLogger = getLogger('pdf-home/bootstrap');
      tempLogger.error('Bootstrap failed', error);
    } catch (_) {}
  }
});

console.log("[DEBUG] Event listener registered for DOMContentLoaded");








