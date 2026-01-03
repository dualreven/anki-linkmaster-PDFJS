/**
 * @file WebGL集成测试用例
 * @description 测试PDFManager的WebGL集成功能
 */

import { PDFManager } from "../pdf-manager.js";
import { WebGLStateManager } from "../../common/utils/webgl-detector.js";
// 移除未使用的 PDF_VIEWER_EVENTS 导入

// Mock Logger
jest.mock("../../common/utils/logger.js", () => {
  const logger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    event: jest.fn(),
    setLogLevel: jest.fn()
  };
  globalThis.__WEBGL_TEST_LOGGER__ = logger;
  const LoggerFn = jest.fn().mockImplementation(() => logger);
  return {
    __esModule: true,
    default: LoggerFn,
    getLogger: jest.fn(() => logger),
    Logger: LoggerFn,
    LogLevel: { DEBUG: "DEBUG", INFO: "INFO", WARN: "WARN", ERROR: "ERROR" },
    setModuleLogLevel: jest.fn(),
    setToastPolicy: jest.fn(),
    getToastPolicy: jest.fn(() => ({ defaultEnabled: false, perModule: {} }))
  };
});

// Mock WebGLStateManager
jest.mock("../../common/utils/webgl-detector.js", () => ({
  WebGLStateManager: {
    getWebGLState: jest.fn(),
    shouldUseCanvasFallback: jest.fn(),
    initialize: jest.fn()
  }
}));

// Mock PDF.js
jest.mock("pdfjs-dist/build/pdf", () => {
  const mockPDFjsLib = {
    version: "3.4.120",
    GlobalWorkerOptions: {
      workerSrc: "",
      disableWebGL: false,
      enableWebGL: true
    },
    setPreferences: jest.fn().mockImplementation(() => {
      if (globalThis.__WEBGL_FORCE_PDFJS_PREF_ERROR__ === true) {
        throw new Error("Configuration error");
      }
    }),
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

describe("PDFManager WebGL集成测试", () => {
  let pdfManager;

  beforeEach(() => {
    jest.clearAllMocks();
    pdfManager = new PDFManager(mockEventBus);
  });

  describe("WebGL检测和配置", () => {
    test("应该检测WebGL状态并正常初始化", async () => {
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

    test("应该检测WebGL禁用并配置Canvas回退", async () => {
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
      expect(globalThis.__WEBGL_TEST_LOGGER__.info).toHaveBeenCalledWith(
        expect.stringContaining("PDF.js configured for Canvas rendering")
      );
    });

    test("应该处理QtWebEngine环境的WebGL禁用", async () => {
      // Mock QtWebEngine环境
      WebGLStateManager.getWebGLState.mockReturnValue({
        enabled: false,
        detection: {
          supported: true,
          disabledByConfig: true,
          userAgent: "QtWebEngine/5.15.0"
        }
      });
      WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(true);

      await pdfManager.initialize();

      expect(WebGLStateManager.shouldUseCanvasFallback).toHaveBeenCalled();
      // 应该配置PDF.js使用Canvas
      const pdfjsLib = await import("pdfjs-dist/build/pdf");
      expect(pdfjsLib.GlobalWorkerOptions.disableWebGL).toBe(true);
      expect(pdfjsLib.GlobalWorkerOptions.enableWebGL).toBe(false);
    });
  });

  describe("PDF.js配置验证", () => {
    test("应该正确配置PDF.js禁用WebGL", async () => {
      // 强制调用配置方法
      WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(true);

      await pdfManager.initialize();

      const pdfjsLib = await import("pdfjs-dist/build/pdf");

      // 验证PDF.js配置
      expect(pdfjsLib.GlobalWorkerOptions.disableWebGL).toBe(true);
      expect(pdfjsLib.GlobalWorkerOptions.enableWebGL).toBe(false);

      if (pdfjsLib.setPreferences) {
        expect(pdfjsLib.setPreferences).toHaveBeenCalledWith({
          "renderer": "canvas",
          "enableWebGL": false
        });
      }
    });

    test("应该处理PDF.js配置错误", async () => {
      WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(true);
      globalThis.__WEBGL_FORCE_PDFJS_PREF_ERROR__ = true;

      await expect(pdfManager.initialize()).resolves.not.toThrow();

      // 应该记录警告但继续执行
      expect(globalThis.__WEBGL_TEST_LOGGER__.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to configure PDF.js for Canvas")
      );

      globalThis.__WEBGL_FORCE_PDFJS_PREF_ERROR__ = false;
    });
  });

  describe("错误处理", () => {
    test("应该处理WebGL检测失败", async () => {
      // Mock WebGL检测失败
      WebGLStateManager.getWebGLState.mockImplementation(() => {
        throw new Error("WebGL detection failed");
      });

      await expect(pdfManager.initialize()).rejects.toThrow("WebGL detection failed");
    });

    // 注意：PDF.js import 失败属于构建/依赖层问题，且涉及 jest.resetModules/doMock 容易污染同文件后续用例。
    // 此处不在本套 WebGL 集成用例内覆盖，避免引入不稳定性。
  });

  describe("性能测试", () => {
    test("应该测量WebGL检测性能", async () => {
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

    test("应该测量Canvas配置性能", async () => {
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
describe("QtWebEngine环境模拟测试", () => {
  let originalNavigator;

  beforeAll(() => {
    // 保存原始navigator
    originalNavigator = global.navigator;
  });

  afterAll(() => {
    // 恢复原始navigator
    global.navigator = originalNavigator;
  });

  test("应该检测QtWebEngine用户代理", async () => {
    // 模拟QtWebEngine环境
    global.navigator = {
      ...originalNavigator,
      userAgent: "Mozilla/5.0 QtWebEngine/5.15.0"
    };

    WebGLStateManager.getWebGLState.mockReturnValue({
      enabled: false,
      detection: {
        supported: true,
        disabledByConfig: true,
        userAgent: "QtWebEngine/5.15.0"
      }
    });
    WebGLStateManager.shouldUseCanvasFallback.mockReturnValue(true);

    const manager = new PDFManager(mockEventBus);
    await manager.initialize();

    // 应该配置Canvas回退
    const pdfjsLib = await import("pdfjs-dist/build/pdf");
    expect(pdfjsLib.GlobalWorkerOptions.disableWebGL).toBe(true);
  });
});
