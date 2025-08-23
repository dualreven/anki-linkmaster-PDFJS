/**
 * PDF Manager Module
 * 负责PDF文件的管理和操作
 */

// 导入事件常量
import {
  PDF_MANAGEMENT_EVENTS,
  WEBSOCKET_MESSAGE_EVENTS,
  WEBSOCKET_EVENTS
} from './event-constants.js';

// 导入日志模块
import Logger from '../utils/logger.js';

/**
 * PDF文件管理器类
 */
class PDFManager {
  constructor(eventBus, websocketManager) {
    this.eventBus = eventBus;
    this.websocketManager = websocketManager;
    this.logger = new Logger('PDFManager');
    this.pdfs = [];
    this.mapping = {};
  }

  /**
   * 初始化PDF管理器
   */
  initialize() {
    // 设置WebSocket消息监听
    this.setupWebSocketListeners();
    
    // 加载PDF列表
    this.loadPDFList();
    
    // 设置事件监听
    this.setupEventListeners();
  }

  /**
   * 设置WebSocket消息监听
   */
  setupWebSocketListeners() {
    // 监听PDF列表更新
    this.eventBus.on(WEBSOCKET_MESSAGE_EVENTS.PDF_LIST_UPDATED, (data) => {
      this.logger.debug('收到 pdf_list_updated 消息:', data);
      this.handlePDFListUpdated(data);
    });
    
    // 监听PDF列表消息（添加缺失的监听器）
    this.eventBus.on(WEBSOCKET_MESSAGE_EVENTS.PDF_LIST, (data) => {
      this.logger.debug('收到 pdf_list 消息:', data);
      this.handlePDFListUpdated(data);
    });
    
    // 监听成功响应
    this.eventBus.on(WEBSOCKET_MESSAGE_EVENTS.SUCCESS, (data) => {
      this.logger.debug('收到 success 消息:', data);
      this.handleSuccessResponse(data);
    });
    
    // 监听错误响应
    this.eventBus.on(WEBSOCKET_MESSAGE_EVENTS.ERROR, (data) => {
      this.logger.debug('收到 error 消息:', data);
      this.handleErrorResponse(data);
    });
    
    // 监听所有WebSocket消息用于调试
    this.eventBus.on(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, (message) => {
      this.logger.debug(`收到所有WebSocket消息: ${message.type}`, message);
    });
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    // 监听添加PDF请求
    this.eventBus.on(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, (fileInfo) => {
      this.addPDF(fileInfo);
    });
    
    // 监听删除PDF请求
    this.eventBus.on(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, (filename) => {
      this.removePDF(filename);
    });
    
    // 监听打开PDF请求
    this.eventBus.on(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, (filename) => {
      this.openPDF(filename);
    });
  }

  /**
   * 加载PDF列表
   */
  loadPDFList() {
    this.logger.info('正在加载PDF列表');
    this.websocketManager.send('get_pdf_list');
  }

  /**
   * 处理PDF列表更新
   * @param {Object} data - 更新数据
   */
  handlePDFListUpdated(data) {
    this.logger.info('处理PDF列表更新');
    
    if (data.data && data.data.files) {
      this.pdfs = data.data.files.map(file => this.mapBackendDataToTableData(file));
      this.eventBus.emit(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, this.pdfs);
    }
  }

  /**
   * 处理成功响应
   * @param {Object} data - 响应数据
   */
  handleSuccessResponse(data) {
    this.logger.info('处理成功响应');
    
    if (data.data && data.data.original_type === 'get_pdf_list' && data.data.result && data.data.result.files) {
      this.pdfs = data.data.result.files.map(file => this.mapBackendDataToTableData(file));
      this.eventBus.emit(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, this.pdfs);
    }
  }

  /**
   * 处理错误响应
   * @param {Object} data - 错误数据
   */
  handleErrorResponse(data) {
    this.logger.error('处理错误响应:', data);
    
    let errorMessage = '操作失败';
    if (data.data && data.data.message) {
      errorMessage = data.data.message;
    } else if (data.message) {
      errorMessage = data.message;
    }
    
    this.eventBus.emit(PDF_MANAGEMENT_EVENTS.ERROR, errorMessage);
  }

  /**
   * 添加PDF文件
   * @param {Object} fileInfo - 文件信息
   */
  addPDF(fileInfo) {
    this.logger.info('添加PDF文件:', fileInfo);
    
    try {
      this.websocketManager.send('add_pdf', { fileInfo });
      this.eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.STARTED, fileInfo);
    } catch (error) {
      this.logger.error('添加PDF失败:', error);
      this.eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.FAILED, error);
    }
  }

  /**
   * 删除PDF文件
   * @param {string} filename - 文件名
   */
  removePDF(filename) {
    this.logger.info('删除PDF文件:', filename);
    
    try {
      this.websocketManager.send('remove_pdf', { filename });
      this.eventBus.emit(PDF_MANAGEMENT_EVENTS.REMOVE.STARTED, filename);
    } catch (error) {
      this.logger.error('删除PDF失败:', error);
      this.eventBus.emit(PDF_MANAGEMENT_EVENTS.REMOVE.FAILED, error);
    }
  }

  /**
   * 打开PDF文件
   * @param {string} filename - 文件名
   */
  openPDF(filename) {
    this.logger.info('打开PDF文件:', filename);
    
    const pdf = this.pdfs.find(p => p.filename === filename);
    if (!pdf) {
      this.eventBus.emit(PDF_MANAGEMENT_EVENTS.ERROR, '找不到指定的PDF文件');
      return;
    }
    
    const filepath = pdf.filepath || pdf.path;
    if (!filepath) {
      this.eventBus.emit(PDF_MANAGEMENT_EVENTS.ERROR, 'PDF文件路径无效');
      return;
    }
    
    // 在新窗口中打开PDF
    if (filepath.startsWith('file://') || filepath.includes(':\\') || filepath.startsWith('/')) {
      window.open(filepath, '_blank');
    } else {
      const viewerUrl = `../pdf-viewer/index.html?file=${encodeURIComponent(filepath)}`;
      window.open(viewerUrl, '_blank');
    }
    
    this.eventBus.emit(PDF_MANAGEMENT_EVENTS.OPENED, pdf);
  }

  /**
   * 获取PDF列表
   * @returns {Array} PDF列表
   */
  getPDFs() {
    return this.pdfs;
  }

  /**
   * 获取指定PDF
   * @param {string} filename - 文件名
   * @returns {Object|null} PDF对象
   */
  getPDF(filename) {
    return this.pdfs.find(p => p.filename === filename);
  }

  /**
   * 搜索PDF文件
   * @param {string} query - 搜索查询
   * @returns {Array} 搜索结果
   */
  searchPDFs(query) {
    if (!query) {
      return this.pdfs;
    }
    
    const lowercaseQuery = query.toLowerCase();
    return this.pdfs.filter(pdf => 
      pdf.title.toLowerCase().includes(lowercaseQuery) ||
      pdf.filename.toLowerCase().includes(lowercaseQuery) ||
      (pdf.path && pdf.path.toLowerCase().includes(lowercaseQuery))
    );
  }

  /**
   * 将后端数据映射为表格数据
   * @param {Object} backendData - 后端数据
   * @returns {Object} 表格数据
   */
  mapBackendDataToTableData(backendData) {
    try {
      return {
        id: backendData.id || backendData.filename,
        filename: backendData.filename || 'unknown.pdf',
        filepath: backendData.filepath || backendData.path || '',
        title: backendData.title || backendData.filename || 'unknown.pdf',
        size: backendData.file_size || backendData.size || 0,
        created_time: this.convertTimeToTimestamp(backendData.created_time),
        modified_time: this.convertTimeToTimestamp(backendData.modified_time),
        page_count: backendData.page_count || 0,
        author: backendData.author || '',
        tags: Array.isArray(backendData.tags) ? backendData.tags : [],
        notes: backendData.notes || '',
        import_date: backendData.import_date || new Date().toISOString(),
        access_date: backendData.access_date || new Date().toISOString(),
        importance: backendData.importance || 'medium',
        unread_pages: backendData.unread_pages || 0,
        total_pages: backendData.total_pages || backendData.page_count || 0,
        annotations_count: backendData.annotations_count || 0,
        cards_count: backendData.cards_count || 0,
        select: '',
        actions: ''
      };
    } catch (error) {
      console.error('数据映射失败:', error);
      return {
        id: backendData.filename || 'unknown',
        filename: backendData.filename || 'unknown.pdf',
        filepath: '',
        title: backendData.filename || 'unknown.pdf',
        size: 0,
        created_time: 0,
        modified_time: 0,
        page_count: 0,
        select: '',
        actions: ''
      };
    }
  }

  /**
   * 转换时间戳
   * @param {*} timeValue - 时间值
   * @returns {number} 时间戳
   */
  convertTimeToTimestamp(timeValue) {
    if (!timeValue) return 0;
    if (typeof timeValue === 'number') return timeValue;
    if (typeof timeValue === 'string') {
      const date = new Date(timeValue);
      return isNaN(date.getTime()) ? 0 : date.getTime();
    }
    return 0;
  }
}

// 导出PDFManager类
export default PDFManager;