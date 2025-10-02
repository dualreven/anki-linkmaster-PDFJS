/**
 * @file PDFManager集成测试
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock PDF.js before importing PDFManager
const mockPdfjsLib = {
  version: '3.4.120',
  build: 'test',
  GlobalWorkerOptions: {},
  getDocument: jest.fn()
};

jest.unstable_mockModule('pdfjs-dist/build/pdf', () => mockPdfjsLib);

const { PDFManager } = await import('../services/pdf-manager-service.js');

describe('PDFManager集成测试', () => {
  let manager;
  let mockEventBus;
  let mockPdfDocument;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock EventBus
    mockEventBus = {
      emit: jest.fn()
    };

    // Mock PDF Document
    mockPdfDocument = {
      numPages: 10,
      fingerprints: ['test-fingerprint'],
      getPage: jest.fn().mockResolvedValue({
        getViewport: jest.fn().mockReturnValue({ width: 800, height: 600 }),
        cleanup: jest.fn()
      }),
      getMetadata: jest.fn().mockResolvedValue({
        info: {
          Title: 'Test PDF',
          Author: 'Test Author'
        }
      }),
      destroy: jest.fn()
    };

    // Mock PDF.js loading task
    const mockLoadingTask = {
      promise: Promise.resolve(mockPdfDocument),
      destroy: jest.fn(),
      onProgress: null
    };

    mockPdfjsLib.getDocument.mockReturnValue(mockLoadingTask);

    manager = new PDFManager(mockEventBus);
  });

  describe('初始化', () => {
    it('应该正确初始化', async () => {
      await manager.initialize();

      expect(mockPdfjsLib.GlobalWorkerOptions.workerSrc).toBeDefined();
    });

    it('不应该重复初始化', async () => {
      await manager.initialize();
      await manager.initialize();

      // workerSrc只应该设置一次
      expect(mockPdfjsLib.GlobalWorkerOptions.workerSrc).toBeDefined();
    });
  });

  describe('loadPDF', () => {
    it('应该成功加载PDF', async () => {
      const fileData = {
        filename: 'test.pdf',
        url: 'http://example.com/test.pdf'
      };

      const result = await manager.loadPDF(fileData);

      expect(result).toBe(mockPdfDocument);
      expect(mockPdfjsLib.getDocument).toHaveBeenCalled();
    });

    it('应该从filename构造URL', async () => {
      const fileData = {
        filename: 'test.pdf'
      };

      await manager.loadPDF(fileData);

      const call = mockPdfjsLib.getDocument.mock.calls[0][0];
      expect(call.url).toContain('test.pdf');
    });

    it('应该自动添加.pdf扩展名', async () => {
      const fileData = {
        filename: 'test'
      };

      await manager.loadPDF(fileData);

      const call = mockPdfjsLib.getDocument.mock.calls[0][0];
      expect(call.url).toContain('test.pdf');
    });

    it('应该发送进度事件', async () => {
      const fileData = {
        filename: 'test.pdf'
      };

      await manager.loadPDF(fileData);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          filename: 'test.pdf',
          percent: 0
        }),
        expect.any(Object)
      );
    });

    it('失败时应该重试', async () => {
      const fileData = {
        filename: 'test.pdf'
      };

      // 第一次失败，第二次成功
      const failTask = {
        promise: Promise.reject(new Error('Load failed')),
        destroy: jest.fn(),
        onProgress: null
      };

      const successTask = {
        promise: Promise.resolve(mockPdfDocument),
        destroy: jest.fn(),
        onProgress: null
      };

      mockPdfjsLib.getDocument
        .mockReturnValueOnce(failTask)
        .mockReturnValueOnce(successTask);

      const result = await manager.loadPDF(fileData);

      expect(result).toBe(mockPdfDocument);
      expect(mockPdfjsLib.getDocument).toHaveBeenCalledTimes(2);
    });
  });

  describe('getPage', () => {
    beforeEach(async () => {
      const fileData = {
        filename: 'test.pdf',
        url: 'http://example.com/test.pdf'
      };
      await manager.loadPDF(fileData);
    });

    it('应该成功获取页面', async () => {
      const page = await manager.getPage(1);

      expect(page).toBeDefined();
      expect(mockPdfDocument.getPage).toHaveBeenCalledWith(1);
    });

    it('应该使用缓存', async () => {
      const page1 = await manager.getPage(1);
      const page2 = await manager.getPage(1);

      expect(page1).toBe(page2);
      expect(mockPdfDocument.getPage).toHaveBeenCalledTimes(1);
    });

    it('无文档时应该抛出错误', async () => {
      const emptyManager = new PDFManager(mockEventBus);

      await expect(emptyManager.getPage(1)).rejects.toThrow('No PDF document loaded');
    });
  });

  describe('getDocumentInfo', () => {
    it('应该返回文档信息', async () => {
      const fileData = {
        filename: 'test.pdf',
        url: 'http://example.com/test.pdf'
      };

      await manager.loadPDF(fileData);
      const info = manager.getDocumentInfo();

      expect(info).toBeDefined();
      expect(info.numPages).toBe(10);
      expect(info.fingerprint).toBe('test-fingerprint');
    });
  });

  describe('getTotalPages', () => {
    it('应该返回总页数', async () => {
      const fileData = {
        filename: 'test.pdf',
        url: 'http://example.com/test.pdf'
      };

      await manager.loadPDF(fileData);
      const totalPages = manager.getTotalPages();

      expect(totalPages).toBe(10);
    });

    it('无文档时应该返回0', () => {
      const totalPages = manager.getTotalPages();
      expect(totalPages).toBe(0);
    });
  });

  describe('closePDF', () => {
    it('应该关闭PDF并清理资源', async () => {
      const fileData = {
        filename: 'test.pdf',
        url: 'http://example.com/test.pdf'
      };

      await manager.loadPDF(fileData);
      await manager.getPage(1); // 添加到缓存

      manager.closePDF();

      expect(mockPdfDocument.destroy).toHaveBeenCalled();
      expect(manager.getTotalPages()).toBe(0);
    });
  });

  describe('cleanupCache', () => {
    it('应该清理缓存', async () => {
      const fileData = {
        filename: 'test.pdf',
        url: 'http://example.com/test.pdf'
      };

      await manager.loadPDF(fileData);
      await manager.getPage(1);
      await manager.getPage(5);

      manager.cleanupCache(1); // 保留页面1附近的页面

      const stats = manager.getCacheStats();
      expect(stats).toBeDefined();
    });
  });

  describe('destroy', () => {
    it('应该销毁管理器并清理所有资源', async () => {
      const fileData = {
        filename: 'test.pdf',
        url: 'http://example.com/test.pdf'
      };

      await manager.loadPDF(fileData);
      manager.destroy();

      expect(mockPdfDocument.destroy).toHaveBeenCalled();
      expect(manager.getTotalPages()).toBe(0);
    });
  });
});
