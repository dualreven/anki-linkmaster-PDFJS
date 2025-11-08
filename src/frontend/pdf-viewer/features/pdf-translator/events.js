// 统一改为从 pdf-viewer 全局事件常量中导出，避免本地字面量
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";

export const PDF_TRANSLATOR_EVENTS = PDF_VIEWER_EVENTS.TRANSLATOR;
export default PDF_TRANSLATOR_EVENTS;
