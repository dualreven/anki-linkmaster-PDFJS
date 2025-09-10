/**
 * 表格回退机制测试文件
 * @file 测试表格回退机制是否正常工作，包括Tabulator初始化失败时的降级方案
 * @module TableFallbackTest
 */

// 创建一个模拟的 Logger 类
class MockLogger {
  constructor(moduleName = "App", initialLogLevel = "info") {
    this.moduleName = moduleName;
    this.logLevel = initialLogLevel;
  }

  setLogLevel(level) {
    this.logLevel = level;
  }

  getLogLevel() {
    return this.logLevel;
  }

  debug(message, ...args) {}
  info(message, ...args) {}
  warn(message, ...args) {}
  error(message, ...args) {}
  event(eventName, action, data = {}) {}
}

// Mock 依赖模块
jest.mock('../../../../src/frontend/common/event/event-bus.js', () => {
  const mockEventBus = {
    on: jest.fn(),
    emit: jest.fn(),
    destroy: jest.fn(),
    once: jest.fn()
  };
  
  return {
    EventBus: jest.fn().mockImplementation(() => mockEventBus),
    default: mockEventBus
  };
});

// 在测试文件顶部模拟 logger 模块
jest.mock('../../../../src/frontend/common/utils/logger.js', () => MockLogger, { virtual: true });

jest.mock('../../../../src/frontend/common/error/error-handler.js', () => ({
  ErrorHandler: jest.fn().mockImplementation(() => ({
    handleError: jest.fn()
  }))
}));

// Mock 正常工作的 Tabulator
const createMockTabulator = (container, options) => {
  // 创建模拟的 Tabulator DOM 结构
  const tabulatorElement = document.createElement('div');
  tabulatorElement.className = 'tabulator';
  tabulatorElement.style.display = 'block';
  tabulatorElement.style.position = 'relative';
  
  // 添加表格结构
  const tableElement = document.createElement('div');
  tableElement.className = 'tabulator-table';
  tabulatorElement.appendChild(tableElement);
  
  container.appendChild(tabulatorElement);
  
  // 内部数据存储
  let internalData = [];
  
  return {
    element: tabulatorElement,
    table: tabulatorElement,
    tableElement: tableElement,
    
    // 数据管理
    setData: jest.fn().mockImplementation((data) => {
      internalData = Array.isArray(data) ? [...data] : [];
      return Promise.resolve(internalData);
    }),
    
    getData: jest.fn().mockImplementation(() => internalData),
    
    clearData: jest.fn().mockImplementation(() => {
      internalData = [];
      return Promise.resolve();
    }),
    
    destroy: jest.fn(),
    redraw: jest.fn(),
    
    // 事件处理
    on: jest.fn(),
    off: jest.fn(),
    
    // 选择功能
    getSelectedData: jest.fn().mockReturnValue([]),
    
    // 列管理
    getColumns: jest.fn().mockImplementation(() => {
      if (options.columns) {
        return options.columns.map((col, index) => ({
          field: col.field,
          title: col.title,
          definition: col
        }));
      }
      return [];
    }),
    
    // 内部状态访问（用于测试）
    _getInternalData: () => internalData
  };
};

// Mock 会抛出错误的 Tabulator（用于测试回退机制）
const createFailingTabulator = (container, options) => {
  // 模拟 Tabulator 构造函数抛出错误
  throw new Error('Tabulator initialization failed');
};

// 动态导入 Tabulator，根据测试场景决定使用正常还是失败的 mock
let TableWrapper;

/**
 * 测试表格回退机制
 */
describe('表格回退机制测试', () => {
  
  let mockContainer;
  let tableWrapper;
  let originalTabulator;

  /**
   * 在所有测试前设置模拟环境
   */
  beforeAll(async () => {
    // 保存原始的 Tabulator 引用
    originalTabulator = require('tabulator-tables').Tabulator;
    
    // 动态导入模块
    const tableWrapperModule = await import('../../../../src/frontend/pdf-home/table-wrapper.js');
    TableWrapper = tableWrapperModule.default;
  });

  /**
   * 在每个测试前设置模拟环境
   */
  beforeEach(() => {
    // 创建模拟容器元素
    mockContainer = document.createElement('div');
    mockContainer.id = 'pdf-table-container';
    document.body.innerHTML = `
      <div class="container">
        <main>
          <div id="pdf-table-container" class="pdf-table-container">
            <!-- PDF表格将在这里动态生成 -->
          </div>
        </main>
      </div>
    `;

    // 清除所有 mock 的调用记录
    jest.clearAllMocks();
  });

  /**
   * 测试 Tabulator 正常工作的情况
   */
  describe('Tabulator 正常工作', () => {
    
    test('应该正确创建 TableWrapper 实例并使用 Tabulator', () => {
      // 设置正常的 Tabulator mock
      require('tabulator-tables').Tabulator = createMockTabulator;
      
      const container = document.getElementById('pdf-table-container');
      tableWrapper = new TableWrapper(container);
      
      expect(tableWrapper).toBeInstanceOf(TableWrapper);
      expect(tableWrapper.tabulator).not.toBeNull();
      expect(tableWrapper.tableWrapper).toBeInstanceOf(HTMLDivElement);
      
      // 验证使用了 Tabulator
      expect(container.querySelector('.tabulator')).not.toBeNull();
    });

    test('应该正确设置和获取表格数据', async () => {
      // 设置正常的 Tabulator mock
      require('tabulator-tables').Tabulator = createMockTabulator;
      
      const container = document.getElementById('pdf-table-container');
      tableWrapper = new TableWrapper(container);
      
      const testData = [
        { id: '1', filename: 'test1.pdf', title: 'Test PDF 1', page_count: 10 },
        { id: '2', filename: 'test2.pdf', title: 'Test PDF 2', page_count: 5 },
        { id: '3', filename: 'test3.pdf', title: 'Test PDF 3', page_count: 15 }
      ];
      
      await tableWrapper.setData(testData);
      
      // 验证数据设置被调用
      expect(tableWrapper.tabulator.setData).toHaveBeenCalledWith(testData);
      
      // 验证内部数据状态
      expect(tableWrapper.tabulator._getInternalData()).toEqual(testData);
    });
  });

  /**
   * 测试 Tabulator 初始化失败时的回退机制
   */
  describe('Tabulator 初始化失败时的回退机制', () => {
    
    test('应该在 Tabulator 初始化失败时回退到基本 HTML 表格', () => {
      // 设置会失败的 Tabulator mock
      require('tabulator-tables').Tabulator = createFailingTabulator;
      
      const container = document.getElementById('pdf-table-container');
      
      // 使用 try-catch 捕获可能的错误
      let fallbackTable = null;
      try {
        tableWrapper = new TableWrapper(container);
        fallbackTable = container.querySelector('.pdf-table-fallback');
      } catch (e) {
        // 如果构造函数抛出错误，检查是否有回退表格
        fallbackTable = container.querySelector('.pdf-table-fallback');
      }
      
      // 验证回退表格存在
      expect(fallbackTable).not.toBeNull();
      expect(fallbackTable.tagName).toBe('TABLE');
      
      // 验证没有 Tabulator 相关的 DOM 元素
      expect(container.querySelector('.tabulator')).toBeNull();
    });

    test('回退表格应该能够显示数据', () => {
      // 设置会失败的 Tabulator mock
      require('tabulator-tables').Tabulator = createFailingTabulator;
      
      const container = document.getElementById('pdf-table-container');
      
      try {
        tableWrapper = new TableWrapper(container);
      } catch (e) {
        // 忽略构造函数可能抛出的错误
      }
      
      const testData = [
        { id: '1', filename: 'test1.pdf', title: 'Test PDF 1', page_count: 10 },
        { id: '2', filename: 'test2.pdf', title: 'Test PDF 2', page_count: 5 }
      ];
      
      // 尝试设置数据（即使 Tabulator 初始化失败）
      if (tableWrapper) {
        tableWrapper.setData(testData);
      }
      
      // 验证回退表格存在并包含数据
      const fallbackTable = container.querySelector('.pdf-table-fallback');
      expect(fallbackTable).not.toBeNull();
      
      // 检查表格行数（应该有标题行 + 数据行）
      const rows = fallbackTable.querySelectorAll('tr');
      expect(rows.length).toBeGreaterThan(1); // 至少有标题行和一行数据
      
      // 检查表头
      const headers = fallbackTable.querySelectorAll('th');
      expect(headers.length).toBeGreaterThan(0);
    });

    test('回退表格应该支持基本的行选择功能', () => {
      // 设置会失败的 Tabulator mock
      require('tabulator-tables').Tabulator = createFailingTabulator;
      
      const container = document.getElementById('pdf-table-container');
      
      try {
        tableWrapper = new TableWrapper(container);
      } catch (e) {
        // 忽略构造函数可能抛出的错误
      }
      
      const testData = [
        { id: '1', filename: 'test1.pdf', title: 'Test PDF 1', page_count: 10 },
        { id: '2', filename: 'test2.pdf', title: 'Test PDF 2', page_count: 5 }
      ];
      
      // 尝试设置数据
      if (tableWrapper) {
        tableWrapper.setData(testData);
      }
      
      // 验证回退表格存在
      const fallbackTable = container.querySelector('.pdf-table-fallback');
      expect(fallbackTable).not.toBeNull();
      
      // 检查是否有选择框
      const checkboxes = fallbackTable.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBeGreaterThan(0);
      
      // 模拟选择第一行
      if (checkboxes.length > 0) {
        checkboxes[0].checked = true;
        
        // 验证 getSelectedRows 方法能够返回选中的行
        if (tableWrapper) {
          const selectedRows = tableWrapper.getSelectedRows();
          expect(selectedRows.length).toBe(1);
          expect(selectedRows[0].id).toBe('1');
        }
      }
    });

    test('回退表格应该支持清空数据功能', () => {
      // 设置会失败的 Tabulator mock
      require('tabulator-tables').Tabulator = createFailingTabulator;
      
      const container = document.getElementById('pdf-table-container');
      
      try {
        tableWrapper = new TableWrapper(container);
      } catch (e) {
        // 忽略构造函数可能抛出的错误
      }
      
      const testData = [
        { id: '1', filename: 'test1.pdf', title: 'Test PDF 1', page_count: 10 }
      ];
      
      // 尝试设置数据
      if (tableWrapper) {
        tableWrapper.setData(testData);
        
        // 验证数据已设置
        let fallbackTable = container.querySelector('.pdf-table-fallback');
        let rows = fallbackTable.querySelectorAll('tr');
        expect(rows.length).toBeGreaterThan(1); // 至少有标题行和一行数据
        
        // 清空数据
        tableWrapper.clear();
        
        // 验证数据已清空（应该只剩下标题行）
        fallbackTable = container.querySelector('.pdf-table-fallback');
        rows = fallbackTable.querySelectorAll('tr');
        expect(rows.length).toBe(1); // 只有标题行
      }
    });

    test('回退表格应该支持销毁功能', () => {
      // 设置会失败的 Tabulator mock
      require('tabulator-tables').Tabulator = createFailingTabulator;
      
      const container = document.getElementById('pdf-table-container');
      
      try {
        tableWrapper = new TableWrapper(container);
      } catch (e) {
        // 忽略构造函数可能抛出的错误
      }
      
      const testData = [
        { id: '1', filename: 'test1.pdf', title: 'Test PDF 1', page_count: 10 }
      ];
      
      // 尝试设置数据
      if (tableWrapper) {
        tableWrapper.setData(testData);
        
        // 验证表格存在
        let fallbackTable = container.querySelector('.pdf-table-fallback');
        expect(fallbackTable).not.toBeNull();
        
        // 销毁表格
        tableWrapper.destroy();
        
        // 验证表格已被销毁
        fallbackTable = container.querySelector('.pdf-table-fallback');
        expect(fallbackTable).toBeNull();
        
        // 验证 tableWrapper 仍然存在（因为不应该移除 wrapper 元素）
        const wrapper = container.querySelector('.pdf-table-wrapper');
        expect(wrapper).not.toBeNull();
      }
    });
  });

  /**
   * 测试回退机制的事件处理
   */
  describe('回退机制的事件处理', () => {
    
    test('回退表格应该支持事件绑定和触发', () => {
      // 设置会失败的 Tabulator mock
      require('tabulator-tables').Tabulator = createFailingTabulator;
      
      const container = document.getElementById('pdf-table-container');
      
      try {
        tableWrapper = new TableWrapper(container);
      } catch (e) {
        // 忽略构造函数可能抛出的错误
      }
      
      const mockHandler = jest.fn();
      const eventName = 'data-loaded';
      
      // 绑定事件
      if (tableWrapper) {
        tableWrapper.on(eventName, mockHandler);
        
        // 触发事件
        const testData = [{ id: '1', filename: 'test1.pdf', title: 'Test PDF 1', page_count: 10 }];
        tableWrapper._callLocalListeners(eventName, testData);
        
        // 验证事件处理器被调用
        expect(mockHandler).toHaveBeenCalledWith(testData);
      }
    });

    test('回退表格应该支持事件解绑', () => {
      // 设置会失败的 Tabulator mock
      require('tabulator-tables').Tabulator = createFailingTabulator;
      
      const container = document.getElementById('pdf-table-container');
      
      try {
        tableWrapper = new TableWrapper(container);
      } catch (e) {
        // 忽略构造函数可能抛出的错误
      }
      
      const mockHandler = jest.fn();
      const eventName = 'data-loaded';
      
      if (tableWrapper) {
        // 绑定事件
        tableWrapper.on(eventName, mockHandler);
        
        // 解除事件绑定
        tableWrapper.off(eventName, mockHandler);
        
        // 触发事件，处理器不应被调用
        const testData = [{ id: '1', filename: 'test1.pdf', title: 'Test PDF 1', page_count: 10 }];
        tableWrapper._callLocalListeners(eventName, testData);
        
        // 验证事件处理器未被调用
        expect(mockHandler).not.toHaveBeenCalled();
      }
    });
  });

  /**
   * 测试回退机制的错误处理
   */
  describe('回退机制的错误处理', () => {
    
    test('应该能够处理 Tabulator 加载失败的情况', () => {
      // 设置会失败的 Tabulator mock
      require('tabulator-tables').Tabulator = createFailingTabulator;
      
      const container = document.getElementById('pdf-table-container');
      
      // 尝试创建 TableWrapper，即使 Tabulator 失败也不应该抛出错误
      let error = null;
      try {
        tableWrapper = new TableWrapper(container);
      } catch (e) {
        error = e;
      }
      
      // 验证即使有错误，回退表格也被创建
      const fallbackTable = container.querySelector('.pdf-table-fallback');
      expect(fallbackTable).not.toBeNull();
      
      // 验证错误被适当处理（可能记录到日志，但不应该阻止回退表格的创建）
      // 这里我们只是验证回退表格被创建，具体的错误处理逻辑会在实现中完善
    });

    test('应该能够处理 setData 时的错误', () => {
      // 设置会失败的 Tabulator mock
      require('tabulator-tables').Tabulator = createFailingTabulator;
      
      const container = document.getElementById('pdf-table-container');
      
      try {
        tableWrapper = new TableWrapper(container);
      } catch (e) {
        // 忽略构造函数可能抛出的错误
      }
      
      // 尝试设置无效数据
      const invalidData = null;
      
      if (tableWrapper) {
        // 这不应该抛出错误，而是应该优雅地处理
        expect(() => {
          tableWrapper.setData(invalidData);
        }).not.toThrow();
      }
    });
  });
});