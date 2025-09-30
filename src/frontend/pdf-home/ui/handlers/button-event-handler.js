/**
 * @file 按钮事件处理器
 * @module ButtonEventHandler
 * @description 专门处理各种按钮点击事件
 */

import { DOMUtils } from "../../../common/utils/dom-utils.js";
import { PDF_MANAGEMENT_EVENTS } from "../../../common/event/event-constants.js";
import { getLogger } from "../../../common/utils/logger.js";

/**
 * 按钮事件处理器类
 * @class ButtonEventHandler
 */
export class ButtonEventHandler {
  #eventBus;
  #logger;
  #elements;
  #stateManager;
  #unsubscribeFunctions = [];

  /**
   * 构造函数
   * @param {Object} eventBus - 事件总线
   * @param {Object} elements - DOM元素引用
   * @param {Object} stateManager - 状态管理器
   */
  constructor(eventBus, elements, stateManager) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("ButtonEventHandler");
    this.#elements = elements;
    this.#stateManager = stateManager;
  }

  /**
   * 设置按钮事件监听器
   */
  setupEventListeners() {
    this.#setupAddPdfButton();
    this.#setupBatchAddButton();
    this.#setupBatchDeleteButton();
    this.#setupTestPdfViewerButton();
    this.#setupTestQWebChannelButton();
    this.#setupDebugButton();
  }

  /**
   * 清理所有事件监听器
   */
  destroy() {
    this.#logger.info("Destroying ButtonEventHandler and cleaning up listeners.");
    this.#unsubscribeFunctions.forEach((unsub) => unsub());
    this.#unsubscribeFunctions = [];
  }

  /**
   * 设置添加PDF按钮
   * @private
   */
  #setupAddPdfButton() {
    if (this.#elements.addPdfBtn) {
      const listener = () => {
        this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD_FILES.REQUEST, {
          isBatch: false
        }, {
          actorId: 'ButtonEventHandler'
        });
      };
      DOMUtils.addEventListener(this.#elements.addPdfBtn, "click", listener);
      this.#unsubscribeFunctions.push(() =>
        DOMUtils.removeEventListener(this.#elements.addPdfBtn, "click", listener)
      );
    }
  }

  /**
   * 设置批量添加按钮
   * @private
   */
  #setupBatchAddButton() {
    if (this.#elements.batchAddBtn) {
      const listener = () => {
        this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD_FILES.REQUEST, {
          isBatch: true
        }, {
          actorId: 'ButtonEventHandler'
        });
      };
      DOMUtils.addEventListener(this.#elements.batchAddBtn, "click", listener);
      this.#unsubscribeFunctions.push(() =>
        DOMUtils.removeEventListener(this.#elements.batchAddBtn, "click", listener)
      );
    }
  }

  /**
   * 设置批量删除按钮
   * @private
   */
  #setupBatchDeleteButton() {
    if (this.#elements.batchDeleteBtn) {
      const listener = () => this.#handleBatchDelete();
      DOMUtils.addEventListener(this.#elements.batchDeleteBtn, "click", listener);
      this.#unsubscribeFunctions.push(() =>
        DOMUtils.removeEventListener(this.#elements.batchDeleteBtn, "click", listener)
      );
    }
  }

  /**
   * 设置测试PDF查看器按钮
   * @private
   */
  #setupTestPdfViewerButton() {
    if (this.#elements.testPdfViewerBtn) {
      const listener = () => this.#handleTestPdfViewer();
      DOMUtils.addEventListener(this.#elements.testPdfViewerBtn, "click", listener);
      this.#unsubscribeFunctions.push(() =>
        DOMUtils.removeEventListener(this.#elements.testPdfViewerBtn, "click", listener)
      );
    }
  }


  /**
   * 设置测试QWebChannel按钮
   * @private
   */
  #setupTestQWebChannelButton() {
    if (this.#elements.testQWebChannelBtn) {
      const listener = () => this.#handleTestQWebChannel();
      DOMUtils.addEventListener(this.#elements.testQWebChannelBtn, "click", listener);
      this.#unsubscribeFunctions.push(() =>
        DOMUtils.removeEventListener(this.#elements.testQWebChannelBtn, "click", listener)
      );
    }
  }

  /**
   * 设置调试按钮
   * @private
   */
  #setupDebugButton() {
    if (this.#elements.debugBtn) {
      const listener = () => this.#toggleDebugStatus();
      DOMUtils.addEventListener(this.#elements.debugBtn, "click", listener);
      this.#unsubscribeFunctions.push(() =>
        DOMUtils.removeEventListener(this.#elements.debugBtn, "click", listener)
      );
    }
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
      actorId: 'ButtonEventHandler',
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
   * 处理测试QWebChannel连接
   * @private
   */
  async #handleTestQWebChannel() {
    this.#logger.info("[阶段1测试] 测试QWebChannel连接按钮被点击");

    try {
      // 动态导入 QWebChannelBridge
      const { QWebChannelBridge } = await import('../../qwebchannel/qwebchannel-bridge.js');

      // 创建桥接实例
      const bridge = new QWebChannelBridge();

      // 初始化连接
      this.#logger.info("[阶段1测试] 正在初始化 QWebChannel...");
      console.log("[阶段1测试] 正在连接 QWebChannel...");

      await bridge.initialize();
      this.#logger.info("[阶段1测试] QWebChannel 初始化成功");

      // 测试连接
      this.#logger.info("[阶段1测试] 调用 testConnection()...");
      const message = await bridge.testConnection();

      this.#logger.info(`[阶段1测试] testConnection() 返回: ${message}`);
      console.log(`%c[阶段1测试] 🎉 QWebChannel 连接成功！`, 'color: green; font-weight: bold; font-size: 14px');
      console.log(`%c[阶段1测试] 返回消息: ${message}`, 'color: blue; font-size: 12px');

      DOMUtils.showSuccess(`QWebChannel 连接成功！返回消息: ${message}`);

    } catch (error) {
      this.#logger.error("[阶段1测试] QWebChannel 连接失败:", error);
      console.error('%c[阶段1测试] ❌ QWebChannel 连接失败', 'color: red; font-weight: bold; font-size: 14px', error);
      DOMUtils.showError(`QWebChannel 连接失败: ${error.message}`);
    }
  }

  /**
   * 处理批量删除
   * @private
   */
  #handleBatchDelete() {
    this.#logger.info("Batch delete requested - delegating to main UIManager");
    // 发出批量删除事件，由主UIManager处理
    this.#eventBus.emit('ui:batch-delete:requested', {}, {
      actorId: 'ButtonEventHandler'
    });
  }
}