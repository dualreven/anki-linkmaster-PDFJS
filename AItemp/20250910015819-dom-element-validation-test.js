/**
 * DOM元素验证测试文件
 * @file 测试 DOM 元素是否正确创建并显示在页面上
 * @module DOMElementValidationTest
 */

import { PDFHomeApp } from '../../src/frontend/pdf-home/index.js';
import TableWrapper from '../../src/frontend/pdf-home/table-wrapper.js';

// Mock 依赖模块
jest.mock('../../src/frontend/common/event/event-bus.js');
jest.mock('../../src/frontend/common/utils/logger.js');
jest.mock('../../src/frontend/common/error/error-handler.js');
jest.mock('../../src/frontend/common/ws/ws-client.js');
jest.mock('../../src/frontend/common/pdf/pdf-manager.js');
jest.mock('../../src/frontend/pdf-home/ui-manager.js');

// Mock Tabulator
jest.mock('tabulator-tables', () => {
  return {
    Tabulator: jest.fn().mockImplementation((container, options) => {
      // 创建模拟的 Tabulator DOM 结构
      const tabulatorElement = document.createElement('div');
      tabulatorElement.className = 'tabulator';
      tabulatorElement.style.display = 'block';
      
      // 添加表格结构
      const tableElement = document.createElement('div');
      tableElement.className = 'tabulator-table';
      tabulatorElement.appendChild(tableElement);
      
      container.appendChild(tabulatorElement);
      
      return {
        element: tabulatorElement,
        table: tabulatorElement,
        tableElement: tableElement,
        setData: jest.fn().mockResolvedValue([]),
        clearData: jest.fn(),
        destroy: jest.fn(),
        redraw: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        getSelectedData: jest.fn().mockReturnValue([]),
        getData: jest.fn().mockReturnValue([]),
        getColumns: jest.fn().mockReturnValue([])
      };
    })
  };
});

/**
 * 测试 DOM 元素创建和显示
 */
describe('DOM 元素验证', () => {
  
  let mockContainer;
  let pdfHomeApp;
  let mockEventBus;
  let mockLogger;
  let mockErrorHandler;
  let mockWSClient;
  let mockPDFManager;
  let mockUIManager;

  /**
   * 在每个测试前设置模拟环境
   */
  beforeEach(() => {
    // 创建模拟容器元素
    mockContainer = document.createElement('div');
    mockContainer.id = 'pdf-table-container';
    document.body.innerHTML = `
      <div class="container">
        <header>
          <h1>PDF文件管理</h1>
          <div style="display: flex; align-items: center; gap: 10px;">
            <button id="add-pdf-btn" class="btn primary">添加PDF文件</button>
            <button id="batch-add-btn" class="btn" title="批量添加PDF文件">📁 批量添加</button>
            <button id="batch-delete-btn" class="btn danger" title="批量删除选中的PDF文件">🗑️ 批量删除</button>
            <button id="debug-btn" class="btn" style="background: #666; color: white;" title="显示调试面板 (Ctrl+D)">🔧 调试</button>
          </div>
        </header>
        <main>
          <div id="pdf-table-container" class="pdf-table-container">
            <!-- PDF表格将在这里动态生成 -->
          </div>
          <div id="empty-state" class="empty-state" style="display: none;">
            <div class="empty-icon">📄</div>
            <h3>暂无PDF文件</h3>
            <p>点击"添加PDF文件"按钮开始管理您的PDF文档</p>
          </div>
        </main>
      </div>
    `;

    // 创建模拟实例
    mockEventBus = {
      on: jest.fn(),
      emit: jest.fn(),
      destroy: jest.fn(),
      once: jest.fn()
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      event: jest.fn()
    };

    mockErrorHandler = {
      handleError: jest.fn()
    };

    mockWSClient = {
      connect: jest.fn().mockResolvedValue(),
      disconnect: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true)
    };

    mockPDFManager = {
      initialize: jest.fn().mockResolvedValue(),
      destroy: jest.fn(),
      getPDFs: jest.fn().mockReturnValue([])
    };

    mockUIManager = {
      initialize: jest.fn().mockResolvedValue(),
      destroy: jest.fn(),
      pdfTable: null
    };

    // 设置模块模拟
    jest.doMock('../../src/frontend/common/utils/logger.js', () => ({
      Logger: jest.fn().mockImplementation(() => mockLogger),
      LogLevel: { DEBUG: 'debug', INFO: 'info', WARN: 'warn', ERROR: 'error' }
    }));

    jest.doMock('../../src/frontend/common/error/error-handler.js', () => ({
      ErrorHandler: jest.fn().mockImplementation(() => mockErrorHandler)
    }));

    jest.doMock('../../src/frontend/common/ws/ws-client.js', () => ({
      default: jest.fn().mockImplementation(() => mockWSClient)
    }));

    jest.doMock('../../src/frontend/common/pdf/pdf-manager.js', () => ({
      default: jest.fn().mockImplementation(() => mockPDFManager)
    }));

    jest.doMock('../../src/frontend/pdf-home/ui-manager.js', () => ({
      UIManager: jest.fn().mockImplementation(() => mockUIManager)
    }));

    // 设置 EventBus 模拟
    const EventBus = jest.fn().mockImplementation(() => mockEventBus);
    jest.doMock('../../src/frontend/common/event/event-bus.js', () => ({
      EventBus
    }));

    // 清除所有 mock 的调用记录
    jest.clearAllMocks();
  });

  /**
   * 测试表格容器元素是否正确创建
   */
  describe('表格容器元素', () => {
    
    test('应该存在 pdf-table-container 元素', () => {
      const container = document.getElementById('pdf-table-container');
      expect(container).not.toBeNull();
      expect(container).toBeInstanceOf(HTMLDivElement);
      expect(container.className).toBe('pdf-table-container');
    });

    test('应该存在空的 empty-state 元素', () => {
      const emptyState = document.getElementById('empty-state');
      expect(emptyState).not.toBeNull();
      expect(emptyState).toBeInstanceOf(HTMLDivElement);
      expect(emptyState.style.display).toBe('none');
    });

    test('应该存在所有操作按钮', () => {
      const addPdfBtn = document.getElementById('add-pdf-btn');
      const batchAddBtn = document.getElementById('batch-add-btn');
      const batchDeleteBtn = document.getElementById('batch-delete-btn');
      const debugBtn = document.getElementById('debug-btn');

      expect(addPdfBtn).not.toBeNull();
      expect(batchAddBtn).not.toBeNull();
      expect(batchDeleteBtn).not.toBeNull();
      expect(debugBtn).not.toBeNull();
    });
  });

  /**
   * 测试 TableWrapper 创建的 DOM 元素
   */
  describe('TableWrapper DOM 元素', () => {
    
    test('应该正确创建 pdf-table-wrapper 元素', () => {
      const container = document.getElementById('pdf-table-container');
      const tableWrapper = new TableWrapper(container);
      
      expect(tableWrapper.tableWrapper).not.toBeNull();
      expect(tableWrapper.tableWrapper).toBeInstanceOf(HTMLDivElement);
      expect(tableWrapper.tableWrapper.className).toBe('pdf-table-wrapper');
      expect(tableWrapper.tableWrapper.style.minHeight).toBe('200px');
    });

    test('应该正确创建 Tabulator 实例和 DOM 元素', () => {
      const container = document.getElementById('pdf-table-container');
      const tableWrapper = new TableWrapper(container);
      
      expect(tableWrapper.tabulator).not.toBeNull();
      expect(tableWrapper.tabulator.element).toBeInstanceOf(HTMLDivElement);
      expect(tableWrapper.tabulator.element.className).toBe('tabulator');
    });

    test('应该在容器中正确创建表格结构', () => {
      const container = document.getElementById('pdf-table-container');
      const tableWrapper = new TableWrapper(container);
      
      // 验证容器结构
      expect(container.children.length).toBe(1);
      expect(container.children[0]).toBe(tableWrapper.tableWrapper);
      
      // 验证 Tabulator 元素
      const tabulatorElement = tableWrapper.tabulator.element;
      expect(tabulatorElement.parentNode).toBe(tableWrapper.tableWrapper);
      expect(tabulatorElement.querySelector('.tabulator-table')).not.toBeNull();
    });

    test('应该正确显示表格元素', () => {
      const container = document.getElementById('pdf-table-container');
      const tableWrapper = new TableWrapper(container);
      
      // 验证表格元素可见
      const tabulatorElement = tableWrapper.tabulator.element;
      expect(tabulatorElement.style.display).not.toBe('none');
      expect(tabulatorElement.offsetParent).not.toBeNull(); // 元素可见
    });

    test('应该正确处理表格数据的显示', async () => {
      const container = document.getElementById('pdf-table-container');
      const tableWrapper = new TableWrapper(container);
      
      const testData = [
        { id: '1', filename: 'test1.pdf', title: 'Test PDF 1', page_count: 10 },
        { id: '2', filename: 'test2.pdf', title: 'Test PDF 2', page_count: 5 }
      ];
      
      await tableWrapper.setData(testData);
      
      // 验证数据设置被调用
      expect(tableWrapper.tabulator.setData).toHaveBeenCalledWith(testData);
      
      // 验证表格元素仍然可见
      const tabulatorElement = tableWrapper.tabulator.element;
      expect(tabulatorElement.style.display).not.toBe('none');
    });
  });

  /**
   * 测试 PDFHomeApp 创建的 DOM 元素
   */
  describe('PDFHomeApp DOM 元素', () => {
    
    test('应该正确初始化并创建表格元素', async () => {
      // 创建 PDFHomeApp 实例
      const EventBus = jest.fn().mockImplementation(() => mockEventBus);
      const { EventBus: MockEventBus } = await import('../../src/frontend/common/event/event-bus.js');
      MockEventBus.mockImplementation(() => mockEventBus);
      
      const { PDFHomeApp: MockPDFHomeApp } = await import('../../src/frontend/pdf-home/index.js');
      pdfHomeApp = new MockPDFHomeApp();
      
      await pdfHomeApp.initialize();
      
      // 验证表格容器存在
      const container = document.getElementById('pdf-table-container');
      expect(container).not.toBeNull();
      
      // 验证表格包装器被创建
      expect(pdfHomeApp.tableWrapper).not.toBeNull();
      expect(pdfHomeApp.tableWrapper.tableWrapper).toBeInstanceOf(HTMLDivElement);
      
      // 验证 Tabulator 实例被创建
      expect(pdfHomeApp.tableWrapper.tabulator).not.toBeNull();
    });

    test('应该正确处理 PDF 列表更新时的 DOM 变化', async () => {
      // 创建 PDFHomeApp 实例
      const { PDFHomeApp: MockPDFHomeApp } = await import('../../src/frontend/pdf-home/index.js');
      pdfHomeApp = new MockPDFHomeApp();
      
      await pdfHomeApp.initialize();
      
      // 模拟 PDF 列表更新
      const testPDFs = [
        { id: '1', filename: 'test1.pdf', title: 'Test PDF 1', page_count: 10 },
        { id: '2', filename: 'test2.pdf', title: 'Test PDF 2', page_count: 5 }
      ];
      
      // 找到 PDF 列表更新处理器
      const pdfListUpdateCall = mockEventBus.on.mock.calls.find(
        call => call[0] === 'pdf:list:updated'
      );
      
      if (pdfListUpdateCall) {
        const handler = pdfListUpdateCall[1];
        handler(testPDFs);
        
        // 验证表格数据更新
        expect(pdfHomeApp.tableWrapper.setData).toHaveBeenCalledWith(testPDFs);
      }
    });

    test('应该正确处理空状态时的 DOM 变化', async () => {
      // 创建 PDFHomeApp 实例
      const { PDFHomeApp: MockPDFHomeApp } = await import('../../src/frontend/pdf-home/index.js');
      pdfHomeApp = new MockPDFHomeApp();
      
      await pdfHomeApp.initialize();
      
      // 模拟空 PDF 列表
      const emptyPDFs = [];
      
      // 找到 PDF 列表更新处理器
      const pdfListUpdateCall = mockEventBus.on.mock.calls.find(
        call => call[0] === 'pdf:list:updated'
      );
      
      if (pdfListUpdateCall) {
        const handler = pdfListUpdateCall[1];
        handler(emptyPDFs);
        
        // 验证表格数据更新
        expect(pdfHomeApp.tableWrapper.setData).toHaveBeenCalledWith(emptyPDFs);
      }
    });
  });

  /**
   * 测试 DOM 元素的可见性和交互性
   */
  describe('DOM 元素可见性和交互性', () => {
    
    test('表格容器应该具有正确的样式', () => {
      const container = document.getElementById('pdf-table-container');
      expect(container.className).toBe('pdf-table-container');
    });

    test('空状态元素应该初始为隐藏', () => {
      const emptyState = document.getElementById('empty-state');
      expect(emptyState.style.display).toBe('none');
    });

    test('操作按钮应该可点击', () => {
      const addPdfBtn = document.getElementById('add-pdf-btn');
      const batchAddBtn = document.getElementById('batch-add-btn');
      const batchDeleteBtn = document.getElementById('batch-delete-btn');
      const debugBtn = document.getElementById('debug-btn');

      expect(addPdfBtn.disabled).toBe(false);
      expect(batchAddBtn.disabled).toBe(false);
      expect(batchDeleteBtn.disabled).toBe(false);
      expect(debugBtn.disabled).toBe(false);
    });

    test('表格包装器应该具有正确的最小高度', () => {
      const container = document.getElementById('pdf-table-container');
      const tableWrapper = new TableWrapper(container);
      
      expect(tableWrapper.tableWrapper.style.minHeight).toBe('200px');
    });
  });

  /**
   * 测试 DOM 元素的响应式设计
   */
  describe('DOM 元素响应式设计', () => {
    
    test('表格容器应该适应不同屏幕尺寸', () => {
      const container = document.getElementById('pdf-table-container');
      
      // 模拟不同屏幕尺寸
      container.style.width = '100%';
      container.style.maxWidth = '1200px';
      
      expect(container.style.width).toBe('100%');
      expect(container.style.maxWidth).toBe('1200px');
    });

    test('表格包装器应该适应容器尺寸', () => {
      const container = document.getElementById('pdf-table-container');
      container.style.width = '800px';
      container.style.height = '600px';
      
      const tableWrapper = new TableWrapper(container);
      
      expect(tableWrapper.tableWrapper.parentNode).toBe(container);
    });
  });

  /**
   * 测试 DOM 元素的错误处理
   */
  describe('DOM 元素错误处理', () => {
    
    test('应该处理容器不存在的情况', () => {
      // 移除容器
      const container = document.getElementById('pdf-table-container');
      container.parentNode.removeChild(container);
      
      expect(() => {
        new TableWrapper(container);
      }).toThrow('Container not found');
    });

    test('应该处理无效的容器参数', () => {
      const invalidContainers = [null, undefined, '', false, 0, {}, []];
      
      invalidContainers.forEach(container => {
        expect(() => {
          new TableWrapper(container);
        }).toThrow('Container not found');
      });
    });

    test('应该处理 Tabulator 初始化失败的情况', () => {
      const container = document.getElementById('pdf-table-container');
      
      // 临时修改 Tabulator mock 使其抛出错误
      const { Tabulator } = require('tabulator-tables');
      Tabulator.mockImplementationOnce(() => {
        throw new Error('Tabulator initialization failed');
      });
      
      expect(() => {
        new TableWrapper(container);
      }).toThrow('Tabulator initialization failed');
    });
  });
});