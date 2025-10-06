import { getLogger } from '../common/utils/logger.js';
// Import polyfills first
import '../common/polyfills.js';

/**
 * @file 应用主入口，负责模块的初始化、协调和生命周期管理。
 * @module PDFHomeApp
 * @description
 * 使用功能域架构（V2）启动应用
 */

import { bootstrapPDFHomeAppV2 } from './bootstrap/app-bootstrap-v2.js';
import { setupCommunicationTestUI } from './utils/communication-tester.js';
// 提前创建 logger，确保在任何使用前已初始化
const logger = getLogger('pdf-home.index');

/**
 * 获取运行环境
 * @returns {'development' | 'production' | 'test'}
 */
function getEnvironment() {
  // 检查是否在开发模式
  if (import.meta.env && import.meta.env.DEV) {
    return 'development';
  }

  // 检查 URL 参数
  const urlParams = new URLSearchParams(window.location.search);
  const envParam = urlParams.get('env');
  if (envParam === 'development' || envParam === 'test' || envParam === 'production') {
    return envParam;
  }

  // 默认生产环境
  return 'production';
}

/**
 * 启动应用
 * @returns {Promise<void>}
 */
async function startApp() {
  logger.info('[DEBUG] Starting PDF Home App...');

  try {
    const app = await bootstrapPDFHomeAppV2({
      environment: getEnvironment()
    });

    logger.info('[DEBUG] 黄集攀 App started successfully');

    // 在开发环境下设置通信测试工具
    const env = getEnvironment();
    if (env === 'development') {
      // 兼容 V2：使用显式 getter 获取依赖
      const wsClient = app.getWSClient ? app.getWSClient() : null;
      const eventBus = app.getEventBus ? app.getEventBus() : null;
      if (wsClient && eventBus) {
        setupCommunicationTestUI(wsClient, eventBus);
        logger.info('[DEBUG] Communication test UI enabled (dev mode)');
      } else {
        logger.warn('[DEBUG] Dev UI not enabled: missing wsClient or eventBus');
      }
    }

    return app;

  } catch (error) {
    logger.error('[DEBUG] App bootstrap failed:', error);
    throw error;
  }
}

// ===== 应用启动 =====
logger.info('[DEBUG] Script loaded, waiting for DOMContentLoaded...');
document.addEventListener('DOMContentLoaded', async () => {
  await startApp();
});

logger.info('[DEBUG] Event listener registered for DOMContentLoaded');

