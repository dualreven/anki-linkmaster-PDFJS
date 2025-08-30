// table-wrapper.js
// Tabulator-based table wrapper for pdf-home (native JS integration)

import Tabulator from 'tabulator-tables';
import Logger from '../common/utils/logger.js';

const logger = new Logger('TableWrapper');

/**
 * TableWrapper - 基于 Tabulator 的表格封装
 *
 * 说明：
 * - 该类封装了 Tabulator 实例并提供一组被 pdf-home 使用的简洁 API。
 * - 遵循项目约定：不直接清空宿主 container，仅在内部的 tableWrapper 插槽中更新内容；事件与 DOM 操作应在初始化时注册一次。
 *
 * @example
 * const wrapper = new TableWrapper(document.querySelector('#pdf-table-container'), { columns: [...] });
 * wrapper.setData(pdfs);
 *
 */
export default class TableWrapper {
  /**
   * 创建 TableWrapper 实例并在 container 内准备 tableWrapper 插槽。
   * @param {HTMLElement|string} container - 容器元素或选择器字符串（外壳，不能被清空）
   * @param {Object} [options] - 传递给 Tabulator 的配置项（会与默认项合并）
   */
  constructor(container, options = {}) {
    if (typeof container === 'string') {
      this.container = document.querySelector(container);
    } else {
      this.container = container;
    }

    if (!this.container) throw new Error('Container not found');

    this.tableWrapper = this._getOrCreateWrapper();

    this.options = Object.assign({
      height: '100%',
      layout: 'fitColumns',
      selectable: true,
      layoutColumnsOnNewData: false,
    }, options);

    this.tabulator = null;
    this._init();
  }

  /**
   * 查找或创建内部 tableWrapper 插槽。
   * 如果容器中已有 .pdf-table-wrapper，则复用；否则创建一个新的并附加到 container 中。
   * @returns {HTMLElement} tableWrapper 元素
   */
  _getOrCreateWrapper() {
    const existing = this.container.querySelector('.pdf-table-wrapper');
    if (existing) return existing;
    const wrapper = document.createElement('div');
    wrapper.className = 'pdf-table-wrapper';
    this.container.appendChild(wrapper);
    return wrapper;
  }

  /**
   * 初始化 Tabulator 实例并挂载到 tableWrapper 上。
   * 仅在构造时调用一次，且不得在每次渲染时重复创建实例。
   * @private
   */
  _init() {
    // Initialize Tabulator instance inside tableWrapper
    this.tabulator = new Tabulator(this.tableWrapper, Object.assign({}, this.options));
    logger.info('Tabulator initialized');
  }

  /**
   * 设置表格数据（防御性拷贝）。
   * @param {Array<Object>} data - 要渲染的行对象数组，方法内部会拷贝每个对象以防外部修改影响内部状态。
   * @returns {void}
   */
  setData(data) {
    // Defensive copy
    const rows = Array.isArray(data) ? data.map(r => Object.assign({}, r)) : [];
    this.tabulator.setData(rows);
    logger.debug('setData count=', rows.length);
  }

  /**
   * 获取当前被选中的行数据（由 Tabulator 管理）。
   * @returns {Array<Object>} 被选中的行对象数组
   */
  getSelectedRows() {
    return this.tabulator.getSelectedData() || [];
  }

  /**
   * 清空表格数据（保留 tableWrapper DOM 结构以避免破坏宿主容器）。
   * @returns {void}
   */
  clear() {
    this.tabulator.clearData();
  }

  /**
   * 销毁 Tabulator 实例并清空内部内容，但不移除 tableWrapper 元素本身（避免破坏宿主容器结构）。
   * @returns {void}
   */
  destroy() {
    if (this.tabulator) {
      this.tabulator.destroy();
      this.tabulator = null;
    }
    // keep wrapper element to avoid detaching container
    while (this.tableWrapper.firstChild) this.tableWrapper.removeChild(this.tableWrapper.firstChild);
  }

  // Additional helpers
  /**
   * 绑定 Tabulator 事件代理，封装对外订阅接口。
   * @param {string} event - Tabulator 事件名
   * @param {Function} handler - 事件处理函数
   */
  on(event, handler) {
    if (!this.tabulator) return;
    this.tabulator.on(event, handler);
  }

  /**
   * 解除绑定 Tabulator 事件代理。
   * @param {string} event - Tabulator 事件名
   * @param {Function} handler - 事件处理函数
   */
  off(event, handler) {
    if (!this.tabulator) return;
    this.tabulator.off(event, handler);
  }

}
