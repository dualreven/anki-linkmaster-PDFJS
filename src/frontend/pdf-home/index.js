// Import polyfills first
import '../common/polyfills.js';

/**
 * @file 应用主入口，负责模块的初始化、协调和生命周期管理。
 * @module PDFHomeApp
 * @description
 * 使用功能域架构（V2）启动应用
 */

import { bootstrapPDFHomeAppV2 } from './bootstrap/app-bootstrap-v2.js';

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
  console.log('[DEBUG] Starting PDF Home App...');

  try {
    const app = await bootstrapPDFHomeAppV2({
      environment: getEnvironment()
    });

    console.log('[DEBUG] App started successfully');
    return app;

  } catch (error) {
    console.error('[DEBUG] App bootstrap failed:', error);
    throw error;
  }
}

// ===== 应用启动 =====
console.log('[DEBUG] Script loaded, waiting for DOMContentLoaded...');

document.addEventListener('DOMContentLoaded', async () => {
  await startApp();
});

console.log('[DEBUG] Event listener registered for DOMContentLoaded');
