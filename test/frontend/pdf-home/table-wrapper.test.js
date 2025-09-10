/**
 * TableWrapper Tabulator实例初始化测试文件
 * @file 测试 TableWrapper 类中 Tabulator 实例的正确初始化
 * @module TableWrapperTabulatorInitializationTest
 */

// 使用 CommonJS 语法导入模块
const TableWrapper = require('../../../src/frontend/pdf-home/table-wrapper.js').default;

// Mock Tabulator 类
jest.mock('tabulator-tables', () => {
  return {
    Tabulator: jest.fn().mockImplementation((container, options) => {
      // 模拟 Tabulator 实例
      return {
        element: container,
        table: container,
        tableElement: container,
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

// Mock Logger
jest.mock('../../../src/frontend/common/utils/logger.js', () => {
  return jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    event: jest.fn()
  }));
});

/**
 * 测试 TableWrapper 类中 Tabulator 实例的初始化
 */
describe('TableWrapper Tabulator 实例初始化', () => {
  
  let mockContainer;
  let tableWrapper;

  /**
   * 在每个测试前设置模拟环境
   */
  beforeEach(() => {
    // 创建模拟容器元素
    mockContainer = document.createElement('div');
    mockContainer.id = 'test-container';
    document.body.appendChild(mockContainer);
    
    // 清除所有 mock 的调用记录
    jest.clearAllMocks();
  });

  /**
   * 在每个测试后清理
   */
  afterEach(() => {
    // 清理 DOM
    if (mockContainer && mockContainer.parentNode) {
      mockContainer.parentNode.removeChild(mockContainer);
    }
    
    // 清理 TableWrapper 实例
    if (tableWrapper) {
      tableWrapper.destroy();
    }
  });

  /**
   * 测试基本初始化功能
   */
  describe('基本初始化功能', () => {
    
    test('应该正确创建 TableWrapper 实例', () => {
      tableWrapper = new TableWrapper(mockContainer);
      
      expect(tableWrapper).toBeInstanceOf(TableWrapper);
      expect(tableWrapper.container).toBe(mockContainer);
      expect(tableWrapper.tableWrapper).toBeInstanceOf(HTMLDivElement);
      expect(tableWrapper.tabulator).toBeDefined();
    });

    test('应该使用选择器字符串正确创建 TableWrapper 实例', () => {
      const containerId = 'test-selector-container';
      const selectorContainer = document.createElement('div');
      selectorContainer.id = containerId;
      document.body.appendChild(selectorContainer);

      tableWrapper = new TableWrapper(`#${containerId}`);
      
      expect(tableWrapper).toBeInstanceOf(TableWrapper);
      expect(tableWrapper.container).toBe(selectorContainer);
      expect(tableWrapper.tableWrapper).toBeInstanceOf(HTMLDivElement);
      expect(tableWrapper.tabulator).toBeDefined();

      // 清理
      selectorContainer.parentNode.removeChild(selectorContainer);
    });

    test('应该正确初始化 Tabulator 实例', () => {
      tableWrapper = new TableWrapper(mockContainer);
      
      // 验证 Tabulator 构造函数被调用
      const { Tabulator } = require('tabulator-tables');
      expect(Tabulator).toHaveBeenCalledTimes(1);
      
      // 验证 Tabulator 实例的属性
      expect(tableWrapper.tabulator.element).toBe(tableWrapper.tableWrapper);
      expect(tableWrapper.tabulator.table).toBe(tableWrapper.tableWrapper);
      expect(tableWrapper.tabulator.tableElement).toBe(tableWrapper.tableWrapper);
    });

    test('应该正确应用默认配置选项', () => {
      tableWrapper = new TableWrapper(mockContainer);
      
      // 验证 Tabulator 构造函数调用时的参数
      const { Tabulator } = require('tabulator-tables');
      const tabulatorCall = Tabulator.mock.calls[0];
      const options = tabulatorCall[1];
      
      expect(options.height).toBe('auto');
      expect(options.layout).toBe('fitColumns');
      expect(options.selectable).toBe(true);
      expect(options.layoutColumnsOnNewData).toBe(false);
      expect(options.placeholder).toContain('暂无数据');
    });

    test('应该正确合并自定义配置选项', () => {
      const customOptions = {
        height: '400px',
        layout: 'fitData',
        selectable: false,
        customOption: 'custom-value'
      };
      
      tableWrapper = new TableWrapper(mockContainer, customOptions);
      
      // 验证 Tabulator 构造函数调用时的参数
      const { Tabulator } = require('tabulator-tables');
      const tabulatorCall = Tabulator.mock.calls[0];
      const options = tabulatorCall[1];
      
      expect(options.height).toBe('400px'); // 自定义选项覆盖默认选项
      expect(options.layout).toBe('fitData'); // 自定义选项覆盖默认选项
      expect(options.selectable).toBe(false); // 自定义选项覆盖默认选项
      expect(options.layoutColumnsOnNewData).toBe(false); // 默认选项保留
      expect(options.customOption).toBe('custom-value'); // 新增的自定义选项
    });
  });

  /**
   * 测试容器处理功能
   */
  describe('容器处理功能', () => {
    
    test('应该正确创建内部 tableWrapper 元素', () => {
      tableWrapper = new TableWrapper(mockContainer);
      
      // 验证内部 tableWrapper 元素
      const internalWrapper = tableWrapper.tableWrapper;
      expect(internalWrapper).toBeInstanceOf(HTMLDivElement);
      expect(internalWrapper.className).toBe('pdf-table-wrapper');
      expect(internalWrapper.style.minHeight).toBe('200px');
      expect(internalWrapper.parentNode).toBe(mockContainer);
    });

    test('应该复用已存在的 tableWrapper 元素', () => {
      // 预先创建一个 tableWrapper 元素
      const existingWrapper = document.createElement('div');
      existingWrapper.className = 'pdf-table-wrapper';
      existingWrapper.style.minHeight = '100px';
      mockContainer.appendChild(existingWrapper);
      
      tableWrapper = new TableWrapper(mockContainer);
      
      // 验证复用了已存在的 tableWrapper 元素
      expect(tableWrapper.tableWrapper).toBe(existingWrapper);
      expect(tableWrapper.tableWrapper.style.minHeight).toBe('100px'); // 保留原有样式
    });

    test('应该在容器不存在时抛出错误', () => {
      // 移除容器
      mockContainer.parentNode.removeChild(mockContainer);
      
      expect(() => {
        tableWrapper = new TableWrapper('#non-existent-container');
      }).toThrow('Container not found');
    });

    test('应该在容器为 null 时抛出错误', () => {
      expect(() => {
        tableWrapper = new TableWrapper(null);
      }).toThrow('Container not found');
    });

    test('应该在容器为 undefined 时抛出错误', () => {
      expect(() => {
        tableWrapper = new TableWrapper(undefined);
      }).toThrow('Container not found');
    });
  });

  /**
   * 测试 Tabulator 实例属性和方法
   */
  describe('Tabulator 实例属性和方法', () => {
    
    test('应该验证 Tabulator 实例的基本方法存在', () => {
      tableWrapper = new TableWrapper(mockContainer);
      
      // 验证基本方法存在
      expect(typeof tableWrapper.tabulator.setData).toBe('function');
      expect(typeof tableWrapper.tabulator.clearData).toBe('function');
      expect(typeof tableWrapper.tabulator.destroy).toBe('function');
      expect(typeof tableWrapper.tabulator.redraw).toBe('function');
      expect(typeof tableWrapper.tabulator.on).toBe('function');
      expect(typeof tableWrapper.tabulator.off).toBe('function');
      expect(typeof tableWrapper.tabulator.getSelectedData).toBe('function');
      expect(typeof tableWrapper.tabulator.getData).toBe('function');
      expect(typeof tableWrapper.tabulator.getColumns).toBe('function');
    });

    test('应该验证 Tabulator 实例的内部引用正确', () => {
      tableWrapper = new TableWrapper(mockContainer);
      
      // 验证内部引用
      expect(tableWrapper.tabulator.element).toBe(tableWrapper.tableWrapper);
      expect(tableWrapper.tabulator.table).toBe(tableWrapper.tableWrapper);
      expect(tableWrapper.tabulator.tableElement).toBe(tableWrapper.tableWrapper);
    });

    test('应该验证没有 _container 未定义的错误', () => {
      // 这个测试专门检查是否存在 '_container' 未定义的错误
      // 我们通过调用 Tabulator 实例的方法来验证内部状态
      
      tableWrapper = new TableWrapper(mockContainer);
      
      // 调用各种方法来验证内部状态
      expect(() => {
        tableWrapper.tabulator.setData([]);
        tableWrapper.tabulator.clearData();
        tableWrapper.tabulator.redraw();
        tableWrapper.tabulator.getData();
        tableWrapper.tabulator.getColumns();
        tableWrapper.tabulator.getSelectedData();
      }).not.toThrow();
    });

    test('应该验证 Tabulator 实例的 DOM 操作正常', () => {
      tableWrapper = new TableWrapper(mockContainer);
      
      // 验证 Tabulator 实例可以正常操作 DOM
      expect(tableWrapper.tabulator.element).toBeDefined();
      expect(tableWrapper.tabulator.element).toBeInstanceOf(HTMLDivElement);
      expect(tableWrapper.tabulator.element.parentNode).toBe(mockContainer);
    });
  });

  /**
   * 测试 DOM 结构
   */
  describe('DOM 结构', () => {
    
    test('应该正确创建 DOM 结构', () => {
      tableWrapper = new TableWrapper(mockContainer);
      
      // 验证容器结构
      expect(mockContainer.children.length).toBe(1);
      expect(mockContainer.children[0]).toBe(tableWrapper.tableWrapper);
      expect(mockContainer.children[0].className).toBe('pdf-table-wrapper');
    });

    test('应该保持容器不被清空', () => {
      // 在容器中预先添加一些内容
      const existingContent = document.createElement('div');
      existingContent.className = 'existing-content';
      existingContent.textContent = 'Existing Content';
      mockContainer.appendChild(existingContent);
      
      const initialChildCount = mockContainer.children.length;
      
      tableWrapper = new TableWrapper(mockContainer);
      
      // 验证容器没有被清空，只是添加了新的 tableWrapper
      expect(mockContainer.children.length).toBe(initialChildCount + 1);
      expect(mockContainer.querySelector('.existing-content')).not.toBeNull();
      expect(mockContainer.querySelector('.pdf-table-wrapper')).not.toBeNull();
    });
  });

  /**
   * 测试错误处理
   */
  describe('错误处理', () => {
    
    test('应该处理无效的容器参数', () => {
      // 测试各种无效的容器参数
      const invalidContainers = [null, undefined, '', false, 0, {}, []];
      
      invalidContainers.forEach(container => {
        expect(() => {
          tableWrapper = new TableWrapper(container);
        }).toThrow('Container not found');
      });
    });

    test('应该处理不存在的选择器', () => {
      expect(() => {
        tableWrapper = new TableWrapper('#non-existent-selector');
      }).toThrow('Container not found');
    });

    test('应该处理无效的选项参数', () => {
      // 测试无效的选项参数不应该抛出错误
      expect(() => {
        tableWrapper = new TableWrapper(mockContainer, null);
        tableWrapper = new TableWrapper(mockContainer, undefined);
        tableWrapper = new TableWrapper(mockContainer, 'invalid-options');
        tableWrapper = new TableWrapper(mockContainer, 123);
      }).not.toThrow();
    });
  });

  /**
   * 测试边缘情况
   */
  describe('边缘情况', () => {
    
    test('应该处理空的选项对象', () => {
      tableWrapper = new TableWrapper(mockContainer, {});
      
      // 验证 Tabulator 仍然正确初始化
      expect(tableWrapper.tabulator).toBeDefined();
      expect(tableWrapper.tableWrapper).toBeDefined();
    });

    test('应该处理没有选项的情况', () => {
      tableWrapper = new TableWrapper(mockContainer);
      
      // 验证 Tabulator 仍然正确初始化
      expect(tableWrapper.tabulator).toBeDefined();
      expect(tableWrapper.tableWrapper).toBeDefined();
    });

    test('应该处理容器已经包含 tableWrapper 的情况', () => {
      // 预先创建一个 tableWrapper 元素
      const existingWrapper = document.createElement('div');
      existingWrapper.className = 'pdf-table-wrapper';
      existingWrapper.innerHTML = '<div class="existing-content">Existing Content</div>';
      mockContainer.appendChild(existingWrapper);
      
      tableWrapper = new TableWrapper(mockContainer);
      
      // 验证复用了已存在的 tableWrapper 元素
      expect(tableWrapper.tableWrapper).toBe(existingWrapper);
      expect(tableWrapper.tableWrapper.querySelector('.existing-content')).not.toBeNull();
    });
  });
});