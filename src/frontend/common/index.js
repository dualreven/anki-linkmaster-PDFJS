/**
 * 通用组件加载器
 * 确保所有基础组件按正确顺序加载
 * 使用ES6模块规范
 */

// 导入所有组件
// import QtWebEngineAdapter from './qtwebengine-adapter.js';
import DebugTools from './debug-tools.js';
import WebSocketManager from './websocket-manager.js';
import UIManager from './ui-manager.js';
import BusinessLogicManager from './business-logic-manager.js';
import AppManager from './app-manager.js';
import ErrorCollector from './error-collector.js';

// 创建全局实例（保持向后兼容）
// const qtWebEngineAdapter = new QtWebEngineAdapter();
const debugTools = new DebugTools({
    prefix: 'App',
    enabled: true
});
const errorCollector = new ErrorCollector();

// 导出所有类和实例
export {
    // QtWebEngineAdapter,
    DebugTools,
    WebSocketManager,
    UIManager,
    BusinessLogicManager,
    AppManager,
    ErrorCollector,
    // qtWebEngineAdapter,
    debugTools,
    errorCollector
};

// 确保所有组件都可用
console.log('[CommonComponents] 所有通用组件已加载完成');