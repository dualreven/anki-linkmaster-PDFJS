/**
 * PDF主页单文件原型 v1
 * 实现完整功能原型，包括事件系统、PDF文件管理、WebSocket通信、UI渲染、日志系统和错误处理
 */

// ===== 事件系统 =====
/**
 * 事件总线类
 * 实现事件发布和订阅功能
 */
class EventBus {
  constructor() {
    this.events = {};
  }

  /**
   * 订阅事件
   * @param {string} event - 事件名称，格式为 {module}:{action}:{status}
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消订阅的函数
   */
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    
    this.events[event].push(callback);
    
    // 返回取消订阅的函数
    return () => {
      this.off(event, callback);
    };
  }

  /**
   * 取消订阅事件
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  off(event, callback) {
    if (!this.events[event]) return;
    
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  }

  /**
   * 发布事件
   * @param {string} event - 事件名称
   * @param {*} data - 事件数据
   */
  emit(event, data) {
    if (!this.events[event]) return;
    
    this.events[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`事件处理错误 [${event}]:`, error);
      }
    });
  }

  /**
   * 一次性订阅事件
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  once(event, callback) {
    const onceWrapper = (data) => {
      callback(data);
      this.off(event, onceWrapper);
    };
    
    this.on(event, onceWrapper);
  }
}

// ===== 日志系统 =====
/**
 * 日志管理器类
 * 实现详细日志输出功能
 */
class Logger {
  constructor(moduleName = 'App') {
    this.moduleName = moduleName;
    this.logLevel = 'debug'; // debug, info, warn, error
    this.logFile = 'debug-console.log';
  }

  /**
   * 格式化日志消息
   * @param {string} level - 日志级别
   * @param {string} message - 消息内容
   * @returns {string} 格式化后的日志消息
   */
  formatMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${this.moduleName}] [${level.toUpperCase()}] ${message}`;
  }

  /**
   * 写入日志到文件和控制台
   * @param {string} level - 日志级别
   * @param {string} message - 消息内容
   */
  writeLog(level, message) {
    const formattedMessage = this.formatMessage(level, message);
    
    // 输出到控制台
    console[level](formattedMessage);
    
    // 在实际应用中，这里应该写入到文件
    // 由于浏览器限制，这里仅模拟文件写入
    this.simulateFileWrite(formattedMessage);
  }

  /**
   * 模拟文件写入（在实际应用中应替换为真实的文件写入）
   * @param {string} message - 日志消息
   */
  simulateFileWrite(message) {
    // 在实际应用中，这里应该使用API将日志发送到服务器
    // 或者使用浏览器的存储机制
    if (typeof window !== 'undefined') {
      // 存储到localStorage用于调试
      const logs = JSON.parse(localStorage.getItem('appLogs') || '[]');
      logs.push(message);
      
      // 限制日志数量，避免存储过多
      if (logs.length > 1000) {
        logs.shift();
      }
      
      localStorage.setItem('appLogs', JSON.stringify(logs));
    }
  }

  /**
   * 调试级别日志
   * @param {string} message - 消息内容
   */
  debug(message) {
    if (this.logLevel === 'debug') {
      this.writeLog('debug', message);
    }
  }

  /**
   * 信息级别日志
   * @param {string} message - 消息内容
   */
  info(message) {
    if (['debug', 'info'].includes(this.logLevel)) {
      this.writeLog('info', message);
    }
  }

  /**
   * 警告级别日志
   * @param {string} message - 消息内容
   */
  warn(message) {
    if (['debug', 'info', 'warn'].includes(this.logLevel)) {
      this.writeLog('warn', message);
    }
  }

  /**
   * 错误级别日志
   * @param {string} message - 消息内容
   * @param {Error} error - 错误对象（可选）
   */
  error(message, error) {
    this.writeLog('error', message);
    if (error) {
      console.error(error);
    }
  }
}

// ===== 错误处理 =====
/**
 * 错误类型枚举
 */
const ErrorType = {
  BUSINESS: 'business',    // 业务错误
  NETWORK: 'network',      // 网络错误
  SYSTEM: 'system'         // 系统错误
};

/**
 * 自定义错误类
 */
class AppError extends Error {
  constructor(message, type = ErrorType.SYSTEM, code = null) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.code = code;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * 错误处理器类
 */
class ErrorHandler {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.logger = new Logger('ErrorHandler');
  }

  /**
   * 处理错误
   * @param {Error|AppError} error - 错误对象
   * @param {string} context - 错误上下文
   */
  handleError(error, context = '') {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      type: error.type || ErrorType.SYSTEM,
      code: error.code || null,
      context,
      timestamp: new Date().toISOString()
    };

    // 记录错误日志
    this.logger.error(`错误发生在 [${context}]: ${error.message}`, error);

    // 通过事件总线传播错误事件
    this.eventBus.emit('system:error:occurred', errorInfo);

    // 显示用户友好的错误消息
    this.showUserFriendlyError(error);
  }

  /**
   * 显示用户友好的错误消息
   * @param {Error|AppError} error - 错误对象
   */
  showUserFriendlyError(error) {
    let userMessage = '操作失败，请稍后重试';

    switch (error.type) {
      case ErrorType.BUSINESS:
        userMessage = error.message || '业务逻辑错误';
        break;
      case ErrorType.NETWORK:
        userMessage = '网络连接失败，请检查网络设置';
        break;
      case ErrorType.SYSTEM:
        userMessage = '系统错误，请联系管理员';
        break;
    }

    // 通过事件总线通知UI显示错误消息
    this.eventBus.emit('ui:error:show', {
      message: userMessage,
      type: error.type
    });
  }

  /**
   * 创建业务错误
   * @param {string} message - 错误消息
   * @param {string} code - 错误代码
   * @returns {AppError} 业务错误对象
   */
  createBusinessError(message, code = null) {
    return new AppError(message, ErrorType.BUSINESS, code);
  }

  /**
   * 创建网络错误
   * @param {string} message - 错误消息
   * @param {string} code - 错误代码
   * @returns {AppError} 网络错误对象
   */
  createNetworkError(message, code = null) {
    return new AppError(message, ErrorType.NETWORK, code);
  }

  /**
   * 创建系统错误
   * @param {string} message - 错误消息
   * @param {string} code - 错误代码
   * @returns {AppError} 系统错误对象
   */
  createSystemError(message, code = null) {
    return new AppError(message, ErrorType.SYSTEM, code);
  }
}

// ===== WebSocket通信 =====
/**
 * WebSocket管理器类
 */
class WebSocketManager {
  constructor(url = 'ws://localhost:8765', eventBus) {
    this.url = url;
    this.eventBus = eventBus;
    this.logger = new Logger('WebSocket');
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.isConnectedFlag = false;
    this.messageQueue = [];
  }

  /**
   * 连接WebSocket
   */
  connect() {
    try {
      this.logger.info(`正在连接到WebSocket服务器: ${this.url}`);
      
      this.socket = new WebSocket(this.url);
      
      this.socket.onopen = () => {
        this.logger.info('WebSocket连接已建立');
        this.isConnectedFlag = true;
        this.reconnectAttempts = 0;
        this.eventBus.emit('websocket:connection:established');
        
        // 发送队列中的消息
        this.flushMessageQueue();
      };
      
      this.socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };
      
      this.socket.onclose = () => {
        this.logger.warn('WebSocket连接已关闭');
        this.isConnectedFlag = false;
        this.eventBus.emit('websocket:connection:closed');
        
        // 尝试重新连接
        this.attemptReconnect();
      };
      
      this.socket.onerror = (error) => {
        this.logger.error('WebSocket连接错误', error);
        this.eventBus.emit('websocket:connection:error', error);
      };
      
    } catch (error) {
      this.logger.error('WebSocket连接失败', error);
      this.eventBus.emit('websocket:connection:failed', error);
    }
  }

  /**
   * 断开WebSocket连接
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.isConnectedFlag = false;
    }
  }

  /**
   * 检查是否已连接
   * @returns {boolean} 是否已连接
   */
  isConnected() {
    return this.isConnectedFlag;
  }

  /**
   * 发送消息
   * @param {string} type - 消息类型
   * @param {Object} data - 消息数据
   */
  send(type, data = {}) {
    const message = {
      type,
      data,
      timestamp: new Date().toISOString()
    };
    
    if (this.isConnected()) {
      try {
        this.socket.send(JSON.stringify(message));
        this.logger.debug(`发送消息: ${type}`);
      } catch (error) {
        this.logger.error(`发送消息失败: ${type}`, error);
        this.eventBus.emit('websocket:message:send_failed', { type, error });
      }
    } else {
      // 将消息加入队列，等待连接建立后发送
      this.messageQueue.push(message);
      this.logger.debug(`消息已加入队列: ${type}`);
    }
  }

  /**
   * 处理接收到的消息
   * @param {string} rawData - 原始消息数据
   */
  handleMessage(rawData) {
    try {
      const message = JSON.parse(rawData);
      this.logger.debug(`收到消息: ${message.type}`, message);
      
      // 通过事件总线分发消息
      this.eventBus.emit(`websocket:message:${message.type}`, message);
      this.eventBus.emit('websocket:message:received', message);
      
    } catch (error) {
      this.logger.error('解析WebSocket消息失败', error);
    }
  }

  /**
   * 尝试重新连接
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('WebSocket重连次数已达上限');
      this.eventBus.emit('websocket:reconnect:failed');
      return;
    }
    
    this.reconnectAttempts++;
    this.logger.info(`尝试重新连接WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  /**
   * 发送队列中的消息
   */
  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      try {
        this.socket.send(JSON.stringify(message));
        this.logger.debug(`发送队列消息: ${message.type}`);
      } catch (error) {
        this.logger.error(`发送队列消息失败: ${message.type}`, error);
        // 将消息重新加入队列
        this.messageQueue.unshift(message);
        break;
      }
    }
  }
}

// ===== PDF文件管理 =====
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
    this.eventBus.on('websocket:message:pdf_list_updated', (data) => {
      this.logger.debug('收到 pdf_list_updated 消息:', data);
      this.handlePDFListUpdated(data);
    });
    
    // 监听PDF列表消息（添加缺失的监听器）
    this.eventBus.on('websocket:message:pdf_list', (data) => {
      this.logger.debug('收到 pdf_list 消息:', data);
      this.handlePDFListUpdated(data);
    });
    
    // 监听成功响应
    this.eventBus.on('websocket:message:success', (data) => {
      this.logger.debug('收到 success 消息:', data);
      this.handleSuccessResponse(data);
    });
    
    // 监听错误响应
    this.eventBus.on('websocket:message:error', (data) => {
      this.logger.debug('收到 error 消息:', data);
      this.handleErrorResponse(data);
    });
    
    // 监听所有WebSocket消息用于调试
    this.eventBus.on('websocket:message:received', (message) => {
      this.logger.debug(`收到所有WebSocket消息: ${message.type}`, message);
    });
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    // 监听添加PDF请求
    this.eventBus.on('pdf:management:add_requested', (fileInfo) => {
      this.addPDF(fileInfo);
    });
    
    // 监听删除PDF请求
    this.eventBus.on('pdf:management:remove_requested', (filename) => {
      this.removePDF(filename);
    });
    
    // 监听打开PDF请求
    this.eventBus.on('pdf:management:open_requested', (filename) => {
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
      this.eventBus.emit('pdf:management:list_updated', this.pdfs);
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
      this.eventBus.emit('pdf:management:list_updated', this.pdfs);
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
    
    this.eventBus.emit('pdf:management:error', errorMessage);
  }

  /**
   * 添加PDF文件
   * @param {Object} fileInfo - 文件信息
   */
  addPDF(fileInfo) {
    this.logger.info('添加PDF文件:', fileInfo);
    
    try {
      this.websocketManager.send('add_pdf', { fileInfo });
      this.eventBus.emit('pdf:management:add_started', fileInfo);
    } catch (error) {
      this.logger.error('添加PDF失败:', error);
      this.eventBus.emit('pdf:management:add_failed', error);
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
      this.eventBus.emit('pdf:management:remove_started', filename);
    } catch (error) {
      this.logger.error('删除PDF失败:', error);
      this.eventBus.emit('pdf:management:remove_failed', error);
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
      this.eventBus.emit('pdf:management:error', '找不到指定的PDF文件');
      return;
    }
    
    const filepath = pdf.filepath || pdf.path;
    if (!filepath) {
      this.eventBus.emit('pdf:management:error', 'PDF文件路径无效');
      return;
    }
    
    // 在新窗口中打开PDF
    if (filepath.startsWith('file://') || filepath.includes(':\\') || filepath.startsWith('/')) {
      window.open(filepath, '_blank');
    } else {
      const viewerUrl = `../pdf-viewer/index.html?file=${encodeURIComponent(filepath)}`;
      window.open(viewerUrl, '_blank');
    }
    
    this.eventBus.emit('pdf:management:opened', pdf);
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

// ===== UI渲染 =====
/**
 * UI管理器类
 */
class UIManager {
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
      container: document.querySelector('.container'),
      addPdfBtn: document.getElementById('add-pdf-btn'),
      batchAddBtn: document.getElementById('batch-add-btn'),
      batchDeleteBtn: document.getElementById('batch-delete-btn'),
      debugBtn: document.getElementById('debug-btn'),
      debugStatus: document.getElementById('debug-status'),
      debugContent: document.getElementById('debug-content'),
      pdfTableContainer: document.getElementById('pdf-table-container'),
      emptyState: document.getElementById('empty-state')
    };
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    // 添加PDF按钮
    if (this.elements.addPdfBtn) {
      this.elements.addPdfBtn.addEventListener('click', () => {
        // 通过WebSocket请求文件选择对话框
        this.eventBus.emit('websocket:send', {
          type: 'request_file_selection'
        });
      });
    }
    
    // 批量添加PDF按钮
    if (this.elements.batchAddBtn) {
      this.elements.batchAddBtn.addEventListener('click', () => {
        // 通过WebSocket请求文件选择对话框
        this.eventBus.emit('websocket:send', {
          type: 'request_file_selection'
        });
      });
    }
    
    // 批量删除PDF按钮
    if (this.elements.batchDeleteBtn) {
      this.elements.batchDeleteBtn.addEventListener('click', () => {
        this.handleBatchDelete();
      });
    }
    
    // 调试按钮
    if (this.elements.debugBtn) {
      this.elements.debugBtn.addEventListener('click', () => {
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
    this.eventBus.on('pdf:management:list_updated', (pdfs) => {
      this.updatePDFList(pdfs);
    });
    
    // 监听WebSocket连接状态
    this.eventBus.on('websocket:connection:established', () => {
      this.setWebSocketConnected(true);
    });
    
    this.eventBus.on('websocket:connection:closed', () => {
      this.setWebSocketConnected(false);
    });
    
    // 监听错误事件
    this.eventBus.on('ui:error:show', (errorInfo) => {
      this.showError(errorInfo.message);
    });
    
    // 监听成功事件
    this.eventBus.on('ui:success:show', (message) => {
      this.showSuccess(message);
    });
    
    // 监听WebSocket发送请求
    this.eventBus.on('websocket:send', (message) => {
      if (window.app && window.app.websocketManager) {
        window.app.websocketManager.send(message.type, message.data || {});
      }
    });
    
    // 键盘快捷键
    document.addEventListener('keydown', (event) => {
      // Ctrl+D: 切换调试面板
      if (event.ctrlKey && event.key === 'd') {
        event.preventDefault();
        this.toggleDebugStatus();
      }
      
      // Ctrl+N: 添加PDF
      if (event.ctrlKey && event.key === 'n') {
        event.preventDefault();
        this.eventBus.emit('websocket:send', {
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
    this.elements.pdfTableContainer.innerHTML = '';
    
    if (loading) {
      // 显示加载状态
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'loading';
      loadingDiv.textContent = '正在加载...';
      this.elements.pdfTableContainer.appendChild(loadingDiv);
    } else if (pdfs.length === 0) {
      // 显示空状态
      if (this.elements.emptyState) {
        this.elements.emptyState.style.display = 'block';
      }
      this.elements.pdfTableContainer.style.display = 'none';
    } else {
      // 显示PDF列表
      if (this.elements.emptyState) {
        this.elements.emptyState.style.display = 'none';
      }
      this.elements.pdfTableContainer.style.display = 'block';
      
      const pdfList = document.createElement('div');
      pdfList.className = 'pdf-list';
      
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
    const header = document.createElement('div');
    header.className = 'pdf-list-header';
    
    header.innerHTML = `
      <input type="checkbox" class="list-header-select" id="select-all">
      <div class="list-header-title">文件名</div>
      <div class="list-header-size">大小</div>
      <div class="list-header-date">修改日期</div>
      <div class="list-header-importance">重要性</div>
      <div class="list-header-pages">页数</div>
      <div class="list-header-annotations">注释</div>
      <div class="list-header-cards">卡片</div>
      <div class="list-header-actions">操作</div>
    `;
    
    // 全选功能
    const selectAllCheckbox = header.querySelector('#select-all');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (event) => {
        const checkboxes = document.querySelectorAll('.pdf-item-checkbox');
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
    const item = document.createElement('div');
    item.className = 'pdf-item';
    item.dataset.filename = pdf.filename;
    
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
    
    item.innerHTML = `
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
    `;
    
    // 添加事件委托
    item.addEventListener('click', (event) => {
      this.handlePDFItemAction(event);
    });
    
    return item;
  }

  /**
   * 处理PDF项操作
   * @param {Event} event - 事件对象
   */
  handlePDFItemAction(event) {
    const button = event.target.closest('button');
    if (!button) return;
    
    const action = button.getAttribute('data-action');
    const filename = button.getAttribute('data-filename');
    
    if (!action || !filename) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    switch (action) {
      case 'open':
        this.eventBus.emit('pdf:management:open_requested', filename);
        break;
      case 'remove':
        if (confirm('确定要删除这个PDF文件吗？')) {
          this.eventBus.emit('pdf:management:remove_requested', filename);
        }
        break;
    }
  }

  /**
   * 处理批量删除
   */
  handleBatchDelete() {
    const checkboxes = document.querySelectorAll('.pdf-item-checkbox:checked');
    if (checkboxes.length === 0) {
      this.showError('请先选择要删除的PDF文件');
      return;
    }
    
    if (confirm(`确定要删除选中的 ${checkboxes.length} 个PDF文件吗？`)) {
      checkboxes.forEach(checkbox => {
        const filename = checkbox.getAttribute('data-filename');
        this.eventBus.emit('pdf:management:remove_requested', filename);
      });
    }
  }

  /**
   * 切换调试状态
   */
  toggleDebugStatus() {
    if (this.elements.debugStatus) {
      const isVisible = this.elements.debugStatus.style.display !== 'none';
      this.elements.debugStatus.style.display = isVisible ? 'none' : 'block';
      
      if (!isVisible) {
        this.updateDebugStatus();
      }
    }
  }

  /**
   * 更新调试状态
   */
  updateDebugStatus() {
    if (!this.elements.debugContent || this.elements.debugStatus.style.display === 'none') return;
    
    const { pdfs, loading, websocketConnected } = this.state;
    
    this.elements.debugContent.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
        <div><strong>WebSocket:</strong> ${websocketConnected ? '🟢 已连接' : '🔴 未连接'}</div>
        <div><strong>PDF数量:</strong> ${pdfs.length}</div>
        <div><strong>加载状态:</strong> ${loading ? '⏳ 加载中' : '✅ 就绪'}</div>
        <div><strong>环境:</strong> ${'标准浏览器'}</div>
      </div>
      <div style="margin-top: 8px; font-size: 10px; color: #666;">
        <strong>提示:</strong> 按 Ctrl+D 打开/关闭调试面板
      </div>
    `;
  }

  /**
   * 显示错误消息
   * @param {string} message - 错误消息
   */
  showError(message) {
    // 创建错误消息元素
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    document.body.appendChild(errorDiv);
    
    // 3秒后自动隐藏
    setTimeout(() => {
      errorDiv.style.display = 'none';
      if (document.body.contains(errorDiv)) {
        document.body.removeChild(errorDiv);
      }
    }, 3000);
  }

  /**
   * 显示成功消息
   * @param {string} message - 成功消息
   */
  showSuccess(message) {
    // 创建成功消息元素
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    
    document.body.appendChild(successDiv);
    
    // 3秒后自动隐藏
    setTimeout(() => {
      successDiv.style.display = 'none';
      if (document.body.contains(successDiv)) {
        document.body.removeChild(successDiv);
      }
    }, 3000);
  }
}

// ===== 主应用类 =====
/**
 * PDF主页应用类
 */
class PDFHomeApp {
  constructor() {
    this.logger = new Logger('PDFHomeApp');
    this.eventBus = new EventBus();
    this.errorHandler = new ErrorHandler(this.eventBus);
    this.websocketManager = new WebSocketManager('ws://localhost:8765', this.eventBus);
    this.pdfManager = new PDFManager(this.eventBus, this.websocketManager);
    this.uiManager = new UIManager(this.eventBus);
    
    this.initialized = false;
  }

  /**
   * 初始化应用
   */
  async initialize() {
    try {
      this.logger.info('正在初始化PDF主页应用');
      
      // 初始化各组件
      this.pdfManager.initialize();
      
      // 连接WebSocket
      this.websocketManager.connect();
      
      // 设置全局错误处理
      this.setupGlobalErrorHandling();
      
      // 设置完成标志
      this.initialized = true;
      
      this.logger.info('PDF主页应用初始化完成');
      
      // 触发初始化完成事件
      this.eventBus.emit('app:initialization:completed');
      
    } catch (error) {
      this.logger.error('应用初始化失败', error);
      this.errorHandler.handleError(error, 'App.initialize');
    }
  }

  /**
   * 设置全局错误处理
   */
  setupGlobalErrorHandling() {
    // 捕获未处理的Promise rejection
    window.addEventListener('unhandledrejection', (event) => {
      this.logger.error('未处理的Promise rejection:', event.reason);
      this.errorHandler.handleError(event.reason, 'UnhandledPromiseRejection');
      event.preventDefault();
    });
    
    // 捕获全局错误
    window.addEventListener('error', (event) => {
      this.logger.error('全局错误:', event.error);
      this.errorHandler.handleError(event.error, 'GlobalError');
      event.preventDefault();
    });
  }

  /**
   * 获取应用状态
   * @returns {Object} 应用状态
   */
  getState() {
    return {
      initialized: this.initialized,
      websocketConnected: this.websocketManager.isConnected(),
      pdfCount: this.pdfManager.getPDFs().length
    };
  }

  /**
   * 获取诊断信息
   * @returns {Object} 诊断信息
   */
  getDiagnostics() {
    return {
      timestamp: new Date().toISOString(),
      app: this.getState(),
      logs: JSON.parse(localStorage.getItem('appLogs') || '[]').slice(-10)
    };
  }
}

// ===== 应用启动 =====
/**
 * 启动应用
 */
document.addEventListener('DOMContentLoaded', () => {
  const app = new PDFHomeApp();
  app.initialize().then(() => {
    // 挂到全局方便调试
    window.app = app;
    window.eventBus = app.eventBus;
    
    console.log('PDF主页应用已启动');
  }).catch(error => {
    console.error('PDF主页应用启动失败:', error);
  });
});