# PDF-Viewer 架构重构 - 测试清单和验收标准

**所属规格**: 20251002040217-pdf-viewer-architecture-refactoring
**版本**: v002-appendix
**创建时间**: 2025-10-02 12:32:17
**文档类型**: 附录 - 测试指南

---

## 文档说明

本文档是 `v002-spec.md` 的附录，提供详细的测试清单、测试用例和验收标准。

---

## 测试策略概述

### 测试金字塔

```
       /\
      /  \        E2E 测试（10%）
     /----\       - 纯浏览器环境
    /      \      - PyQt 集成环境
   /--------\
  / 集成测试  \    集成测试（30%）
 /------------\   - 模块间协作
/  单元测试     \  - 事件流测试
/--------------\
                  单元测试（60%）
                  - 各组件独立测试
                  - Handler 测试
                  - 工具函数测试
```

### 测试覆盖率目标

- **总体覆盖率**: ≥ 80%
- **核心模块**: ≥ 90% (core/, adapters/)
- **功能模块**: ≥ 80% (features/)
- **工具函数**: ≥ 95% (common/utils/)

---

## 单元测试清单

### 1. BaseEventHandler 测试

```javascript
// core/__tests__/base-event-handler.test.js

import { BaseEventHandler } from '../base-event-handler.js';
import { EventBus } from '../../common/event/event-bus.js';

describe('BaseEventHandler', () => {
  let eventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('构造函数', () => {
    test('不能直接实例化抽象类', () => {
      expect(() => {
        new BaseEventHandler({}, eventBus, 'Test');
      }).toThrow('BaseEventHandler is abstract');
    });

    test('子类可以正常实例化', () => {
      class TestHandler extends BaseEventHandler {
        setup() {}
      }

      const handler = new TestHandler({}, eventBus, 'TestHandler');
      expect(handler).toBeInstanceOf(BaseEventHandler);
    });
  });

  describe('setup 方法', () => {
    test('子类必须实现 setup 方法', () => {
      class TestHandler extends BaseEventHandler {}

      const handler = new TestHandler({}, eventBus, 'TestHandler');

      expect(() => {
        handler.setup();
      }).toThrow('must implement setup()');
    });
  });

  describe('_on 方法', () => {
    class TestHandler extends BaseEventHandler {
      setup() {
        this._on('test:event', this.handleTest);
      }

      handleTest = jest.fn();
    }

    test('可以注册事件监听器', () => {
      const handler = new TestHandler({}, eventBus, 'TestHandler');
      handler.setup();

      eventBus.emit('test:event', { data: 'test' });

      expect(handler.handleTest).toHaveBeenCalledWith({ data: 'test' });
    });

    test('监听器异常不会中断其他监听器', () => {
      const handler = new TestHandler({}, eventBus, 'TestHandler');

      handler._on('test:event', () => {
        throw new Error('Test error');
      });

      const handler2Callback = jest.fn();
      handler._on('test:event', handler2Callback);

      eventBus.emit('test:event', {});

      // 第二个监听器应该仍然被调用
      expect(handler2Callback).toHaveBeenCalled();
    });

    test('异步监听器的 rejection 会被捕获', async () => {
      const handler = new TestHandler({}, eventBus, 'TestHandler');

      const asyncHandler = jest.fn().mockRejectedValue(new Error('Async error'));
      handler._on('test:event', asyncHandler);

      eventBus.emit('test:event', {});

      // 等待一下以确保 Promise rejection 被处理
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(asyncHandler).toHaveBeenCalled();
      // 不应该有未捕获的 rejection
    });

    test('可以取消订阅', () => {
      const handler = new TestHandler({}, eventBus, 'TestHandler');
      const callback = jest.fn();

      const unsubscribe = handler._on('test:event', callback);

      unsubscribe();

      eventBus.emit('test:event', {});

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('_emit 方法', () => {
    class TestHandler extends BaseEventHandler {
      setup() {}

      triggerEvent(data) {
        this._emit('test:event', data);
      }
    }

    test('可以发射事件', () => {
      const handler = new TestHandler({}, eventBus, 'TestHandler');
      const callback = jest.fn();

      eventBus.on('test:event', callback);

      handler.triggerEvent({ data: 'test' });

      expect(callback).toHaveBeenCalledWith({ data: 'test' });
    });
  });

  describe('destroy 方法', () => {
    class TestHandler extends BaseEventHandler {
      setup() {
        this._on('event1', jest.fn());
        this._on('event2', jest.fn());
        this._on('event3', jest.fn());
      }
    }

    test('清理所有监听器', () => {
      const handler = new TestHandler({}, eventBus, 'TestHandler');
      handler.setup();

      expect(handler.getListenerCount()).toBe(3);

      handler.destroy();

      expect(handler.getListenerCount()).toBe(0);
    });

    test('清理后事件不再触发', () => {
      const handler = new TestHandler({}, eventBus, 'TestHandler');
      const callback = jest.fn();

      handler._on('test:event', callback);
      handler.destroy();

      eventBus.emit('test:event', {});

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('getListenerCount', () => {
    test('返回正确的监听器数量', () => {
      class TestHandler extends BaseEventHandler {
        setup() {}
      }

      const handler = new TestHandler({}, eventBus, 'TestHandler');

      expect(handler.getListenerCount()).toBe(0);

      handler._on('event1', jest.fn());
      expect(handler.getListenerCount()).toBe(1);

      handler._on('event2', jest.fn());
      expect(handler.getListenerCount()).toBe(2);
    });
  });

  describe('getRegisteredEvents', () => {
    test('返回已注册的事件列表', () => {
      class TestHandler extends BaseEventHandler {
        setup() {}
      }

      const handler = new TestHandler({}, eventBus, 'TestHandler');

      handler._on('event1', jest.fn());
      handler._on('event2', jest.fn());

      const events = handler.getRegisteredEvents();

      expect(events).toEqual(['event1', 'event2']);
    });
  });
});
```

### 2. StateManager 测试

```javascript
// core/__tests__/state-manager.test.js

import { StateManager } from '../state-manager.js';
import { globalEventBus } from '../../common/event/event-bus.js';
import { APP_EVENTS } from '../../common/event/constants.js';

describe('StateManager', () => {
  let stateManager;
  let eventCallback;

  beforeEach(() => {
    stateManager = new StateManager();
    eventCallback = jest.fn();

    // 监听状态变更事件
    globalEventBus.on(APP_EVENTS.STATE.CHANGED, eventCallback);
  });

  afterEach(() => {
    globalEventBus.off(APP_EVENTS.STATE.CHANGED, eventCallback);
  });

  describe('初始状态', () => {
    test('初始状态正确', () => {
      const state = stateManager.getState();

      expect(state).toEqual({
        initialized: false,
        currentFile: null,
        currentPage: 1,
        totalPages: 0,
        zoomLevel: 1.0,
      });
    });
  });

  describe('setInitialized', () => {
    test('设置初始化状态', () => {
      stateManager.setInitialized(true);

      expect(stateManager.isInitialized()).toBe(true);
      expect(stateManager.getState().initialized).toBe(true);
    });

    test('状态变更时发射事件', () => {
      stateManager.setInitialized(true);

      expect(eventCallback).toHaveBeenCalledWith({
        field: 'initialized',
        oldValue: false,
        newValue: true,
        state: expect.objectContaining({
          initialized: true,
        }),
      });
    });

    test('相同值不发射事件', () => {
      stateManager.setInitialized(true);
      eventCallback.mockClear();

      stateManager.setInitialized(true);

      expect(eventCallback).not.toHaveBeenCalled();
    });
  });

  describe('setCurrentFile', () => {
    test('设置当前文件', () => {
      stateManager.setCurrentFile('/path/to/file.pdf');

      expect(stateManager.getCurrentFile()).toBe('/path/to/file.pdf');
    });

    test('状态变更时发射事件', () => {
      stateManager.setCurrentFile('/path/to/file.pdf');

      expect(eventCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          field: 'currentFile',
          oldValue: null,
          newValue: '/path/to/file.pdf',
        })
      );
    });
  });

  describe('setCurrentPage', () => {
    test('设置当前页码', () => {
      stateManager.setCurrentPage(5);

      expect(stateManager.getState().currentPage).toBe(5);
    });

    test('状态变更时发射事件', () => {
      stateManager.setCurrentPage(5);

      expect(eventCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          field: 'currentPage',
          oldValue: 1,
          newValue: 5,
        })
      );
    });
  });

  describe('setZoomLevel', () => {
    test('设置缩放级别', () => {
      stateManager.setZoomLevel(1.5);

      expect(stateManager.getState().zoomLevel).toBe(1.5);
    });

    test('状态变更时发射事件', () => {
      stateManager.setZoomLevel(1.5);

      expect(eventCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          field: 'zoomLevel',
          oldValue: 1.0,
          newValue: 1.5,
        })
      );
    });
  });
});
```

### 3. AppCoordinator 测试

```javascript
// core/__tests__/coordinator.test.js

import { AppCoordinator } from '../coordinator.js';

describe('AppCoordinator', () => {
  let mockContainer;
  let mockPDFManager;
  let mockUIManager;
  let mockBookmarkManager;

  beforeEach(() => {
    // 创建 mock 对象
    mockPDFManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn(),
    };

    mockUIManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn(),
    };

    mockBookmarkManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn(),
    };

    mockContainer = {
      getPDFManager: jest.fn().mockReturnValue(mockPDFManager),
      getUIManager: jest.fn().mockReturnValue(mockUIManager),
      getBookmarkManager: jest.fn().mockReturnValue(mockBookmarkManager),
      getEventBus: jest.fn().mockReturnValue({}),
    };
  });

  describe('initialize', () => {
    test('按顺序初始化所有模块', async () => {
      const coordinator = new AppCoordinator(mockContainer);

      await coordinator.initialize();

      expect(mockPDFManager.initialize).toHaveBeenCalled();
      expect(mockUIManager.initialize).toHaveBeenCalled();
      expect(mockBookmarkManager.initialize).toHaveBeenCalled();
    });

    test('初始化失败时抛出异常', async () => {
      mockPDFManager.initialize.mockRejectedValue(new Error('Init failed'));

      const coordinator = new AppCoordinator(mockContainer);

      await expect(coordinator.initialize()).rejects.toThrow('Init failed');
    });
  });

  describe('destroy', () => {
    test('销毁所有模块', async () => {
      const coordinator = new AppCoordinator(mockContainer);

      await coordinator.initialize();
      coordinator.destroy();

      expect(mockPDFManager.destroy).toHaveBeenCalled();
      expect(mockUIManager.destroy).toHaveBeenCalled();
      expect(mockBookmarkManager.destroy).toHaveBeenCalled();
    });

    test('销毁时错误不会中断流程', async () => {
      mockPDFManager.destroy.mockImplementation(() => {
        throw new Error('Destroy failed');
      });

      const coordinator = new AppCoordinator(mockContainer);

      await coordinator.initialize();

      // 不应该抛出异常
      expect(() => coordinator.destroy()).not.toThrow();

      // 其他模块仍然应该被销毁
      expect(mockUIManager.destroy).toHaveBeenCalled();
    });
  });

  describe('getPDFManager', () => {
    test('返回 PDF 管理器实例', () => {
      const coordinator = new AppCoordinator(mockContainer);

      expect(coordinator.getPDFManager()).toBe(mockPDFManager);
    });
  });
});
```

### 4. WebSocketAdapter 测试

```javascript
// adapters/__tests__/websocket-adapter.test.js

import { WebSocketAdapter } from '../websocket-adapter.js';
import { globalEventBus } from '../../common/event/event-bus.js';
import { PDF_EVENTS } from '../../common/event/constants.js';

describe('WebSocketAdapter', () => {
  let mockWSClient;
  let adapter;
  let eventCallback;

  beforeEach(() => {
    mockWSClient = {
      onMessage: jest.fn(),
      send: jest.fn(),
    };

    adapter = new WebSocketAdapter(mockWSClient);
    eventCallback = jest.fn();
  });

  describe('setupMessageHandlers', () => {
    test('注册 WebSocket 消息监听器', () => {
      adapter.setupMessageHandlers();

      expect(mockWSClient.onMessage).toHaveBeenCalled();
    });

    test('设置内部事件到 WebSocket 的桥接', () => {
      adapter.setupMessageHandlers();
      adapter.onInitialized();

      globalEventBus.on(PDF_EVENTS.FILE.LOADED, eventCallback);

      globalEventBus.emit(PDF_EVENTS.FILE.LOADED, {
        filePath: '/test.pdf',
        totalPages: 10,
      });

      expect(mockWSClient.send).toHaveBeenCalledWith({
        type: 'pdf_loaded',
        data: {
          file_path: '/test.pdf',
          total_pages: 10,
        },
      });
    });
  });

  describe('handleMessage', () => {
    beforeEach(() => {
      adapter.setupMessageHandlers();
      globalEventBus.on(PDF_EVENTS.FILE.LOAD.REQUESTED, eventCallback);
    });

    afterEach(() => {
      globalEventBus.off(PDF_EVENTS.FILE.LOAD.REQUESTED, eventCallback);
    });

    test('未初始化时消息进入队列', () => {
      adapter.handleMessage({
        type: 'load_pdf_file',
        data: { file_path: '/test.pdf' },
      });

      // 事件不应该立即发射
      expect(eventCallback).not.toHaveBeenCalled();
    });

    test('初始化后处理队列中的消息', () => {
      adapter.handleMessage({
        type: 'load_pdf_file',
        data: { file_path: '/test.pdf' },
      });

      adapter.onInitialized();

      // 事件应该被发射
      expect(eventCallback).toHaveBeenCalledWith({
        filePath: '/test.pdf',
        initialPage: undefined,
        zoom: undefined,
      });
    });

    test('初始化后直接处理消息', () => {
      adapter.onInitialized();

      adapter.handleMessage({
        type: 'load_pdf_file',
        data: { file_path: '/test.pdf', initial_page: 5 },
      });

      expect(eventCallback).toHaveBeenCalledWith({
        filePath: '/test.pdf',
        initialPage: 5,
        zoom: undefined,
      });
    });
  });

  describe('消息路由', () => {
    beforeEach(() => {
      adapter.setupMessageHandlers();
      adapter.onInitialized();
    });

    test('load_pdf_file 消息转换为 PDF_EVENTS.FILE.LOAD.REQUESTED', () => {
      globalEventBus.on(PDF_EVENTS.FILE.LOAD.REQUESTED, eventCallback);

      adapter.handleMessage({
        type: 'load_pdf_file',
        data: { file_path: '/test.pdf', initial_page: 3, zoom: 1.5 },
      });

      expect(eventCallback).toHaveBeenCalledWith({
        filePath: '/test.pdf',
        initialPage: 3,
        zoom: 1.5,
      });

      globalEventBus.off(PDF_EVENTS.FILE.LOAD.REQUESTED, eventCallback);
    });

    test('navigate_page 消息转换为 PDF_EVENTS.PAGE.NAVIGATE', () => {
      globalEventBus.on(PDF_EVENTS.PAGE.NAVIGATE, eventCallback);

      adapter.handleMessage({
        type: 'navigate_page',
        data: { page_number: 5 },
      });

      expect(eventCallback).toHaveBeenCalledWith({
        pageNumber: 5,
      });

      globalEventBus.off(PDF_EVENTS.PAGE.NAVIGATE, eventCallback);
    });

    test('未知消息类型记录警告', () => {
      // 应该不会崩溃
      expect(() => {
        adapter.handleMessage({
          type: 'unknown_type',
          data: {},
        });
      }).not.toThrow();
    });
  });
});
```

---

## 集成测试清单

### 1. 事件流测试

```javascript
// __tests__/integration/event-flow.test.js

import { bootstrap } from '../../bootstrap/app-bootstrap.js';
import { globalEventBus } from '../../common/event/event-bus.js';
import { PDF_EVENTS } from '../../common/event/constants.js';

describe('事件流集成测试', () => {
  let app;

  beforeEach(async () => {
    // 创建 mock WebSocket 客户端
    const mockWSClient = {
      onMessage: jest.fn(),
      send: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    };

    app = await bootstrap({
      wsClient: mockWSClient,
    });
  });

  afterEach(() => {
    app.destroy();
  });

  test('PDF 加载完整流程', async () => {
    const loadedCallback = jest.fn();
    const pageChangedCallback = jest.fn();

    // 监听加载完成事件
    globalEventBus.on(PDF_EVENTS.FILE.LOADED, loadedCallback);
    globalEventBus.on(PDF_EVENTS.PAGE.CHANGED, pageChangedCallback);

    // 模拟 WebSocket 消息触发加载
    globalEventBus.emit(PDF_EVENTS.FILE.LOAD.REQUESTED, {
      filePath: '/test.pdf',
      initialPage: 3,
    });

    // 等待异步操作完成
    await new Promise(resolve => setTimeout(resolve, 100));

    // 验证加载完成事件被触发
    expect(loadedCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: '/test.pdf',
      })
    );

    // 验证页面导航事件被触发
    expect(pageChangedCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNumber: 3,
      })
    );

    globalEventBus.off(PDF_EVENTS.FILE.LOADED, loadedCallback);
    globalEventBus.off(PDF_EVENTS.PAGE.CHANGED, pageChangedCallback);
  });

  test('状态管理与事件同步', () => {
    const stateChangedCallback = jest.fn();

    globalEventBus.on('app:state:changed', stateChangedCallback);

    // 修改状态
    app.stateManager.setCurrentPage(5);

    // 验证状态变更事件
    expect(stateChangedCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        field: 'currentPage',
        newValue: 5,
      })
    );

    globalEventBus.off('app:state:changed', stateChangedCallback);
  });
});
```

### 2. 模块协作测试

```javascript
// __tests__/integration/module-collaboration.test.js

import { bootstrap } from '../../bootstrap/app-bootstrap.js';

describe('模块协作测试', () => {
  let app;

  beforeEach(async () => {
    const mockWSClient = {
      onMessage: jest.fn(),
      send: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    };

    app = await bootstrap({ wsClient: mockWSClient });
  });

  afterEach(() => {
    app.destroy();
  });

  test('所有模块成功初始化', () => {
    expect(app.coordinator).toBeDefined();
    expect(app.stateManager).toBeDefined();
    expect(app.lifecycleManager).toBeDefined();
    expect(app.wsAdapter).toBeDefined();
  });

  test('应用状态正确', () => {
    const state = app.getState();

    expect(state.initialized).toBe(true);
  });

  test('销毁流程正常', () => {
    expect(() => {
      app.destroy();
    }).not.toThrow();
  });
});
```

---

## 端到端测试清单

### 1. 纯浏览器环境测试

```javascript
// __tests__/e2e/browser-environment.test.js

/**
 * 端到端测试 - 纯浏览器环境
 * 使用 Puppeteer 或 Playwright
 */

import puppeteer from 'puppeteer';

describe('纯浏览器环境 E2E 测试', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.goto('http://localhost:3000');
  });

  afterEach(async () => {
    await page.close();
  });

  test('应用正常启动', async () => {
    // 等待应用初始化
    await page.waitForFunction(() => window.pdfViewerApp !== undefined);

    // 验证应用实例存在
    const appExists = await page.evaluate(() => {
      return window.pdfViewerApp !== null;
    });

    expect(appExists).toBe(true);
  });

  test('加载 PDF 文件', async () => {
    await page.waitForFunction(() => window.pdfViewerApp !== undefined);

    // 触发加载 PDF
    await page.evaluate(() => {
      window.pdfViewerApp.getEventBus().emit('pdf:file:load:requested', {
        filePath: '/test.pdf',
      });
    });

    // 等待加载完成
    await page.waitForFunction(
      () => {
        const state = window.pdfViewerApp.getState();
        return state.currentFile !== null;
      },
      { timeout: 5000 }
    );

    // 验证文件已加载
    const currentFile = await page.evaluate(() => {
      return window.pdfViewerApp.getState().currentFile;
    });

    expect(currentFile).toBe('/test.pdf');
  });

  test('页面导航功能', async () => {
    await page.waitForFunction(() => window.pdfViewerApp !== undefined);

    // 加载 PDF
    await page.evaluate(() => {
      window.pdfViewerApp.getEventBus().emit('pdf:file:load:requested', {
        filePath: '/test.pdf',
      });
    });

    // 等待加载完成
    await page.waitForFunction(() => {
      const state = window.pdfViewerApp.getState();
      return state.currentFile !== null;
    });

    // 导航到第 5 页
    await page.evaluate(() => {
      window.pdfViewerApp.getEventBus().emit('pdf:page:navigate', {
        pageNumber: 5,
      });
    });

    // 验证页码
    const currentPage = await page.evaluate(() => {
      return window.pdfViewerApp.getState().currentPage;
    });

    expect(currentPage).toBe(5);
  });

  test('缩放功能', async () => {
    await page.waitForFunction(() => window.pdfViewerApp !== undefined);

    // 设置缩放级别
    await page.evaluate(() => {
      window.pdfViewerApp.getEventBus().emit('pdf:zoom:change', {
        level: 1.5,
      });
    });

    // 验证缩放级别
    const zoomLevel = await page.evaluate(() => {
      return window.pdfViewerApp.getState().zoomLevel;
    });

    expect(zoomLevel).toBe(1.5);
  });

  test('错误处理', async () => {
    await page.waitForFunction(() => window.pdfViewerApp !== undefined);

    // 监听错误事件
    const errorPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        window.pdfViewerApp.getEventBus().once('pdf:file:load:failed', (data) => {
          resolve(data);
        });
      });
    });

    // 尝试加载不存在的文件
    await page.evaluate(() => {
      window.pdfViewerApp.getEventBus().emit('pdf:file:load:requested', {
        filePath: '/nonexistent.pdf',
      });
    });

    // 验证错误事件
    const errorData = await errorPromise;

    expect(errorData).toHaveProperty('error');
    expect(errorData.filePath).toBe('/nonexistent.pdf');
  });
});
```

### 2. PyQt 集成环境测试

```python
# __tests__/e2e/test_pyqt_integration.py

import pytest
from PyQt5.QtCore import QUrl
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtWidgets import QApplication

from qt_integration.main_window import PDFViewerMainWindow

@pytest.fixture
def app(qtbot):
    """创建 Qt 应用实例"""
    window = PDFViewerMainWindow()
    qtbot.addWidget(window)
    window.show()
    return window

def test_application_starts(app):
    """测试应用正常启动"""
    assert app.isVisible()
    assert app.web_view is not None

def test_load_pdf_via_qt_bridge(app, qtbot):
    """测试通过 Qt 桥接加载 PDF"""
    # 等待页面加载完成
    qtbot.waitUntil(lambda: app.web_view.page().loadFinished, timeout=5000)

    # 通过 Qt 桥接加载 PDF
    app.load_pdf('/path/to/test.pdf')

    # 等待加载完成
    qtbot.wait(1000)

    # 验证（这里需要通过 Qt 桥接获取状态）
    # 实际实现取决于桥接接口

def test_qwebchannel_communication(app, qtbot):
    """测试 QWebChannel 通信"""
    qtbot.waitUntil(lambda: app.web_view.page().loadFinished, timeout=5000)

    # 测试 JS → Python 通信
    # 实际实现取决于桥接接口

    # 测试 Python → JS 通信
    # 实际实现取决于桥接接口

def test_external_ui_integration(app, qtbot):
    """测试外部 UI 组件集成"""
    # 测试工具栏按钮
    # 测试菜单项
    # 测试快捷键
    pass
```

---

## 依赖检查测试

### 1. 依赖规则验证

```bash
#!/bin/bash
# test-dependencies.sh

echo "运行依赖检查..."

npm run check:deps

if [ $? -eq 0 ]; then
  echo "✓ 依赖检查通过"
  exit 0
else
  echo "✗ 依赖检查失败"
  echo "请修复违反分层规则的依赖"
  exit 1
fi
```

### 2. 预期的依赖检查结果

```
✓ No circular dependencies found
✓ Layer 1 (common/) has no upper layer dependencies
✓ Layer 2 (core/) does not depend on features/adapters/bootstrap
✓ Layer 3 (features/) modules do not cross-depend
✓ Layer 4 (adapters/) only depends on common/
✓ All dependencies follow the layering rules
```

---

## 代码质量检查清单

### 1. ESLint 检查

```bash
npm run lint
```

**预期结果**: 0 errors, 0 warnings

### 2. 测试覆盖率检查

```bash
npm run test:coverage
```

**预期结果**:
```
-------------------------|---------|----------|---------|---------|
File                     | % Stmts | % Branch | % Funcs | % Lines |
-------------------------|---------|----------|---------|---------|
All files                |   82.5  |   78.3   |   85.1  |   82.8  |
 core/                   |   91.2  |   87.5   |   92.3  |   91.5  |
  base-event-handler.js  |   95.0  |   92.0   |   96.0  |   95.2  |
  coordinator.js         |   88.5  |   85.0   |   90.0  |   89.0  |
  state-manager.js       |   90.0  |   86.0   |   91.0  |   90.5  |
  lifecycle-manager.js   |   92.0  |   88.5   |   93.0  |   92.3  |
 features/pdf/           |   85.3  |   80.2   |   87.5  |   85.8  |
 features/ui/            |   83.0  |   78.5   |   85.0  |   83.5  |
 adapters/               |   90.5  |   87.0   |   92.0  |   90.8  |
-------------------------|---------|----------|---------|---------|
```

### 3. 文件大小检查

```bash
# 检查是否有超过 200 行的文件
find src/frontend/pdf-viewer -name "*.js" -exec wc -l {} \; | awk '$1 > 200 {print}'
```

**预期结果**: 空（没有超过 200 行的文件）

### 4. 函数复杂度检查

```bash
npx eslint --rule 'complexity: [error, 10]' src/frontend/pdf-viewer/**/*.js
```

**预期结果**: 0 errors

---

## 验收标准检查表

> **说明**: 本检查表与 `v002-spec.md` 的实施计划保持一致，按照五层架构的 6 个阶段组织。

---

### 阶段1: Layer 1 基础设施层准备 【P0】

**功能验收**:
- [ ] 根目录只保留 3 个文件: main.js, jsconfig.json, .dependency-cruiser.js
- [ ] 所有备份文件已删除 (ui-manager.js.backup, index.backup2.html, index.temp.html)
- [ ] 所有桥接文件已删除 (pdf-manager.js, event-handlers.js, ui-manager.js)
- [ ] 所有无价值封装已删除 (eventbus.js)
- [ ] 所有 -refactored 后缀已移除

**目录结构验收**:
- [ ] 五层架构目录已创建: core/, features/, adapters/, bootstrap/, types/
- [ ] Python 文件已移动到 qt-integration/
- [ ] 静态资源已移动到 assets/

**类型系统验收**:
- [ ] types/common.d.ts 已创建
- [ ] types/events.d.ts 已创建
- [ ] types/pdf.d.ts 已创建
- [ ] types/ui.d.ts 已创建
- [ ] types/index.d.ts 已创建
- [ ] IDE 能识别类型定义

**依赖检查验收**:
- [ ] dependency-cruiser 已安装
- [ ] .dependency-cruiser.js 已配置
- [ ] jsconfig.json 已配置
- [ ] npm scripts 已添加 (check:deps, test:pre-commit)
- [ ] 依赖检查通过（0 violations）

**路径更新验收**:
- [ ] 所有导入路径已更新
- [ ] 测试文件路径已更新
- [ ] ESLint 检查通过（0 errors）
- [ ] 应用可以正常启动

**测试验收**:
- [ ] 类型定义测试通过（IDE 无类型错误）
- [ ] 路径更新后所有模块可正常导入

---

### 阶段2: Layer 4 适配器层重构 【P0】

**功能验收**:
- [ ] adapters/websocket-adapter.js 已创建
- [ ] WebSocket 消息路由功能正常
- [ ] 事件到 WebSocket 桥接功能正常
- [ ] 消息队列机制工作正常

**清理验收**:
- [ ] websocket-handler.js 已删除
- [ ] app-core.js 中 WebSocket 处理逻辑已移除
- [ ] container/app-container.js 已更新

**测试验收**:
- [ ] WebSocketAdapter 单元测试通过
  - [ ] 消息路由测试通过
  - [ ] 消息队列测试通过
  - [ ] 错误处理测试通过
- [ ] WebSocket 通信集成测试通过
- [ ] 测试覆盖率 ≥ 90%

**功能回归测试**:
- [ ] WebSocket 连接正常
- [ ] 外部消息能转换为内部事件
- [ ] 内部事件能转换为外部消息

---

### 阶段3: Layer 2 核心领域层重构 【P1】

**BaseEventHandler 验收**:
- [ ] core/base-event-handler.js 已创建
- [ ] _on() 方法实现正确（带错误捕获）
- [ ] _emit() 方法实现正确（带日志）
- [ ] destroy() 方法实现正确（自动清理）
- [ ] setup() 抽象方法定义正确
- [ ] BaseEventHandler 单元测试通过（覆盖率 ≥ 90%）

**AppCoordinator 验收**:
- [ ] core/coordinator.js 已创建
- [ ] 模块管理逻辑正确
- [ ] 初始化和销毁逻辑正确
- [ ] AppCoordinator 单元测试通过

**StateManager 验收**:
- [ ] core/state-manager.js 已创建
- [ ] 所有状态字段正确提取
- [ ] getState() 方法正确
- [ ] 状态变更事件发射正确
- [ ] StateManager 单元测试通过

**LifecycleManager 验收**:
- [ ] core/lifecycle-manager.js 已创建
- [ ] 全局错误处理正确
- [ ] onInitialized 逻辑正确
- [ ] LifecycleManager 单元测试通过

**清理验收**:
- [ ] app-core.js 已删除
- [ ] app.js 已删除
- [ ] 所有导入引用已更新

**集成测试验收**:
- [ ] 核心模块协作测试通过
- [ ] 应用功能不受影响
- [ ] 所有功能正常（PDF 加载、导航、缩放）

---

### 阶段4: Layer 3 功能特性层重构 【P1】

**PDF 模块验收**:
- [ ] pdf/ 已移动到 features/pdf/
- [ ] pdf-manager-refactored.js 已重命名为 manager.js
- [ ] features/pdf/handlers/pdf-event-handler.js 已创建
- [ ] PDFEventHandler 继承 BaseEventHandler
- [ ] features/pdf/index.js 已创建
- [ ] PDF 模块单元测试通过

**UI 模块验收**:
- [ ] ui/ 已移动到 features/ui/
- [ ] ui-manager-core-refactored.js 已重命名为 manager.js
- [ ] UI 组件已移动到 features/ui/components/
- [ ] features/ui/handlers/ui-event-handler.js 已创建
- [ ] features/ui/index.js 已创建
- [ ] UI 模块单元测试通过

**书签模块验收**:
- [ ] bookmark/ 已移动到 features/bookmark/
- [ ] features/bookmark/handlers/bookmark-event-handler.js 已创建
- [ ] features/bookmark/index.js 已创建
- [ ] 书签模块单元测试通过

**页面传输模块验收**:
- [ ] page-transfer-*.js 已移动到 features/page-transfer/
- [ ] features/page-transfer/index.js 已创建
- [ ] 页面传输模块单元测试通过

**清理验收**:
- [ ] 原 pdf/, ui/, bookmark/ 目录已删除
- [ ] handlers/ 目录已删除
- [ ] event-handlers-refactored.js 已删除
- [ ] 所有导入路径已更新

**功能测试验收**:
- [ ] PDF 加载功能正常
- [ ] UI 交互功能正常
- [ ] 书签功能正常
- [ ] 页面传输功能正常

**依赖检查验收**:
- [ ] 无跨 feature 依赖
- [ ] 依赖检查通过

---

### 阶段5: Layer 5 应用入口层重构 【P1】

**应用启动器验收**:
- [ ] bootstrap/app-bootstrap.js 已创建
- [ ] bootstrap() 函数实现正确
- [ ] 组合 AppCoordinator, StateManager, LifecycleManager, WebSocketAdapter
- [ ] 启动流程编排正确

**主入口验收**:
- [ ] main.js 已重写使用 bootstrap()
- [ ] window.pdfViewerApp 全局对象可用（向后兼容）
- [ ] 友好的错误提示已添加

**清理验收**:
- [ ] app.js（继承版本）已删除
- [ ] app-core.js 已确认删除
- [ ] 所有旧的启动逻辑已清理

**集成测试验收**:
- [ ] 应用启动流程测试通过
- [ ] 模块协作测试通过
- [ ] 事件流测试通过
- [ ] 状态管理测试通过

**端到端测试验收**:
- [ ] 纯浏览器环境测试通过
- [ ] PyQt 集成环境测试通过

**功能完整性验收**:
- [ ] 应用使用组合模式（无继承）
- [ ] PDF 加载功能正常
- [ ] 页面导航功能正常
- [ ] 缩放功能正常
- [ ] 书签功能正常
- [ ] WebSocket 通信正常

---

### 阶段6: 完善和优化 【P2】

**文档验收**:
- [ ] README.md 已更新
  - [ ] 目录结构说明正确
  - [ ] 架构图正确
  - [ ] API 文档完整
- [ ] SPEC 规范文档已更新
  - [ ] 分层架构说明完整
  - [ ] 组合模式说明完整
- [ ] MIGRATION.md 已创建
  - [ ] 导入路径迁移说明清晰
  - [ ] API 变更说明清晰
  - [ ] 示例代码完整
- [ ] CHANGELOG.md 已创建
  - [ ] 所有破坏性变更已记录
  - [ ] 新增功能已记录

**代码质量验收**:
- [ ] JSDoc 注释完整
- [ ] 函数命名清晰
- [ ] 代码风格统一
- [ ] 不必要的日志已移除

**测试验收**:
- [ ] 缺失的单元测试已补充
- [ ] 测试覆盖率 ≥ 80%
- [ ] 边界情况测试已添加

**最终验收**:
- [ ] 完整测试套件通过
- [ ] 依赖检查通过（0 violations）
- [ ] ESLint 检查通过（0 errors, 0 warnings）
- [ ] 手动功能测试通过

---

## 总体验收清单

### 功能完整性

- [ ] PDF 加载功能正常
- [ ] 页面导航功能正常
- [ ] 缩放功能正常
- [ ] 书签功能正常
- [ ] WebSocket 通信正常
- [ ] 错误处理正常

### 代码质量

- [ ] ESLint: 0 errors, 0 warnings
- [ ] 测试覆盖率: ≥ 80%
- [ ] 依赖检查: 0 violations
- [ ] 单个文件: ≤ 200 行
- [ ] 单个函数: ≤ 50 行
- [ ] 循环复杂度: ≤ 10

### 架构规范

- [ ] 符合五层架构
- [ ] 无循环依赖
- [ ] 无违反分层规则的依赖
- [ ] Feature 间无直接依赖
- [ ] 所有公共接口有类型定义

### 文档完整性

- [ ] README.md 准确
- [ ] SPEC 文档准确
- [ ] API 文档完整
- [ ] 迁移指南清晰
- [ ] CHANGELOG 完整

### 环境兼容性

- [ ] 纯浏览器环境测试通过
- [ ] PyQt 集成环境测试通过
- [ ] 开发环境启动正常
- [ ] 生产构建成功

---

**文档版本**: v002-appendix-testing
**最后更新**: 2025-10-02 12:32:17
**维护者**: 核心团队
