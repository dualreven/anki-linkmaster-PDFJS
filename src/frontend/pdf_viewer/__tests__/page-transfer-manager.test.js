/**
 * @file PageTransferManager 测试文件
 * @module PageTransferManagerTest
 * @description 测试 PDF 页面传输管理器的核心功能
 */

import { PageTransferManager } from '../page-transfer-manager.js';
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

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  readyState: 1, // OPEN
  send: jest.fn(),
  close: jest.fn()
}));

describe('PageTransferManager', () => {
  let pageTransferManager;
  let mockEventBus;
  let mockWsClient;
  let mockLogger;

  beforeEach(() => {
    mockEventBus = new EventBus();
    mockWsClient = new WebSocket('ws://localhost');
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    pageTransferManager = new PageTransferManager(mockEventBus, mockWsClient);
    jest.clearAllMocks();
  });

  describe('requestPage() - 分页加载功能测试', () => {
    test('应该成功请求页面并返回数据', async () => {
      const fileId = 'test-file';
      const pageNumber = 1;
      const mockPageData = { content: 'test page data', processed: true };

      // 模拟WebSocket消息响应
      setTimeout(() => {
        const responseMessage = {
          type: 'pdf_page_response',
          request_id: expect.any(String),
          data: {
            file_id: fileId,
            page_number: pageNumber,
            page_data: mockPageData
          }
        };
        
        mockEventBus.on.mock.calls.find(call => 
          call[0] === 'websocket_message_received'
        )[1](responseMessage);
      }, 100);

      const result = await pageTransferManager.requestPage(fileId, pageNumber);
      
      expect(result).toEqual(mockPageData);
      expect(mockWsClient.send).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(`返回缓存页面: ${fileId}-${pageNumber}`);
    });

    test('应该从缓存中返回页面数据', async () => {
      const fileId = 'test-file';
      const pageNumber = 1;
      const cachedData = { content: 'cached data', processed: true };

      // 手动添加缓存
      pageTransferManager._addToCache(fileId, pageNumber, cachedData);

      const result = await pageTransferManager.requestPage(fileId, pageNumber);
      
      expect(result).toBe(cachedData);
      expect(mockWsClient.send).not.toHaveBeenCalled(); // 不应该发送WebSocket请求
    });

    test('应该支持不同的压缩类型', async () => {
      const fileId = 'test-file';
      const pageNumber = 1;
      const compression = 'gzip_base64';

      await pageTransferManager.requestPage(fileId, pageNumber, compression);
      
      const sentMessage = JSON.parse(mockWsClient.send.mock.calls[0][0]);
      expect(sentMessage.data.compression).toBe(compression);
    });
  });

  describe('preloadPages() - 预加载功能测试', () => {
    test('应该发送预加载请求', async () => {
      const fileId = 'test-file';
      const startPage = 1;
      const endPage = 3;

      await pageTransferManager.preloadPages(fileId, startPage, endPage);
      
      expect(mockWsClient.send).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(`预加载页面范围: ${fileId} ${startPage}-${endPage}`);
    });

    test('应该避免重复预加载相同的范围', async () => {
      const fileId = 'test-file';
      const startPage = 1;
      const endPage = 3;

      // 第一次预加载
      await pageTransferManager.preloadPages(fileId, startPage, endPage);
      // 第二次预加载（应该被跳过）
      await pageTransferManager.preloadPages(fileId, startPage, endPage);
      
      // 应该只发送一次请求
      expect(mockWsClient.send).toHaveBeenCalledTimes(1);
    });

    test('应该支持不同的优先级', async () => {
      const fileId = 'test-file';
      const startPage = 1;
      const endPage = 3;
      const priority = 'high';

      await pageTransferManager.preloadPages(fileId, startPage, endPage, priority);
      
      const sentMessage = JSON.parse(mockWsClient.send.mock.calls[0][0]);
      expect(sentMessage.data.priority).toBe(priority);
    });
  });

  describe('缓存管理测试', () => {
    test('应该正确添加和获取缓存', () => {
      const fileId = 'test-file';
      const pageNumber = 1;
      const pageData = { content: 'test data' };

      pageTransferManager._addToCache(fileId, pageNumber, pageData);
      const result = pageTransferManager._getFromCache(fileId, pageNumber);
      
      expect(result).toBe(pageData);
    });

    test('应该清理指定文件的缓存', () => {
      const fileId = 'test-file';
      const pageData = { content: 'test data' };

      // 添加缓存
      pageTransferManager._addToCache(fileId, 1, pageData);
      pageTransferManager._addToCache(fileId, 2, pageData);
      
      // 清理缓存
      pageTransferManager.clearCache(fileId);
      
      const result = pageTransferManager._getFromCache(fileId, 1);
      expect(result).toBeNull();
      expect(mockWsClient.send).toHaveBeenCalled(); // 应该发送清理请求到后端
    });

    test('应该保留指定的页面缓存', () => {
      const fileId = 'test-file';
      const pageData = { content: 'test data' };

      // 添加多个页面缓存
      pageTransferManager._addToCache(fileId, 1, pageData);
      pageTransferManager._addToCache(fileId, 2, pageData);
      pageTransferManager._addToCache(fileId, 3, pageData);
      
      // 清理但保留页面2
      pageTransferManager.clearCache(fileId, [2]);
      
      expect(pageTransferManager._getFromCache(fileId, 1)).toBeNull();
      expect(pageTransferManager._getFromCache(fileId, 2)).toBe(pageData);
      expect(pageTransferManager._getFromCache(fileId, 3)).toBeNull();
    });

    test('应该自动清理超出限制的缓存', () => {
      const fileId = 'test-file';
      const maxCacheSize = 20;

      // 添加超过限制的页面
      for (let i = 1; i <= maxCacheSize + 5; i++) {
        pageTransferManager._addToCache(fileId, i, { content: `page ${i}`, processedAt: Date.now() - i * 1000 });
      }

      const stats = pageTransferManager.getCacheStats();
      expect(stats.totalPages).toBeLessThanOrEqual(maxCacheSize);
    });
  });

  describe('错误处理机制测试', () => {
    test('应该处理页面请求错误', async () => {
      const fileId = 'test-file';
      const pageNumber = 1;

      // 模拟错误响应
      setTimeout(() => {
        const errorMessage = {
          type: 'pdf_page_error',
          request_id: expect.any(String),
          error: {
            retryable: true,
            message: '页面加载失败'
          }
        };
        
        mockEventBus.on.mock.calls.find(call => 
          call[0] === 'websocket_message_received'
        )[1](errorMessage);
      }, 100);

      await expect(pageTransferManager.requestPage(fileId, pageNumber))
        .rejects.toThrow('页面加载失败: 页面加载失败');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('进行第'));
    });

    test('应该处理请求超时', async () => {
      jest.useFakeTimers();
      
      const fileId = 'test-file';
      const pageNumber = 1;

      const requestPromise = pageTransferManager.requestPage(fileId, pageNumber);
      
      // 推进时间超过超时时间
      jest.advanceTimersByTime(11000);
      
      await expect(requestPromise).rejects.toThrow('页面请求超时');
      expect(mockLogger.error).toHaveBeenCalledWith('页面请求最终超时');
      
      jest.useRealTimers();
    });

    test('应该处理WebSocket未连接的情况', async () => {
      // 模拟WebSocket未连接
      mockWsClient.readyState = 3; // CLOSED

      await expect(pageTransferManager.requestPage('test-file', 1))
        .rejects.toThrow('WebSocket连接不可用');
      
      expect(mockLogger.warn).toHaveBeenCalledWith('WebSocket未连接，无法发送消息');
    });
  });

  describe('性能测试', () => {
    test('应该测量页面请求的响应时间', async () => {
      const fileId = 'test-file';
      const pageNumber = 1;
      const mockPageData = { content: 'test data' };

      const startTime = performance.now();
      
      // 模拟快速响应
      setTimeout(() => {
        const responseMessage = {
          type: 'pdf_page_response',
          request_id: expect.any(String),
          data: {
            file_id: fileId,
            page_number: pageNumber,
            page_data: mockPageData
          }
        };
        
        mockEventBus.on.mock.calls.find(call => 
          call[0] === 'websocket_message_received'
        )[1](responseMessage);
      }, 50);

      await pageTransferManager.requestPage(fileId, pageNumber);
      const endTime = performance.now();
      
      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(1000); // 应该在1秒内完成
    });

    test('应该测试缓存命中的性能优势', async () => {
      const fileId = 'test-file';
      const pageNumber = 1;
      const pageData = { content: 'cached data' };

      // 第一次请求（缓存未命中）
      const firstStart = performance.now();
      pageTransferManager._addToCache(fileId, pageNumber, pageData);
      const firstResult = await pageTransferManager.requestPage(fileId, pageNumber);
      const firstTime = performance.now() - firstStart;

      // 第二次请求（缓存命中）
      const secondStart = performance.now();
      const secondResult = await pageTransferManager.requestPage(fileId, pageNumber);
      const secondTime = performance.now() - secondStart;

      expect(firstResult).toBe(secondResult);
      expect(secondTime).toBeLessThan(firstTime / 10); // 缓存命中应该快很多
    });
  });

  describe('边界情况测试', () => {
    test('应该处理无效的文件ID', async () => {
      await expect(pageTransferManager.requestPage('', 1))
        .rejects.toThrow();
      
      await expect(pageTransferManager.requestPage(null, 1))
        .rejects.toThrow();
    });

    test('应该处理无效的页面编号', async () => {
      await expect(pageTransferManager.requestPage('test-file', 0))
        .rejects.toThrow();
      
      await expect(pageTransferManager.requestPage('test-file', -1))
        .rejects.toThrow();
    });

    test('应该处理超大页面范围的预加载', async () => {
      const fileId = 'test-file';
      
      // 测试超大范围预加载
      await pageTransferManager.preloadPages(fileId, 1, 1000);
      
      expect(mockWsClient.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWsClient.send.mock.calls[0][0]);
      expect(sentMessage.data.end_page).toBe(1000);
    });

    test('应该处理并发页面请求', async () => {
      const fileId = 'test-file';
      const requests = [];

      // 发起多个并发请求
      for (let i = 1; i <= 5; i++) {
        requests.push(pageTransferManager.requestPage(fileId, i));
      }

      // 模拟所有响应
      setTimeout(() => {
        for (let i = 1; i <= 5; i++) {
          const responseMessage = {
            type: 'pdf_page_response',
            request_id: expect.any(String),
            data: {
              file_id: fileId,
              page_number: i,
              page_data: { content: `page ${i}` }
            }
          };
          
          mockEventBus.on.mock.calls.find(call => 
            call[0] === 'websocket_message_received'
          )[1](responseMessage);
        }
      }, 100);

      const results = await Promise.all(requests);
      expect(results).toHaveLength(5);
      expect(results[0].content).toBe('page 1');
    });
  });

  describe('getCacheStats() - 缓存统计测试', () => {
    test('应该返回正确的缓存统计信息', () => {
      const fileId1 = 'file1';
      const fileId2 = 'file2';

      // 添加多个文件的缓存
      pageTransferManager._addToCache(fileId1, 1, { content: 'page1' });
      pageTransferManager._addToCache(fileId1, 2, { content: 'page2' });
      pageTransferManager._addToCache(fileId2, 1, { content: 'page1' });

      const stats = pageTransferManager.getCacheStats();
      
      expect(stats.totalFiles).toBe(2);
      expect(stats.totalPages).toBe(3);
      expect(stats.fileStats[fileId1].cachedPages).toBe(2);
      expect(stats.fileStats[fileId2].cachedPages).toBe(1);
    });
  });

  describe('destroy() - 销毁测试', () => {
    test('应该清理所有资源', () => {
      // 添加一些缓存和待处理请求
      pageTransferManager._addToCache('test-file', 1, { content: 'test' });
      
      pageTransferManager.destroy();
      
      const stats = pageTransferManager.getCacheStats();
      expect(stats.totalPages).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith('PageTransferManager已销毁');
    });
  });
});