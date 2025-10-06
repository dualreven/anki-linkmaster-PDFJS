/**
 * 事件处理器重构验证测试
 * 验证重构后的事件处理器功能是否正常
 */

import eventBusSingleton from '../../common/event/event-bus.js';
import { EventHandlers } from '../event-handlers.js';
import { PDF_VIEWER_EVENTS } from '../../common/event/pdf-viewer-constants.js';
import { getLogger } from '../../common/utils/logger.js';
const logger = getLogger('EventHandlersRefactoringTest');


/**
 * 创建模拟的应用对象
 */
function createMockApp() {
  return {
    eventBus: eventBusSingleton,
    logger: logger,
    currentFile: null,
    currentPage: 1,
    totalPages: 0,
    zoomLevel: 1.0,
    pdfManager: {
      loadPDF: async () => ({ numPages: 10 }),
      getPage: async (pageNumber) => ({
        getViewport: ({ scale }) => ({
          width: 612 * scale,
          height: 792 * scale,
          scale: scale
        })
      }),
      cleanup: () => {}
    },
    uiManager: {
      showLoading: () => {},
      hideProgress: () => {},
      updateProgress: () => {},
      showError: () => {},
      hideError: () => {},
      updatePageInfo: () => {},
      renderPage: async () => {},
      setScale: () => {},
      cleanup: () => {},
      getContainerWidth: () => 800,
      getContainerHeight: () => 600
    },
    errorHandler: {
      handleError: () => {}
    }
  };
}

/**
 * 验证事件处理器重构
 */
async function verifyEventHandlersRefactoring() {
  console.log('========================================');
  console.log('事件处理器重构验证测试');
  console.log('========================================\n');

  try {
    // 1. 验证模块导入
    console.log('1. 验证模块导入...');
    const modules = {
      'EventHandlers': EventHandlers,
      'NavigationHandler': (await import('../handlers/navigation-handler.js')).NavigationHandler,
      'ZoomHandler': (await import('../handlers/zoom-handler.js')).ZoomHandler,
      'FileHandler': (await import('../handlers/file-handler.js')).FileHandler
    };

    for (const [name, Module] of Object.entries(modules)) {
      if (!Module) {
        throw new Error(`模块 ${name} 导入失败`);
      }
      console.log(`  ✓ ${name} 导入成功`);
    }

    // 2. 验证EventHandlers实例化
    console.log('\n2. 验证EventHandlers实例化...');
    const mockApp = createMockApp();
    const eventHandlers = new EventHandlers(mockApp);
    console.log('  ✓ EventHandlers 实例化成功');

    // 3. 验证事件监听器设置
    console.log('\n3. 验证事件监听器设置...');
    eventHandlers.setupEventListeners();
    console.log('  ✓ 事件监听器设置成功');

    // 4. 验证公共方法
    console.log('\n4. 验证公共方法...');
    const methods = [
      // 文件处理方法
      'handleFileLoadRequested',
      'handleFileLoadProgress',
      'handleFileLoadRetry',
      'handleFileClose',
      // 导航方法
      'handleNavigationGoto',
      'handleNavigationPrevious',
      'handleNavigationNext',
      'renderPage',
      // 缩放方法
      'handleZoomIn',
      'handleZoomOut',
      'handleZoomFitWidth',
      'handleZoomFitHeight',
      'handleZoomActualSize',
      'handleZoomChanged',
      'applyZoom',
      // 其他方法
      'getNavigationHandler',
      'getZoomHandler',
      'getFileHandler',
      'getState',
      'reset',
      'destroy'
    ];

    for (const method of methods) {
      if (typeof eventHandlers[method] !== 'function') {
        throw new Error(`方法 ${method} 不存在`);
      }
      console.log(`  ✓ 方法 ${method} 存在`);
    }

    // 5. 验证子处理器获取
    console.log('\n5. 验证子处理器获取...');
    const navigationHandler = eventHandlers.getNavigationHandler();
    const zoomHandler = eventHandlers.getZoomHandler();
    const fileHandler = eventHandlers.getFileHandler();

    if (!navigationHandler) throw new Error('无法获取NavigationHandler');
    if (!zoomHandler) throw new Error('无法获取ZoomHandler');
    if (!fileHandler) throw new Error('无法获取FileHandler');

    console.log('  ✓ NavigationHandler 获取成功');
    console.log('  ✓ ZoomHandler 获取成功');
    console.log('  ✓ FileHandler 获取成功');

    // 6. 验证状态获取
    console.log('\n6. 验证状态获取...');
    const state = eventHandlers.getState();
    console.log('  当前状态:', {
      currentPage: state.currentPage,
      totalPages: state.totalPages,
      zoomLevel: state.zoomLevel,
      zoomPercentage: state.zoomPercentage,
      isLoading: state.isLoading,
      loadProgress: state.loadProgress
    });
    console.log('  ✓ 状态获取成功');

    // 7. 验证导航功能
    console.log('\n7. 验证导航功能...');

    // 模拟文件已加载
    mockApp.totalPages = 10;
    mockApp.currentFile = { filename: 'test.pdf' };

    // 测试页面跳转
    await eventHandlers.handleNavigationGoto({ pageNumber: 5 });
    if (mockApp.currentPage !== 5) {
      throw new Error('页面跳转失败');
    }
    console.log('  ✓ 页面跳转成功');

    // 测试下一页
    await eventHandlers.handleNavigationNext();
    if (mockApp.currentPage !== 6) {
      throw new Error('下一页导航失败');
    }
    console.log('  ✓ 下一页导航成功');

    // 测试上一页
    await eventHandlers.handleNavigationPrevious();
    if (mockApp.currentPage !== 5) {
      throw new Error('上一页导航失败');
    }
    console.log('  ✓ 上一页导航成功');

    // 8. 验证缩放功能
    console.log('\n8. 验证缩放功能...');

    // 测试放大
    const initialZoom = mockApp.zoomLevel;
    eventHandlers.handleZoomIn();
    if (mockApp.zoomLevel <= initialZoom) {
      throw new Error('放大功能失败');
    }
    console.log('  ✓ 放大功能正常');

    // 测试缩小
    eventHandlers.handleZoomOut();
    if (mockApp.zoomLevel !== initialZoom) {
      throw new Error('缩小功能失败');
    }
    console.log('  ✓ 缩小功能正常');

    // 测试实际大小
    eventHandlers.handleZoomActualSize();
    if (mockApp.zoomLevel !== 1.0) {
      throw new Error('实际大小功能失败');
    }
    console.log('  ✓ 实际大小功能正常');

    // 9. 验证文件处理功能
    console.log('\n9. 验证文件处理功能...');

    // 测试文件加载进度
    eventHandlers.handleFileLoadProgress({ percent: 50, message: '加载中' });
    console.log('  ✓ 文件加载进度处理成功');

    // 测试文件关闭
    await eventHandlers.handleFileClose();
    if (mockApp.currentFile !== null) {
      throw new Error('文件关闭失败');
    }
    console.log('  ✓ 文件关闭成功');

    // 10. 验证事件发送
    console.log('\n10. 验证事件发送...');

    let eventReceived = false;
    const testEventListener = () => {
      eventReceived = true;
    };

    // 监听页面变更事件
    eventBusSingleton.on(PDF_VIEWER_EVENTS.NAVIGATION.PAGE_CHANGED, testEventListener);

    // 触发导航，应该发送页面变更事件
    mockApp.totalPages = 10;
    mockApp.currentFile = { filename: 'test.pdf' };
    await eventHandlers.handleNavigationGoto({ pageNumber: 3 });

    // 等待事件处理
    await new Promise(resolve => setTimeout(resolve, 100));

    if (!eventReceived) {
      throw new Error('事件发送失败');
    }
    console.log('  ✓ 事件发送成功');

    // 11. 测试重置
    console.log('\n11. 测试重置...');
    eventHandlers.reset();
    console.log('  ✓ 重置成功');

    // 12. 测试销毁
    console.log('\n12. 测试销毁...');
    eventHandlers.destroy();
    console.log('  ✓ 销毁成功');

    // 验证完成
    console.log('\n========================================');
    console.log('✅ 事件处理器重构验证完成');
    console.log('========================================');
    console.log('\n所有测试通过! 事件处理器重构成功保持了原有功能。\n');

    return true;

  } catch (error) {
    console.error('\n❌ 事件处理器重构验证失败:', error);
    console.error('错误栈:', error.stack);
    return false;
  }
}

// 如果是直接运行此脚本
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  verifyEventHandlersRefactoring().then(success => {
    if (!success) {
      process.exit(1);
    }
  });
}

export { verifyEventHandlersRefactoring };
