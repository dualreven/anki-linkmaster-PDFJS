/**
 * @file PDFManager集成测试
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PDFManager } from '../services/pdf-manager-service.js';

// Mock PDF.js - PDFManager接受pdfjs作为参数，所以可以在测试中mock
const mockPdfjsLib = {
  version: '3.4.120',
  build: 'test',
  GlobalWorkerOptions: {},
  getDocument: jest.fn()
};

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

    // 注入mockPdfjsLib以避免动态import
    manager = new PDFManager(mockEventBus, mockPdfjsLib);
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
      // 注意：必须给rejected promise添加catch handler，否则会导致unhandled rejection
      const failPromise = Promise.reject(new Error('Load failed'));
      failPromise.catch(() => {}); // 防止unhandled rejection

      const failTask = {
        promise: failPromise,
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
      // 清除loadPDF期间的getPage调用计数（包括预加载）
      mockPdfDocument.getPage.mockClear();

      const page1 = await manager.getPage(1);

      // 等待异步预加载完成（#preloadAdjacentPages是async但没有await）
      await new Promise(resolve => setTimeout(resolve, 50));
      const initialCalls = mockPdfDocument.getPage.mock.calls.length;

      const page2 = await manager.getPage(1);

      // 再次等待，确保没有新的预加载
      await new Promise(resolve => setTimeout(resolve, 50));
      const finalCalls = mockPdfDocument.getPage.mock.calls.length;

      expect(page1).toBe(page2);
      // 第二次调用应该使用缓存，不增加调用次数
      expect(finalCalls).toBe(initialCalls);
    });

    it('无文档时应该抛出错误', async () => {
      const emptyManager = new PDFManager(mockEventBus, mockPdfjsLib);

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
