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
  logger.debug('Starting PDF Home App...');

  try {
    const app = await bootstrapPDFHomeAppV2({
      environment: getEnvironment()
    });

    logger.debug('App started successfully');

    // 已移除“通信测试”按钮与相关开发UI

    return app;

  } catch (error) {
    logger.error('App bootstrap failed:', error);
    throw error;
  }
}

// ===== 应用启动 =====
logger.debug('Script loaded, waiting for DOMContentLoaded...');
document.addEventListener('DOMContentLoaded', async () => {
  await startApp();
});

logger.debug('Event listener registered for DOMContentLoaded');

