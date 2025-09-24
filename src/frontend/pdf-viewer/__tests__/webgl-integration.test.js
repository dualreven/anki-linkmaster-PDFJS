/**
 * @file WebGL集成测试用例
 * @description 测试PDFManager的WebGL集成功能
 */

import { PDFManager } from '../pdf-manager.js';
import { WebGLStateManager } from '../../common/utils/webgl-detector.js';
import Logger from '../../common/utils/logger.js';
import { PDF_VIEWER_EVENTS } from '../../common/event/pdf-viewer-constants.js';

// Mock Logger
jest.mock('../../common/utils/logger.js', () => {
  return jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }));
});

// Mock WebGLStateManager
jest.mock('../../common/utils/webgl-detector.js', () => ({
  WebGLStateManager: {
    getWebGLState: jest.fn(),
    shouldUseCanvasFallback: jest.fn(),
    initialize: jest.fn()
  }
}));

// Mock PDF.js
jest.mock('pdfjs-dist/build/pdf', () => {
  const mockPDFjsLib = {
    version: '3.4.120',
    GlobalWorkerOptions: {
      workerSrc: '',
      disableWebGL: false,
      enableWebGL: true
    },
    setPreferences: jest.fn(),
    getDocument: jest.fn().mockReturnValue({
      promise: Promise.resolve({
        numPages: 10,
        getPage: jest.fn().mockResolvedValue({
          getViewport: jest.fn().mockReturnValue({ width: 800, height: 600 })
        }),
        destroy: jest.fn().mockResolvedValue(undefined)
      }),
      onProgress: jest.fn()
    })
  };
  return mockPDFjsLib;
});

// Mock event bus
const mockEventBus = {
  on: jest.fn(),
  emit: jest.fn(),
  destroy: jest.fn()
};

describe('PDFManager WebGL集成测试', () => {
  let pdfManager;

  beforeEach(() => {
    jest.clearAllMocks();
    pdfManager = new PDFManager(mockEventBus);
  });

  describe('WebGL检测和配置', () => {
    test('应该检测WebGL状态并正常初始化', async () => {
      // Mock WebGL正常支持
      WebGLStateManager.getWebGLState.mockReturnValue({
        enabled: true,
        detection: { supported: true, disabledByConfig: false }
      });
      WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(false);

      await pdfManager.initialize();

      expect(WebGLStateManager.getWebGLState).toHaveBeenCalled();
      expect(WebGLStateManager.shouldUseCanvasFallback).toHaveBeenCalled();
      // 不应该调用Canvas配置
      expect(pdfManager._configurePDFJSForCanvas).toBeUndefined();
    });

    test('应该检测WebGL禁用并配置Canvas回退', async () => {
      // Mock WebGL被禁用
      WebGLStateManager.getWebGLState.mockReturnValue({
        enabled: false,
        detection: { supported: true, disabledByConfig: true }
      });
      WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(true);

      await pdfManager.initialize();

      expect(WebGLStateManager.getWebGLState).toHaveBeenCalled();
      expect(WebGLStateManager.shouldUseCanvasFallback).toHaveBeenCalled();
      // 应该记录Canvas配置信息
      expect(Logger.mock.results[0].value.info).toHaveBeenCalledWith(
        expect.stringContaining('PDF.js configured for Canvas rendering')
      );
    });

    test('应该处理QtWebEngine环境的WebGL禁用', async () => {
      // Mock QtWebEngine环境
      WebGLStateManager.getWebGLState.mockReturnValue({
        enabled: false,
        detection: { 
          supported: true, 
          disabledByConfig: true,
          userAgent: 'QtWebEngine/5.15.0'
        }
      });
      WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(true);

      await pdfManager.initialize();

      expect(WebGLStateManager.shouldUseCanvasFallback).toHaveBeenCalled();
      // 应该配置PDF.js使用Canvas
      const pdfjsLib = await import('pdfjs-dist/build/pdf');
      expect(pdfjsLib.GlobalWorkerOptions.disableWebGL).toBe(true);
      expect(pdfjsLib.GlobalWorkerOptions.enableWebGL).toBe(false);
    });
  });

  describe('PDF.js配置验证', () => {
    test('应该正确配置PDF.js禁用WebGL', async () => {
      // 强制调用配置方法
      WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(true);
      
      await pdfManager.initialize();

      const pdfjsLib = await import('pdfjs-dist/build/pdf');
      
      // 验证PDF.js配置
      expect(pdfjsLib.GlobalWorkerOptions.disableWebGL).toBe(true);
      expect(pdfjsLib.GlobalWorkerOptions.enableWebGL).toBe(false);
      
      if (pdfjsLib.setPreferences) {
        expect(pdfjsLib.setPreferences).toHaveBeenCalledWith({
          'renderer': 'canvas',
          'enableWebGL': false
        });
      }
    });

    test('应该处理PDF.js配置错误', async () => {
      // Mock PDF.js配置错误
      const pdfjsLib = await import('pdfjs-dist/build/pdf');
      pdfjsLib.setPreferences = jest.fn().mockImplementation(() => {
        throw new Error('Configuration error');
      });

      WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(true);

      await expect(pdfManager.initialize()).resolves.not.toThrow();
      
      // 应该记录警告但继续执行
      expect(Logger.mock.results[0].value.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to configure PDF.js for Canvas')
      );
    });
  });

  describe('错误处理', () => {
    test('应该处理WebGL检测失败', async () => {
      // Mock WebGL检测失败
      WebGLStateManager.getWebGLState.mockImplementation(() => {
        throw new Error('WebGL detection failed');
      });

      await expect(pdfManager.initialize()).rejects.toThrow('WebGL detection failed');
    });

    test('应该处理PDF.js加载失败', async () => {
      // Mock PDF.js加载失败
      jest.resetModules();
      jest.doMock('pdfjs-dist/build/pdf', () => {
        throw new Error('PDF.js加载失败');
      });

      const { PDFManager } = require('../pdf-manager.js');
      const manager = new PDFManager(mockEventBus);

      await expect(manager.initialize()).rejects.toThrow('PDF.js加载失败');
    });
  });

  describe('性能测试', () => {
    test('应该测量WebGL检测性能', async () => {
      const startTime = Date.now();
      
      WebGLStateManager.getWebGLState.mockReturnValue({
        enabled: true,
        detection: { supported: true, disabledByConfig: false }
      });
      WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(false);

      await pdfManager.initialize();
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // WebGL检测应该在合理时间内完成
      expect(duration).toBeLessThan(1000); // 1秒内完成
    });

    test('应该测量Canvas配置性能', async () => {
      const startTime = Date.now();
      
      WebGLStateManager.getWebGLState.mockReturnValue({
        enabled: false,
        detection: { supported: true, disabledByConfig: true }
      });
      WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(true);

      await pdfManager.initialize();
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Canvas配置应该在合理时间内完成
      expect(duration).toBeLessThan(1000); // 1秒内完成
    });
  });
});

// 模拟QtWebEngine环境测试
describe('QtWebEngine环境模拟测试', () => {
  let originalNavigator;

  beforeAll(() => {
    // 保存原始navigator
    originalNavigator = global.navigator;
  });

  afterAll(() => {
    // 恢复原始navigator
    global.navigator = originalNavigator;
  });

  test('应该检测QtWebEngine用户代理', async () => {
    // 模拟QtWebEngine环境
    global.navigator = {
      ...originalNavigator,
      userAgent: 'Mozilla/5.0 QtWebEngine/5.15.0'
    };

    WebGLStateManager.getWebGLState.mockReturnValue({
      enabled: false,
      detection: { 
        supported: true, 
        disabledByConfig: true,
        userAgent: 'QtWebEngine/5.15.0'
      }
    });
    WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(true);

    await pdfManager.initialize();

    // 应该配置Canvas回退
    const pdfjsLib = await import('pdfjs-dist/build/pdf');
    expect(pdfjsLib.GlobalWorkerOptions.disableWebGL).toBe(true);
  });
});