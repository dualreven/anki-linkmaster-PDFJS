/**
 * @file PDF管理器导出（使用重构后的模块）
 * @module PDFManager
 * @description 导出重构后的PDF管理器，保持向后兼容
 *
 * 重构说明：
 * - 原始的单文件实现（504行）已被拆分到pdf/目录下的多个模块
 * - pdf-loader.js: PDF加载逻辑（155行）
 * - pdf-document-manager.js: 文档管理（195行）
 * - page-cache-manager.js: 页面缓存（178行）
 * - pdf-config.js: 配置管理（113行）
 * - pdf-manager-refactored.js: 主管理器（265行）
 *
 * 总计：从504行拆分为5个文件，更易维护和测试
 */

// 导出重构后的PDFManager
export { PDFManager } from "./pdf/pdf-manager-refactored.js";

// 也导出子模块，便于独立测试和使用
export { PDFLoader } from "./pdf/pdf-loader.js";
export { PDFDocumentManager } from "./pdf/pdf-document-manager.js";
export { PageCacheManager } from "./pdf/page-cache-manager.js";
export {
  getPDFJSConfig,
  PDFJS_CONFIG,
  LOADING_CONFIG,
  CACHE_CONFIG,
  PATH_CONFIG
} from "./pdf/pdf-config.js";