import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";

function safeEmit(eventBus, eventName, payload, meta, logger, warnMessage) {
  try {
    eventBus.emitGlobal(eventName, payload, meta);
  } catch (e) {
    logger?.warn?.(warnMessage, e);
  }
}

export async function handleOutlineNavigateById({
  logger,
  eventBus,
  outlineManager,
  outlineItemId,
  metadata = {},
  listReady,
  setPendingNavigateId,
  navigateToOutlineItem
}) {
  if (!logger) { throw new Error("[OutlineNavigateById] logger is required"); }
  if (!eventBus) { throw new Error("[OutlineNavigateById] eventBus is required"); }
  if (!outlineManager) { throw new Error("[OutlineNavigateById] outlineManager is required"); }
  if (typeof setPendingNavigateId !== "function") { throw new Error("[OutlineNavigateById] setPendingNavigateId must be a function"); }
  if (typeof navigateToOutlineItem !== "function") { throw new Error("[OutlineNavigateById] navigateToOutlineItem must be a function"); }

  const sourceActorId = metadata?.actorId || "";
  const targetId = String(outlineItemId || "").trim();
  if (!targetId) {
    logger.warn("[Outline] 导航请求缺少ID", { receivedData: { outlineItemId } }, { toast: { type: "error", ms: 3000 } });
    return;
  }

  // 对外语义：按ID导航应当等价于“用户在大纲侧边栏中点击该项”
  safeEmit(
    eventBus,
    PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPEN_REQUESTED,
    { sidebarId: "outline" },
    { actorId: "OutlineManager" },
    logger,
    "[Outline] 无法发出大纲侧边栏打开请求（非致命）"
  );

  const item = outlineManager.getOutlineItem(targetId);
  if (!item) {
    if (!listReady) {
      setPendingNavigateId(targetId);
      logger.info(`[Outline] 记录挂起的按ID导航请求: ${targetId}`, { toast: { type: "info", ms: 2000 } });
    } else {
      logger.error(`[Outline] 大纲项不存在或未加载：${targetId}`, { toast: { type: "error", ms: 4500 } });
      safeEmit(
        eventBus,
        PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.FAILED,
        { error: "not_found", id: targetId },
        { actorId: "OutlineManager" },
        logger,
        "[Outline] emit OUTLINE.NAVIGATE.FAILED failed"
      );
    }
    return;
  }

  // 让侧边栏像“用户点击一样”高亮并滚动到该项（避免 OutlineSidebarUI 自己触发造成循环）
  if (sourceActorId !== "OutlineSidebarUI") {
    safeEmit(
      eventBus,
      PDF_VIEWER_EVENTS.OUTLINE.SELECT.CHANGED,
      { outlineItemId: item.id },
      { actorId: "OutlineManager" },
      logger,
      "[Outline] 发出 OUTLINE.SELECT.CHANGED 失败（非致命）"
    );
  }

  await navigateToOutlineItem(item);
  logger.info("[Outline] 导航完成", { outlineItemId: item.id }, { toast: { type: "success", ms: 2000 } });
}

export function tryOutlinePendingNavigate({
  logger,
  eventBus,
  outlineManager,
  listReady,
  pendingNavigateId,
  clearPendingNavigateId,
  navigateToOutlineItem
}) {
  if (!logger) { throw new Error("[OutlineNavigateById] logger is required"); }
  if (!eventBus) { throw new Error("[OutlineNavigateById] eventBus is required"); }
  if (!outlineManager) { throw new Error("[OutlineNavigateById] outlineManager is required"); }
  if (typeof clearPendingNavigateId !== "function") { throw new Error("[OutlineNavigateById] clearPendingNavigateId must be a function"); }
  if (typeof navigateToOutlineItem !== "function") { throw new Error("[OutlineNavigateById] navigateToOutlineItem must be a function"); }

  const id = String(pendingNavigateId || "").trim();
  if (!id) { return; }

  const item = outlineManager.getOutlineItem(id);
  if (!item) {
    if (listReady) {
      logger.error(`[Outline] 大纲项不存在或未加载：${id}`, { toast: { type: "error", ms: 4500 } });
      safeEmit(
        eventBus,
        PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.FAILED,
        { error: "not_found", id },
        { actorId: "OutlineManager" },
        logger,
        "[Outline] emit OUTLINE.NAVIGATE.FAILED failed"
      );
      clearPendingNavigateId();
    }
    return;
  }

  clearPendingNavigateId();
  logger.info(`[Outline] 处理挂起的按ID导航: ${id}`);
  navigateToOutlineItem(item);
}
