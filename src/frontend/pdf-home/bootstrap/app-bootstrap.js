/**
 * @file 应用启动引导程序
 * @module AppBootstrap
 */

import { PDFHomeApp } from "../core/pdf-home-app.js";
import { setupAutoTestEnvironment } from "../core/auto-test-runner.js";
import { resolveWebSocketPortSync, DEFAULT_WS_PORT } from "../utils/ws-port-resolver.js";
import { getLogger } from "../../common/utils/logger.js";

/**
 * 启动PDF Home应用
 * @returns {Promise<PDFHomeApp>} 应用实例
 */
export async function bootstrapPDFHomeApp() {
  console.log("[DEBUG] DOMContentLoaded: bootstrap PDF Home App...");

  try {
    // 1) 解析WebSocket端口
    const wsPort = resolveWebSocketPortSync({ fallbackPort: DEFAULT_WS_PORT });
    const wsUrl = `ws://localhost:${wsPort}`;

    // 3) 创建应用实例（会自动创建容器）
    const app = new PDFHomeApp({ wsUrl });

    console.log("[DEBUG] Starting app initialization...");
    await app.initialize();

    // 设置自动化测试环境
    setupAutoTestEnvironment(app);

    console.log("[DEBUG] App initialization completed, setting up window.app...");
    window.app = {
      getState: () => app.getState(),
      destroy: () => app.destroy(),
      _internal: app
    };

    // 使用getLogger创建临时logger来记录启动成功
    const logger = getLogger('pdf-home/app');
    logger.info("PDF Home App started. Use window.app.getState() for status.");
    console.log("[DEBUG] PDF Home App fully started");

    return app;
  } catch (error) {
    console.error("[DEBUG] App bootstrap/initialization failed:", error);
    try {
      // 尝试创建一个临时logger来记录错误
      const tempLogger = getLogger('pdf-home/bootstrap');
      tempLogger.error('Bootstrap failed', error);
    } catch (_) {}
    throw error;
  }
}