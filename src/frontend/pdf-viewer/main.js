/**
 * @file PDF查看器应用主入口，负责模块的初始化、协调和生命周期管理
 * @module PDFViewerApp
 * @description 基于事件总线的组合式架构，管理PDF查看器的所有核心功能
 */

// 导入PDF.js viewer的CSS样式（用于文字层）
import 'pdfjs-dist/web/pdf_viewer.css';

import { getLogger } from "../common/utils/logger.js";

// ===== 应用启动 =====
// 使用 Feature-based bootstrap 模式启动应用（插件化架构）
// 旧版本: import { bootstrapPDFViewerApp } from "./bootstrap/app-bootstrap.js";
import { bootstrapPDFViewerAppFeature } from "./bootstrap/app-bootstrap-feature.js";

document.addEventListener("DOMContentLoaded", async () => {
  const indexLogger = getLogger("PDFViewer");
  indexLogger.info("DOMContentLoaded: Starting PDF Viewer App bootstrap...");
  indexLogger.info("黄集攀-1 (Feature-based architecture)");

  try {
    // 使用新的 Feature-based bootstrap
    await bootstrapPDFViewerAppFeature();
    indexLogger.info("PDF Viewer App bootstrap completed successfully");
  } catch (error) {
    indexLogger.error("PDF Viewer App bootstrap failed:", error);
  }
});