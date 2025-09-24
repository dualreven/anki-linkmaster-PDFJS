/**
 * @file PDFManager 测试文件
 * @module PDFManagerTest
 * @description 测试 PDFManager 的核心功能
 */

import { PDFManager } from '../pdf-manager.js';
import { EventBus } from '../../common/event/event-bus.js';
import { jest } from '@jest/globals';

// Mock 依赖模块
jest.mock('../../common/event/event-bus.js', () => {
  return {
    EventBus: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      emit: jest.fn(),
      destroy: jest.fn()
    }))
  };
});

jest.mock('../../common/utils/logger.js', () => {
  return jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }));
});

// Mock PDF.js
jest.mock('pdfjs-dist/build/pdf', () => {
  const mockDocument = {
    numPages: 10,
    getPage: jest.fn().mockResolvedValue({
      cleanup: jest.fn()
    }),
    destroy: jest.fn().mockResolvedValue(undefined)
  };

  return {
    GlobalWorkerOptions: {
      workerSrc: ''
    },
    getDocument: jest.fn().mockImplementation(() => ({
      promise: Promise.resolve(mockDocument)
    }))
  };
});

describe('PDFManager', () => {
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

  describe('initialize()', () => {
    test('应该成功初始化PDF管理器', async () => {
      await pdfManager.initialize();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Initializing PDF Manager...');
      expect(mockLogger.info).toHaveBeenCalledWith('PDF Manager initialized successfully');
    });

    test('初始化失败时应该抛出错误', async () => {
      // 模拟PDF.js导入失败
      jest.resetModules();
      jest.doMock('pdfjs-dist/build/pdf', () => {
        throw new Error('PDF.js加载失败');
      });

      await expect(pdfManager.initialize()).rejects.toThrow('PDF.js加载失败');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('loadPDF()', () => {
    beforeEach(async () => {
      await pdfManager.initialize();
    });

    test('应该从URL成功加载PDF', async () => {
      const fileData = { filename: 'test.pdf', url: 'https://example.com/test.pdf' };
      
      const result = await pdfManager.loadPDF(fileData);
      
      expect(result.numPages).toBe(10);
      expect(mockLogger.info).toHaveBeenCalledWith('Loading PDF document:', fileData);
      expect(mockLogger.info).toHaveBeenCalledWith('PDF document loaded successfully. Pages: 10');
    });

    test('应该从ArrayBuffer成功加载PDF', async () => {
      const fileData = { filename: 'test.pdf', arrayBuffer: new ArrayBuffer(100) };
      
      const result = await pdfManager.loadPDF(fileData);
      
      expect(result.numPages).toBe(10);
      expect(mockLogger.info).toHaveBeenCalledWith('Loading PDF document:', fileData);
    });

    test('加载失败时应该发出错误事件', async () => {
      // 模拟加载失败
      const pdfjsLib = await import('pdfjs-dist/build/pdf');
      pdfjsLib.getDocument.mockImplementationOnce(() => ({
        promise: Promise.reject(new Error('加载失败'))
      }));

      const fileData = { filename: 'test.pdf', url: 'https://example.com/test.pdf' };
      
      await expect(pdfManager.loadPDF(fileData)).rejects.toThrow('加载失败');
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ error: '加载失败' }),
        expect.any(Object)
      );
    });

    test('不支持的文件格式应该抛出错误', async () => {
      const fileData = { filename: 'test.pdf' }; // 缺少必要的字段
      
      await expect(pdfManager.loadPDF(fileData)).rejects.toThrow('Unsupported file data format');
    });
  });

  describe('getPage()', () => {
    beforeEach(async () => {
      await pdfManager.initialize();
      const fileData = { filename: 'test.pdf', url: 'https://example.com/test.pdf' };
      await pdfManager.loadPDF(fileData);
    });

    test('应该成功获取页面', async () => {
      const page = await pdfManager.getPage(1);
      
      expect(page).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith('Loading page 1');
    });

    test('应该从缓存中获取页面', async () => {
      // 第一次获取
      await pdfManager.getPage(1);
      // 第二次获取应该从缓存中
      await pdfManager.getPage(1);
      
      expect(mockLogger.debug).toHaveBeenCalledWith('Returning page 1 from cache');
    });

    test('无效的页面编号应该抛出错误', async () => {
      await expect(pdfManager.getPage(0)).rejects.toThrow('Invalid page number: 0');
      await expect(pdfManager.getPage(11)).rejects.toThrow('Invalid page number: 11');
    });

    test('没有加载文档时应该抛出错误', async () => {
      pdfManager.cleanup(); // 清理当前文档
      
      await expect(pdfManager.getPage(1)).rejects.toThrow('No PDF document loaded');
    });
  });

  describe('cleanup()', () => {
    test('应该清理所有资源', async () => {
      await pdfManager.initialize();
      const fileData = { filename: 'test.pdf', url: 'https://example.com/test.pdf' };
      await pdfManager.loadPDF(fileData);
      
      // 获取一些页面以填充缓存
      await pdfManager.getPage(1);
      await pdfManager.getPage(2);
      
      pdfManager.cleanup();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Cleaning up PDF resources');
      // 验证文档被销毁
      const pdfjsLib = await import('pdfjs-dist/build/pdf');
      expect(pdfjsLib.getDocument().promise.destroy).toHaveBeenCalled();
    });
  });

  describe('preloadPages()', () => {
    test('应该预加载指定范围的页面', async () => {
      await pdfManager.initialize();
      const fileData = { filename: 'test.pdf', url: 'https://example.com/test.pdf' };
      await pdfManager.loadPDF(fileData);
      
      await pdfManager.preloadPages(1, 3);
      
      expect(mockLogger.debug).toHaveBeenCalledWith('Preloading pages 1 to 3');
      expect(mockLogger.debug).toHaveBeenCalledWith('Preloaded 3 pages');
    });

    test('应该跳过已经缓存的页面', async () => {
      await pdfManager.initialize();
      const fileData = { filename: 'test.pdf', url: 'https://example.com/test.pdf' };
      await pdfManager.loadPDF(fileData);
      
      // 先缓存第一页
      await pdfManager.getPage(1);
      
      await pdfManager.preloadPages(1, 3);
      
      // 应该只预加载2和3页
      expect(mockLogger.debug).toHaveBeenCalledWith('Preloaded 2 pages');
    });
  });

  describe('getCacheStats()', () => {
    test('应该返回正确的缓存统计信息', async () => {
      await pdfManager.initialize();
      const fileData = { filename: 'test.pdf', url: 'https://example.com/test.pdf' };
      await pdfManager.loadPDF(fileData);
      
      // 获取一些页面
      await pdfManager.getPage(1);
      await pdfManager.getPage(2);
      
      const stats = pdfManager.getCacheStats();
      
      expect(stats.totalCached).toBe(2);
      expect(stats.cachedPages).toEqual([1, 2]);
    });
  });
});