// Import polyfills first
import '../common/polyfills.js';

/**
 * @file 应用主入口，负责模块的初始化、协调和生命周期管理。
 * @module PDFHomeApp
 */

import { bootstrapPDFHomeApp } from "./bootstrap/app-bootstrap.js";

// ===== 应用启动 =====
console.log("[DEBUG] Script loaded, waiting for DOMContentLoaded...");

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await bootstrapPDFHomeApp();
  } catch (error) {
    console.error("[DEBUG] App bootstrap failed:", error);
  }
});

console.log("[DEBUG] Event listener registered for DOMContentLoaded");