
/**
 * UI管理器模块
 * 负责UI渲染和交互处理
 */

// 导入DOM工具模块
import { DOMUtils } from '../utils/dom-utils.js';

// 导入事件常量
import {
  PDF_MANAGEMENT_EVENTS,
  WEBSOCKET_EVENTS,
  UI_EVENTS,
  WEBSOCKET_MESSAGE_EVENTS
} from './event-constants.js';

// 导入日志模块
import Logger from '../utils/logger.js';

/**
 * UI管理器类
 */
export class UIManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.logger = new Logger('UIManager');
    this.state = {
      pdfs: [],
      loading: false,
      websocketConnected: false,
      error: null
    };
    
    this.initializeElements();
    this.setupEventListeners();
  }

  /**
   * 初始化DOM元素
   */
  initializeElements() {
    this.elements = {
      container: DOMUtils.findElement('.container'),
      addPdfBtn: DOMUtils.getElementById('add-pdf-btn'),
      batchAddBtn: DOMUtils.getElementById('batch-add-btn'),
      batchDeleteBtn: DOMUtils.getElementById('batch-delete-btn'),
      debugBtn: DOMUtils.getElementById('debug-btn'),
      debugStatus: DOMUtils.getElementById('debug-status'),
      debugContent: DOMUtils.getElementById('debug-content'),
      pdfTableContainer: DOMUtils.getElementById('pdf-table-container'),
      emptyState: DOMUtils.getElementById('empty-state')
    };
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    // 添加PDF按钮
    if (this.elements.addPdfBtn) {
      DOMUtils.addEventListener(this.elements.addPdfBtn, 'click', () => {
        // 通过WebSocket请求文件选择对话框
        this.eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, {
          type: 'request_file_selection'
        });
      });
    }
    
    // 批量添加PDF按钮
    if (this.elements.batchAddBtn) {
      DOMUtils.addEventListener(this.elements.batchAddBtn, 'click', () => {
        // 通过WebSocket请求文件选择对话框
        this.eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, {
          type: 'request_file_selection'
        });
      });
    }
    
    // 批量删除PDF按钮
    if (this.elements.batchDeleteBtn) {
      DOMUtils.addEventListener(this.elements.batchDeleteBtn, 'click', () => {
        this.handleBatchDelete();
      });
    }
    
    // 调试按钮
    if (this.elements.debugBtn) {
      DOMUtils.addEventListener(this.elements.debugBtn, 'click', () => {
        this.toggleDebugStatus();
      });
    }
    
    // 设置全局事件监听
    this.setupGlobalEventListeners();
  }

  /**
   * 设置全局事件监听
   */
  setupGlobalEventListeners() {
    // 监听PDF列表更新
    this.eventBus.on(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, (pdfs) => {
      this.updatePDFList(pdfs);
    });
    
    // 监听WebSocket连接状态
    this.eventBus.on(WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED, () => {
      this.setWebSocketConnected(true);
    });
    
    this.eventBus.on(WEBSOCKET_EVENTS.CONNECTION.CLOSED, () => {
      this.setWebSocketConnected(false);
    });
    
    // 监听错误事件
    this.eventBus.on(UI_EVENTS.ERROR.SHOW, (errorInfo) => {
      this.showError(errorInfo.message);
    });
    
    // 监听成功事件
    this.eventBus.on(UI_EVENTS.SUCCESS.SHOW, (message) => {
      this.showSuccess(message);
    });
    
    // 监听WebSocket发送请求
    this.eventBus.on(WEBSOCKET_EVENTS.MESSAGE.SEND, (message) => {
      if (window.app && window.app.websocketManager) {
        window.app.websocketManager.send(message.type, message.data || {});
      }
    });
    
    // 键盘快捷键
    DOMUtils.addEventListener(document, 'keydown', (event) => {
      // Ctrl+D: 切换调试面板
      if (event.ctrlKey && event.key === 'd') {
        event.preventDefault();
        this.toggleDebugStatus();
      }
      
      // Ctrl+N: 添加PDF
      if (event.ctrlKey && event.key === 'n') {
        event.preventDefault();
        this.eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, {
          type: 'request_file_selection'
        });
      }
    });
  }

  /**
   * 更新PDF列表
   * @param {Array} pdfs - PDF列表
   */
  updatePDFList(pdfs) {
    this.logger.info('更新PDF列表UI');
    this.state.pdfs = pdfs;
    this.render();
  }

  /**
   * 设置加载状态
   * @param {boolean} loading - 是否加载中
   */
  setLoading(loading) {
    this.state.loading = loading;
    this.render();
  }

  /**
   * 设置WebSocket连接状态
   * @param {boolean} connected - 是否已连接
   */
  setWebSocketConnected(connected) {
    this.state.websocketConnected = connected;
    this.render();
  }

  /**
   * 渲染UI
   */
  render() {
    this.renderPDFList();
    this.updateDebugStatus();
  }

  /**
   * 渲染PDF列表
   */
  renderPDFList() {
    const { pdfs, loading } = this.state;
    
    if (!this.elements.pdfTableContainer) return;
    
    // 清空容器
    DOMUtils.empty(this.elements.pdfTableContainer);
    
    if (loading) {
      // 显示加载状态
      const loadingDiv = DOMUtils.createElement('div', { className: 'loading' }, '正在加载...');
      this.elements.pdfTableContainer.appendChild(loadingDiv);
    } else if (pdfs.length === 0) {
      // 显示空状态
      if (this.elements.emptyState) {
        DOMUtils.show(this.elements.emptyState);
      }
      DOMUtils.hide(this.elements.pdfTableContainer);
    } else {
      // 显示PDF列表
      if (this.elements.emptyState) {
        DOMUtils.hide(this.elements.emptyState);
      }
      DOMUtils.show(this.elements.pdfTableContainer);
      
      const pdfList = DOMUtils.createElement('div', { className: 'pdf-list' });
      
      // 创建表头
      const header = this.createPDFListHeader();
      pdfList.appendChild(header);
      
      // 创建PDF项
      pdfs.forEach(pdf => {
        const pdfItem = this.createPDFItem(pdf);
        pdfList.appendChild(pdfItem);
      });
      
      this.elements.pdfTableContainer.appendChild(pdfList);
    }
  }

  /**
   * 创建PDF列表表头
   * @returns {HTMLElement} 表头元素
   */
  createPDFListHeader() {
    const header = DOMUtils.createElement('div', { className: 'pdf-list-header' });
    
    DOMUtils.setHTML(header, `
      <input type="checkbox" class="list-header-select" id="select-all">
      <div class="list-header-title">文件名</div>
      <div class="list-header-size">大小</div>
      <div class="list-header-date">修改日期</div>
      <div class="list-header-importance">重要性</div>
      <div class="list-header-pages">页数</div>
      <div class="list-header-annotations">注释</div>
      <div class="list-header-cards">卡片</div>
      <div class="list-header-actions">操作</div>
    `);
    
    // 全选功能
    const selectAllCheckbox = DOMUtils.findElement('#select-all', header);
    if (selectAllCheckbox) {
      DOMUtils.addEventListener(selectAllCheckbox, 'change', (event) => {
        const checkboxes = DOMUtils.findAllElements('.pdf-item-checkbox');
        checkboxes.forEach(checkbox => {
          checkbox.checked = event.target.checked;
        });
      });
    }
    
    return header;
  }

  /**
   * 创建PDF项
   * @param {Object} pdf - PDF数据
   * @returns {HTMLElement} PDF项元素
   */
  createPDFItem(pdf) {
    const item = DOMUtils.createElement('div', { className: 'pdf-item' });
    DOMUtils.setData(item, 'filename', pdf.filename);
    
    const formatDate = (timestamp) => {
      if (!timestamp) return '-';
      return new Date(timestamp).toLocaleDateString();
    };
    
    const formatSize = (bytes) => {
      if (!bytes) return '-';
      const sizes = ['B', 'KB', 'MB', 'GB'];
      if (bytes === 0) return '0 B';
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };
    
    const importanceClass = `importance-${pdf.importance || 'medium'}`;
    
    DOMUtils.setHTML(item, `
      <input type="checkbox" class="pdf-item-checkbox" data-filename="${pdf.filename}">
      <div class="pdf-item-icon">📄</div>
      <div class="pdf-item-title" title="${pdf.title}">${pdf.title}</div>
      <div class="pdf-item-size">${formatSize(pdf.size)}</div>
      <div class="pdf-item-date">${formatDate(pdf.modified_time)}</div>
      <div class="pdf-item-importance ${importanceClass}">${pdf.importance || 'medium'}</div>
      <div class="pdf-item-pages">${pdf.page_count || 0}</div>
      <div class="pdf-item-annotations">${pdf.annotations_count || 0}</div>
      <div class="pdf-item-cards">${pdf.cards_count || 0}</div>
      <div class="pdf-item-actions">
        <button class="btn btn-small" data-action="open" data-filename="${pdf.filename}">打开</button>
        <button class="btn btn-small danger" data-action="remove" data-filename="${pdf.filename}">删除</button>
      </div>
    `);
    
    // 添加事件委托
    DOMUtils.addEventListener(item, 'click', (event) => {
      this.handlePDFItemAction(event);
    });
    
    return item;
  }

  /**
   * 处理PDF项操作
   * @param {Event} event - 事件对象
   */
  handlePDFItemAction(event) {
    const button = DOMUtils.closest(event.target, 'button');
    if (!button) return;
    
    const action = DOMUtils.getAttribute(button, 'data-action');
    const filename = DOMUtils.getAttribute(button, 'data-filename');
    
    if (!action || !filename) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    switch (action) {
      case 'open':
        this.eventBus.emit(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, filename);
        break;
      case 'remove':
        if (confirm('确定要删除这个PDF文件吗？')) {
          this.eventBus.emit(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, filename);
        }
        break;
    }
  }

  /**
   * 处理批量删除
   */
  handleBatchDelete() {
    const checkboxes = DOMUtils.findAllElements('.pdf-item-checkbox:checked');
    if (checkboxes.length === 0) {
      this.showError('请先选择要删除的PDF文件');
      return;
    }
    
    if (confirm(`确定要删除选中的 ${checkboxes.length} 个PDF文件吗？`)) {
      checkboxes.forEach(checkbox => {
        const filename = DOMUtils.getAttribute(checkbox, 'data-filename');
        this.eventBus.emit(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, filename);
      });
    }
  }

  /**
   * 切换调试状态
   */
  toggleDebugStatus() {
    if (this.elements.debugStatus) {
      const isVisible = DOMUtils.isVisible(this.elements.debugStatus);
      if (isVisible) {
        DOMUtils.hide(this.elements.debugStatus);
      } else {
        DOMUtils.show(this.elements.debugStatus);
        this.updateDebugStatus();
      }
    }
  }

  /**
   * 更新调试状态
   */
  updateDebugStatus() {
    if (!this.elements.debugContent || !DOMUtils.isVisible(this.elements.debugStatus)) return;
    
    const { pdfs, loading, websocketConnected } = this.state;
    
    DOMUtils.setHTML(this.elements.debugContent, `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
        <div><strong>WebSocket:</strong> ${websocketConnected ? '🟢 已连接' : '🔴 未连接'}</div>
        <div><strong>PDF数量:</strong> ${pdfs.length}</div>
        <div><strong>加载状态:</strong> ${loading ? '⏳ 加载中' : '✅ 就绪'}</div>
        <div><strong>环境:</strong> ${'标准浏览器'}</div>
      </div>
      <div style="margin-top: 8px; font-size: 10px; color: #666;">
        <strong>提示:</strong> 按 Ctrl+D 打开/关闭调试面板
      </div>
    `);
  }

  /**
   * 显示错误消息
   * @param {string} message - 错误消息
   */
  showError(message) {
    // 使用DOMUtils显示错误消息
    DOMUtils.showError(message);
  }

  /**
   * 显示成功消息
   * @param {string} message - 成功消息
   */
  showSuccess(message) {
    // 使用DOMUtils显示成功消息
    DOMUtils.showSuccess(message);
  }
}