/**
 * @file 错误处理测试文件
 * @module ErrorHandlingTest
 * @description 测试PDF查看器错误代码体系和错误处理功能
 */

import { PDFManager } from '../pdf-manager.js';
import { EventBus } from '../../common/event/event-bus.js';
import ERROR_CODES from '../../common/constants/error-codes.js';
import { jest } from '@jest/globals';

// Mock 依赖模块
jest.mock('../../common/event/event-bus.js', () => {
  return {
    EventBus: function() {
      return {
        on: function() {},
        emit: function() {},
        destroy: function() {}
      };
    }
  };
});

jest.mock('../../common/utils/logger.js', () => {
  return function() {
    return {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };
  };
});

// Mock WebGL检测器
jest.mock('../../common/utils/webgl-detector.js', () => {
  return {
    WebGLStateManager: {
      getWebGLState: function() {
        return {
          supported: true,
          enabled: true
        };
      },
      shouldUseCanvasFallback: function() {
        return false;
      },
      initialize: function() {}
    }
  };
});

// Mock PDF.js - 模拟各种错误情况
jest.mock('pdfjs-dist/build/pdf', () => {
  const createMockDocument = (numPages = 10) => ({
    numPages,
    getPage: jest.fn().mockResolvedValue({
      cleanup: jest.fn()
    }),
    destroy: jest.fn().mockResolvedValue(undefined)
  });

  return {
    GlobalWorkerOptions: {
      workerSrc: ''
    },
    getDocument: jest.fn().mockImplementation((options) => {
      // 模拟网络错误
      if (options.url && options.url.includes('network-error')) {
        return {
          promise: Promise.reject(new Error('Network error: Failed to fetch'))
        };
      }
      // 模拟404错误
      if (options.url && options.url.includes('not-found')) {
        return {
          promise: Promise.reject(new Error('HTTP 404: Not Found'))
        };
      }
      // 模拟格式错误
      if (options.url && options.url.includes('invalid-format')) {
        return {
          promise: Promise.reject(new Error('Invalid PDF format'))
        };
      }
      // 模拟加密文件错误
      if (options.url && options.url.includes('encrypted')) {
        return {
          promise: Promise.reject(new Error('Encrypted PDF: decryption failed'))
        };
      }
      // 模拟内存错误
      if (options.url && options.url.includes('memory-error')) {
        return {
          promise: Promise.reject(new Error('Out of memory'))
        };
      }
      // 模拟权限错误
      if (options.url && options.url.includes('permission-error')) {
        return {
          promise: Promise.reject(new Error('Permission denied'))
        };
      }
      // 模拟服务器错误
      if (options.url && options.url.includes('server-error')) {
        return {
          promise: Promise.reject(new Error('HTTP 500: Internal Server Error'))
        };
      }
      // 模拟超时错误
      if (options.url && options.url.includes('timeout-error')) {
        return {
          promise: Promise.reject(new Error('Request timeout'))
        };
      }
      // 正常情况
      return {
        promise: Promise.resolve(createMockDocument()),
        onProgress: jest.fn()
      };
    })
  };
});

describe('错误代码体系测试', () => {
  test('应该正确导出所有错误代码常量', () => {
    expect(ERROR_CODES.NETWORK_ERRORS).toBeDefined();
    expect(ERROR_CODES.FORMAT_ERRORS).toBeDefined();
    expect(ERROR_CODES.RENDER_ERRORS).toBeDefined();
    expect(ERROR_CODES.GENERAL_ERRORS).toBeDefined();
    
    // 验证网络错误代码
    expect(ERROR_CODES.NETWORK_ERRORS.NETWORK_CONNECTION_FAILED).toBe(1001);
    expect(ERROR_CODES.NETWORK_ERRORS.FILE_NOT_FOUND).toBe(1004);
    
    // 验证格式错误代码
    expect(ERROR_CODES.FORMAT_ERRORS.INVALID_PDF_FORMAT).toBe(2001);
    expect(ERROR_CODES.FORMAT_ERRORS.ENCRYPTED_PDF).toBe(2005);
    
    // 验证渲染错误代码
    expect(ERROR_CODES.RENDER_ERRORS.PAGE_RENDER_FAILED).toBe(3001);
    
    // 验证通用错误代码
    expect(ERROR_CODES.GENERAL_ERRORS.UNKNOWN_ERROR).toBe(9001);
    expect(ERROR_CODES.GENERAL_ERRORS.MEMORY_ERROR).toBe(9003);
  });

  test('应该正确返回错误描述', () => {
    expect(ERROR_CODES.getErrorDescription(1001)).toBe('网络连接失败，请检查网络连接');
    expect(ERROR_CODES.getErrorDescription(2001)).toBe('无效的PDF文件格式');
    expect(ERROR_CODES.getErrorDescription(3001)).toBe('页面渲染失败');
    expect(ERROR_CODES.getErrorDescription(9001)).toBe('发生未知错误');
    expect(ERROR_CODES.getErrorDescription(9999)).toBe('未知错误代码: 9999');
  });

  test('应该正确判断错误类型', () => {
    expect(ERROR_CODES.isNetworkError(1001)).toBe(true);
    expect(ERROR_CODES.isNetworkError(2001)).toBe(false);
    
    expect(ERROR_CODES.isFormatError(2001)).toBe(true);
    expect(ERROR_CODES.isFormatError(1001)).toBe(false);
    
    expect(ERROR_CODES.isRenderError(3001)).toBe(true);
    expect(ERROR_CODES.isRenderError(2001)).toBe(false);
    
    expect(ERROR_CODES.isGeneralError(9001)).toBe(true);
    expect(ERROR_CODES.isGeneralError(3001)).toBe(false);
  });
});

describe('PDFManager 错误处理测试', () => {
  let pdfManager;
  let mockEventBus;
  let mockLogger;

  beforeEach(() => {
    mockEventBus = new EventBus();
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    pdfManager = new PDFManager(mockEventBus);
    jest.clearAllMocks();
  });

  describe('网络错误处理', () => {
    test('应该正确处理网络连接错误', async () => {
      await pdfManager.initialize();
      
      const fileData = { filename: 'test.pdf', url: 'https://example.com/network-error.pdf' };
      
      await expect(pdfManager.loadPDF(fileData)).rejects.toThrow();
      
      // 验证错误事件被触发且包含正确的错误代码
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          code: ERROR_CODES.NETWORK_ERRORS.NETWORK_CONNECTION_FAILED,
          type: 'NETWORK_ERROR'
        }),
        expect.any(Object)
      );
    });

    test('应该正确处理文件未找到错误(404)', async () => {
      await pdfManager.initialize();
      
      const fileData = { filename: 'test.pdf', url: 'https://example.com/not-found.pdf' };
      
      await expect(pdfManager.loadPDF(fileData)).rejects.toThrow();
      
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          code: ERROR_CODES.NETWORK_ERRORS.FILE_NOT_FOUND,
          type: 'NETWORK_ERROR'
        }),
        expect.any(Object)
      );
    });

    test('应该正确处理服务器错误(500)', async () => {
      await pdfManager.initialize();
      
      const fileData = { filename: 'test.pdf', url: 'https://example.com/server-error.pdf' };
      
      await expect(pdfManager.loadPDF(fileData)).rejects.toThrow();
      
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          code: ERROR_CODES.NETWORK_ERRORS.SERVER_ERROR,
          type: 'NETWORK_ERROR'
        }),
        expect.any(Object)
      );
    });

    test('应该正确处理请求超时错误', async () => {
      await pdfManager.initialize();
      
      const fileData = { filename: 'test.pdf', url: 'https://example.com/timeout-error.pdf' };
      
      await expect(pdfManager.loadPDF(fileData)).rejects.toThrow();
      
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          code: ERROR_CODES.NETWORK_ERRORS.REQUEST_TIMEOUT,
          type: 'NETWORK_ERROR'
        }),
        expect.any(Object)
      );
    });
  });

  describe('格式错误处理', () => {
    test('应该正确处理无效PDF格式错误', async () => {
      await pdfManager.initialize();
      
      const fileData = { filename: 'test.pdf', url: 'https://example.com/invalid-format.pdf' };
      
      await expect(pdfManager.loadPDF(fileData)).rejects.toThrow();
      
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          code: ERROR_CODES.FORMAT_ERRORS.INVALID_PDF_FORMAT,
          type: 'FORMAT_ERROR'
        }),
        expect.any(Object)
      );
    });

    test('应该正确处理加密PDF错误', async () => {
      await pdfManager.initialize();
      
      const fileData = { filename: 'test.pdf', url: 'https://example.com/encrypted.pdf' };
      
      await expect(pdfManager.loadPDF(fileData)).rejects.toThrow();
      
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          code: ERROR_CODES.FORMAT_ERRORS.ENCRYPTED_PDF,
          type: 'PARSE_ERROR'
        }),
        expect.any(Object)
      );
    });
  });

  describe('通用错误处理', () => {
    test('应该正确处理内存不足错误', async () => {
      await pdfManager.initialize();
      
      const fileData = { filename: 'test.pdf', url: 'https://example.com/memory-error.pdf' };
      
      await expect(pdfManager.loadPDF(fileData)).rejects.toThrow();
      
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          code: ERROR_CODES.GENERAL_ERRORS.MEMORY_ERROR,
          type: 'MEMORY_ERROR'
        }),
        expect.any(Object)
      );
    });

    test('应该正确处理权限错误', async () => {
      await pdfManager.initialize();
      
      const fileData = { filename: 'test.pdf', url: 'https://example.com/permission-error.pdf' };
      
      await expect(pdfManager.loadPDF(fileData)).rejects.toThrow();
      
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          code: ERROR_CODES.GENERAL_ERRORS.PERMISSION_ERROR,
          type: 'PERMISSION_ERROR'
        }),
        expect.any(Object)
      );
    });
  });

  describe('错误重试性判断', () => {
    test('网络错误应该是可重试的', async () => {
      await pdfManager.initialize();
      
      const fileData = { filename: 'test.pdf', url: 'https://example.com/network-error.pdf' };
      
      await expect(pdfManager.loadPDF(fileData)).rejects.toThrow();
      
      const emittedError = mockEventBus.emit.mock.calls[0][1];
      expect(emittedError.retryable).toBe(true);
    });

    test('格式错误应该是不可重试的', async () => {
      await pdfManager.initialize();
      
      const fileData = { filename: 'test.pdf', url: 'https://example.com/invalid-format.pdf' };
      
      await expect(pdfManager.loadPDF(fileData)).rejects.toThrow();
      
      const emittedError = mockEventBus.emit.mock.calls[0][1];
      expect(emittedError.retryable).toBe(false);
    });

    test('未知错误应该是可重试的', async () => {
      // 模拟未知错误
      const pdfjsLib = await import('pdfjs-dist/build/pdf');
      pdfjsLib.getDocument.mockImplementationOnce(() => ({
        promise: Promise.reject(new Error('Some unknown error'))
      }));
      
      await pdfManager.initialize();
      
      const fileData = { filename: 'test.pdf', url: 'https://example.com/test.pdf' };
      
      await expect(pdfManager.loadPDF(fileData)).rejects.toThrow();
      
      const emittedError = mockEventBus.emit.mock.calls[0][1];
      expect(emittedError.retryable).toBe(true);
    });
  });

  describe('错误信息完整性', () => {
    test('错误对象应该包含完整的错误信息', async () => {
      await pdfManager.initialize();
      
      const fileData = { filename: 'test.pdf', url: 'https://example.com/network-error.pdf' };
      
      await expect(pdfManager.loadPDF(fileData)).rejects.toThrow();
      
      const emittedError = mockEventBus.emit.mock.calls[0][1];
      expect(emittedError).toHaveProperty('error');
      expect(emittedError).toHaveProperty('code');
      expect(emittedError).toHaveProperty('type');
      expect(emittedError).toHaveProperty('userMessage');
      expect(emittedError).toHaveProperty('file');
      expect(emittedError).toHaveProperty('timestamp');
      expect(emittedError).toHaveProperty('retryable');
    });
  });
});