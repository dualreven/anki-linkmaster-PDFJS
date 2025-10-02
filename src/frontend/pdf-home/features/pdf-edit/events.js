/**
 * @file PDF编辑功能域事件定义
 * @module PDFEditEvents
 * @description PDF编辑功能的事件常量定义
 */

/**
 * PDF编辑事件常量
 * @constant
 */
export const PDF_EDIT_EVENTS = {
  // 编辑操作事件
  EDIT_REQUESTED: 'edit:requested',
  EDIT_STARTED: 'edit:started',
  EDIT_COMPLETED: 'edit:completed',
  EDIT_FAILED: 'edit:failed',
  EDIT_CANCELLED: 'edit:cancelled',

  // 模态框事件
  MODAL_OPENED: 'modal:opened',
  MODAL_CLOSED: 'modal:closed',

  // 表单事件
  FORM_CHANGED: 'form:changed',
  FORM_VALIDATED: 'form:validated',
  FORM_SUBMITTED: 'form:submitted',

  // 错误事件
  ERROR_OCCURRED: 'error:occurred',
};

/**
 * 创建编辑请求事件数据
 * @param {Object} record - PDF记录
 * @returns {Object} 事件数据
 */
export function createEditRequestedData(record) {
  return {
    record,
    timestamp: Date.now()
  };
}

/**
 * 创建编辑完成事件数据
 * @param {string} pdfId - PDF ID
 * @param {Object} updates - 更新数据
 * @returns {Object} 事件数据
 */
export function createEditCompletedData(pdfId, updates) {
  return {
    pdf_id: pdfId,
    updates,
    timestamp: Date.now()
  };
}
