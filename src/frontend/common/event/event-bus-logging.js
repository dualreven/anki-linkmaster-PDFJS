import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_EVENTS } from "./event-constants.js";
import { PDF_VIEWER_EVENTS } from "./pdf-viewer-constants.js";

const SUPPRESSED_EVENT_LOGS = new Set([
  PDF_VIEWER_EVENTS.FILE.LOAD.PROGRESS,
  WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
]);

// 统一关闭发布/订阅的详细日志；为少数事件保留或采样输出
const VERBOSE_EVENT_LOGS_ENABLED = false; // 关闭订阅/发布通用日志

// 发布日志保留/采样名单：value 为采样率（0~1）
const PUBLISH_EVENT_KEEP_SAMPLING = new Map([
  [WEBSOCKET_MESSAGE_EVENTS.UNKNOWN, 1.0],
  [PDF_VIEWER_EVENTS.PAGE.CHANGING, 0.10],
]);

function shouldLogPublishEvent(event) {
  if (VERBOSE_EVENT_LOGS_ENABLED === true) {return true;}
  if (!PUBLISH_EVENT_KEEP_SAMPLING.has(event)) {return false;}
  const ratio = PUBLISH_EVENT_KEEP_SAMPLING.get(event);
  if (typeof ratio !== "number") {return false;}
  if (ratio >= 1) {return true;}
  if (ratio <= 0) {return false;}
  try { return Math.random() < ratio; } catch { return false; }
}

export {
  SUPPRESSED_EVENT_LOGS,
  VERBOSE_EVENT_LOGS_ENABLED,
  PUBLISH_EVENT_KEEP_SAMPLING,
  shouldLogPublishEvent,
};
