import { WEBSOCKET_MESSAGE_TYPES } from "../../../common/event/event-constants.js";
import { getCurrentPDFDocument } from "../../pdf/current-document-registry.js";
import { awaitOutlineWsMessage } from "./outline-await-message.js";

export async function runOutlineInitialLoadFlowAfterFile({
  logger,
  eventBus,
  wsClient,
  getPdfId,
  outlineManager,
  setListReady,
  refreshList,
  tryPendingNavigate,
  importNativeOutlineIfEmpty,
  pdfDocument
}) {
  if (!logger) { throw new Error("[OutlineInitFlow] logger is required"); }
  if (!eventBus) { throw new Error("[OutlineInitFlow] eventBus is required"); }
  if (typeof getPdfId !== "function") { throw new Error("[OutlineInitFlow] getPdfId must be a function"); }
  if (!outlineManager) { throw new Error("[OutlineInitFlow] outlineManager is required"); }
  if (typeof setListReady !== "function") { throw new Error("[OutlineInitFlow] setListReady must be a function"); }
  if (typeof refreshList !== "function") { throw new Error("[OutlineInitFlow] refreshList must be a function"); }
  if (typeof tryPendingNavigate !== "function") { throw new Error("[OutlineInitFlow] tryPendingNavigate must be a function"); }
  if (typeof importNativeOutlineIfEmpty !== "function") { throw new Error("[OutlineInitFlow] importNativeOutlineIfEmpty must be a function"); }

  logger.info("[Outline][init] running initial outline flow (event-driven, no timeouts)");
  const pdfId = getPdfId();
  if (!pdfId) { logger.warn("[Outline][init] pdfId missing"); return; }
  if (!wsClient) { logger.warn("[Outline][init] wsClient missing"); return; }

  logger.info("[Outline][init] requesting outline-list from backend...", { pdf_uuid: pdfId });
  const waitList1 = awaitOutlineWsMessage({
    eventBus,
    types: [WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED, WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_FAILED],
    subscriberId: "OutlineFeature.await.init1"
  });
  await wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
  const list1 = await waitList1;

  if (list1?.type === WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_FAILED) {
    logger.warn("[Outline][init] outline-list failed", list1?.error || list1?.data, { toast: { type: "error", ms: 3500 } });
    setListReady(true);
    refreshList("backend");
    return;
  }

  const first = Array.isArray(list1?.data?.outline_items) ? list1.data.outline_items : list1?.data?.outline_items;
  if (first === null) {
    logger.info("[Outline][init] backend returned outline_items=null (no records). Will import from PDF.");
  } else if (Array.isArray(first)) {
    logger.info(`[Outline][init] backend returned outline array (count=${first.length}). Will render without import.`);
  } else {
    logger.warn("[Outline][init] unexpected outline_list payload; treating as empty");
  }

  if (first === null) {
    const pdfDoc = pdfDocument || getCurrentPDFDocument?.();
    if (!pdfDoc) {
      logger.warn("[Outline][init] pdfDocument missing after FILE.LOAD.SUCCESS");
      setListReady(true);
      refreshList("backend");
      return;
    }
    logger.info("[Outline][init] extracting native outline via OutlineDataProvider.getOutline(...)");
    await importNativeOutlineIfEmpty(pdfDoc);

    logger.info("[Outline][init] re-requesting outline-list after bulk-save...");
    const waitList2 = awaitOutlineWsMessage({
      eventBus,
      types: [WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED, WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_FAILED],
      subscriberId: "OutlineFeature.await.init2"
    });
    await wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
    const list2 = await waitList2;

    if (list2?.type === WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED) {
      const items2 = Array.isArray(list2?.data?.outline_items) ? list2.data.outline_items : [];
      logger.info(`[Outline][init] final outline-list returned count=${items2.length}`);
      await outlineManager.replaceFromRemote(items2);
      setListReady(true);
      refreshList("backend");
      tryPendingNavigate();
      return;
    }
    logger.warn("[Outline][init] final outline-list failed; rendering empty");
    setListReady(true);
    refreshList("backend");
    return;
  }

  if (Array.isArray(first)) {
    await outlineManager.replaceFromRemote(first.length > 0 ? first : []);
    setListReady(true);
    refreshList("backend");
    tryPendingNavigate();
    return;
  }

  setListReady(true);
  refreshList("backend");
}
