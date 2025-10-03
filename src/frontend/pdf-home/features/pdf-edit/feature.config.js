/**
 * @file PDF编辑功能域配置
 * @module PDFEditConfig
 */

export const PDF_EDIT_FEATURE_CONFIG = {
  name: 'pdf-edit',
  version: '1.0.0',
  description: 'PDF记录编辑功能',

  // 依赖的其他功能域
  dependencies: [],

  // 提供的全局事件
  providedEvents: [
    '@pdf-edit/edit:completed',
    '@pdf-edit/edit:failed'
  ],

  // 监听的全局事件
  listenedEvents: [
    '@pdf-management/pdf:edit:requested'
  ]
};
