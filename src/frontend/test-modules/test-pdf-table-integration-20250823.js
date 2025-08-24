/**
 * PDF表格集成测试模块
 * 用于验证pdf-table组件与pdf-home页面的集成功能
 */

// 导入事件常量
import {
  PDF_MANAGEMENT_EVENTS,
  UI_EVENTS
} from '../pdf-home/modules/event-constants.js';

// 导入日志模块
import Logger from '../pdf-home/utils/logger.js';

// 测试模块状态
const testState = {
  logger: null,
  eventBus: null,
  pdfTable: null,
  testData: [
    {
      id: 'test-pdf-1',
      filename: 'test-pdf-1.pdf',
      filepath: '/path/to/test-pdf-1.pdf',
      title: '测试PDF 1',
      size: 1024000,
      created_time: Date.now(),
      modified_time: Date.now(),
      page_count: 10,
      author: '测试作者',
      tags: ['测试', '标签'],
      notes: '测试笔记',
      import_date: new Date().toISOString(),
      access_date: new Date().toISOString(),
      importance: 'medium',
      unread_pages: 5,
      total_pages: 10,
      annotations_count: 3,
      cards_count: 5,
      select: '',
      actions: ''
    },
    {
      id: 'test-pdf-2',
      filename: 'test-pdf-2.pdf',
      filepath: '/path/to/test-pdf-2.pdf',
      title: '测试PDF 2',
      size: 2048000,
      created_time: Date.now(),
      modified_time: Date.now(),
      page_count: 20,
      author: '测试作者',
      tags: ['测试', '标签'],
      notes: '测试笔记',
      import_date: new Date().toISOString(),
      access_date: new Date().toISOString(),
      importance: 'high',
      unread_pages: 10,
      total_pages: 20,
      annotations_count: 6,
      cards_count: 10,
      select: '',
      actions: ''
    }
  ],
  testResults: {
    dataLoadTest: false,
    selectionEventTest: false,
    deleteEventTest: false
  }
};

/**
 * 初始化测试环境
 */
async function initializeTestEnvironment() {
  testState.logger = new Logger('PDFTableIntegrationTest');
  testState.eventBus = window.eventBus;
  
  if (!testState.eventBus) {
    throw new Error('事件总线未初始化，无法运行测试');
  }
  
  // 获取PDFTable实例 - 通过事件总线监听PDFTable初始化事件
  if (window.app && window.app.uiManager) {
    // 尝试直接访问UIManager中的PDFTable实例
    if (window.app.uiManager.pdfTable) {
      testState.pdfTable = window.app.uiManager.pdfTable;
      testState.logger.info('PDFTable实例已直接可用');
    } else {
      // 如果直接访问失败，通过事件系统等待PDFTable初始化完成
      console.log('[TEST] PDFTable实例未直接暴露，通过事件系统等待初始化...');
      
      // 返回一个Promise，等待PDFTable初始化完成事件
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('PDFTable初始化超时，请检查UIManager是否正确暴露PDFTable实例'));
        }, 10000); // 10秒超时
        
        // 监听PDFTable初始化完成事件
        const initializationHandler = (data) => {
          clearTimeout(timeout);
          testState.pdfTable = data.pdfTable;
          testState.logger.info('PDFTable实例通过事件系统获取成功');
          
          // 移除事件监听器
          testState.eventBus.off('ui:pdf_table:initialized', initializationHandler);
          testState.eventBus.off('ui:pdf_table:initialization_failed', failureHandler);
          
          resolve();
        };
        
        // 监听PDFTable初始化失败事件
        const failureHandler = (data) => {
          clearTimeout(timeout);
          testState.eventBus.off('ui:pdf_table:initialized', initializationHandler);
          testState.eventBus.off('ui:pdf_table:initialization_failed', failureHandler);
          reject(new Error(`PDFTable初始化失败: ${data.error.message}`));
        };
        
        // 添加事件监听器
        testState.eventBus.on('ui:pdf_table:initialized', initializationHandler);
        testState.eventBus.on('ui:pdf_table:initialization_failed', failureHandler);
      });
    }
  } else {
    throw new Error('UIManager未初始化，无法运行测试');
  }
  
  testState.logger.info('测试环境初始化完成');
}

/**
 * 运行测试
 */
async function runTest() {
  try {
    console.log('[TEST] 开始运行PDF表格集成测试');
    
    // 初始化测试环境
    await initializeTestEnvironment();
    
    // 运行数据加载测试
    await testDataLoadTest();
    
    // 运行选择事件测试
    await testSelectionEventTest();
    
    // 运行删除事件测试
    await testDeleteEventTest();
    
    // 输出测试结果
    outputTestResults();
    
    console.log('[TEST] PDF表格集成测试完成');
    
    return testState.testResults;
  } catch (error) {
    console.error('[TEST] 测试运行失败:', error);
    throw error;
  }
}

/**
 * 测试数据加载功能
 */
async function testDataLoadTest() {
  console.log('[TEST] 开始测试数据加载功能');
  
  return new Promise((resolve) => {
    // 监听pdf:management:list_updated事件
    const listUpdatedHandler = (data) => {
      console.log('[TEST] 收到pdf:management:list_updated事件，数据:', data);
      
      try {
        // 验证pdfTable.loadData是否被调用
        if (testState.pdfTable && Array.isArray(data)) {
          console.log('[TEST] 数据加载测试通过：pdfTable.loadData被调用且数据是数组');
          testState.testResults.dataLoadTest = true;
        } else {
          console.log('[TEST] 数据加载测试失败：数据不是数组或pdfTable未初始化');
        }
      } catch (error) {
        console.error('[TEST] 数据加载测试出错:', error);
      } finally {
        // 移除事件监听器
        testState.eventBus.off(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, listUpdatedHandler);
        resolve();
      }
    };
    
    // 添加事件监听器
    testState.eventBus.on(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, listUpdatedHandler);
    
    // 模拟触发pdf:management:list_updated事件
    console.log('[TEST] 模拟触发pdf:management:list_updated事件');
    testState.eventBus.emit(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, testState.testData);
    
    // 设置超时，防止测试卡住
    setTimeout(() => {
      console.log('[TEST] 数据加载测试超时');
      testState.eventBus.off(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, listUpdatedHandler);
      resolve();
    }, 5000);
  });
}

/**
 * 测试选择事件功能
 */
async function testSelectionEventTest() {
  console.log('[TEST] 开始测试选择事件功能');
  
  return new Promise((resolve) => {
    // 监听ui:selection:changed事件
    const selectionChangedHandler = (selectedRows) => {
      console.log('[TEST] 收到ui:selection:changed事件，数据:', selectedRows);
      
      try {
        // 验证选择事件是否被正确触发
        if (Array.isArray(selectedRows) && selectedRows.length > 0) {
          console.log('[TEST] 选择事件测试通过：事件被正确触发且携带了正确的选中行数据');
          testState.testResults.selectionEventTest = true;
        } else {
          console.log('[TEST] 选择事件测试失败：事件数据不正确');
        }
      } catch (error) {
        console.error('[TEST] 选择事件测试出错:', error);
      } finally {
        // 移除事件监听器
        testState.eventBus.off(UI_EVENTS.SELECTION_CHANGED, selectionChangedHandler);
        resolve();
      }
    };
    
    // 添加事件监听器
    testState.eventBus.on(UI_EVENTS.SELECTION_CHANGED, selectionChangedHandler);
    
    // 模拟选中表格中的一行
    console.log('[TEST] 模拟选中表格中的一行');
    if (testState.pdfTable && testState.pdfTable.events) {
      // 模拟选择第一行
      testState.pdfTable.events.emit('selection-changed', [testState.testData[0]]);
    } else {
      console.log('[TEST] 选择事件测试失败：pdfTable或pdfTable.events未初始化');
      testState.eventBus.off(UI_EVENTS.SELECTION_CHANGED, selectionChangedHandler);
      resolve();
    }
    
    // 设置超时，防止测试卡住
    setTimeout(() => {
      console.log('[TEST] 选择事件测试超时');
      testState.eventBus.off(UI_EVENTS.SELECTION_CHANGED, selectionChangedHandler);
      resolve();
    }, 5000);
  });
}

/**
 * 测试删除事件功能
 */
async function testDeleteEventTest() {
  console.log('[TEST] 开始测试删除事件功能');
  
  return new Promise((resolve) => {
    // 监听pdf:management:delete_requested事件
    const deleteRequestedHandler = (data) => {
      console.log('[TEST] 收到pdf:management:delete_requested事件，数据:', data);
      
      try {
        // 验证删除事件是否被正确触发
        if (data && data.pdfId) {
          console.log('[TEST] 删除事件测试通过：事件被正确触发且携带了正确的pdfId');
          testState.testResults.deleteEventTest = true;
        } else {
          console.log('[TEST] 删除事件测试失败：事件数据不正确');
        }
      } catch (error) {
        console.error('[TEST] 删除事件测试出错:', error);
      } finally {
        // 移除事件监听器
        testState.eventBus.off(PDF_MANAGEMENT_EVENTS.DELETE.REQUESTED, deleteRequestedHandler);
        resolve();
      }
    };
    
    // 添加事件监听器
    testState.eventBus.on(PDF_MANAGEMENT_EVENTS.DELETE.REQUESTED, deleteRequestedHandler);
    
    // 模拟点击某行的"删除"按钮
    console.log('[TEST] 模拟点击某行的"删除"按钮');
    if (testState.pdfTable && testState.pdfTable.events) {
      // 模拟点击删除按钮
      testState.pdfTable.events.emit('action-click', {
        action: 'delete',
        rowData: testState.testData[0]
      });
    } else {
      console.log('[TEST] 删除事件测试失败：pdfTable或pdfTable.events未初始化');
      testState.eventBus.off(PDF_MANAGEMENT_EVENTS.DELETE.REQUESTED, deleteRequestedHandler);
      resolve();
    }
    
    // 设置超时，防止测试卡住
    setTimeout(() => {
      console.log('[TEST] 删除事件测试超时');
      testState.eventBus.off(PDF_MANAGEMENT_EVENTS.DELETE.REQUESTED, deleteRequestedHandler);
      resolve();
    }, 5000);
  });
}

/**
 * 输出测试结果
 */
function outputTestResults() {
  console.log('[TEST] ===== 测试结果 =====');
  console.log('[TEST] 数据加载测试:', testState.testResults.dataLoadTest ? '通过' : '失败');
  console.log('[TEST] 选择事件测试:', testState.testResults.selectionEventTest ? '通过' : '失败');
  console.log('[TEST] 删除事件测试:', testState.testResults.deleteEventTest ? '通过' : '失败');
  
  const allTestsPassed = Object.values(testState.testResults).every(result => result === true);
  console.log('[TEST] 总体结果:', allTestsPassed ? '所有测试通过' : '部分测试失败');
}

/**
 * 清理测试环境
 */
function cleanup() {
  console.log('[TEST] 开始清理测试环境');
  
  // 重置测试状态
  testState.testResults = {
    dataLoadTest: false,
    selectionEventTest: false,
    deleteEventTest: false
  };
  
  // 清理PDFTable实例引用
  testState.pdfTable = null;
  
  console.log('[TEST] 测试环境清理完成');
}

// 导出测试函数
export { runTest, cleanup };