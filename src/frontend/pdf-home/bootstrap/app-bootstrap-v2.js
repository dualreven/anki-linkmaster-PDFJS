/**
 * @file 应用启动引导程序 V2（功能域架构版本）
 * @module AppBootstrapV2
 * @description
 * 新版启动程序，使用功能域架构的 PDFHomeAppV2。
 * 支持通过 Feature Flag 控制功能启用。
 */

import { PDFHomeAppV2 } from '../core/pdf-home-app-v2.js';
import { setupAutoTestEnvironment } from '../core/auto-test-runner.js';
import { resolveWebSocketPortSync, DEFAULT_WS_PORT } from '../utils/ws-port-resolver.js';
import { getLogger } from '../../common/utils/logger.js';
const logger = getLogger('pdf-home/app-v2');

/**
 * 启动 PDF Home 应用（V2 功能域架构）
 * @param {Object} options - 启动选项
 * @param {string} [options.environment='production'] - 运行环境
 * @param {string} [options.featureFlagConfigPath] - Feature Flag 配置文件路径
 * @returns {Promise<PDFHomeAppV2>} 应用实例
 */
export async function bootstrapPDFHomeAppV2(options = {}) {
  logger.info('[DEBUG] DOMContentLoaded: bootstrap PDF Home App V2 (Feature Domain Architecture)...');

  try {
    // 1. 解析 WebSocket 端口
    const wsPort = resolveWebSocketPortSync({ fallbackPort: DEFAULT_WS_PORT });
    const wsUrl = `ws://localhost:${wsPort}`;

    // 2. 合并启动选项
    const appOptions = {
      wsUrl,
      environment: options.environment || 'production',
      featureFlagConfigPath: options.featureFlagConfigPath || './config/feature-flags.json'
    };

    logger.info('[DEBUG] Creating PDFHomeAppV2 with options:', {
      wsUrl,
      environment: appOptions.environment,
      featureFlagConfig: appOptions.featureFlagConfigPath
    });

    // 3. 创建应用实例（功能域架构）
    const app = new PDFHomeAppV2(appOptions);

    logger.info('[DEBUG] Starting app V2 initialization...');
    await app.initialize();

    // 4. 设置自动化测试环境
    setupAutoTestEnvironment(app);

    logger.info('[DEBUG] App V2 initialization completed, setting up window.app...');

    // 5. 暴露全局接口（与 V1 兼容）
    window.app = {
      // 基础 API
      getState: () => app.getState(),
      destroy: () => app.destroy(),

      // V2 特有 API
      enableFeature: (featureName) => app.enableFeature(featureName),
      disableFeature: (featureName) => app.disableFeature(featureName),
      getRegistry: () => app.getRegistry(),
      getStateManager: () => app.getStateManager(),
      getFeatureFlagManager: () => app.getFeatureFlagManager(),
      getContainer: () => app.getContainer(),

      // 内部实例（调试用）
      _internal: app,
      _version: 'v2'
    };

    // 6. 记录启动成功
    logger.info('PDF Home App V2 (Feature Domain Architecture) started successfully');

    // 记录功能域状态
    const state = app.getState();
    logger.info(`Installed Features: ${state.features.installed.join(', ')}`);
    logger.info('Use window.app.getState() for full status');

    logger.info('[DEBUG] PDF Home App V2 fully started');
    logger.info('[DEBUG] Available features:', state.features.installed);

    return app;

  } catch (error) {
    logger.error('[DEBUG] App V2 bootstrap/initialization failed:', error);

    // 尝试记录错误
    try {
      const tempLogger = getLogger('pdf-home/bootstrap-v2');
      tempLogger.error('Bootstrap V2 failed', error);
    } catch (_) {
      // 忽略日志错误
    }

    throw error;
  }
}

/**
 * 获取推荐的启动选项
 * @param {string} environment - 环境名称 ('development' | 'production' | 'test')
 * @returns {Object} 启动选项
 */
export function getRecommendedOptions(environment) {
  const baseOptions = {
    environment
  };

  switch (environment) {
    case 'development':
      return {
        ...baseOptions,
        featureFlagConfigPath: './config/feature-flags.dev.json'
      };

    case 'test':
      return {
        ...baseOptions,
        featureFlagConfigPath: './config/feature-flags.test.json'
      };

    case 'production':
    default:
      return {
        ...baseOptions,
        featureFlagConfigPath: './config/feature-flags.json'
      };
  }
}

