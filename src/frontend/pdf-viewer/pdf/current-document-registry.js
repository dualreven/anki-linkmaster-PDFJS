/**
 * 当前PDF文档注册表
 * @file 保存/获取当前打开的 PDF.js 文档实例，供跨模块安全访问
 * @module CurrentPDFDocumentRegistry
 */

let currentPDFDocument = null;

/**
 * 设置当前PDF文档
 * @param {Object|null} pdfDocument - PDF.js 文档对象
 */
export function setCurrentPDFDocument(pdfDocument) {
  currentPDFDocument = pdfDocument || null;
}

/**
 * 获取当前PDF文档
 * @returns {Object|null} 当前 PDF.js 文档对象
 */
export function getCurrentPDFDocument() {
  return currentPDFDocument;
}

/**
 * 清空当前PDF文档
 */
export function clearCurrentPDFDocument() {
  currentPDFDocument = null;
}

export default {
  setCurrentPDFDocument,
  getCurrentPDFDocument,
  clearCurrentPDFDocument
};

