/**
 * 全局事件白名单注册表
 * - 收集 event-constants.js 中导出的所有事件字符串作为“允许的全局事件”
 * - 作用：限制前端不得随意创造新的“全局事件”（不含以 @ 开头的局部事件）
 */

import EVENT_CONSTANTS from './event-constants.js';
// 引入 PDF-Viewer 事件常量，仅用于白名单收集（不新增事件名）
import { PDF_VIEWER_EVENTS } from './pdf-viewer-constants.js';
// 引入 PDF-Translator 事件常量，补充翻译功能域的全局事件白名单
// 注意：仅用于白名单收集，不产生运行时依赖耦合
import { PDF_TRANSLATOR_EVENTS } from '../../pdf-viewer/features/pdf-translator/events.js';

function collectStrings(obj, out) {
  if (!obj) return;
  if (typeof obj === 'string') {
    out.add(obj);
    return;
  }
  if (Array.isArray(obj)) {
    for (const v of obj) collectStrings(v, out);
    return;
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) collectStrings(obj[k], out);
  }
}

const AllowedGlobalEvents = new Set();
// 收集通用事件常量
collectStrings(EVENT_CONSTANTS, AllowedGlobalEvents);
// 收集 PDF-Viewer 模块事件常量：仅放行已有事件名，避免“未注册的全局事件”阻塞合法事件
collectStrings(PDF_VIEWER_EVENTS, AllowedGlobalEvents);
// 收集 PDF-Translator 模块事件常量：确保 pdf-translator:* 事件被允许
collectStrings(PDF_TRANSLATOR_EVENTS, AllowedGlobalEvents);

export function isGlobalEventAllowed(eventName) {
  // 仅针对“全局事件”进行白名单检查；局部事件以 @feature/ 开头不在此限制
  if (typeof eventName !== 'string') return false;
  if (eventName.startsWith('@')) return true;
  return AllowedGlobalEvents.has(eventName);
}

export { AllowedGlobalEvents };
