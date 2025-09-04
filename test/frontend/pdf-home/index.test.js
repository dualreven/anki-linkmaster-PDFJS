/**
 * PDFHomeApp 应用主类测试文件
 * @file 测试 PDFHomeApp 类的正确性和功能完整性
 * @module PDFHomeAppTest
 */

import { PDFHomeApp } from '../../../src/frontend/pdf-home/index.js';
import { EventBus } from '../../../src/frontend/common/event/event-bus.js';
import { 
  APP_EVENTS, 
  PDF_MANAGEMENT_EVENTS, 
  UI_EVENTS, 
  SYSTEM_EVENTS,
  WEBSOCKET_EVENTS 
} from '../../../src/frontend/common/event/event-constants.js';

// Mock 依赖模块
jest.mock('../../../src/frontend/common/event/event-bus.js');
jest.mock('../../../src/frontend/common/utils/logger.js');
jest.mock('../../../src/frontend/common/error/error-handler.js');
jest.mock('../../../src/frontend/common/ws/ws-client.js');
jest.mock('../../../src/frontend/common/pdf/pdf-manager.js');
jest.mock('../../../src/frontend/pdf-home/ui-manager.js');
jest.mock('../../../src/frontend/pdf-home/table-wrapper.js');

// Mock DOM 环境
beforeAll(() => {
  // 创建必要的 DOM 元素
  document.body.innerHTML = `
    <div id="pdf-table-container"></div>
    <div class="container"></div>
  `;
});

/**
 * 测试 PDFHomeApp 类
 */
describe('PDFHomeApp', () => {
  
  let pdfHomeApp;
  let mockEventBus;
  let mockLogger;
  let mockErrorHandler;
  let mockWSClient;
  let mockPDFManager;
  let mockUIManager;
  let mockTableWrapper;

  /**
   * 在每个测试前设置模拟环境
   */
  beforeEach(() => {
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

    mockTableWrapper = {
      setData: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      tabulator: {
        on: jest.fn(),
        off: jest.fn()
      }
    };

    // 设置模块模拟
    jest.doMock('../../../src/frontend/common/utils/logger.js', () => ({
      Logger: jest.fn().mockImplementation(() => mockLogger),
      LogLevel: { DEBUG: 'debug', INFO: 'info', WARN: 'warn', ERROR: 'error' }
    }));

    jest.doMock('../../../src/frontend/common/error/error-handler.js', () => ({
      ErrorHandler: jest.fn().mockImplementation(() => mockErrorHandler)
    }));

    jest.doMock('../../../src/frontend/common/ws/ws-client.js', () => ({
      default: jest.fn().mockImplementation(() => mockWSClient)
    }));

    jest.doMock('../../../src/frontend/common/pdf/pdf-manager.js', () => ({
      default: jest.fn().mockImplementation(() => mockPDFManager)
    }));

    jest.doMock('../../../src/frontend/pdf-home/ui-manager.js', () => ({
      UIManager: jest.fn().mockImplementation(() => mockUIManager)
    }));

    jest.doMock('../../../src/frontend/pdf-home/table-wrapper.js', () => ({
      default: jest.fn().mockImplementation(() => mockTableWrapper)
    }));

    // 设置 EventBus 模拟
    EventBus.mockImplementation(() => mockEventBus);

    // 创建 PDFHomeApp 实例
    pdfHomeApp = new PDFHomeApp();
  });

  /**
   * 在每个测试后清理
   */
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  /**
   * 测试构造函数
   */
  test('构造函数正确初始化', () => {
    expect(pdfHomeApp).toBeInstanceOf(PDFHomeApp);
    expect(EventBus).toHaveBeenCalledTimes(1);
    expect(EventBus).toHaveBeenCalledWith({
      enableValidation: true,
      logLevel: 'DEBUG'
    });
  });

  /**
   * 测试初始化方法
   */
  describe('initialize()', () => {
    
    test('成功初始化所有模块', async () => {
      await pdfHomeApp.initialize();

      // 验证模块初始化调用
      expect(mockPDFManager.initialize).toHaveBeenCalledTimes(1);
      expect(mockWSClient.connect).toHaveBeenCalledTimes(1);
      expect(mockUIManager.initialize).toHaveBeenCalledTimes(1);

      // 验证初始化状态
      expect(pdfHomeApp.getState().initialized).toBe(true);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        APP_EVENTS.INITIALIZATION.COMPLETED,
        undefined,
        expect.objectContaining({ actorId: 'PDFHomeApp' })
      );
    });

    test('初始化失败时正确处理错误', async () => {
      const error = new Error('初始化失败');
      mockPDFManager.initialize.mockRejectedValue(error);

      await pdfHomeApp.initialize();

      expect(mockLogger.error).toHaveBeenCalledWith('Application initialization failed.', error);
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(error, 'App.initialize');
      expect(pdfHomeApp.getState().initialized).toBe(false);
    });

    test('正确设置全局错误处理', async () => {
      await pdfHomeApp.initialize();

      // 验证全局错误处理设置
      expect(window.addEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  /**
   * 测试PDF文档加载功能
   */
  describe('PDF文档加载功能', () => {
    
    beforeEach(async () => {
      await pdfHomeApp.initialize();
    });

    test('正确监听PDF列表更新事件', () => {
      // 验证事件监听器设置
      const pdfListUpdateCall = mockEventBus.on.mock.calls.find(
        call => call[0] === PDF_MANAGEMENT_EVENTS.LIST.UPDATED
      );
      
      expect(pdfListUpdateCall).toBeDefined();
      expect(pdfListUpdateCall[1]).toBeInstanceOf(Function);
      expect(pdfListUpdateCall[2]).toEqual(expect.objectContaining({ subscriberId: 'PDFHomeApp' }));
    });

    test('正确处理PDF列表更新数据', () => {
      // 找到PDF列表更新处理器
      const pdfListUpdateHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === PDF_MANAGEMENT_EVENTS.LIST.UPDATED
      )?.[1];

      const testPDFs = [
        { id: '1', filename: 'test1.pdf', title: 'Test PDF 1', page_count: 10 },
        { id: '2', filename: 'test2.pdf', title: 'Test PDF 2', page_count: 5 }
      ];

      // 调用处理器
      pdfListUpdateHandler(testPDFs);

      // 验证表格数据更新
      expect(mockTableWrapper.setData).toHaveBeenCalledWith(testPDFs);
      expect(mockLogger.info).toHaveBeenCalledWith('pdf:list:updated received, count=2');
    });

    test('处理空PDF列表时正确行为', () => {
      const pdfListUpdateHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === PDF_MANAGEMENT_EVENTS.LIST.UPDATED
      )?.[1];

      pdfListUpdateHandler([]);

      expect(mockTableWrapper.setData).toHaveBeenCalledWith([]);
      expect(mockLogger.info).toHaveBeenCalledWith('pdf:list:updated received, count=0');
    });
  });

  /**
   * 测试页面渲染功能
   */
  describe('页面渲染功能', () => {
    
    beforeEach(async () => {
      await pdfHomeApp.initialize();
    });

    test('正确初始化表格包装器', () => {
      // 验证表格包装器创建
      expect(mockTableWrapper.setData).toHaveBeenCalledTimes(1); // 初始空数据
      expect(mockUIManager.pdfTable).toBe(mockTableWrapper);
    });

    test('设置正确的表格列配置', () => {
      // 验证表格列配置
      const tableWrapperCall = jest.requireMock('../../../src/frontend/pdf-home/table-wrapper.js').default.mock.calls[0];
      const tableConfig = tableWrapperCall[1];
      
      expect(tableConfig.columns).toHaveLength(5);
      expect(tableConfig.columns[0]).toEqual(expect.objectContaining({
        formatter: "rowSelection",
        titleFormatter: "rowSelection"
      }));
      expect(tableConfig.selectable).toBe(true);
      expect(tableConfig.layout).toBe("fitColumns");
    });

    test('正确处理表格事件绑定', () => {
      // 验证表格事件绑定
      expect(mockTableWrapper.tabulator.on).toHaveBeenCalledWith("rowSelectionChanged", expect.any(Function));
      expect(mockTableWrapper.tabulator.on).toHaveBeenCalledWith("rowClick", expect.any(Function));
      expect(mockTableWrapper.tabulator.on).toHaveBeenCalledWith("cellClick", expect.any(Function));
    });
  });

  /**
   * 测试事件处理功能
   */
  describe('事件处理功能', () => {
    
    beforeEach(async () => {
      await pdfHomeApp.initialize();
    });

    test('正确处理行选择变化事件', () => {
      // 找到行选择变化处理器
      const rowSelectionHandler = mockTableWrapper.tabulator.on.mock.calls.find(
        call => call[0] === "rowSelectionChanged"
      )?.[1];

      const mockRows = [
        { id: '1', filename: 'test1.pdf' },
        { id: '2', filename: 'test2.pdf' }
      ];

      rowSelectionHandler(mockRows, mockRows);

      // 验证事件总线发出选择变化事件
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        UI_EVENTS.SELECTION.CHANGED,
        ['1', '2'],
        expect.objectContaining({ actorId: 'PDFHomeApp' })
      );
    });

    test('正确处理行点击事件', () => {
      const rowClickHandler = mockTableWrapper.tabulator.on.mock.calls.find(
        call => call[0] === "rowClick"
      )?.[1];

      const mockRow = {
        getData: jest.fn().mockReturnValue({ id: '1', filename: 'test.pdf' }),
        isSelected: jest.fn().mockReturnValue(false),
        select: jest.fn(),
        deselect: jest.fn()
      };

      rowClickHandler({}, mockRow);

      expect(mockRow.select).toHaveBeenCalled();
      expect(mockRow.deselect).not.toHaveBeenCalled();
    });

    test('正确处理单元格点击事件 - 打开操作', () => {
      const cellClickHandler = mockTableWrapper.tabulator.on.mock.calls.find(
        call => call[0] === "cellClick"
      )?.[1];

      const mockEvent = {
        target: {
          closest: jest.fn().mockReturnValue({
            getAttribute: jest.fn().mockReturnValue('open')
          })
        },
        stopPropagation: jest.fn()
      };

      const mockCell = {
        getRow: jest.fn().mockReturnValue({
          getData: jest.fn().mockReturnValue({ id: '1', filename: 'test.pdf' })
        }),
        getElement: jest.fn().mockReturnValue(document.createElement('div'))
      };

      cellClickHandler(mockEvent, mockCell);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED,
        '1'
      );
    });

    test('正确处理单元格点击事件 - 删除操作', () => {
      const cellClickHandler = mockTableWrapper.tabulator.on.mock.calls.find(
        call => call[0] === "cellClick"
      )?.[1];

      // Mock confirm 返回 true
      global.confirm = jest.fn().mockReturnValue(true);

      const mockEvent = {
        target: {
          closest: jest.fn().mockReturnValue({
            getAttribute: jest.fn().mockReturnValue('delete')
          })
        },
        stopPropagation: jest.fn()
      };

      const mockCell = {
        getRow: jest.fn().mockReturnValue({
          getData: jest.fn().mockReturnValue({ id: '1', filename: 'test.pdf' })
        }),
        getElement: jest.fn().mockReturnValue(document.createElement('div'))
      };

      cellClickHandler(mockEvent, mockCell);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED,
        '1'
      );
    });
  });

  /**
   * 测试模块化设计的正确性
   */
  describe('模块化设计的正确性', () => {
    
    test('各模块正确依赖事件总线', () => {
      // 验证所有模块都接收了事件总线实例
      const pdfManagerCall = jest.requireMock('../../../src/frontend/common/pdf/pdf-manager.js').default.mock.calls[0];
      const uiManagerCall = jest.requireMock('../../../src/frontend/pdf-home/ui-manager.js').UIManager.mock.calls[0];
      const wsClientCall = jest.requireMock('../../../src/frontend/common/ws/ws-client.js').default.mock.calls[0];

      expect(pdfManagerCall[0]).toBe(mockEventBus);
      expect(uiManagerCall[0]).toBe(mockEventBus);
      expect(wsClientCall[1]).toBe(mockEventBus);
    });

    test('模块间通过事件总线通信', async () => {
      await pdfHomeApp.initialize();

      // 验证事件总线上的事件监听
      const eventNames = mockEventBus.on.mock.calls.map(call => call[0]);
      
      // 应该包含核心事件
      expect(eventNames).toContain(PDF_MANAGEMENT_EVENTS.LIST.UPDATED);
      expect(eventNames).toContain(WEBSOCKET_EVENTS.MESSAGE.RECEIVED);
      expect(eventNames).toContain(UI_EVENTS.ERROR.SHOW);
    });

    test('模块生命周期管理正确', async () => {
      await pdfHomeApp.initialize();
      pdfHomeApp.destroy();

      // 验证所有模块的destroy方法都被调用
      expect(mockPDFManager.destroy).toHaveBeenCalledTimes(1);
      expect(mockUIManager.destroy).toHaveBeenCalledTimes(1);
      expect(mockWSClient.disconnect).toHaveBeenCalledTimes(1);
      expect(mockEventBus.destroy).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * 测试状态获取方法
   */
  test('获取应用状态', () => {
    const state = pdfHomeApp.getState();
    
    expect(state).toEqual(expect.objectContaining({
      initialized: false,
      websocketConnected: false,
      pdfCount: 0
    }));

    // 验证返回的是副本而不是引用
    state.test = true;
    expect(pdfHomeApp.getState().test).toBeUndefined();
  });

  /**
   * 测试事件总线访问方法
   */
  test('获取事件总线实例', () => {
    const eventBus = pdfHomeApp.getEventBus();
    expect(eventBus).toBe(mockEventBus);
  });

  /**
   * 测试错误处理
   */
  describe('错误处理', () => {
    
    test('表格事件处理错误时正确上报', () => {
      const rowSelectionHandler = mockTableWrapper.tabulator.on.mock.calls.find(
        call => call[0] === "rowSelectionChanged"
      )?.[1];

      const error = new Error('处理错误');
      // 模拟处理器抛出错误
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      rowSelectionHandler(null, null); // 传入无效数据触发错误

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        SYSTEM_EVENTS.ERROR.OCCURRED,
        expect.objectContaining({
          type: 'table_error',
          message: expect.any(String)
        })
      );
    });

    test('全局错误处理正确配置', async () => {
      await pdfHomeApp.initialize();

      // 获取全局错误处理器
      const errorHandlers = [];
      const addEventListenerCalls = window.addEventListener.mock.calls;
      
      addEventListenerCalls.forEach(call => {
        if (call[0] === 'error' || call[0] === 'unhandledrejection') {
          errorHandlers.push(call[1]);
        }
      });

      expect(errorHandlers).toHaveLength(2);
    });
  });

  /**
   * 测试所有功能场景的覆盖
   */
  describe('功能场景覆盖测试', () => {
    
    test('覆盖所有主要事件类型', async () => {
      await pdfHomeApp.initialize();

      const handledEvents = new Set(mockEventBus.on.mock.calls.map(call => call[0]));
      
      // 验证核心事件类型都被处理
      const coreEvents = [
        PDF_MANAGEMENT_EVENTS.LIST.UPDATED,
        WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
        WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED,
        WEBSOCKET_EVENTS.CONNECTION.CLOSED,
        UI_EVENTS.ERROR.SHOW,
        UI_EVENTS.SUCCESS.SHOW
      ];

      coreEvents.forEach(event => {
        expect(handledEvents.has(event)).toBe(true);
      });
    });

    test('覆盖所有用户交互场景', () => {
      // 验证表格交互事件
      const tableEvents = mockTableWrapper.tabulator.on.mock.calls.map(call => call[0]);
      expect(tableEvents).toContain('rowSelectionChanged');
      expect(tableEvents).toContain('rowClick');
      expect(tableEvents).toContain('cellClick');
    });

    test('覆盖所有模块初始化场景', async () => {
      await pdfHomeApp.initialize();

      expect(mockPDFManager.initialize).toHaveBeenCalled();
      expect(mockWSClient.connect).toHaveBeenCalled();
      expect(mockUIManager.initialize).toHaveBeenCalled();
    });
  });
});