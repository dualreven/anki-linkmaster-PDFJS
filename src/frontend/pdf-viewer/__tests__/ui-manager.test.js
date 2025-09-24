/**
 * @file UIManager 测试文件
 * @module UIManagerTest
 * @description 测试 UIManager 的核心功能
 */

import { UIManager } from '../ui-manager.js';
import { EventBus } from '../../common/event/event-bus.js';
import { DOMUtils } from '../../common/utils/dom-utils.js';
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

jest.mock('../../common/utils/dom-utils.js', () => ({
  DOMUtils: {
    getElementById: jest.fn(),
    addClass: jest.fn(),
    removeClass: jest.fn(),
    createElement: jest.fn()
  }
}));

describe('UIManager', () => {
  let uiManager;
  let mockEventBus;
  let mockLogger;
  let mockContainer;
  let mockCanvas;

  beforeEach(() => {
    mockEventBus = new EventBus();
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    // 创建模拟的DOM元素
    mockContainer = {
      clientWidth: 800,
      clientHeight: 600,
      appendChild: jest.fn(),
      innerHTML: '',
      style: {}
    };

    mockCanvas = {
      id: '',
      className: '',
      style: {},
      width: 0,
      height: 0,
      getContext: jest.fn().mockReturnValue({
        scale: jest.fn()
      }),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      parentNode: {
        removeChild: jest.fn()
      }
    };

    // 设置DOMUtils mock
    DOMUtils.getElementById.mockReturnValue(mockContainer);
    DOMUtils.createElement.mockReturnValue(mockCanvas);

    uiManager = new UIManager(mockEventBus);
    jest.clearAllMocks();
  });

  describe('initialize()', () => {
    test('应该成功初始化UI管理器', async () => {
      await uiManager.initialize();
      
      expect(DOMUtils.getElementById).toHaveBeenCalledWith('pdf_viewer-container');
      expect(mockContainer.appendChild).toHaveBeenCalledWith(mockCanvas);
      expect(mockLogger.info).toHaveBeenCalledWith('UI Manager initialized successfully');
    });

    test('容器不存在时应该抛出错误', async () => {
      DOMUtils.getElementById.mockReturnValueOnce(null);
      
      await expect(uiManager.initialize()).rejects.toThrow('PDF viewer container not found');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('renderPage()', () => {
    let mockPage;
    let mockViewport;

    beforeEach(async () => {
      await uiManager.initialize();
      
      mockPage = {
        render: jest.fn().mockReturnValue({
          promise: Promise.resolve()
        })
      };

      mockViewport = {
        width: 600,
        height: 800
      };
    });

    test('应该成功渲染页面', async () => {
      await uiManager.renderPage(mockPage, mockViewport);
      
      expect(mockLogger.debug).toHaveBeenCalledWith('Rendering page with viewport: 600x800');
      expect(mockPage.render).toHaveBeenCalledWith({
        canvasContext: expect.any(Object),
        viewport: mockViewport
      });
      expect(mockLogger.debug).toHaveBeenCalledWith('Page rendered successfully');
    });

    test('渲染失败时应该抛出错误', async () => {
      mockPage.render.mockReturnValueOnce({
        promise: Promise.reject(new Error('渲染失败'))
      });

      await expect(uiManager.renderPage(mockPage, mockViewport)).rejects.toThrow('渲染失败');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to render page:');
    });
  });

  describe('事件处理', () => {
    beforeEach(async () => {
      await uiManager.initialize();
    });

    test('应该处理键盘导航事件', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      
      // 模拟事件处理
      document.dispatchEvent(event);
      
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.any(String),
        undefined,
        expect.objectContaining({ actorId: 'UIManager' })
      );
    });

    test('应该忽略输入框中的按键', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      input.dispatchEvent(event);
      
      expect(mockEventBus.emit).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });

    test('应该处理缩放快捷键', () => {
      const events = [
        new KeyboardEvent('keydown', { key: '+', ctrlKey: true }),
        new KeyboardEvent('keydown', { key: '-', ctrlKey: true }),
        new KeyboardEvent('keydown', { key: '0', ctrlKey: true })
      ];
      
      events.forEach(event => document.dispatchEvent(event));
      
      expect(mockEventBus.emit).toHaveBeenCalledTimes(3);
    });
  });

  describe('容器尺寸获取', () => {
    test('应该返回正确的容器宽度', async () => {
      await uiManager.initialize();
      
      const width = uiManager.getContainerWidth();
      expect(width).toBe(800);
    });

    test('应该返回正确的容器高度', async () => {
      await uiManager.initialize();
      
      const height = uiManager.getContainerHeight();
      expect(height).toBe(600);
    });

    test('容器不存在时应该返回0', () => {
      // 不调用initialize，容器为null
      const width = uiManager.getContainerWidth();
      const height = uiManager.getContainerHeight();
      
      expect(width).toBe(0);
      expect(height).toBe(0);
    });
  });

  describe('showError()', () => {
    test('应该显示错误信息', async () => {
      await uiManager.initialize();
      
      uiManager.showError('测试错误信息');
      
      expect(mockLogger.error).toHaveBeenCalledWith('UI Error:', '测试错误信息');
      expect(mockContainer.innerHTML).toContain('测试错误信息');
      expect(DOMUtils.addClass).toHaveBeenCalledWith(mockContainer, 'error');
    });

    test('容器不存在时应该记录错误', () => {
      // 不初始化，容器为null
      uiManager.showError('测试错误信息');
      
      expect(mockLogger.error).toHaveBeenCalledWith('UI Error:', '测试错误信息');
    });
  });

  describe('cleanup()', () => {
    test('应该清理UI资源', async () => {
      await uiManager.initialize();
      
      uiManager.cleanup();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Cleaning up UI resources');
      expect(mockCanvas.width).toBe(0);
      expect(mockCanvas.height).toBe(0);
      expect(DOMUtils.removeClass).toHaveBeenCalledWith(mockContainer, 'loading');
      expect(DOMUtils.removeClass).toHaveBeenCalledWith(mockContainer, 'error');
    });
  });

  describe('destroy()', () => {
    test('应该销毁UI管理器', async () => {
      await uiManager.initialize();
      
      uiManager.destroy();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Destroying UI Manager');
      expect(mockCanvas.removeEventListener).toHaveBeenCalled();
    });
  });

  describe('缩放控制', () => {
    test('应该设置和获取缩放级别', () => {
      uiManager.setScale(1.5);
      const scale = uiManager.getScale();
      
      expect(scale).toBe(1.5);
      expect(mockLogger.debug).toHaveBeenCalledWith('Scale set to: 1.5');
    });
  });

  describe('Canvas操作', () => {
    test('应该返回Canvas元素', async () => {
      await uiManager.initialize();
      
      const canvas = uiManager.getCanvas();
      expect(canvas).toBe(mockCanvas);
    });

    test('应该返回Canvas上下文', async () => {
      await uiManager.initialize();
      
      const context = uiManager.getContext();
      expect(context).toBeDefined();
    });
  });

  describe('showLoading()', () => {
    test('应该显示加载状态', async () => {
      await uiManager.initialize();
      
      uiManager.showLoading(true);
      expect(DOMUtils.addClass).toHaveBeenCalledWith(mockContainer, 'loading');
      
      uiManager.showLoading(false);
      expect(DOMUtils.removeClass).toHaveBeenCalledWith(mockContainer, 'loading');
    });

    test('容器不存在时应该跳过', () => {
      uiManager.showLoading(true);
      expect(DOMUtils.addClass).not.toHaveBeenCalled();
    });
  });
});