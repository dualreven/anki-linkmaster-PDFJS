/**
 * @file PDFLoader单元测试
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PDFLoader } from '../components/pdf-loader.js';

describe('PDFLoader', () => {
  let loader;
  let mockEventBus;
  let mockPdfjsLib;
  let mockLoadingTask;

  beforeEach(() => {
    // Mock EventBus
    mockEventBus = {
      emit: jest.fn()
    };

    // Mock Loading Task
    mockLoadingTask = {
      promise: Promise.resolve({ numPages: 10 }),
      destroy: jest.fn().mockResolvedValue(undefined),
      onProgress: null
    };

    // Mock PDF.js Library
    mockPdfjsLib = {
      getDocument: jest.fn().mockReturnValue(mockLoadingTask)
    };

    loader = new PDFLoader(mockEventBus, mockPdfjsLib);
  });

  describe('构造函数', () => {
    it('应该正确初始化', () => {
      expect(loader).toBeDefined();
    });
  });

  describe('loadFromURL', () => {
    it('应该成功从URL加载PDF', async () => {
      const url = 'http://example.com/test.pdf';
      const result = await loader.loadFromURL(url);

      expect(mockPdfjsLib.getDocument).toHaveBeenCalled();
      expect(result).toEqual({ numPages: 10 });
    });

    it('应该使用正确的配置参数', async () => {
      const url = 'http://example.com/test.pdf';
      await loader.loadFromURL(url);

      const config = mockPdfjsLib.getDocument.mock.calls[0][0];
      expect(config.url).toBe(url);
      expect(config.withCredentials).toBe(false);
      expect(config.disableAutoFetch).toBe(false);
      expect(config.cMapPacked).toBe(true);
    });

    it('应该发送加载进度事件', async () => {
      const url = 'http://example.com/test.pdf';

      // 模拟进度回调
      mockPdfjsLib.getDocument.mockImplementation((config) => {
        const task = { ...mockLoadingTask };
        setTimeout(() => {
          if (task.onProgress) {
            task.onProgress({ loaded: 50, total: 100 });
          }
        }, 0);
        return task;
      });

      await loader.loadFromURL(url);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          loaded: 50,
          total: 100,
          percent: 50
        }),
        expect.any(Object)
      );
    });

    it('应该取消之前的加载任务', async () => {
      const url1 = 'http://example.com/test1.pdf';
      const url2 = 'http://example.com/test2.pdf';

      const firstTask = { ...mockLoadingTask };
      const secondTask = { ...mockLoadingTask };

      mockPdfjsLib.getDocument
        .mockReturnValueOnce(firstTask)
        .mockReturnValueOnce(secondTask);

      const promise1 = loader.loadFromURL(url1);
      const promise2 = loader.loadFromURL(url2);

      await Promise.all([promise1, promise2]);

      expect(firstTask.destroy).toHaveBeenCalled();
    });
  });

  describe('loadFromArrayBuffer', () => {
    it('应该成功从ArrayBuffer加载PDF', async () => {
      const arrayBuffer = new ArrayBuffer(100);
      const result = await loader.loadFromArrayBuffer(arrayBuffer);

      expect(mockPdfjsLib.getDocument).toHaveBeenCalled();
      expect(result).toEqual({ numPages: 10 });
    });

    it('应该使用data参数', async () => {
      const arrayBuffer = new ArrayBuffer(100);
      await loader.loadFromArrayBuffer(arrayBuffer);

      const config = mockPdfjsLib.getDocument.mock.calls[0][0];
      expect(config.data).toBe(arrayBuffer);
    });
  });

  describe('loadFromBlob', () => {
    it('应该成功从Blob加载PDF', async () => {
      const blob = new Blob(['test'], { type: 'application/pdf' });
      // Mock arrayBuffer method for older jsdom environments
      blob.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(4));

      const result = await loader.loadFromBlob(blob);

      expect(mockPdfjsLib.getDocument).toHaveBeenCalled();
      expect(result).toEqual({ numPages: 10 });
    });
  });

  describe('cancelLoading', () => {
    it('应该取消当前的加载任务', async () => {
      const url = 'http://example.com/test.pdf';

      const loadPromise = loader.loadFromURL(url);
      await loader.cancelLoading();

      expect(mockLoadingTask.destroy).toHaveBeenCalled();
    });

    it('在没有加载任务时不应抛出错误', async () => {
      await expect(loader.cancelLoading()).resolves.not.toThrow();
    });
  });

  describe('destroy', () => {
    it('应该取消当前加载并清理资源', async () => {
      const url = 'http://example.com/test.pdf';

      const loadPromise = loader.loadFromURL(url);
      loader.destroy();

      expect(mockLoadingTask.destroy).toHaveBeenCalled();
    });
  });
});
