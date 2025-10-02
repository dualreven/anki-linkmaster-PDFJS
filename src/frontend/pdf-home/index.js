// Import polyfills first
import '../common/polyfills.js';

/**
 * @file 应用主入口，负责模块的初始化、协调和生命周期管理。
 * @module PDFHomeApp
 * @description
 * 支持双模式启动：
 * - V1（旧架构）：默认模式，使用 PDFHomeApp
 * - V2（功能域架构）：新模式，使用 PDFHomeAppV2
 *
 * 切换方式：
 * 1. URL 参数：?arch=v2 或 ?arch=v1
 * 2. localStorage：localStorage.setItem('pdf-home-architecture', 'v2')
 * 3. 默认值：v1（向后兼容）
 */

import { bootstrapPDFHomeApp } from './bootstrap/app-bootstrap.js';
import { bootstrapPDFHomeAppV2 } from './bootstrap/app-bootstrap-v2.js';

/**
 * 检测应该使用哪个架构版本
 * @returns {'v1' | 'v2'} 架构版本
 */
function detectArchitecture() {
  // 1. 检查 URL 参数（优先级最高）
  const urlParams = new URLSearchParams(window.location.search);
  const urlArch = urlParams.get('arch');
  if (urlArch === 'v2' || urlArch === 'v1') {
    console.log(`[DEBUG] Architecture from URL parameter: ${urlArch}`);
    return urlArch;
  }

  // 2. 检查 localStorage
  const storedArch = localStorage.getItem('pdf-home-architecture');
  if (storedArch === 'v2' || storedArch === 'v1') {
    console.log(`[DEBUG] Architecture from localStorage: ${storedArch}`);
    return storedArch;
  }

  // 3. 默认使用 V1（向后兼容）
  console.log('[DEBUG] Architecture: v1 (default)');
  return 'v1';
}

/**
 * 根据架构版本启动应用
 * @param {'v1' | 'v2'} architecture - 架构版本
 * @returns {Promise<void>}
 */
async function startApp(architecture) {
  console.log(`[DEBUG] Starting PDF Home App with architecture: ${architecture}`);

  try {
    let app;

    if (architecture === 'v2') {
      // 使用新架构（功能域）
      console.log('[DEBUG] Using V2 (Feature Domain Architecture)');
      app = await bootstrapPDFHomeAppV2({
        environment: getEnvironment()
      });
    } else {
      // 使用旧架构（默认）
      console.log('[DEBUG] Using V1 (Legacy Architecture)');
      app = await bootstrapPDFHomeApp();
    }

    // 记录架构版本到全局
    window.PDF_HOME_ARCHITECTURE = architecture;

    console.log(`[DEBUG] App started successfully with ${architecture} architecture`);
    return app;

  } catch (error) {
    console.error(`[DEBUG] App bootstrap failed (${architecture}):`, error);
    throw error;
  }
}

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

// ===== 应用启动 =====
console.log('[DEBUG] Script loaded, waiting for DOMContentLoaded...');

document.addEventListener('DOMContentLoaded', async () => {
  const architecture = detectArchitecture();
  await startApp(architecture);
});

console.log('[DEBUG] Event listener registered for DOMContentLoaded');

// ===== 暴露全局切换函数（调试用） =====
window.switchArchitecture = function(version) {
  if (version !== 'v1' && version !== 'v2') {
    console.error('Invalid architecture version. Use "v1" or "v2"');
    return;
  }

  localStorage.setItem('pdf-home-architecture', version);
  console.log(`Architecture switched to ${version}. Reloading page...`);
  window.location.reload();
};