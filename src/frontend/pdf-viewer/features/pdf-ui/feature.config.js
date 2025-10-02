/**
 * @file PDF UI功能域配置
 */

export const PDFUIFeatureConfig = {
  name: 'pdf-ui',
  version: '1.0.0',
  dependencies: ['pdf-reader'],
  description: 'PDF UI组件功能 - 渲染容器、键盘快捷键、进度提示',
  
  capabilities: [
    '渲染容器管理',
    '键盘快捷键',
    '进度条和错误提示',
    '布局控制',
    '缩放控件'
  ],
  
  events: {
    UI_READY: '@pdf-ui/ready',
    KEYBOARD_SHORTCUT: '@pdf-ui/keyboard:shortcut',
    LAYOUT_CHANGE: '@pdf-ui/layout:change'
  },
  
  metadata: {
    phase: 'Phase 1',
    priority: 'high'
  }
};
