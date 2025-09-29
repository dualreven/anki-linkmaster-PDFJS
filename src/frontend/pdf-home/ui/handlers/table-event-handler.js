/**
 * @file 表格事件处理器
 * @module TableEventHandler
 * @description 专门处理表格相关的事件
 */

import { DOMUtils } from "../../../common/utils/dom-utils.js";
import { PDF_MANAGEMENT_EVENTS } from "../../../common/event/event-constants.js";
import { getLogger } from "../../../common/utils/logger.js";

/**
 * 表格事件处理器类
 * @class TableEventHandler
 */
export class TableEventHandler {
  #eventBus;
  #logger;
  #elements;
  #unsubscribeFunctions = [];

  /**
   * 构造函数
   * @param {Object} eventBus - 事件总线
   * @param {Object} elements - DOM元素引用
   */
  constructor(eventBus, elements) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("TableEventHandler");
    this.#elements = elements;
  }

  /**
   * 设置表格事件监听器
   */
  setupEventListeners() {
    this.#setupTableActionListeners();
  }

  /**
   * 清理所有事件监听器
   */
  destroy() {
    this.#logger.info("Destroying TableEventHandler and cleaning up listeners.");
    this.#unsubscribeFunctions.forEach((unsub) => unsub());
    this.#unsubscribeFunctions = [];
  }

  /**
   * 设置表格操作监听器
   * @private
   */
  #setupTableActionListeners() {
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
            this.#handleOpenAction(rowId, filename);
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
   * 处理打开操作
   * @param {string} rowId - 行ID
   * @param {string} filename - 文件名
   * @private
   */
  #handleOpenAction(rowId, filename) {
    this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, rowId || filename, {
      actorId: 'TableEventHandler'
    });
  }

  /**
   * 处理删除操作
   * @param {string} rowId - 行ID
   * @param {string} filename - 文件名
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
      actorId: 'TableEventHandler'
    });
  }
}