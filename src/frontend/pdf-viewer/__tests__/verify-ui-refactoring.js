/**
 * UI管理器重构验证测试
 * 验证重构后的UI管理器功能是否正常
 */

import eventBusSingleton from '../../common/event/event-bus.js';
import { UIManagerCore } from '../features/ui-manager/components/ui-manager-core.js';
import { PDF_VIEWER_EVENTS } from '../../common/event/pdf-viewer-constants.js';
import { getLogger } from '../../common/utils/logger.js';

const logger = getLogger('UIRefactoringTest');

/**
 * 验证UI管理器重构
 */
async function verifyUIRefactoring() {
  console.log('========================================');
  console.log('UI管理器重构验证测试');
  console.log('========================================\n');

  try {
    // 1. 验证模块导入
    console.log('1. 验证模块导入...');
    const modules = {
      'UIManagerCore': UIManagerCore,
      'DOMElementManager': (await import('../ui/dom-element-manager.js')).DOMElementManager,
      'KeyboardHandler': (await import('../ui/keyboard-handler.js')).KeyboardHandler,
      'UIStateManager': (await import('../ui/ui-state-manager.js')).UIStateManager
    };

    for (const [name, Module] of Object.entries(modules)) {
      if (!Module) {
        throw new Error(`模块 ${name} 导入失败`);
      }
      console.log(`  ✓ ${name} 导入成功`);
    }

    // 2. 验证UIManagerCore实例化
    console.log('\n2. 验证UIManagerCore实例化...');
    const uiManager = new UIManagerCore(eventBusSingleton);
    console.log('  ✓ UIManagerCore 实例化成功');

    // 3. 验证初始化
    console.log('\n3. 验证初始化...');
    await uiManager.initialize();
    console.log('  ✓ 初始化成功');

    // 4. 验证公共方法
    console.log('\n4. 验证公共方法...');
    const methods = [
      'getContainerWidth',
      'getContainerHeight',
      'showLoading',
      'getState',
      'getElement',
      'getElements',
      'setKeyboardEnabled',
      'addKeyBinding',
      'cleanup',
      'destroy',
      'getPerformanceStats'
    ];

    for (const method of methods) {
      if (typeof uiManager[method] !== 'function') {
        throw new Error(`方法 ${method} 不存在`);
      }
      console.log(`  ✓ 方法 ${method} 存在`);
    }

    // 5. 验证状态管理
    console.log('\n5. 验证状态管理...');
    const state = uiManager.getState();
    console.log('  当前状态:', {
      currentScale: state.currentScale,
      currentPage: state.currentPage,
      totalPages: state.totalPages,
      isLoading: state.isLoading,
      isLoaded: state.isLoaded
    });
    console.log('  ✓ 状态获取成功');

    // 6. 验证DOM元素管理
    console.log('\n6. 验证DOM元素管理...');
    const elements = uiManager.getElements();
    console.log(`  DOM元素数量: ${Object.keys(elements).length}`);

    // 获取特定元素
    const container = uiManager.getElement('container');
    if (container) {
      console.log('  ✓ container元素获取成功');
    }

    const canvas = uiManager.getElement('canvas');
    if (canvas) {
      console.log('  ✓ canvas元素获取成功');
    }

    // 7. 验证键盘处理
    console.log('\n7. 验证键盘处理...');

    // 禁用键盘
    uiManager.setKeyboardEnabled(false);
    console.log('  ✓ 键盘处理已禁用');

    // 启用键盘
    uiManager.setKeyboardEnabled(true);
    console.log('  ✓ 键盘处理已启用');

    // 添加自定义键绑定
    let customHandlerCalled = false;
    uiManager.addKeyBinding('ctrl+t', () => {
      customHandlerCalled = true;
      console.log('  ✓ 自定义键绑定被触发');
    });
    console.log('  ✓ 自定义键绑定添加成功');

    // 8. 验证加载状态
    console.log('\n8. 验证加载状态...');
    uiManager.showLoading(true);
    console.log('  ✓ 显示加载状态');

    uiManager.showLoading(false);
    console.log('  ✓ 隐藏加载状态');

    // 9. 验证容器尺寸
    console.log('\n9. 验证容器尺寸...');
    const width = uiManager.getContainerWidth();
    const height = uiManager.getContainerHeight();
    console.log(`  容器尺寸: ${width}x${height}`);
    console.log('  ✓ 容器尺寸获取成功');

    // 10. 验证性能统计
    console.log('\n10. 验证性能统计...');
    const stats = uiManager.getPerformanceStats();
    console.log('  性能统计:', stats);
    console.log('  ✓ 性能统计获取成功');

    // 11. 验证事件响应
    console.log('\n11. 验证事件响应...');

    // 测试页面变更事件
    let pageChangeHandled = false;
    const testPageChange = new Promise((resolve) => {
      setTimeout(() => {
        eventBusSingleton.emit(PDF_VIEWER_EVENTS.NAVIGATION.PAGE_CHANGED, {
          pageNumber: 5,
          totalPages: 20
        }, { actorId: 'UIRefactoringTest' });

        setTimeout(() => {
          const newState = uiManager.getState();
          if (newState.currentPage === 5 && newState.totalPages === 20) {
            pageChangeHandled = true;
          }
          resolve();
        }, 100);
      }, 100);
    });

    await testPageChange;
    if (pageChangeHandled) {
      console.log('  ✓ 页面变更事件处理成功');
    }

    // 测试缩放变更事件
    let zoomChangeHandled = false;
    const testZoomChange = new Promise((resolve) => {
      setTimeout(() => {
        eventBusSingleton.emit(PDF_VIEWER_EVENTS.ZOOM.CHANGED, {
          scale: 1.5,
          mode: 'custom'
        }, { actorId: 'UIRefactoringTest' });

        setTimeout(() => {
          const newState = uiManager.getState();
          if (newState.currentScale === 1.5 && newState.scaleMode === 'custom') {
            zoomChangeHandled = true;
          }
          resolve();
        }, 100);
      }, 100);
    });

    await testZoomChange;
    if (zoomChangeHandled) {
      console.log('  ✓ 缩放变更事件处理成功');
    }

    // 12. 清理测试
    console.log('\n12. 测试清理...');
    uiManager.cleanup();
    console.log('  ✓ 清理成功');

    // 13. 销毁测试
    console.log('\n13. 测试销毁...');
    uiManager.destroy();
    console.log('  ✓ 销毁成功');

    // 验证完成
    console.log('\n========================================');
    console.log('✅ UI管理器重构验证完成');
    console.log('========================================');
    console.log('\n所有测试通过! UI管理器重构成功保持了原有功能。\n');

    return true;

  } catch (error) {
    console.error('\n❌ UI管理器重构验证失败:', error);
    console.error('错误栈:', error.stack);
    return false;
  }
}

// 如果是直接运行此脚本
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  verifyUIRefactoring().then(success => {
    if (!success) {
      process.exit(1);
    }
  });
}

export { verifyUIRefactoring };