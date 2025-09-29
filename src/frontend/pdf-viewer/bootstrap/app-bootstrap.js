/**
 * @file PDF查看器应用启动引导程序
 * @module AppBootstrap
 * @description 负责PDF查看器应用的初始化和启动，参照pdf-home的模式
 */

import { getLogger } from "../../common/utils/logger.js";

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
 * 启动PDF查看器应用
 * @returns {Promise<PDFViewerApp>} 应用实例
 */
export async function bootstrapPDFViewerApp() {
  const logger = getLogger('pdf-viewer.bootstrap');
  logger.info("[Bootstrap] Starting PDF Viewer App initialization...");

  try {
    // 1. 解析配置
    const wsPort = resolveWebSocketPort();
    const wsUrl = `ws://localhost:${wsPort}`;
    const pdfPath = resolvePDFPath();

    logger.info(`[Bootstrap] Configuration: wsUrl=${wsUrl}, pdfPath=${pdfPath}`);

    // 2. 动态导入主应用类（避免循环依赖）
    const { PDFViewerApp } = await import("../main.js");

    // 3. 创建应用实例
    const app = new PDFViewerApp({ wsUrl });

    // 4. 执行初始化
    logger.info("[Bootstrap] Initializing app...");
    await app.initialize();

    // 5. 设置全局引用（便于调试）
    window.pdfViewerApp = {
      getState: () => app.getState(),
      destroy: () => app.destroy(),
      loadPDF: (path) => app.loadPDF?.(path),
      _internal: app // 内部引用，仅用于调试
    };

    // 6. 如果有PDF路径，自动加载
    if (pdfPath) {
      logger.info(`[Bootstrap] Auto-loading PDF: ${pdfPath}`);

      // 从完整路径中提取文件名
      const filename = pdfPath.includes('\\') || pdfPath.includes('/')
        ? pdfPath.split(/[\\\/]/).pop()
        : pdfPath;

      // 通过事件系统请求加载PDF
      const eventBus = app.getEventBus();
      if (eventBus) {
        const { PDF_VIEWER_EVENTS } = await import("../../common/event/pdf-viewer-constants.js");
        eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, {
          filename: filename,
          file_path: pdfPath
        }, { actorId: 'Bootstrap' });
      }
    }

    logger.info("[Bootstrap] PDF Viewer App started successfully");
    return app;

  } catch (error) {
    logger.error("[Bootstrap] Failed to initialize PDF Viewer App:", error);

    // 尝试显示错误信息到界面
    try {
      const errorContainer = document.getElementById('error-container');
      if (errorContainer) {
        errorContainer.innerHTML = `
          <div style="color: red; padding: 20px;">
            <h3>Failed to start PDF Viewer</h3>
            <p>${error.message}</p>
          </div>
        `;
      }
    } catch (displayError) {
      console.error("Failed to display error:", displayError);
    }

    throw error;
  }
}

/**
 * 设置自动化测试环境（可选）
 * @param {PDFViewerApp} app - 应用实例
 */
export function setupAutoTestEnvironment(app) {
  const logger = getLogger('pdf-viewer.test');

  // 仅在开发环境启用
  if (process.env.NODE_ENV !== 'production') {
    window.testPDFViewer = {
      // 测试加载PDF
      loadTestPDF: async () => {
        logger.info("[Test] Loading test PDF...");
        return app.loadPDF?.('/test/sample.pdf');
      },

      // 测试导航
      testNavigation: async () => {
        logger.info("[Test] Testing navigation...");
        const eventBus = app.getEventBus();
        if (eventBus) {
          eventBus.emit('pdf:navigation:next', {}, { actorId: 'Test' });
        }
      },

      // 测试缩放
      testZoom: async (level) => {
        logger.info(`[Test] Testing zoom to ${level}...`);
        const eventBus = app.getEventBus();
        if (eventBus) {
          eventBus.emit('pdf:zoom:set', { level }, { actorId: 'Test' });
        }
      }
    };

    logger.info("[Test] Auto-test environment setup completed");
  }
}