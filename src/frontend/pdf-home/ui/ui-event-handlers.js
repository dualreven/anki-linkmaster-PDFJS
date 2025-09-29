/**
 * @file UI事件处理器集合，负责处理各种UI交互事件
 * @module UIEventHandlers
 */

import { DOMUtils } from "../../common/utils/dom-utils.js";
import {
  PDF_MANAGEMENT_EVENTS,
  WEBSOCKET_EVENTS,
  UI_EVENTS,
} from "../../common/event/event-constants.js";
import { getLogger } from "../../common/utils/logger.js";

/**
 * UI事件处理器类
 */
export class UIEventHandlers {
  #eventBus;
  #logger;
  #elements;
  #stateManager;
  #unsubscribeFunctions = [];

  constructor(eventBus, elements, stateManager) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("UIEventHandlers");
    this.#elements = elements;
    this.#stateManager = stateManager;
  }

  /**
   * 设置所有事件监听器
   */
  setupEventListeners() {
    this.#setupButtonEventListeners();
    this.#setupGlobalEventListeners();
    this.#setupKeyboardEventListeners();
    this.#setupTableEventListeners();
  }

  /**
   * 清理所有事件监听器
   */
  destroy() {
    this.#logger.info("Destroying UIEventHandlers and unsubscribing from events.");
    this.#unsubscribeFunctions.forEach((unsub) => unsub());
    this.#unsubscribeFunctions = [];
  }

  /**
   * 设置按钮事件监听器
   * @private
   */
  #setupButtonEventListeners() {
    // 添加PDF按钮
    if (this.#elements.addPdfBtn) {
      const listener = () => {
        this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, {}, {
          actorId: 'UIManager'
        });
      };
      DOMUtils.addEventListener(this.#elements.addPdfBtn, "click", listener);
      this.#unsubscribeFunctions.push(() =>
        DOMUtils.removeEventListener(this.#elements.addPdfBtn, "click", listener)
      );
    }

    // 批量添加按钮
    if (this.#elements.batchAddBtn) {
      const listener = () => this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, { isBatch: true }, {
        actorId: 'UIManager'
      });
      DOMUtils.addEventListener(this.#elements.batchAddBtn, "click", listener);
      this.#unsubscribeFunctions.push(() =>
        DOMUtils.removeEventListener(this.#elements.batchAddBtn, "click", listener)
      );
    }

    // 批量删除按钮
    if (this.#elements.batchDeleteBtn) {
      const listener = () => this.#handleBatchDelete();
      DOMUtils.addEventListener(this.#elements.batchDeleteBtn, "click", listener);
      this.#unsubscribeFunctions.push(() =>
        DOMUtils.removeEventListener(this.#elements.batchDeleteBtn, "click", listener)
      );
    }

    // 测试PDF查看器按钮
    if (this.#elements.testPdfViewerBtn) {
      const listener = () => this.#handleTestPdfViewer();
      DOMUtils.addEventListener(this.#elements.testPdfViewerBtn, "click", listener);
      this.#unsubscribeFunctions.push(() =>
        DOMUtils.removeEventListener(this.#elements.testPdfViewerBtn, "click", listener)
      );
    }

    // 测试QWebChannel连通性按钮
    if (this.#elements.testQWebChannelBtn) {
      const listener = () => this.#handleTestQWebChannel();
      DOMUtils.addEventListener(this.#elements.testQWebChannelBtn, "click", listener);
      this.#unsubscribeFunctions.push(() =>
        DOMUtils.removeEventListener(this.#elements.testQWebChannelBtn, "click", listener)
      );
    }

    // 调试按钮
    if (this.#elements.debugBtn) {
      const listener = () => this.#toggleDebugStatus();
      DOMUtils.addEventListener(this.#elements.debugBtn, "click", listener);
      this.#unsubscribeFunctions.push(() =>
        DOMUtils.removeEventListener(this.#elements.debugBtn, "click", listener)
      );
    }
  }

  /**
   * 设置全局事件监听器
   * @private
   */
  #setupGlobalEventListeners() {
    const listeners = [
      this.#eventBus.on(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, (pdfs) => this.#handlePDFListUpdated(pdfs)),
      this.#eventBus.on(WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED, () => this.#handleWebSocketConnected(true)),
      this.#eventBus.on(WEBSOCKET_EVENTS.CONNECTION.CLOSED, () => this.#handleWebSocketConnected(false)),
      this.#eventBus.on(UI_EVENTS.ERROR.SHOW, (errorInfo) => this.#handleShowError(errorInfo.message)),
      this.#eventBus.on(UI_EVENTS.SUCCESS.SHOW, (message) => this.#handleShowSuccess(message)),
      this.#eventBus.on('qwebchannel:status:ready', (bridge) => this.#handleQWebChannelReady(bridge)),
      this.#eventBus.on('qwebchannel:status:unavailable', (info) => this.#handleQWebChannelUnavailable(info)),
      this.#eventBus.on('qwebchannel:test:success', (result) => this.#handleQWebChannelTestSuccess(result)),
      this.#eventBus.on('qwebchannel:test:failed', (error) => this.#handleQWebChannelTestFailed(error)),
    ];
    this.#unsubscribeFunctions.push(...listeners);
  }

  /**
   * 设置键盘事件监听器
   * @private
   */
  #setupKeyboardEventListeners() {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === "d") {
        event.preventDefault();
        this.#toggleDebugStatus();
      }
      if (event.ctrlKey && event.key === "n") {
        event.preventDefault();
        this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, undefined, {
          actorId: 'UIManager'
        });
      }
    };
    DOMUtils.addEventListener(document, "keydown", handleKeyDown);
    this.#unsubscribeFunctions.push(() =>
      DOMUtils.removeEventListener(document, "keydown", handleKeyDown)
    );
  }

  /**
   * 设置表格事件监听器
   * @private
   */
  #setupTableEventListeners() {
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
            this.#handleDeleteAction(rowId, filename);
            break;
        }
      }
    };

    if (this.#elements.pdfTableContainer) {
      DOMUtils.addEventListener(this.#elements.pdfTableContainer, 'click', handleTableAction);
      this.#unsubscribeFunctions.push(() =>
        DOMUtils.removeEventListener(this.#elements.pdfTableContainer, 'click', handleTableAction)
      );
    }
  }

  /**
   * 处理删除操作
   * @private
   */
  async #handleDeleteAction(rowId, filename) {
    // 使用新的对话框管理器
    if (window.dialogManager) {
      const confirmed = await window.dialogManager.confirm("确定要删除这个PDF文件吗？");
      if (!confirmed) return;
    } else {
      // 降级到原生confirm
      if (!confirm("确定要删除这个PDF文件吗？")) return;
    }

    const payload = rowId || filename;
    this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, payload, {
      actorId: 'UIManager'
    });
  }

  /**
   * 处理PDF列表更新事件
   * @private
   */
  #handlePDFListUpdated(pdfs) {
    this.#stateManager.updatePDFList(pdfs);
  }

  /**
   * 处理WebSocket连接状态变化
   * @private
   */
  #handleWebSocketConnected(connected) {
    this.#stateManager.setWebSocketConnected(connected);
  }

  /**
   * 处理显示错误事件
   * @private
   */
  #handleShowError(message) {
    DOMUtils.showError(message);
    this.#stateManager.setError(message);
  }

  /**
   * 处理显示成功事件
   * @private
   */
  #handleShowSuccess(message) {
    DOMUtils.showSuccess(message);
    this.#stateManager.clearError();
  }

  /**
   * 处理测试PDF查看器
   * @private
   */
  #handleTestPdfViewer() {
    this.#logger.info("测试PDF查看器按钮被点击");

    // 使用 data/pdfs 目录下的测试PDF文件
    const testPdfPath = "test.pdf";

    this.#logger.info(`请求打开测试PDF: ${testPdfPath} (从 data/pdfs 目录)`);

    // 触发PDF查看器启动事件
    this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, testPdfPath, {
      actorId: 'UIManager',
      source: 'test-button',
      expectedLocation: 'data/pdfs/'
    });

    DOMUtils.showSuccess("正在启动PDF查看器...");
  }

  /**
   * 切换调试状态显示
   * @private
   */
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

  /**
   * 更新调试状态显示
   * @private
   */
  #updateDebugStatus() {
    if (!this.#elements.debugContent || !DOMUtils.isVisible(this.#elements.debugStatus)) return;

    const debugInfo = this.#stateManager.getDebugInfo();
    const debugText = `PDF数量: ${debugInfo.pdfCount}, 加载中: ${debugInfo.loading}, WebSocket: ${debugInfo.websocketConnected}`;
    DOMUtils.setHTML(this.#elements.debugContent, debugText);
  }

  /**
   * 处理测试QWebChannel连通性
   * @private
   */
  #handleTestQWebChannel() {
    this.#logger.info("测试QWebChannel连通性按钮被点击");

    // 发送QWebChannel状态检查请求
    this.#eventBus.emit('qwebchannel:check:request', {}, {
      actorId: 'UIEventHandlers'
    });

    DOMUtils.showSuccess("正在检查QWebChannel连通性...");
  }

  /**
   * 处理QWebChannel就绪状态
   * @private
   */
  async #handleQWebChannelReady(bridge) {
    this.#logger.info("QWebChannel连通性测试 - 已连接:", bridge);

    try {
      // 尝试调用实际的连通测试
      this.#eventBus.emit('qwebchannel:test:request', {}, {
        actorId: 'UIEventHandlers'
      });

      const timestamp = new Date().toLocaleTimeString();
      const message = `✅ QWebChannel连通测试成功! (${timestamp})`;

      DOMUtils.showSuccess(message);
      console.log("🔗 [QWebChannel测试] 连接正常，bridge对象:", bridge);
      console.log("🔗 [QWebChannel测试] 已请求进一步测试PyQt功能...");
    } catch (error) {
      this.#logger.error("QWebChannel连通性测试过程中发生错误:", error);
      DOMUtils.showError(`QWebChannel测试过程出错: ${error.message}`);
    }
  }

  /**
   * 处理QWebChannel不可用状态
   * @private
   */
  #handleQWebChannelUnavailable(info) {
    this.#logger.info("QWebChannel连通性测试 - 不可用:", info);

    const timestamp = new Date().toLocaleTimeString();
    const message = `❌ QWebChannel连通测试失败 (${timestamp}): ${info.reason || '未知原因'}`;

    DOMUtils.showError(message);
    console.log("🔗 [QWebChannel测试] 连接失败，详细信息:", info);
  }

  /**
   * 处理QWebChannel测试成功
   * @private
   */
  #handleQWebChannelTestSuccess(result) {
    this.#logger.info("PyQt连通性测试成功:", result);

    const message = `🎉 PyQt连通性测试成功! (${result.timestamp})`;
    DOMUtils.showSuccess(message);

    console.log("🔗 [PyQt测试] 详细结果:", result);
    if (result.message) {
      console.log("🔗 [PyQt测试] 消息:", result.message);
    }
  }

  /**
   * 处理QWebChannel测试失败
   * @private
   */
  #handleQWebChannelTestFailed(error) {
    this.#logger.error("PyQt连通性测试失败:", error);

    const message = `❌ PyQt连通性测试失败 (${error.timestamp}): ${error.error}`;
    DOMUtils.showError(message);

    console.log("🔗 [PyQt测试] 错误详情:", error);
  }

  /**
   * 处理批量删除（复杂逻辑保持不变）
   * @private
   */
  async #handleBatchDelete() {
    // 这里保持原有的复杂批量删除逻辑
    // 由于逻辑复杂且与表格实例紧密耦合，暂时保持在这里
    // 未来可以进一步优化到独立的批量操作处理器

    this.#logger.info("Batch delete requested - delegating to main UIManager");
    // 发出批量删除事件，由主UIManager处理
    this.#eventBus.emit('ui:batch-delete:requested', {}, {
      actorId: 'UIEventHandlers'
    });
  }
}