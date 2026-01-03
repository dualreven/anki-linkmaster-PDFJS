import { WEBSOCKET_MESSAGE_TYPES } from "../../../common/event/event-constants.js";

export function handleOutlineCreate({ logger, dialog, wsClient, getPdfId, getCurrentPage }) {
  if (!logger) { throw new Error("[OutlineCrud] logger is required"); }
  if (!dialog) { throw new Error("[OutlineCrud] dialog is required"); }
  if (typeof getPdfId !== "function") { throw new Error("[OutlineCrud] getPdfId must be a function"); }
  if (typeof getCurrentPage !== "function") { throw new Error("[OutlineCrud] getCurrentPage must be a function"); }

  const currentPage = getCurrentPage();
  dialog.showAdd({
    currentPage,
    onConfirm: async (data) => {
      const pdfId = getPdfId();
      const name = String(data?.name || "").trim();
      const pageAt = Number.isInteger(data?.pageAt) && data.pageAt > 0 ? data.pageAt : currentPage;
      const position = (typeof data?.position === "number" && Number.isFinite(data.position))
        ? Math.max(0, Math.min(100, Math.round(data.position)))
        : null;
      if (!wsClient || !pdfId || !name || !pageAt) {
        logger.warn("[Outline] create aborted: missing wsClient/pdfId/name/pageAt");
        return;
      }
      try {
        logger.info("[Outline] create → WS request", { pdf_uuid: pdfId, name, page_at: pageAt, position });
        await wsClient.request(
          WEBSOCKET_MESSAGE_TYPES.OUTLINE_CREATE,
          { pdf_uuid: pdfId, name, page_at: pageAt, position },
          { metadata: { version: "1.0.0" } }
        );
        await wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
      } catch (e) {
        logger.warn("[Outline] create ws request failed", e);
      }
    },
    onCancel: () => {}
  });
}

export function handleOutlineUpdate({ logger, dialog, wsClient, getPdfId, outlineManager, outlineItemId, directUpdate }) {
  if (!logger) { throw new Error("[OutlineCrud] logger is required"); }
  if (!dialog) { throw new Error("[OutlineCrud] dialog is required"); }
  if (typeof getPdfId !== "function") { throw new Error("[OutlineCrud] getPdfId must be a function"); }
  if (!outlineManager) { throw new Error("[OutlineCrud] outlineManager is required"); }

  const item = outlineManager.getOutlineItem(outlineItemId);
  if (!item) {
    logger.error(`[Outline] 更新失败：ID 未在当前列表中 ${outlineItemId}`, { toast: { type: "error", ms: 4500 } });
    return;
  }

  if (directUpdate && typeof directUpdate === "object") {
    (async () => {
      const pdfId = getPdfId();
      if (!wsClient || !pdfId) {
        logger.error("[Outline] update aborted: missing wsClient/pdfId", { toast: { type: "error", ms: 4000 } });
        return;
      }
      try {
        await wsClient.request(
          WEBSOCKET_MESSAGE_TYPES.OUTLINE_UPDATE,
          { outline_id: outlineItemId, update: directUpdate },
          { metadata: { version: "1.0.0" } }
        );
        await wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
      } catch (e) {
        logger.warn("[Outline] update ws request failed", e);
      }
    })();
    return;
  }

  dialog.showEdit({
    outlineItem: item,
    onConfirm: async (updates) => {
      const pdfId = getPdfId();
      if (!wsClient || !pdfId) {
        logger.error("[Outline] update aborted: missing wsClient/pdfId", { toast: { type: "error", ms: 4000 } });
        return;
      }
      const update = {};
      if (typeof updates?.name === "string") { update.name = updates.name.trim(); }
      if (Number.isInteger(updates?.pageAt) && updates.pageAt > 0) { update.page_at = updates.pageAt; }
      if (updates?.position === null || typeof updates?.position === "number") {
        update.position = (updates.position === null) ? null : Math.max(0, Math.min(100, Math.round(updates.position)));
      }
      try {
        logger.info("[Outline] update → WS request", { outline_id: outlineItemId, update });
        await wsClient.request(
          WEBSOCKET_MESSAGE_TYPES.OUTLINE_UPDATE,
          { outline_id: outlineItemId, update },
          { metadata: { version: "1.0.0" } }
        );
        await wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
      } catch (e) {
        logger.warn("[Outline] update ws request failed", e);
      }
    }
  });
}

export async function handleOutlineDelete({ logger, dialog, wsClient, getPdfId, outlineManager, outlineItemId, directCascade }) {
  if (!logger) { throw new Error("[OutlineCrud] logger is required"); }
  if (!dialog) { throw new Error("[OutlineCrud] dialog is required"); }
  if (typeof getPdfId !== "function") { throw new Error("[OutlineCrud] getPdfId must be a function"); }
  if (!outlineManager) { throw new Error("[OutlineCrud] outlineManager is required"); }

  const item = outlineManager.getOutlineItem(outlineItemId);
  const childCount = item?.children?.length || 0;

  if (typeof directCascade === "boolean") {
    const pdfId = getPdfId();
    if (!wsClient || !pdfId) { logger.warn("[Outline] delete aborted: missing wsClient/pdfId"); return; }
    try {
      await wsClient.request(
        WEBSOCKET_MESSAGE_TYPES.OUTLINE_DELETE,
        { outline_id: outlineItemId, cascade: directCascade },
        { metadata: { version: "1.0.0" } }
      );
      await wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
    } catch (e) {
      logger.warn("[Outline] delete ws request failed", e);
    }
    return;
  }

  dialog.showDelete({
    outlineItem: item,
    childCount,
    onConfirm: async (cascade) => {
      const pdfId = getPdfId();
      if (!wsClient || !pdfId) { logger.warn("[Outline] delete aborted: missing wsClient/pdfId"); return; }
      try {
        await wsClient.request(
          WEBSOCKET_MESSAGE_TYPES.OUTLINE_DELETE,
          { outline_id: outlineItemId, cascade: cascade !== false },
          { metadata: { version: "1.0.0" } }
        );
        await wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
      } catch (e) {
        logger.warn("[Outline] delete ws request failed", e);
      }
    }
  });
}

export async function handleOutlineReorder({ logger, wsClient, getPdfId, outlineItemId, newParentId, newIndex }) {
  if (!logger) { throw new Error("[OutlineCrud] logger is required"); }
  if (typeof getPdfId !== "function") { throw new Error("[OutlineCrud] getPdfId must be a function"); }

  const pdfId = getPdfId();
  if (!wsClient || !pdfId) { logger.warn("[Outline] reorder aborted: missing wsClient/pdfId"); return; }
  try {
    await wsClient.request(
      WEBSOCKET_MESSAGE_TYPES.OUTLINE_REORDER,
      { outline_id: outlineItemId, new_parent_id: newParentId || null, new_index: Number(newIndex) || 0 },
      { metadata: { version: "1.0.0" } }
    );
    await wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
  } catch (e) {
    logger.warn("[Outline] reorder ws request failed", e);
  }
}

