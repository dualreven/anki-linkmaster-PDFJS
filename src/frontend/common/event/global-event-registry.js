/**
 * 全局事件白名单注册表
 * - 收集 event-constants.js 中导出的所有事件字符串作为“允许的全局事件”
 * - 作用：限制前端不得随意创造新的“全局事件”（不含以 @ 开头的局部事件）
 */

import EVENT_CONSTANTS, {
  // 显式引入关键事件组，防止生产构建下被 Tree-Shaking 意外移除
  APP_EVENTS,
  SYSTEM_EVENTS,
  WEBSOCKET_EVENTS,
  UI_EVENTS,
  WEBSOCKET_MESSAGE_EVENTS,
  WEBSOCKET_MESSAGE_TYPES,
  PDF_MANAGEMENT_EVENTS,
  SEARCH_EVENTS,
  FILTER_EVENTS,
  SEARCH_RESULTS_EVENTS,
  SIDEBAR_EVENTS,
  PDF_EDITOR_EVENTS,
  HEADER_EVENTS,
  SORTER_EVENTS,
} from './event-constants.js';
// 引入 PDF-Viewer 事件常量，仅用于白名单收集（不新增事件名）
import { PDF_VIEWER_EVENTS } from './pdf-viewer-constants.js';
// 引入 PDF-Translator 事件常量，补充翻译功能域的全局事件白名单
// 注意：仅用于白名单收集，不产生运行时依赖耦合
// 备注：pdf-viewer 子仓库源码在某些环境下可能未同步到当前工作区，
// 为避免构建 pdf-home 时因找不到翻译模块事件常量而失败，暂不直接静态导入。
// 若运行环境包含 pdf-viewer 模块，其事件常量可通过该模块自身注册或后续构建阶段补齐白名单。

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
// 收集通用事件常量（整体 + 关键分组，双重保障）
collectStrings(EVENT_CONSTANTS, AllowedGlobalEvents);
collectStrings(APP_EVENTS, AllowedGlobalEvents);
collectStrings(SYSTEM_EVENTS, AllowedGlobalEvents);
collectStrings(WEBSOCKET_EVENTS, AllowedGlobalEvents);
collectStrings(UI_EVENTS, AllowedGlobalEvents);
collectStrings(WEBSOCKET_MESSAGE_EVENTS, AllowedGlobalEvents);
collectStrings(WEBSOCKET_MESSAGE_TYPES, AllowedGlobalEvents);
collectStrings(PDF_MANAGEMENT_EVENTS, AllowedGlobalEvents);
collectStrings(SEARCH_EVENTS, AllowedGlobalEvents);
collectStrings(FILTER_EVENTS, AllowedGlobalEvents);
collectStrings(SEARCH_RESULTS_EVENTS, AllowedGlobalEvents);
collectStrings(SIDEBAR_EVENTS, AllowedGlobalEvents);
collectStrings(PDF_EDITOR_EVENTS, AllowedGlobalEvents);
collectStrings(HEADER_EVENTS, AllowedGlobalEvents);
collectStrings(SORTER_EVENTS, AllowedGlobalEvents);
// 收集 PDF-Viewer 模块事件常量：仅放行已有事件名，避免“未注册的全局事件”阻塞合法事件
collectStrings(PDF_VIEWER_EVENTS, AllowedGlobalEvents);
// 收集 PDF-Translator 模块事件常量：确保 pdf-translator:* 事件被允许
// 如果需要在同一仓库下启用 pdf-translator 事件白名单，请在 pdf-viewer 模块内完成注册，
// 或在合并子仓库后恢复以下收集逻辑。

export function isGlobalEventAllowed(eventName) {
  // 仅针对“全局事件”进行白名单检查；局部事件以 @feature/ 开头不在此限制
  if (typeof eventName !== 'string') return false;
  if (eventName.startsWith('@')) return true;
  return AllowedGlobalEvents.has(eventName);
}

export { AllowedGlobalEvents };
