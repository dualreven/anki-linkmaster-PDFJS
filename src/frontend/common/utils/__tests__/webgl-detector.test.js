/**
 * @file WebGL检测器测试用例
 * @description 测试WebGL检测和禁用功能
 */

import { WebGLDetector, WebGLStateManager } from '../webgl-detector.js';

// Mock HTMLCanvasElement
class MockCanvas {
  getContext(contextType) {
    if (contextType === 'webgl' || contextType === 'experimental-webgl') {
      return {
        getParameter: (param) => {
          if (param === 7936) return 'WebGL 1.0'; // VERSION
          if (param === 7937) return 'Mock WebGL Renderer'; // RENDERER
          if (param === 7938) return 'Mock Vendor'; // VENDOR
          return null;
        }
      };
    }
    if (contextType === 'webgl2') {
      return {
        getParameter: (param) => {
          if (param === 7936) return 'WebGL 2.0'; // VERSION
          if (param === 7937) return 'Mock WebGL2 Renderer'; // RENDERER
          if (param === 7938) return 'Mock Vendor'; // VENDOR
          return null;
        }
      };
    }
    return null;
  }
}

// Mock navigator
const mockNavigator = {
  webdriver: false,
  userAgent: 'Mozilla/5.0 Test Browser'
};

// Mock window
const mockWindow = {
  addEventListener: jest.fn(),
  WEBGL_DISABLED: undefined
};

// Mock document
const mockDocument = {
  createElement: jest.fn().mockReturnValue(new MockCanvas())
};

// Mock global objects
global.navigator = mockNavigator;
global.window = mockWindow;
global.document = mockDocument;

describe('WebGLDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigator.webdriver = false;
    mockNavigator.userAgent = 'Mozilla/5.0 Test Browser';
    mockWindow.WEBGL_DISABLED = undefined;
  });

  describe('detectWebGLSupport', () => {
    test('应该检测WebGL支持状态', () => {
      const result = WebGLDetector.detectWebGLSupport();
      
      expect(result).toEqual({
        supported: true,
        version: 'WebGL 1.0',
        renderer: 'Mock WebGL Renderer',
        vendor: 'Mock Vendor',
        hasWebGL1: true,
        hasWebGL2: false,
        disabledByConfig: false,
        error: null
      });
    });

    test('应该检测WebGL2支持状态', () => {
      // Mock WebGL2支持
      const originalGetContext = MockCanvas.prototype.getContext;
      MockCanvas.prototype.getContext = function(contextType) {
        if (contextType === 'webgl2') {
          return {
            getParameter: (param) => {
              if (param === 7936) return 'WebGL 2.0';
              if (param === 7937) return 'Mock WebGL2 Renderer';
              if (param === 7938) return 'Mock Vendor';
              return null;
            }
          };
        }
        return originalGetContext.call(this, contextType);
      };

      const result = WebGLDetector.detectWebGLSupport();
      
      expect(result.hasWebGL2).toBe(true);
      expect(result.version).toBe('WebGL 2.0');
      
      // 恢复mock
      MockCanvas.prototype.getContext = originalGetContext;
    });

    test('应该处理WebGL不支持的情况', () => {
      // Mock WebGL不支持
      const originalGetContext = MockCanvas.prototype.getContext;
      MockCanvas.prototype.getContext = () => null;

      const result = WebGLDetector.detectWebGLSupport();
      
      expect(result.supported).toBe(false);
      expect(result.hasWebGL1).toBe(false);
      expect(result.hasWebGL2).toBe(false);
      
      // 恢复mock
      MockCanvas.prototype.getContext = originalGetContext;
    });
  });

  describe('isWebGLDisabledByConfig', () => {
    test('应该检测自动化测试环境', () => {
      mockNavigator.webdriver = true;
      expect(WebGLDetector.isWebGLDisabledByConfig()).toBe(true);
    });

    test('应该检测QtWebEngine环境', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 QtWebEngine/5.15.0';
      expect(WebGLDetector.isWebGLDisabledByConfig()).toBe(true);
    });

    test('应该检测正常浏览器环境', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 Chrome/91.0.4472.124';
      expect(WebGLDetector.isWebGLDisabledByConfig()).toBe(false);
    });
  });

  describe('disableWebGL', () => {
    test('应该成功禁用WebGL', () => {
      const result = WebGLDetector.disableWebGL();
      expect(result).toBe(true);
      expect(mockWindow.WEBGL_DISABLED).toBe(true);
    });

    test('应该处理禁用失败的情况', () => {
      // Mock 错误情况
      const originalPrototype = Object.getPrototypeOf(HTMLCanvasElement.prototype);
      Object.setPrototypeOf(HTMLCanvasElement.prototype, null);

      const result = WebGLDetector.disableWebGL();
      expect(result).toBe(false);

      // 恢复原型
      Object.setPrototypeOf(HTMLCanvasElement.prototype, originalPrototype);
    });
  });
});

describe('WebGLStateManager', () => {
  beforeEach(() => {
    WebGLStateManager.initialize();
  });

  test('应该正确初始化WebGL状态', () => {
    const state = WebGLStateManager.getWebGLState();
    expect(state.enabled).toBe(true);
    expect(state.detection).toBeDefined();
  });

  test('应该禁用WebGL', () => {
    WebGLStateManager.disableWebGL();
    const state = WebGLStateManager.getWebGLState();
    expect(state.enabled).toBe(false);
  });

  test('应该检查Canvas回退条件', () => {
    // 正常情况不应该回退
    expect(WebGLStateManager.shouldUseCanvasFallback()).toBe(false);

    // 模拟禁用情况应该回退
    mockNavigator.webdriver = true;
    WebGLStateManager.initialize();
    expect(WebGLStateManager.shouldUseCanvasFallback()).toBe(true);
  });
});

// Mock PDF.js库测试
describe('PDF.js WebGL配置', () => {
  test('应该检查PDF.js WebGL使用情况', () => {
    const mockPDFjsLib = {
      version: '3.4.120',
      GlobalWorkerOptions: {
        enableWebGL: true,
        disableWebGL: false
      }
    };

    const result = WebGLDetector.checkPDFJSWebGLUsage(mockPDFjsLib);
    expect(result).toBe(true);
  });

  test('应该配置PDF.js使用Canvas渲染', () => {
    const mockPDFjsLib = {
      GlobalWorkerOptions: {
        enableWebGL: true,
        disableWebGL: false
      },
      setPreferences: jest.fn()
    };

    const result = WebGLDetector.configurePDFJSForCanvas(mockPDFjsLib);
    expect(result).toBe(true);
    expect(mockPDFjsLib.GlobalWorkerOptions.enableWebGL).toBe(false);
    expect(mockPDFjsLib.GlobalWorkerOptions.disableWebGL).toBe(true);
    expect(mockPDFjsLib.setPreferences).toHaveBeenCalledWith({
      'renderer': 'canvas',
      'enableWebGL': false
    });
  });
});