/**
 * PDF-Viewer 错误处理和进度指示功能测试文件
 * @file 测试错误分类、进度指示、错误显示和重试机制
 * @module ErrorHandlingProgressTest
 */

import { PDFManager } from '../../../src/frontend/pdf-viewer/pdf-manager.js';
import { UIManager } from '../../../src/frontend/pdf-viewer/ui-manager.js';
import EventBus from '../../../src/frontend/common/event/event-bus.js';
import { PDF_VIEWER_EVENTS } from '../../../src/frontend/common/event/pdf-viewer-constants.js';

// Mock 依赖模块
jest.mock('../../../src/frontend/common/event/event-bus.js');
jest.mock('../../../src/frontend/common/utils/logger.js');

/**
 * 测试 PDFManager 错误分类功能
 */
describe('PDFManager 错误分类功能', () => {
  
  let pdfManager;
  let mockEventBus;

  beforeEach(() => {
    mockEventBus = {
      emit: jest.fn()
    };
    pdfManager = new PDFManager(mockEventBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * 测试网络错误分类
   */
  test('正确分类网络错误', () => {
    const networkError = new Error('Network error: Failed to fetch');
    const fileData = { filename: 'test.pdf', url: 'http://example.com/test.pdf' };
    
    const classifiedError = pdfManager._classifyPDFError(networkError, fileData);
    
    expect(classifiedError.type).toBe('NETWORK_ERROR');
    expect(classifiedError.userMessage).toBe('网络连接失败，请检查网络连接或文件URL是否正确');
    expect(classifiedError.retryable).toBe(true);
    expect(classifiedError.file).toEqual(fileData);
  });

  /**
   * 测试格式错误分类
   */
  test('正确分类格式错误', () => {
    const formatError = new Error('Invalid PDF structure');
    const fileData = { filename: 'corrupted.pdf' };
    
    const classifiedError = pdfManager._classifyPDFError(formatError, fileData);
    
    expect(classifiedError.type).toBe('FORMAT_ERROR');
    expect(classifiedError.userMessage).toBe('文件格式错误，可能不是有效的PDF文件或文件已损坏');
    expect(classifiedError.retryable).toBe(false);
  });

  /**
   * 测试解析错误分类
   */
  test('正确分类解析错误', () => {
    const parseError = new Error('PDF parsing failed: invalid syntax');
    const fileData = { filename: 'encrypted.pdf' };
    
    const classifiedError = pdfManager._classifyPDFError(parseError, fileData);
    
    expect(classifiedError.type).toBe('PARSE_ERROR');
    expect(classifiedError.userMessage).toBe('PDF文件解析失败，可能使用了不支持的加密或压缩格式');
    expect(classifiedError.retryable).toBe(false);
  });

  /**
   * 测试内存错误分类
   */
  test('正确分类内存错误', () => {
    const memoryError = new Error('Out of memory: file too large');
    const fileData = { filename: 'large.pdf', size: 1024 * 1024 * 100 };
    
    const classifiedError = pdfManager._classifyPDFError(memoryError, fileData);
    
    expect(classifiedError.type).toBe('MEMORY_ERROR');
    expect(classifiedError.userMessage).toBe('内存不足，无法加载大型PDF文件');
    expect(classifiedError.retryable).toBe(false);
  });

  /**
   * 测试权限错误分类
   */
  test('正确分类权限错误', () => {
    const permissionError = new Error('Permission denied: access to file');
    const fileData = { filename: 'restricted.pdf' };
    
    const classifiedError = pdfManager._classifyPDFError(permissionError, fileData);
    
    expect(classifiedError.type).toBe('PERMISSION_ERROR');
    expect(classifiedError.userMessage).toBe('没有权限访问该文件');
    expect(classifiedError.retryable).toBe(false);
  });

  /**
   * 测试未知错误分类
   */
  test('正确分类未知错误', () => {
    const unknownError = new Error('Some unexpected error');
    const fileData = { filename: 'unknown.pdf' };
    
    const classifiedError = pdfManager._classifyPDFError(unknownError, fileData);
    
    expect(classifiedError.type).toBe('UNKNOWN');
    expect(classifiedError.userMessage).toBe('加载PDF文件时发生未知错误');
    expect(classifiedError.retryable).toBe(true);
  });

  /**
   * 测试错误消息包含多种关键词时的优先级
   */
  test('错误消息关键词优先级处理', () => {
    // 网络错误应该优先于其他错误
    const mixedError = new Error('Network error: HTTP 404, file format invalid');
    const fileData = { filename: 'mixed.pdf' };
    
    const classifiedError = pdfManager._classifyPDFError(mixedError, fileData);
    
    expect(classifiedError.type).toBe('NETWORK_ERROR');
  });
});

/**
 * 测试 UIManager 进度指示功能
 */
describe('UIManager 进度指示功能', () => {
  
  let uiManager;
  let mockEventBus;
  let mockContainer;

  beforeEach(() => {
    mockEventBus = {
      emit: jest.fn()
    };
    
    // 创建模拟的DOM容器
    mockContainer = {
      querySelector: jest.fn(),
      appendChild: jest.fn(),
      style: {}
    };
    
    // Mock DOMUtils
    jest.mock('../../../src/frontend/common/utils/dom-utils.js', () => ({
      DOMUtils: {
        getElementById: jest.fn().mockReturnValue(mockContainer),
        addClass: jest.fn(),
        removeClass: jest.fn()
      }
    }));
    
    uiManager = new UIManager(mockEventBus);
    
    // 手动设置进度元素
    uiManager._progressBar = {
      querySelector: jest.fn().mockReturnValue({ style: {} })
    };
    uiManager._progressText = { textContent: '' };
  });

  /**
   * 测试进度更新功能
   */
  test('正确更新进度显示', () => {
    const progressFill = { style: { width: '0%' } };
    uiManager._progressBar.querySelector.mockReturnValue(progressFill);
    
    uiManager.updateProgress(50, '正在加载');
    
    expect(progressFill.style.width).toBe('50%');
    expect(uiManager._progressText.textContent).toBe('正在加载 50%');
  });

  /**
   * 测试进度边界值处理
   */
  test('正确处理进度边界值', () => {
    const progressFill = { style: { width: '0%' } };
    uiManager._progressBar.querySelector.mockReturnValue(progressFill);
    
    // 测试0%
    uiManager.updateProgress(0, '开始加载');
    expect(progressFill.style.width).toBe('0%');
    
    // 测试100%
    uiManager.updateProgress(100, '完成加载');
    expect(progressFill.style.width).toBe('100%');
    
    // 测试超出范围的值
    uiManager.updateProgress(150, '超出范围');
    expect(progressFill.style.width).toBe('100%');
    
    uiManager.updateProgress(-10, '负值');
    expect(progressFill.style.width).toBe('0%');
  });

  /**
   * 测试进度隐藏功能
   */
  test('正确隐藏进度条', () => {
    const progressContainer = { style: { display: 'block' } };
    uiManager._container = {
      querySelector: jest.fn().mockReturnValue(progressContainer)
    };
    
    uiManager.hideProgress();
    
    expect(progressContainer.style.display).toBe('none');
  });
});

/**
 * 测试 UIManager 错误显示功能
 */
describe('UIManager 错误显示功能', () => {
  
  let uiManager;
  let mockEventBus;
  let mockContainer;

  beforeEach(() => {
    mockEventBus = {
      emit: jest.fn()
    };
    
    mockContainer = {
      innerHTML: '',
      style: {},
      appendChild: jest.fn(),
      querySelector: jest.fn()
    };
    
    jest.mock('../../../src/frontend/common/utils/dom-utils.js', () => ({
      DOMUtils: {
        getElementById: jest.fn().mockReturnValue(mockContainer),
        addClass: jest.fn(),
        removeClass: jest.fn()
      }
    }));
    
    uiManager = new UIManager(mockEventBus);
    uiManager._errorContainer = {
      style: { display: 'none' },
      innerHTML: ''
    };
    uiManager._progressBar = {
      parentElement: { style: { display: 'block' } }
    };
  });

  /**
   * 测试可重试错误的显示
   */
  test('正确显示可重试的错误信息', () => {
    const errorData = {
      type: 'NETWORK_ERROR',
      userMessage: '网络连接失败',
      retryable: true,
      file: { filename: 'test.pdf' }
    };
    
    uiManager.showError(errorData);
    
    expect(uiManager._errorContainer.style.display).toBe('block');
    expect(uiManager._errorContainer.innerHTML).toContain('网络连接失败');
    expect(uiManager._errorContainer.innerHTML).toContain('重试');
    expect(uiManager._errorContainer.innerHTML).toContain('关闭');
  });

  /**
   * 测试不可重试错误的显示
   */
  test('正确显示不可重试的错误信息', () => {
    const errorData = {
      type: 'FORMAT_ERROR',
      userMessage: '文件格式错误',
      retryable: false,
      file: { filename: 'corrupted.pdf' }
    };
    
    uiManager.showError(errorData);
    
    expect(uiManager._errorContainer.innerHTML).not.toContain('重试');
    expect(uiManager._errorContainer.innerHTML).toContain('关闭');
  });

  /**
   * 测试错误隐藏功能
   */
  test('正确隐藏错误信息', () => {
    uiManager._errorContainer.style.display = 'block';
    uiManager._errorContainer.innerHTML = '<div>Error content</div>';
    
    uiManager.hideError();
    
    expect(uiManager._errorContainer.style.display).toBe('none');
    expect(uiManager._errorContainer.innerHTML).toBe('');
  });

  /**
   * 测试重试按钮功能
   */
  test('重试按钮触发正确的事件', () => {
    const errorData = {
      type: 'NETWORK_ERROR',
      userMessage: '网络连接失败',
      retryable: true,
      file: { filename: 'test.pdf' }
    };
    
    uiManager.showError(errorData);
    
    // 模拟重试按钮点击
    const retryBtn = { onclick: null };
    document.getElementById = jest.fn().mockReturnValue(retryBtn);
    
    uiManager.showError(errorData);
    
    // 触发重试按钮点击
    retryBtn.onclick();
    
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.FILE.LOAD.RETRY,
      errorData.file,
      expect.any(Object)
    );
  });

  /**
   * 测试关闭按钮功能
   */
  test('关闭按钮触发正确的事件', () => {
    const errorData = {
      type: 'NETWORK_ERROR',
      userMessage: '网络连接失败',
      retryable: true,
      file: { filename: 'test.pdf' }
    };
    
    uiManager.showError(errorData);
    
    // 模拟关闭按钮点击
    const closeBtn = { onclick: null };
    document.getElementById = jest.fn().mockReturnValue(closeBtn);
    
    uiManager.showError(errorData);
    
    // 触发关闭按钮点击
    closeBtn.onclick();
    
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.FILE.CLOSE,
      undefined,
      expect.any(Object)
    );
  });
});

/**
 * 测试集成错误处理和进度指示功能
 */
describe('集成错误处理和进度指示功能', () => {
  
  let pdfManager;
  let uiManager;
  let mockEventBus;

  beforeEach(() => {
    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn()
    };
    
    pdfManager = new PDFManager(mockEventBus);
    uiManager = new UIManager(mockEventBus);
    
    // Mock UI方法
    uiManager.updateProgress = jest.fn();
    uiManager.hideProgress = jest.fn();
    uiManager.showError = jest.fn();
  });

  /**
   * 测试进度事件集成
   */
  test('进度事件正确触发UI更新', () => {
    const progressHandler = mockEventBus.on.mock.calls.find(
      call => call[0] === PDF_VIEWER_EVENTS.FILE.LOAD.PROGRESS
    )?.[1];
    
    const progressData = {
      loaded: 50,
      total: 100,
      percent: 50
    };
    
    progressHandler(progressData);
    
    expect(uiManager.updateProgress).toHaveBeenCalledWith(50, '加载中...');
  });

  /**
   * 测试错误事件集成
   */
  test('错误事件正确触发错误显示', () => {
    const errorHandler = mockEventBus.on.mock.calls.find(
      call => call[0] === PDF_VIEWER_EVENTS.FILE.LOAD.FAILED
    )?.[1];
    
    const errorData = {
      type: 'NETWORK_ERROR',
      userMessage: '网络连接失败',
      retryable: true,
      file: { filename: 'test.pdf' }
    };
    
    errorHandler(errorData);
    
    expect(uiManager.hideProgress).toHaveBeenCalled();
    expect(uiManager.showError).toHaveBeenCalledWith(errorData);
  });

  /**
   * 测试重试事件集成
   */
  test('重试事件正确触发文件重新加载', () => {
    const retryHandler = mockEventBus.on.mock.calls.find(
      call => call[0] === PDF_VIEWER_EVENTS.FILE.LOAD.RETRY
    )?.[1];
    
    const fileData = { filename: 'test.pdf', url: 'http://example.com/test.pdf' };
    
    retryHandler(fileData);
    
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED,
      fileData,
      expect.any(Object)
    );
  });
});

/**
 * 测试边界情况和异常场景
 */
describe('边界情况和异常场景测试', () => {
  
  let pdfManager;
  let mockEventBus;

  beforeEach(() => {
    mockEventBus = {
      emit: jest.fn()
    };
    pdfManager = new PDFManager(mockEventBus);
  });

  /**
   * 测试空错误消息处理
   */
  test('正确处理空错误消息', () => {
    const emptyError = { message: '' };
    const fileData = { filename: 'empty.pdf' };
    
    const classifiedError = pdfManager._classifyPDFError(emptyError, fileData);
    
    expect(classifiedError.type).toBe('UNKNOWN');
    expect(classifiedError.userMessage).toBe('加载PDF文件时发生未知错误');
  });

  /**
   * 测试未定义错误处理
   */
  test('正确处理未定义错误', () => {
    const undefinedError = undefined;
    const fileData = { filename: 'undefined.pdf' };
    
    const classifiedError = pdfManager._classifyPDFError(undefinedError, fileData);
    
    expect(classifiedError.type).toBe('UNKNOWN');
    expect(classifiedError.error).toBe('undefined');
  });

  /**
   * 测试字符串错误处理
   */
  test('正确处理字符串错误', () => {
    const stringError = 'Simple error string';
    const fileData = { filename: 'string.pdf' };
    
    const classifiedError = pdfManager._classifyPDFError(stringError, fileData);
    
    expect(classifiedError.type).toBe('UNKNOWN');
    expect(classifiedError.error).toBe('Simple error string');
  });
});