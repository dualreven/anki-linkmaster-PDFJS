/**
 * 表格功能测试文件
 * @file 测试表格功能是否正常工作，包括排序、筛选、分页等核心功能
 * @module TableFunctionalityTest
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

jest.mock('../../../../src/frontend/common/ws/ws-client.js', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(),
    disconnect: jest.fn(),
    isConnected: jest.fn().mockReturnValue(true)
  }));
});

jest.mock('../../../../src/frontend/common/pdf/pdf-manager.js', () => {
  return jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(),
    destroy: jest.fn(),
    getPDFs: jest.fn().mockReturnValue([])
  }));
});

jest.mock('../../../../src/frontend/pdf-home/ui-manager.js', () => ({
  UIManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(),
    destroy: jest.fn(),
    pdfTable: null
  }))
});

// Mock Tabulator with enhanced functionality for testing sorting, filtering, pagination
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
  
  // 添加表头
  const headerElement = document.createElement('div');
  headerElement.className = 'tabulator-header';
  tabulatorElement.appendChild(headerElement);
  
  // 添加表格内容
  const tableHolderElement = document.createElement('div');
  tableHolderElement.className = 'tabulator-tableHolder';
  tabulatorElement.appendChild(tableHolderElement);
  
  container.appendChild(tabulatorElement);
  
  // 内部数据存储
  let internalData = [];
  let currentSort = null;
  let currentFilter = null;
  let currentPage = 1;
  const pageSize = options.paginationSize || 10;
  
  // 模拟排序功能
  const applySort = (data, sorters) => {
    if (!sorters || sorters.length === 0) return data;
    
    return [...data].sort((a, b) => {
      for (const sorter of sorters) {
        const { field, dir } = sorter;
        const aVal = a[field];
        const bVal = b[field];
        
        if (aVal < bVal) return dir === 'asc' ? -1 : 1;
        if (aVal > bVal) return dir === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };
  
  // 模拟筛选功能
  const applyFilter = (data, filters) => {
    if (!filters || filters.length === 0) return data;
    
    return data.filter(row => {
      return filters.every(filter => {
        const { field, value } = filter;
        const rowValue = String(row[field] || '').toLowerCase();
        const filterValue = String(value || '').toLowerCase();
        return rowValue.includes(filterValue);
      });
    });
  };
  
  // 模拟分页功能
  const applyPagination = (data) => {
    if (!options.pagination) return data;
    
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  };
  
  return {
    element: tabulatorElement,
    table: tabulatorElement,
    tableElement: tableElement,
    
    // 数据管理
    setData: jest.fn().mockImplementation((data) => {
      internalData = Array.isArray(data) ? [...data] : [];
      return Promise.resolve(internalData);
    }),
    
    getData: jest.fn().mockImplementation(() => {
      let processedData = [...internalData];
      
      // 应用筛选
      if (currentFilter) {
        processedData = applyFilter(processedData, currentFilter);
      }
      
      // 应用排序
      if (currentSort) {
        processedData = applySort(processedData, currentSort);
      }
      
      // 应用分页
      processedData = applyPagination(processedData);
      
      return processedData;
    }),
    
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
    selectRow: jest.fn(),
    deselectRow: jest.fn(),
    
    // 排序功能
    setSort: jest.fn().mockImplementation((sorters) => {
      currentSort = Array.isArray(sorters) ? sorters : [sorters];
      return Promise.resolve();
    }),
    
    getSorters: jest.fn().mockImplementation(() => currentSort || []),
    
    // 筛选功能
    setFilter: jest.fn().mockImplementation((field, value) => {
      currentFilter = [{ field, value }];
      return Promise.resolve();
    }),
    
    addFilter: jest.fn().mockImplementation((field, value) => {
      currentFilter = currentFilter || [];
      currentFilter.push({ field, value });
      return Promise.resolve();
    }),
    
    removeFilter: jest.fn().mockImplementation((field) => {
      if (currentFilter) {
        currentFilter = currentFilter.filter(f => f.field !== field);
      }
      return Promise.resolve();
    }),
    
    clearFilter: jest.fn().mockImplementation(() => {
      currentFilter = null;
      return Promise.resolve();
    }),
    
    getFilters: jest.fn().mockImplementation(() => currentFilter || []),
    
    // 分页功能
    setPage: jest.fn().mockImplementation((page) => {
      currentPage = page;
      return Promise.resolve();
    }),
    
    getPage: jest.fn().mockImplementation(() => currentPage),
    
    getPageSize: jest.fn().mockImplementation(() => pageSize),
    
    setPageCount: jest.fn(),
    
    getPageMax: jest.fn().mockImplementation(() => {
      let filteredData = [...internalData];
      if (currentFilter) {
        filteredData = applyFilter(filteredData, currentFilter);
      }
      return Math.ceil(filteredData.length / pageSize);
    }),
    
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
    _getInternalData: () => internalData,
    _getCurrentSort: () => currentSort,
    _getCurrentFilter: () => currentFilter,
    _getCurrentPage: () => currentPage
  };
};

jest.mock('tabulator-tables', () => {
  return {
    Tabulator: jest.fn().mockImplementation(createMockTabulator)
  };
});

// 在测试文件中动态导入 PDFHomeApp
let PDFHomeApp;
let TableWrapper;

/**
 * 测试表格功能
 */
describe('表格功能测试', () => {
  
  let mockContainer;
  let tableWrapper;
  let mockEventBus;
  let mockLogger;
  let mockErrorHandler;
  let mockWSClient;
  let mockPDFManager;
  let mockUIManager;

  /**
   * 在所有测试前设置模拟环境
   */
  beforeAll(async () => {
    // 动态导入模块
    const pdfHomeModule = await import('../../../../src/frontend/pdf-home/index.js');
    PDFHomeApp = pdfHomeModule.PDFHomeApp;
    
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

    // 清除所有 mock 的调用记录
    jest.clearAllMocks();
  });

  /**
   * 测试表格基本功能
   */
  describe('表格基本功能', () => {
    
    test('应该正确创建 TableWrapper 实例', () => {
      const container = document.getElementById('pdf-table-container');
      tableWrapper = new TableWrapper(container);
      
      expect(tableWrapper).toBeInstanceOf(TableWrapper);
      expect(tableWrapper.tabulator).not.toBeNull();
      expect(tableWrapper.tableWrapper).toBeInstanceOf(HTMLDivElement);
    });

    test('应该正确设置和获取表格数据', async () => {
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

    test('应该正确清空表格数据', async () => {
      const container = document.getElementById('pdf-table-container');
      tableWrapper = new TableWrapper(container);
      
      const testData = [
        { id: '1', filename: 'test1.pdf', title: 'Test PDF 1', page_count: 10 }
      ];
      
      await tableWrapper.setData(testData);
      tableWrapper.clear();
      
      // 验证清空数据被调用
      expect(tableWrapper.tabulator.clearData).toHaveBeenCalled();
      
      // 验证内部数据状态
      expect(tableWrapper.tabulator._getInternalData()).toEqual([]);
    });

    test('应该正确获取选中的行数据', () => {
      const container = document.getElementById('pdf-table-container');
      tableWrapper = new TableWrapper(container);
      
      const selectedData = [
        { id: '1', filename: 'test1.pdf', title: 'Test PDF 1', page_count: 10 }
      ];
      
      // 设置模拟的选中数据
      tableWrapper.tabulator.getSelectedData.mockReturnValue(selectedData);
      
      const result = tableWrapper.getSelectedRows();
      
      expect(result).toEqual(selectedData);
      expect(tableWrapper.tabulator.getSelectedData).toHaveBeenCalled();
    });
  });

  /**
   * 测试表格排序功能
   */
  describe('表格排序功能', () => {
    
    test('应该正确设置单列排序', async () => {
      const container = document.getElementById('pdf-table-container');
      tableWrapper = new TableWrapper(container);
      
      const sorter = { field: 'filename', dir: 'asc' };
      
      await tableWrapper.tabulator.setSort(sorter);
      
      expect(tableWrapper.tabulator.setSort).toHaveBeenCalledWith(sorter);
      expect(tableWrapper.tabulator._getCurrentSort()).toEqual([sorter]);
    });

    test('应该正确设置多列排序', async () => {
      const container = document.getElementById('pdf-table-container');
      tableWrapper = new TableWrapper(container);
      
      const sorters = [
        { field: 'filename', dir: 'asc' },
        { field: 'page_count', dir: 'desc' }
      ];
      
      await tableWrapper.tabulator.setSort(sorters);
      
      expect(tableWrapper.tabulator.setSort).toHaveBeenCalledWith(sorters);
      expect(tableWrapper.tabulator._getCurrentSort()).toEqual(sorters);
    });

    test('应该正确获取当前排序设置', () => {
      const container = document.getElementById('pdf-table-container');
      tableWrapper = new TableWrapper(container);
      
      const sorters = [
        { field: 'filename', dir: 'asc' },
        { field: 'page_count', dir: 'desc' }
      ];
      
      // 设置模拟的排序数据
      tableWrapper.tabulator._getCurrentSort = () => sorters;
      
      const result = tableWrapper.tabulator.getSorters();
      
      expect(result).toEqual(sorters);
      expect(tableWrapper.tabulator.getSorters).toHaveBeenCalled();
    });

    test('应该正确应用排序到数据', async () => {
      const container = document.getElementById('pdf-table-container');
      tableWrapper = new TableWrapper(container);
      
      const testData = [
        { id: '1', filename: 'c.pdf', title: 'C PDF', page_count: 10 },
        { id: '2', filename: 'a.pdf', title: 'A PDF', page_count: 5 },
        { id: '3', filename: 'b.pdf', title: 'B PDF', page_count: 15 }
      ];
      
      await tableWrapper.setData(testData);
      
      // 设置按文件名升序排序
      const sorter = { field: 'filename', dir: 'asc' };
      await tableWrapper.tabulator.setSort(sorter);
      
      // 获取排序后的数据
      const sortedData = tableWrapper.tabulator.getData();
      
      // 验证排序结果
      expect(sortedData[0].filename).toBe('a.pdf');
      expect(sortedData[1].filename).toBe('b.pdf');
      expect(sortedData[2].filename).toBe('c.pdf');
    });
  });

  /**
   * 测试表格筛选功能
   */
  describe('表格筛选功能', () => {
    
    test('应该正确设置单一筛选条件', async () => {
      const container = document.getElementById('pdf-table-container');
      tableWrapper = new TableWrapper(container);
      
      const field = 'filename';
      const value = 'test';
      
      await tableWrapper.tabulator.setFilter(field, value);
      
      expect(tableWrapper.tabulator.setFilter).toHaveBeenCalledWith(field, value);
      expect(tableWrapper.tabulator._getCurrentFilter()).toEqual([{ field, value }]);
    });

    test('应该正确添加多个筛选条件', async () => {
      const container = document.getElementById('pdf-table-container');
      tableWrapper = new TableWrapper(container);
      
      // 添加第一个筛选条件
      await tableWrapper.tabulator.addFilter('filename', 'test');
      
      // 添加第二个筛选条件
      await tableWrapper.tabulator.addFilter('title', 'PDF');
      
      expect(tableWrapper.tabulator.addFilter).toHaveBeenCalledTimes(2);
      expect(tableWrapper.tabulator._getCurrentFilter()).toEqual([
        { field: 'filename', value: 'test' },
        { field: 'title', value: 'PDF' }
      ]);
    });

    test('应该正确移除指定筛选条件', async () => {
      const container = document.getElementById('pdf-table-container');
      tableWrapper = new TableWrapper(container);
      
      // 添加多个筛选条件
      await tableWrapper.tabulator.addFilter('filename', 'test');
      await tableWrapper.tabulator.addFilter('title', 'PDF');
      
      // 移除一个筛选条件
      await tableWrapper.tabulator.removeFilter('filename');
      
      expect(tableWrapper.tabulator.removeFilter).toHaveBeenCalledWith('filename');
      expect(tableWrapper.tabulator._getCurrentFilter()).toEqual([
        { field: 'title', value: 'PDF' }
      ]);
    });

    test('应该正确清空所有筛选条件', async () => {
      const container = document.getElementById('pdf-table-container');
      tableWrapper = new TableWrapper(container);
      
      // 添加多个筛选条件
      await tableWrapper.tabulator.addFilter('filename', 'test');
      await tableWrapper.tabulator.addFilter('title', 'PDF');
      
      // 清空所有筛选条件
      await tableWrapper.tabulator.clearFilter();
      
      expect(tableWrapper.tabulator.clearFilter).toHaveBeenCalled();
      expect(tableWrapper.tabulator._getCurrentFilter()).toBeNull();
    });

    test('应该正确获取当前筛选条件', () => {
      const container = document.getElementById('pdf-table-container');
      tableWrapper = new TableWrapper(container);
      
      const filters = [
        { field: 'filename', value: 'test' },
        { field: 'title', value: 'PDF' }
      ];
      
      // 设置模拟的筛选数据
      tableWrapper.tabulator._getCurrentFilter = () => filters;
      
      const result = tableWrapper.tabulator.getFilters();
      
      expect(result).toEqual(filters);
      expect(tableWrapper.tabulator.getFilters).toHaveBeenCalled();
    });

    test('应该正确应用筛选到数据', async () => {
      const container = document.getElementById('pdf-table-container');
      tableWrapper = new TableWrapper(container);
      
      const testData = [
        { id: '1', filename: 'test1.pdf', title: 'Test PDF 1', page_count: 10 },
        { id: '2', filename: 'example.pdf', title: 'Example PDF', page_count: 5 },
        { id: '3', filename: 'test2.pdf', title: 'Test PDF 2', page_count: 15 }
      ];
      
      await tableWrapper.setData(testData);
      
      // 设置筛选条件：文件名包含 'test'
      await tableWrapper.tabulator.setFilter('filename', 'test');
      
      // 获取筛选后的数据
      const filteredData = tableWrapper.tabulator.getData();
      
      // 验证筛选结果
      expect(filteredData.length).toBe(2);
      expect(filteredData[0].filename).toBe('test1.pdf');
      expect(filteredData[1].filename).toBe('test2.pdf');
    });
  });

  /**
   * 测试表格分页功能
   */
  describe('表格分页功能', () => {
    
    test('应该正确设置当前页码', async () => {
      const container = document.getElementById('pdf-table-container');
      
      // 创建带分页的表格
      tableWrapper = new TableWrapper(container, {
        pagination: true,
        paginationSize: 5
      });
      
      const page = 2;
      
      await tableWrapper.tabulator.setPage(page);
      
      expect(tableWrapper.tabulator.setPage).toHaveBeenCalledWith(page);
      expect(tableWrapper.tabulator._getCurrentPage()).toBe(page);
    });

    test('应该正确获取当前页码', () => {
      const container = document.getElementById('pdf-table-container');
      
      // 创建带分页的表格
      tableWrapper = new TableWrapper(container, {
        pagination: true,
        paginationSize: 5
      });
      
      const currentPage = 3;
      
      // 设置模拟的当前页码
      tableWrapper.tabulator._getCurrentPage = () => currentPage;
      
      const result = tableWrapper.tabulator.getPage();
      
      expect(result).toBe(currentPage);
      expect(tableWrapper.tabulator.getPage).toHaveBeenCalled();
    });

    test('应该正确获取每页大小', () => {
      const container = document.getElementById('pdf-table-container');
      
      const pageSize = 10;
      
      // 创建带分页的表格
      tableWrapper = new TableWrapper(container, {
        pagination: true,
        paginationSize: pageSize
      });
      
      const result = tableWrapper.tabulator.getPageSize();
      
      expect(result).toBe(pageSize);
      expect(tableWrapper.tabulator.getPageSize).toHaveBeenCalled();
    });

    test('应该正确获取最大页码', async () => {
      const container = document.getElementById('pdf-table-container');
      
      // 创建带分页的表格
      tableWrapper = new TableWrapper(container, {
        pagination: true,
        paginationSize: 5
      });
      
      const testData = Array.from({ length: 12 }, (_, i) => ({
        id: String(i + 1),
        filename: `test${i + 1}.pdf`,
        title: `Test PDF ${i + 1}`,
        page_count: i + 1
      }));
      
      await tableWrapper.setData(testData);
      
      // 获取最大页码
      const maxPage = tableWrapper.tabulator.getPageMax();
      
      // 12条数据，每页5条，应该有3页
      expect(maxPage).toBe(3);
    });

    test('应该正确应用分页到数据', async () => {
      const container = document.getElementById('pdf-table-container');
      
      // 创建带分页的表格
      tableWrapper = new TableWrapper(container, {
        pagination: true,
        paginationSize: 2
      });
      
      const testData = [
        { id: '1', filename: 'test1.pdf', title: 'Test PDF 1', page_count: 10 },
        { id: '2', filename: 'test2.pdf', title: 'Test PDF 2', page_count: 5 },
        { id: '3', filename: 'test3.pdf', title: 'Test PDF 3', page_count: 15 },
        { id: '4', filename: 'test4.pdf', title: 'Test PDF 4', page_count: 8 }
      ];
      
      await tableWrapper.setData(testData);
      
      // 设置当前页码为2
      await tableWrapper.tabulator.setPage(2);
      
      // 获取当前页数据
      const pageData = tableWrapper.tabulator.getData();
      
      // 验证分页结果：每页2条数据，第2页应该是第3和第4条数据
      expect(pageData.length).toBe(2);
      expect(pageData[0].filename).toBe('test3.pdf');
      expect(pageData[1].filename).toBe('test4.pdf');
    });
  });

  /**
   * 测试表格综合功能
   */
  describe('表格综合功能', () => {
    
    test('应该正确同时应用排序、筛选和分页', async () => {
      const container = document.getElementById('pdf-table-container');
      
      // 创建带分页的表格
      tableWrapper = new TableWrapper(container, {
        pagination: true,
        paginationSize: 2
      });
      
      const testData = [
        { id: '1', filename: 'ctest1.pdf', title: 'C Test PDF 1', page_count: 10 },
        { id: '2', filename: 'atest1.pdf', title: 'A Test PDF 1', page_count: 5 },
        { id: '3', filename: 'btest1.pdf', title: 'B Test PDF 1', page_count: 15 },
        { id: '4', filename: 'ctest2.pdf', title: 'C Test PDF 2', page_count: 8 },
        { id: '5', filename: 'atest2.pdf', title: 'A Test PDF 2', page_count: 12 },
        { id: '6', filename: 'btest2.pdf', title: 'B Test PDF 2', page_count: 7 }
      ];
      
      await tableWrapper.setData(testData);
      
      // 设置筛选条件：文件名包含 'test'
      await tableWrapper.tabulator.setFilter('filename', 'test');
      
      // 设置排序：按文件名升序
      await tableWrapper.tabulator.setSort({ field: 'filename', dir: 'asc' });
      
      // 设置当前页码为2
      await tableWrapper.tabulator.setPage(2);
      
      // 获取处理后的数据
      const resultData = tableWrapper.tabulator.getData();
      
      // 验证结果：
      // 1. 筛选后应该有6条数据（都包含'test'）
      // 2. 排序后应该是：atest1.pdf, atest2.pdf, btest1.pdf, btest2.pdf, ctest1.pdf, ctest2.pdf
      // 3. 分页后第2页应该是：btest1.pdf, btest2.pdf
      expect(resultData.length).toBe(2);
      expect(resultData[0].filename).toBe('btest1.pdf');
      expect(resultData[1].filename).toBe('btest2.pdf');
    });

    test('应该正确处理空数据情况', async () => {
      const container = document.getElementById('pdf-table-container');
      
      // 创建带分页的表格
      tableWrapper = new TableWrapper(container, {
        pagination: true,
        paginationSize: 5
      });
      
      const emptyData = [];
      
      await tableWrapper.setData(emptyData);
      
      // 设置筛选条件
      await tableWrapper.tabulator.setFilter('filename', 'test');
      
      // 设置排序
      await tableWrapper.tabulator.setSort({ field: 'filename', dir: 'asc' });
      
      // 设置当前页码
      await tableWrapper.tabulator.setPage(1);
      
      // 获取处理后的数据
      const resultData = tableWrapper.tabulator.getData();
      
      // 验证结果：空数据
      expect(resultData).toEqual([]);
      expect(tableWrapper.tabulator.getPageMax()).toBe(0);
    });

    test('应该正确处理筛选后无数据情况', async () => {
      const container = document.getElementById('pdf-table-container');
      
      // 创建带分页的表格
      tableWrapper = new TableWrapper(container, {
        pagination: true,
        paginationSize: 5
      });
      
      const testData = [
        { id: '1', filename: 'test1.pdf', title: 'Test PDF 1', page_count: 10 },
        { id: '2', filename: 'test2.pdf', title: 'Test PDF 2', page_count: 5 }
      ];
      
      await tableWrapper.setData(testData);
      
      // 设置筛选条件：文件名包含 'nonexistent'
      await tableWrapper.tabulator.setFilter('filename', 'nonexistent');
      
      // 获取处理后的数据
      const resultData = tableWrapper.tabulator.getData();
      
      // 验证结果：无数据
      expect(resultData).toEqual([]);
      expect(tableWrapper.tabulator.getPageMax()).toBe(0);
    });
  });

  /**
   * 测试表格事件处理
   */
  describe('表格事件处理', () => {
    
    test('应该正确绑定和触发事件', () => {
      const container = document.getElementById('pdf-table-container');
      tableWrapper = new TableWrapper(container);
      
      const mockHandler = jest.fn();
      const eventName = 'data-loaded';
      
      // 绑定事件
      tableWrapper.on(eventName, mockHandler);
      
      expect(tableWrapper.tabulator.on).toHaveBeenCalledWith(eventName, mockHandler);
      
      // 触发事件
      const testData = [{ id: '1', filename: 'test1.pdf', title: 'Test PDF 1', page_count: 10 }];
      tableWrapper._callLocalListeners(eventName, testData);
      
      expect(mockHandler).toHaveBeenCalledWith(testData);
    });

    test('应该正确解除事件绑定', () => {
      const container = document.getElementById('pdf-table-container');
      tableWrapper = new TableWrapper(container);
      
      const mockHandler = jest.fn();
      const eventName = 'data-loaded';
      
      // 绑定事件
      tableWrapper.on(eventName, mockHandler);
      
      // 解除事件绑定
      tableWrapper.off(eventName, mockHandler);
      
      expect(tableWrapper.tabulator.off).toHaveBeenCalledWith(eventName, mockHandler);
      
      // 触发事件，处理器不应被调用
      const testData = [{ id: '1', filename: 'test1.pdf', title: 'Test PDF 1', page_count: 10 }];
      tableWrapper._callLocalListeners(eventName, testData);
      
      expect(mockHandler).not.toHaveBeenCalled();
    });

    test('应该正确处理行选择事件', () => {
      const container = document.getElementById('pdf-table-container');
      tableWrapper = new TableWrapper(container);
      
      const mockHandler = jest.fn();
      const eventName = 'rowSelectionChanged';
      
      // 绑定事件
      tableWrapper.on(eventName, mockHandler);
      
      expect(tableWrapper.tabulator.on).toHaveBeenCalledWith(eventName, mockHandler);
    });

    test('应该正确处理单元格点击事件', () => {
      const container = document.getElementById('pdf-table-container');
      tableWrapper = new TableWrapper(container);
      
      const mockHandler = jest.fn();
      const eventName = 'cellClick';
      
      // 绑定事件
      tableWrapper.on(eventName, mockHandler);
      
      expect(tableWrapper.tabulator.on).toHaveBeenCalledWith(eventName, mockHandler);
    });
  });
});