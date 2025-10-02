/**
 * @file 微服务架构核心组件 - 统一导出入口
 * @module common/micro-service
 * @description
 * 提供功能域架构所需的核心基础设施组件：
 * - DependencyContainer: 依赖注入容器
 * - FeatureRegistry: 功能注册中心
 * - StateManager: 响应式状态管理
 * - FeatureFlagManager: Feature Flag 管理
 *
 * @example
 * // 导入所有核心组件
 * import {
 *   DependencyContainer,
 *   FeatureRegistry,
 *   StateManager,
 *   FeatureFlagManager
 * } from '../../common/micro-service/index.js';
 *
 * // 创建应用
 * const container = new DependencyContainer('my-app');
 * const registry = new FeatureRegistry({ container });
 * const stateManager = new StateManager();
 * const flagManager = new FeatureFlagManager();
 */

// ==================== 依赖注入容器 ====================
export { DependencyContainer, ServiceScope } from './dependency-container.js';

// ==================== 功能注册中心 ====================
export { FeatureRegistry, FeatureStatus } from './feature-registry.js';

// ==================== 状态管理器 ====================
export { StateManager } from './state-manager.js';

// ==================== Feature Flag 管理器 ====================
export { FeatureFlagManager } from './feature-flag-manager.js';

/**
 * 版本信息
 * @constant {string}
 */
export const VERSION = '1.0.0';

/**
 * 来源说明
 * @constant {string}
 */
export const SOURCE = 'PDF-Home (anki-linkmaster-B)';

/**
 * 迁移日期
 * @constant {string}
 */
export const MIGRATED_AT = '2025-10-02';
