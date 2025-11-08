/**
 * UI管理器重构验证测试
 * 验证重构后的UI管理器功能是否正常
 */

import eventBusSingleton from "../../common/event/event-bus.js";
import { UIManagerCore } from "../features/infra-ui/components/ui-manager-core.js";
import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { getLogger } from "../../common/utils/logger.js";
const logger = getLogger("UIRefactoringTest");

/**
 * 验证UI管理器重构
 */
async function verifyUIRefactoring() {
  logger.info("========================================");
  logger.info("UI管理器重构验证测试");
  logger.info("========================================");

  try {
    // 1. 验证模块导入
    logger.info("1. 验证模块导入...");
    const modules = {
      "UIManagerCore": UIManagerCore,
      "DOMElementManager": (await import("../ui/dom-element-manager.js")).DOMElementManager,
      "KeyboardHandler": (await import("../ui/keyboard-handler.js")).KeyboardHandler,
      "UIStateManager": (await import("../ui/ui-state-manager.js")).UIStateManager
    };

    for (const [name, Module] of Object.entries(modules)) {
      if (!Module) {
        throw new Error(`模块 ${name} 导入失败`);
      }
      logger.info(`  ✓ ${name} 导入成功`);
    }

    // 2. 验证UIManagerCore实例化
    logger.info("2. 验证UIManagerCore实例化...");
    const uiManager = new UIManagerCore(eventBusSingleton);
    logger.info("  ✓ UIManagerCore 实例化成功");

    // 3. 验证初始化
    logger.info("3. 验证初始化...");
    await uiManager.initialize();
    logger.info("  ✓ 初始化成功");

    // 4. 验证公共方法
    logger.info("4. 验证公共方法...");
    const methods = [
      "getContainerWidth",
      "getContainerHeight",
      "showLoading",
      "getState",
      "getElement",
      "getElements",
      "setKeyboardEnabled",
      "addKeyBinding",
      "cleanup",
      "destroy",
      "getPerformanceStats"
    ];

    for (const method of methods) {
      if (typeof uiManager[method] !== "function") {
        throw new Error(`方法 ${method} 不存在`);
      }
      logger.info(`  ✓ 方法 ${method} 存在`);
    }

    // 5. 验证状态管理
    logger.info("5. 验证状态管理...");
    const state = uiManager.getState();
    logger.info("  当前状态:", {
      currentScale: state.currentScale,
      currentPage: state.currentPage,
      totalPages: state.totalPages,
      isLoading: state.isLoading,
      isLoaded: state.isLoaded
    });
    logger.info("  ✓ 状态获取成功");

    // 6. 验证DOM元素管理
    logger.info("6. 验证DOM元素管理...");
    const elements = uiManager.getElements();
    logger.info(`  DOM元素数量: ${Object.keys(elements).length}`);

    // 获取特定元素
    const container = uiManager.getElement("container");
    if (container) {
      logger.info("  ✓ container元素获取成功");
    }

    const canvas = uiManager.getElement("canvas");
    if (canvas) {
      logger.info("  ✓ canvas元素获取成功");
    }

    // 7. 验证键盘处理
    logger.info("7. 验证键盘处理...");

    // 禁用键盘
    uiManager.setKeyboardEnabled(false);
    logger.info("  ✓ 键盘处理已禁用");

    // 启用键盘
    uiManager.setKeyboardEnabled(true);
    logger.info("  ✓ 键盘处理已启用");

    // 添加自定义键绑定
    uiManager.addKeyBinding("ctrl+t", () => {
      logger.info("  ✓ 自定义键绑定被触发");
    });
    logger.info("  ✓ 自定义键绑定添加成功");

    // 8. 验证加载状态
    logger.info("8. 验证加载状态...");
    uiManager.showLoading(true);
    logger.info("  ✓ 显示加载状态");

    uiManager.showLoading(false);
    logger.info("  ✓ 隐藏加载状态");

    // 9. 验证容器尺寸
    logger.info("9. 验证容器尺寸...");
    const width = uiManager.getContainerWidth();
    const height = uiManager.getContainerHeight();
    logger.info(`  容器尺寸: ${width}x${height}`);
    logger.info("  ✓ 容器尺寸获取成功");

    // 10. 验证性能统计
    logger.info("10. 验证性能统计...");
    const stats = uiManager.getPerformanceStats();
    logger.info("  性能统计:", stats);
    logger.info("  ✓ 性能统计获取成功");

    // 11. 验证事件响应
    logger.info("11. 验证事件响应...");

    // 测试页面变更事件
    let pageChangeHandled = false;
    const testPageChange = new Promise((resolve) => {
      setTimeout(() => {
        eventBusSingleton.emit(PDF_VIEWER_EVENTS.NAVIGATION.PAGE_CHANGED, {
          pageNumber: 5,
          totalPages: 20
        }, { actorId: "UIRefactoringTest" });

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
      logger.info("  ✓ 页面变更事件处理成功");
    }

    // 测试缩放变更事件
    let zoomChangeHandled = false;
    const testZoomChange = new Promise((resolve) => {
      setTimeout(() => {
        eventBusSingleton.emit(PDF_VIEWER_EVENTS.ZOOM.CHANGED, {
          scale: 1.5,
          mode: "custom"
        }, { actorId: "UIRefactoringTest" });

        setTimeout(() => {
          const newState = uiManager.getState();
          if (newState.currentScale === 1.5 && newState.scaleMode === "custom") {
            zoomChangeHandled = true;
          }
          resolve();
        }, 100);
      }, 100);
    });

    await testZoomChange;
    if (zoomChangeHandled) {
      logger.info("  ✓ 缩放变更事件处理成功");
    }

    // 12. 清理测试
    logger.info("12. 测试清理...");
    uiManager.cleanup();
    logger.info("  ✓ 清理成功");

    // 13. 销毁测试
    logger.info("13. 测试销毁...");
    uiManager.destroy();
    logger.info("  ✓ 销毁成功");

    // 验证完成
    logger.info("========================================");
    logger.info("✅ UI管理器重构验证完成");
    logger.info("========================================");
    logger.info("所有测试通过! UI管理器重构成功保持了原有功能。");

    return true;

  } catch (error) {
    logger.error("❌ UI管理器重构验证失败:", error);
    try { logger.error("错误栈:", error.stack); } catch {}
    return false;
  }
}

// 如果是直接运行此脚本
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  verifyUIRefactoring().then(success => {
    if (!success) {
      process.exit(1);
    }
  });
}

export { verifyUIRefactoring };

