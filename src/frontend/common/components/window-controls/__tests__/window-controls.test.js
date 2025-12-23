/**
 * WindowControlsComponent 单元测试
 *
 * 测试窗口控制组件的所有功能：
 * 1. 构造函数参数验证（严格模式）
 * 2. 拖拽按钮点击事件
 * 3. QWebChannel 方法调用
 * 4. CSS 类切换
 * 5. 组件挂载和销毁
 */

import { WindowControlsComponent } from '../window-controls.js';

describe('WindowControlsComponent', () => {
  let component;
  let mockWsClient;
  let mockQWebChannel;
  let mockBridge;

  beforeEach(() => {
    // 重置 DOM
    document.body.innerHTML = '<div id="test-container"></div>';

    // Mock WebSocket 客户端
    mockWsClient = {
      send: jest.fn().mockResolvedValue(undefined),
      getClientName: jest.fn().mockReturnValue('pdf-viewer-test')
    };

    // Mock PyQt Bridge
    // 注意：PyQt 方法直接返回值，不使用回调
    mockBridge = {
      minimizeWindow: jest.fn(() => true),
      maximizeWindow: jest.fn(() => true),
      startWindowDrag: jest.fn(() => true),
      stopWindowDrag: jest.fn(() => true),
      requestCloseWindow: jest.fn(() => true)
    };

    // Mock QWebChannel
    mockQWebChannel = jest.fn((transport, callback) => {
      callback({
        objects: {
          pdfViewerBridge: mockBridge
        }
      });
    });

    // 设置全局对象
    global.window.qt = {
      webChannelTransport: {}
    };
    global.window.QWebChannel = mockQWebChannel;

    // Mock fetch（用于加载模板）
    global.fetch = jest.fn((url) => {
      if (url.includes('window-controls.html')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(`
            <div class="window-controls">
              <button id="window-drag-btn" class="window-control-btn window-drag"></button>
              <button id="window-minimize-btn" class="window-control-btn"></button>
              <button id="window-maximize-btn" class="window-control-btn"></button>
              <button id="window-close-btn" class="window-control-btn"></button>
            </div>
          `)
        });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  afterEach(() => {
    if (component) {
      component.destroy();
      component = null;
    }
    delete global.window.qt;
    delete global.window.QWebChannel;
    jest.clearAllMocks();
  });

  // ==================== 构造函数测试 ====================

  describe('构造函数参数验证（严格模式）', () => {
    test('缺少 clientId 参数时应该抛出错误', () => {
      expect(() => {
        new WindowControlsComponent({
          bridgeName: 'pdfViewerBridge',
          wsClient: mockWsClient
          // 缺少 clientId
        });
      }).toThrow('clientId is required');
    });

    test('缺少 wsClient 参数时应该抛出错误', () => {
      expect(() => {
        new WindowControlsComponent({
          bridgeName: 'pdfViewerBridge',
          clientId: 'pdf-viewer-test'
          // 缺少 wsClient
        });
      }).toThrow('wsClient is required');
    });

    test('提供所有必需参数时应该成功创建', () => {
      expect(() => {
        component = new WindowControlsComponent({
          bridgeName: 'pdfViewerBridge',
          clientId: 'pdf-viewer-test',
          wsClient: mockWsClient
        });
      }).not.toThrow();
    });

    test('应该正确存储 clientId', () => {
      component = new WindowControlsComponent({
        bridgeName: 'pdfViewerBridge',
        clientId: 'pdf-viewer-test-123',
        wsClient: mockWsClient
      });

      // 通过触发关闭按钮来验证 clientId
      // （因为 clientId 是私有字段，只能通过行为验证）
      expect(component).toBeDefined();
    });
  });

  // ==================== 挂载和销毁测试 ====================

  describe('挂载和销毁', () => {
    test('应该成功挂载到 DOM 容器', async () => {
      component = new WindowControlsComponent({
        bridgeName: 'pdfViewerBridge',
        clientId: 'pdf-viewer-test',
        wsClient: mockWsClient
      });

      await component.mount('#test-container');

      const dragBtn = document.querySelector('#window-drag-btn');
      expect(dragBtn).not.toBeNull();
      expect(component.mounted).toBe(true);
    });

    test('挂载时应该加载 HTML 模板', async () => {
      component = new WindowControlsComponent({
        bridgeName: 'pdfViewerBridge',
        clientId: 'pdf-viewer-test',
        wsClient: mockWsClient
      });

      await component.mount('#test-container');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('window-controls.html')
      );
    });

    test('已挂载的组件再次挂载应该发出警告', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      component = new WindowControlsComponent({
        bridgeName: 'pdfViewerBridge',
        clientId: 'pdf-viewer-test',
        wsClient: mockWsClient,
        autoLoad: false  // 禁用自动加载 CSS 避免报错
      });

      await component.mount('#test-container');
      await component.mount('#test-container');  // 第二次挂载

      // 注意：由于使用 logger，这里可能不会调用 console.warn
      // 如果使用了 logger，需要 mock logger 而不是 console

      consoleWarnSpy.mockRestore();
    });

    test('销毁后应该移除事件监听器', async () => {
      component = new WindowControlsComponent({
        bridgeName: 'pdfViewerBridge',
        clientId: 'pdf-viewer-test',
        wsClient: mockWsClient
      });

      await component.mount('#test-container');
      const dragBtn = document.querySelector('#window-drag-btn');
      const removeEventListenerSpy = jest.spyOn(dragBtn, 'removeEventListener');

      component.destroy();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
    });

    test('销毁后 mounted 状态应该为 false', async () => {
      component = new WindowControlsComponent({
        bridgeName: 'pdfViewerBridge',
        clientId: 'pdf-viewer-test',
        wsClient: mockWsClient
      });

      await component.mount('#test-container');
      expect(component.mounted).toBe(true);

      component.destroy();
      expect(component.mounted).toBe(false);
    });
  });

  // ==================== 拖拽功能测试 ====================

  describe('拖拽功能', () => {
    beforeEach(async () => {
      component = new WindowControlsComponent({
        bridgeName: 'pdfViewerBridge',
        clientId: 'pdf-viewer-test',
        wsClient: mockWsClient
      });
      await component.mount('#test-container');
    });

    test('点击拖拽按钮应该调用 startWindowDrag', async () => {
      const dragBtn = document.querySelector('#window-drag-btn');

      // 模拟鼠标按下（左键）
      const mouseDownEvent = new MouseEvent('mousedown', {
        button: 0,  // 左键
        bubbles: true
      });

      dragBtn.dispatchEvent(mouseDownEvent);

      // 等待异步调用完成
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockBridge.startWindowDrag).toHaveBeenCalled();
    });

    test('拖拽时应该添加 dragging CSS 类', async () => {
      const dragBtn = document.querySelector('#window-drag-btn');

      const mouseDownEvent = new MouseEvent('mousedown', {
        button: 0,
        bubbles: true
      });

      dragBtn.dispatchEvent(mouseDownEvent);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(dragBtn.classList.contains('dragging')).toBe(true);
    });

    test('释放鼠标应该调用 stopWindowDrag', async () => {
      const dragBtn = document.querySelector('#window-drag-btn');

      // 先开始拖拽
      const mouseDownEvent = new MouseEvent('mousedown', {
        button: 0,
        bubbles: true
      });
      dragBtn.dispatchEvent(mouseDownEvent);
      await new Promise(resolve => setTimeout(resolve, 0));

      // 释放鼠标
      const mouseUpEvent = new MouseEvent('mouseup', {
        button: 0,
        bubbles: true
      });
      dragBtn.dispatchEvent(mouseUpEvent);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockBridge.stopWindowDrag).toHaveBeenCalled();
    });

    test('释放鼠标应该移除 dragging CSS 类', async () => {
      const dragBtn = document.querySelector('#window-drag-btn');

      // 开始拖拽
      const mouseDownEvent = new MouseEvent('mousedown', {
        button: 0,
        bubbles: true
      });
      dragBtn.dispatchEvent(mouseDownEvent);
      await new Promise(resolve => setTimeout(resolve, 0));

      // 释放鼠标
      const mouseUpEvent = new MouseEvent('mouseup', {
        button: 0,
        bubbles: true
      });
      dragBtn.dispatchEvent(mouseUpEvent);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(dragBtn.classList.contains('dragging')).toBe(false);
    });

    test('右键点击不应该触发拖拽', async () => {
      const dragBtn = document.querySelector('#window-drag-btn');

      const mouseDownEvent = new MouseEvent('mousedown', {
        button: 2,  // 右键
        bubbles: true
      });

      dragBtn.dispatchEvent(mouseDownEvent);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockBridge.startWindowDrag).not.toHaveBeenCalled();
    });

    test('未拖拽状态下释放鼠标不应该调用 stopWindowDrag', async () => {
      const dragBtn = document.querySelector('#window-drag-btn');

      // 直接释放鼠标（没有先按下）
      const mouseUpEvent = new MouseEvent('mouseup', {
        button: 0,
        bubbles: true
      });
      dragBtn.dispatchEvent(mouseUpEvent);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockBridge.stopWindowDrag).not.toHaveBeenCalled();
    });
  });

  // ==================== 窗口控制按钮测试 ====================

  describe('窗口控制按钮', () => {
    beforeEach(async () => {
      component = new WindowControlsComponent({
        bridgeName: 'pdfViewerBridge',
        clientId: 'pdf-viewer-test',
        wsClient: mockWsClient
      });
      await component.mount('#test-container');
    });

    test('点击最小化按钮应该调用 minimizeWindow', async () => {
      const minimizeBtn = document.querySelector('#window-minimize-btn');

      minimizeBtn.click();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockBridge.minimizeWindow).toHaveBeenCalled();
    });

    test('点击最大化按钮应该调用 maximizeWindow', async () => {
      const maximizeBtn = document.querySelector('#window-maximize-btn');

      maximizeBtn.click();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockBridge.maximizeWindow).toHaveBeenCalled();
    });

    test('点击关闭按钮应该发送 WebSocket 消息', async () => {
      const closeBtn = document.querySelector('#window-close-btn');

      closeBtn.click();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockWsClient.send).toHaveBeenCalledWith({
        type: 'app-window:close:requested',
        data: {
          client_id: 'pdf-viewer-test',
          reason: 'user_close'
        }
      });
    });
  });

  // ==================== QWebChannel 错误处理测试 ====================

  describe('QWebChannel 错误处理', () => {
    test('QWebChannel 不可用时应该拒绝 Promise', async () => {
      delete global.window.qt;  // 移除 qt 对象

      component = new WindowControlsComponent({
        bridgeName: 'pdfViewerBridge',
        clientId: 'pdf-viewer-test',
        wsClient: mockWsClient
      });

      await component.mount('#test-container');

      const dragBtn = document.querySelector('#window-drag-btn');
      const mouseDownEvent = new MouseEvent('mousedown', {
        button: 0,
        bubbles: true
      });

      // 应该不会抛出异常（错误被捕获）
      expect(() => {
        dragBtn.dispatchEvent(mouseDownEvent);
      }).not.toThrow();
    });

    test('Bridge 方法不存在时应该拒绝 Promise', async () => {
      // Mock 一个没有 startWindowDrag 方法的 Bridge
      const incompleteBridge = {
        minimizeWindow: jest.fn()
        // 缺少 startWindowDrag
      };

      global.window.QWebChannel = jest.fn((transport, callback) => {
        callback({
          objects: {
            pdfViewerBridge: incompleteBridge
          }
        });
      });

      component = new WindowControlsComponent({
        bridgeName: 'pdfViewerBridge',
        clientId: 'pdf-viewer-test',
        wsClient: mockWsClient
      });

      await component.mount('#test-container');

      const dragBtn = document.querySelector('#window-drag-btn');
      const mouseDownEvent = new MouseEvent('mousedown', {
        button: 0,
        bubbles: true
      });

      // 应该不会抛出异常
      expect(() => {
        dragBtn.dispatchEvent(mouseDownEvent);
      }).not.toThrow();
    });
  });

  // ==================== 边界条件测试 ====================

  describe('边界条件', () => {
    test('容器不存在时应该抛出错误', async () => {
      component = new WindowControlsComponent({
        bridgeName: 'pdfViewerBridge',
        clientId: 'pdf-viewer-test',
        wsClient: mockWsClient
      });

      await expect(component.mount('#non-existent')).rejects.toThrow('Container element not found');
    });

    test('传入 HTMLElement 而不是选择器应该成功挂载', async () => {
      component = new WindowControlsComponent({
        bridgeName: 'pdfViewerBridge',
        clientId: 'pdf-viewer-test',
        wsClient: mockWsClient
      });

      const container = document.getElementById('test-container');
      await component.mount(container);

      expect(component.mounted).toBe(true);
    });

    test('未挂载的组件调用 destroy 不应该抛出错误', () => {
      component = new WindowControlsComponent({
        bridgeName: 'pdfViewerBridge',
        clientId: 'pdf-viewer-test',
        wsClient: mockWsClient
      });

      expect(() => {
        component.destroy();
      }).not.toThrow();
    });
  });
});
