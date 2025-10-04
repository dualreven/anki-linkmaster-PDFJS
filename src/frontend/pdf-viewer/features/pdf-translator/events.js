/**
 * PDF 翻译功能域事件常量
 * @module PDFTranslatorEvents
 * @description 定义翻译功能相关的所有事件名称，遵循三段式命名规范
 */

/**
 * PDF翻译事件常量
 * 命名规范: {module}:{action}:{status}
 */
export const PDF_TRANSLATOR_EVENTS = {
  // 文本选择事件
  TEXT: {
    SELECTED: 'pdf-translator:text:selected',
    CLEARED: 'pdf-translator:text:cleared'
  },

  // 翻译请求事件
  TRANSLATE: {
    REQUESTED: 'pdf-translator:translate:requested',
    STARTED: 'pdf-translator:translate:started',
    COMPLETED: 'pdf-translator:translate:completed',
    FAILED: 'pdf-translator:translate:failed'
  },

  // 侧边栏事件
  SIDEBAR: {
    TOGGLE: 'pdf-translator:sidebar:toggle',
    OPENED: 'pdf-translator:sidebar:opened',
    CLOSED: 'pdf-translator:sidebar:closed'
  },

  // 卡片集成事件
  CARD: {
    CREATE_REQUESTED: 'pdf-translator:card:create-requested',
    CREATE_SUCCESS: 'pdf-translator:card:create-success',
    CREATE_FAILED: 'pdf-translator:card:create-failed'
  },

  // 设置事件
  ENGINE: {
    CHANGED: 'pdf-translator:engine:changed'
  },

  // 历史记录事件
  HISTORY: {
    ADDED: 'pdf-translator:history:added',
    CLEARED: 'pdf-translator:history:cleared'
  }
};
