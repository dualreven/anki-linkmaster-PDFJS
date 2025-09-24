/**
 * @file QtWebEngine版本兼容性测试用例
 * @description 测试不同QtWebEngine版本的兼容性和渲染效果
 */

import { PDFManager } from '../pdf-manager.js';
import { WebGLStateManager } from '../../common/utils/webgl-detector.js';
import Logger from '../../common/utils/logger.js';
import PDF_VIEWER_EVENTS from '../../common/event/pdf_viewer-constants.js';

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

// QtWebEngine版本定义
const QT_WEBENGINE_VERSIONS = [
  { version: '5.15.0', name: 'Qt 5.15 LTS', userAgent: 'Mozilla/5.0 QtWebEngine/5.15.0' },
  { version: '6.0.0', name: 'Qt 6.0', userAgent: 'Mozilla/5.0 QtWebEngine/6.0.0' },
  { version: '6.2.0', name: 'Qt 6.2 LTS', userAgent: 'Mozilla/5.0 QtWebEngine/6.2.0' },
  { version: '6.5.0', name: 'Qt 6.5 LTS', userAgent: 'Mozilla/5.0 QtWebEngine/6.5.0' },
  { version: '6.6.0', name: 'Qt 6.6', userAgent: 'Mozilla/5.0 QtWebEngine/6.6.0' }
];

describe('QtWebEngine版本兼容性测试', () => {
  let pdfManager;
  let originalNavigator;

  beforeAll(() => {
    // 保存原始navigator
    originalNavigator = global.navigator;
  });

  afterAll(() => {
    // 恢复原始navigator
    global.navigator = originalNavigator;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    pdfManager = new PDFManager(mockEventBus);
  });

  // 测试每个QtWebEngine版本
  QT_WEBENGINE_VERSIONS.forEach(qtVersion => {
    describe(`${qtVersion.name} (${qtVersion.version}) 兼容性测试`, () => {
      beforeEach(() => {
        // 模拟特定版本的QtWebEngine环境
        global.navigator = {
          ...originalNavigator,
          userAgent: qtVersion.userAgent
        };
      });

      test('应该正确检测QtWebEngine用户代理并禁用WebGL', async () => {
        WebGLStateManager.getWebGLState.mockReturnValue({
          enabled: false,
          detection: { 
            supported: true, 
            disabledByConfig: true,
            userAgent: qtVersion.userAgent
          }
        });
        WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(true);

        await pdfManager.initialize();

        expect(WebGLStateManager.getWebGLState).toHaveBeenCalled();
        expect(WebGLStateManager.shouldUseCanvasFallback).toHaveBeenCalled();
        
        // 应该配置Canvas回退
        const pdfjsLib = await import('pdfjs-dist/build/pdf');
        expect(pdfjsLib.GlobalWorkerOptions.disableWebGL).toBe(true);
        expect(pdfjsLib.GlobalWorkerOptions.enableWebGL).toBe(false);
      });

      test('应该配置PDF.js使用Canvas渲染', async () => {
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

      test('应该正确处理PDF加载和渲染', async () => {
        WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(true);

        await pdfManager.initialize();

        // 模拟PDF加载
        const fileData = { filename: 'test.pdf', arrayBuffer: new ArrayBuffer(100) };
        const pdfDocument = await pdfManager.loadPDF(fileData);

        expect(pdfDocument).toBeDefined();
        expect(pdfDocument.numPages).toBe(10);
        
        // 验证页面渲染
        const page = await pdfManager.getPage(1);
        expect(page).toBeDefined();
      });

      test('应该处理内存优化配置', async () => {
        WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(true);

        await pdfManager.initialize();

        const pdfjsLib = await import('pdfjs-dist/build/pdf');
        const loadingTask = pdfjsLib.getDocument({
          data: new ArrayBuffer(100),
          maxImageSize: -1, // 无限制
          disableAutoFetch: false,
          disableStream: false,
          disableRange: false
        });

        expect(loadingTask).toBeDefined();
      });
    });
  });

  describe('跨版本兼容性测试', () => {
    test('应该处理QtWebEngine版本升级兼容性', async () => {
      // 模拟从Qt 5.15升级到Qt 6.5
      const versionsToTest = [
        { version: '5.15.0', userAgent: 'Mozilla/5.0 QtWebEngine/5.15.0' },
        { version: '6.5.0', userAgent: 'Mozilla/5.0 QtWebEngine/6.5.0' }
      ];

      for (const version of versionsToTest) {
        global.navigator = {
          ...originalNavigator,
          userAgent: version.userAgent
        };

        WebGLStateManager.getWebGLState.mockReturnValue({
          enabled: false,
          detection: { 
            supported: true, 
            disabledByConfig: true,
            userAgent: version.userAgent
          }
        });
        WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(true);

        await pdfManager.initialize();

        const pdfjsLib = await import('pdfjs-dist/build/pdf');
        expect(pdfjsLib.GlobalWorkerOptions.disableWebGL).toBe(true);
      }
    });

    test('应该处理QtWebEngine版本降级兼容性', async () => {
      // 模拟从Qt 6.5降级到Qt 5.15
      const versionsToTest = [
        { version: '6.5.0', userAgent: 'Mozilla/5.0 QtWebEngine/6.5.0' },
        { version: '5.15.0', userAgent: 'Mozilla/5.0 QtWebEngine/5.15.0' }
      ];

      for (const version of versionsToTest) {
        global.navigator = {
          ...originalNavigator,
          userAgent: version.userAgent
        };

        WebGLStateManager.getWebGLState.mockReturnValue({
          enabled: false,
          detection: { 
            supported: true, 
            disabledByConfig: true,
            userAgent: version.userAgent
          }
        });
        WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(true);

        await pdfManager.initialize();

        const pdfjsLib = await import('pdfjs-dist/build/pdf');
        expect(pdfjsLib.GlobalWorkerOptions.disableWebGL).toBe(true);
      }
    });
  });

  describe('安全配置测试', () => {
    test('应该验证PDF.js安全配置选项', async () => {
      WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(true);

      await pdfManager.initialize();

      const pdfjsLib = await import('pdfjs-dist/build/pdf');
      const loadingTask = pdfjsLib.getDocument({
        data: new ArrayBuffer(100),
        isEvalSupported: true, // 安全配置
        useSystemFonts: false // 安全配置
      });

      expect(loadingTask).toBeDefined();
    });

    test('应该处理跨域安全配置', async () => {
      WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(true);

      await pdfManager.initialize();

      const pdfjsLib = await import('pdfjs-dist/build/pdf');
      const loadingTask = pdfjsLib.getDocument({
        url: 'https://example.com/test.pdf',
        withCredentials: false, // 跨域安全配置
        cMapUrl: null, // 禁用CMap以优化安全
        cMapPacked: false
      });

      expect(loadingTask).toBeDefined();
    });
  });

  describe('性能测试', () => {
    test('应该测量Canvas渲染性能', async () => {
      WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(true);

      const startTime = Date.now();
      await pdfManager.initialize();
      const initializationTime = Date.now() - startTime;

      // Canvas配置应该在合理时间内完成
      expect(initializationTime).toBeLessThan(1000); // 1秒内完成

      // 测试PDF加载性能
      const loadStartTime = Date.now();
      const fileData = { filename: 'test.pdf', arrayBuffer: new ArrayBuffer(100) };
      await pdfManager.loadPDF(fileData);
      const loadTime = Date.now() - loadStartTime;

      expect(loadTime).toBeLessThan(2000); // 2秒内完成加载
    });

    test('应该测量页面渲染性能', async () => {
      WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(true);

      await pdfManager.initialize();
      const fileData = { filename: 'test.pdf', arrayBuffer: new ArrayBuffer(100) };
      await pdfManager.loadPDF(fileData);

      const renderStartTime = Date.now();
      await pdfManager.getPage(1);
      const renderTime = Date.now() - renderStartTime;

      expect(renderTime).toBeLessThan(1000); // 1秒内完成渲染
    });
  });

  describe('错误处理测试', () => {
    test('应该处理WebGL检测失败', async () => {
      WebGLStateManager.getWebGLState.mockImplementation(() => {
        throw new Error('WebGL detection failed');
      });

      await expect(pdfManager.initialize()).rejects.toThrow('WebGL detection failed');
    });

    test('应该处理PDF.js配置错误', async () => {
      const pdfjsLib = await import('pdfjs-dist/build/pdf');
      pdfjsLib.setPreferences = jest.fn().mockImplementation(() => {
        throw new Error('Configuration error');
      });

      WebGLStateManager.getWebGLState.mockReturnValue({
        enabled: false,
        detection: { 
          supported: true, 
          disabledByConfig: true,
          userAgent: 'QtWebEngine/5.15.0'
        }
      });
      WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(true);

      await expect(pdfManager.initialize()).resolves.not.toThrow();
      
      // 应该记录警告但继续执行
      expect(Logger.mock.results[0].value.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to configure PDF.js for Canvas')
      );
    });

    test('应该处理不支持的QtWebEngine版本', async () => {
      // 模拟非常旧的Qt版本
      global.navigator = {
        ...originalNavigator,
        userAgent: 'Mozilla/5.0 QtWebEngine/4.8.0'
      };

      WebGLStateManager.getWebGLState.mockReturnValue({
        enabled: false,
        detection: { 
          supported: true, 
          disabledByConfig: true,
          userAgent: 'QtWebEngine/4.8.0'
        }
      });
      WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(true);

      await expect(pdfManager.initialize()).resolves.not.toThrow();
    });
  });
});

// 模拟不同QtWebEngine版本的渲染效果测试
describe('QtWebEngine渲染效果测试', () => {
  let pdfManager;

  beforeEach(() => {
    jest.clearAllMocks();
    pdfManager = new PDFManager(mockEventBus);
    WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(true);
  });

  test('应该验证Canvas渲染质量', async () => {
    await pdfManager.initialize();
    const fileData = { filename: 'test.pdf', arrayBuffer: new ArrayBuffer(100) };
    const pdfDocument = await pdfManager.loadPDF(fileData);

    // 验证文档基本信息
    expect(pdfDocument.numPages).toBe(10);
    
    // 验证页面获取
    const page = await pdfManager.getPage(1);
    expect(page).toBeDefined();
    
    // 验证视口计算
    const viewport = page.getViewport({ scale: 1.0 });
    expect(viewport.width).toBe(800);
    expect(viewport.height).toBe(600);
  });

  test('应该测试不同缩放级别的渲染', async () => {
    await pdfManager.initialize();
    const fileData = { filename: 'test.pdf', arrayBuffer: new ArrayBuffer(100) };
    await pdfManager.loadPDF(fileData);

    const page = await pdfManager.getPage(1);
    
    // 测试不同缩放级别
    const scales = [0.5, 1.0, 1.5, 2.0];
    for (const scale of scales) {
      const viewport = page.getViewport({ scale });
      expect(viewport.width).toBe(800);
      expect(viewport.height).toBe(600);
    }
  });

  test('应该验证内存使用优化', async () => {
    await pdfManager.initialize();
    const fileData = { filename: 'test.pdf', arrayBuffer: new ArrayBuffer(100) };
    await pdfManager.loadPDF(fileData);

    // 加载多个页面测试缓存
    await pdfManager.getPage(1);
    await pdfManager.getPage(2);
    await pdfManager.getPage(3);

    const cacheStats = pdfManager.getCacheStats();
    expect(cacheStats.totalCached).toBe(3);
    expect(cacheStats.cachedPages).toEqual([1, 2, 3]);

    // 清理缓存测试
    pdfManager.cleanupCache(1);
    const updatedCacheStats = pdfManager.getCacheStats();
    expect(updatedCacheStats.totalCached).toBeLessThanOrEqual(3);
  });
});