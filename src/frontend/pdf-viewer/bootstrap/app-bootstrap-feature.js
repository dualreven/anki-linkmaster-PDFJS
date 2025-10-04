/**
 * @file PDF查看器应用启动引导程序（基于Feature Registry）
 * @module AppBootstrapFeature
 * @description 使用插件化架构启动PDF查看器应用
 */

import { getLogger } from "../../common/utils/logger.js";
import { FeatureRegistry } from "../../common/micro-service/feature-registry.js";
import { SimpleDependencyContainer } from "../container/simple-dependency-container.js";
import eventBusSingleton from "../../common/event/event-bus.js";

// 导入 Features
import { AppCoreFeature } from "../features/app-core/index.js";
import { PDFManagerFeature } from "../features/pdf-manager/index.js";
import { UIManagerFeature } from "../features/ui-manager/index.js";
import { CoreNavigationFeature } from "../features/core-navigation/index.js";
import { SearchFeature } from "../features/search/index.js";
import { URLNavigationFeature } from "../features/url-navigation/index.js";
import { AnnotationFeature } from "../features/annotation/index.js";
import { SidebarManagerFeature } from "../features/sidebar-manager/index.js";
import { PDFBookmarkFeature } from "../features/pdf-bookmark/index.js";

/**
 * 解析WebSocket端口
 * @returns {number} WebSocket端口号
 */
function resolveWebSocketPort() {
  // 1. 优先从URL参数获取
  const urlParams = new URLSearchParams(window.location.search);
  const msgCenterPort = urlParams.get('msgCenter');
  if (msgCenterPort) {
    return parseInt(msgCenterPort, 10);
  }

  // 2. 从环境或默认值
  return 8765;
}

/**
 * 解析PDF文件路径
 * @returns {string|null} PDF文件路径
 */
function resolvePDFPath() {
  const urlParams = new URLSearchParams(window.location.search);

  // 1. 优先检查window.PDF_PATH（通过script标签注入）
  if (window.PDF_PATH) {
    return window.PDF_PATH;
  }

  // 2. 检查URL参数file（通过launcher.py传递）
  const fileParam = urlParams.get('file');
  if (fileParam) {
    return decodeURIComponent(fileParam);
  }

  return null;
}

/**
 * 启动PDF查看器应用（基于Feature Registry）
 * @returns {Promise<FeatureRegistry>} Feature Registry 实例
 */
export async function bootstrapPDFViewerAppFeature() {
  const logger = getLogger('pdf-viewer.bootstrap');
  logger.info("[Bootstrap] Starting PDF Viewer App initialization (Feature-based)...");

  try {
    // 1. 解析配置
    const wsPort = resolveWebSocketPort();
    const wsUrl = `ws://localhost:${wsPort}`;
    const pdfPath = resolvePDFPath();

    logger.info(`[Bootstrap] Configuration: wsUrl=${wsUrl}, pdfPath=${pdfPath}`);

    // 2. 创建依赖注入容器
    const container = new SimpleDependencyContainer('pdf-viewer');

    // 注册核心服务
    container.register('eventBus', eventBusSingleton);
    container.register('logger', logger);

    // 3. 创建 Feature Registry
    const registry = new FeatureRegistry({
      container,
      globalEventBus: eventBusSingleton,
      logger
    });

    // 4. 注册核心 Features
    registry.register(new AppCoreFeature());
    registry.register(new PDFManagerFeature());
    registry.register(new UIManagerFeature());
    registry.register(new CoreNavigationFeature());  // 核心导航服务（需在url-navigation和annotation之前）
    registry.register(new SearchFeature());  // 注册搜索功能
    registry.register(new URLNavigationFeature());
    registry.register(new PDFBookmarkFeature());  // 书签管理功能（需在sidebar-manager之前）
    registry.register(new SidebarManagerFeature());  // 侧边栏统一管理器
    registry.register(new AnnotationFeature());

    // 5. 安装所有 Features（自动解析依赖顺序）
    logger.info("[Bootstrap] Installing features...");
    await registry.installAll();

    // 6. 设置全局引用（便于调试）
    window.pdfViewerApp = {
      registry,
      container,
      getFeature: (name) => {
        const record = registry.get(name);
        return record ? record.feature : null;
      },
      destroy: () => registry.uninstallAll(),
      eventBus: eventBusSingleton
    };

    // 7. 如果有PDF路径，自动加载
    if (pdfPath) {
      logger.info(`[Bootstrap] Auto-loading PDF: ${pdfPath}`);

      // 从完整路径中提取文件名
      const filename = pdfPath.includes('\\') || pdfPath.includes('/')
        ? pdfPath.split(/[\\\/]/).pop()
        : pdfPath;

      // 通过事件系统请求加载PDF
      const { PDF_VIEWER_EVENTS } = await import("../../common/event/pdf-viewer-constants.js");
      eventBusSingleton.emit(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, {
        filename: filename,
        file_path: pdfPath
      }, { actorId: 'Bootstrap' });
    }

    logger.info("[Bootstrap] PDF Viewer App started successfully");
    return registry;

  } catch (error) {
    logger.error("[Bootstrap] Failed to start PDF Viewer App:", error);
    throw error;
  }
}
