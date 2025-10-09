/**
 * @file Polyfills for ES features.
 * @description This file should be imported at the very top of the application's entry point.
 */

// 生产构建下禁用 core-js 全量注入，避免打包器生成 file:/// 绝对路径导入导致加载失败。
// QtWebEngine (Chromium) 运行环境已具备现代特性，暂不需要全量 polyfill。
// 如需特定 polyfill，请改为精确按需引入并确认打包输出不包含本地绝对路径。
// import 'core-js/stable';

// Import regenerator-runtime for async/await syntax.
import 'regenerator-runtime/runtime';
