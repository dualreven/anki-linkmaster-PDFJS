import { WEBSOCKET_MESSAGE_TYPES } from "../../../common/event/event-constants.js";
import { getCurrentPDFDocument } from "../../pdf/current-document-registry.js";
import { awaitOutlineDomainEvent, OUTLINE_DOMAIN_EVENTS } from "./outline-await-message.js";

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
  const waitList1 = awaitOutlineDomainEvent({
    eventBus,
    types: [OUTLINE_DOMAIN_EVENTS.LOAD_SUCCESS, OUTLINE_DOMAIN_EVENTS.LOAD_EMPTY, OUTLINE_DOMAIN_EVENTS.LOAD_FAILED],
    subscriberId: "OutlineFeature.await.init1"
  });
  await wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
  const list1 = await waitList1;

  if (list1?.eventName === OUTLINE_DOMAIN_EVENTS.LOAD_FAILED) {
    logger.warn("[Outline][init] outline-list failed", list1?.data?.error || list1?.data, { toast: { type: "error", ms: 3500 } });
    setListReady(true);
    return;
  }

  if (list1?.eventName === OUTLINE_DOMAIN_EVENTS.LOAD_EMPTY) {
    logger.info("[Outline][init] backend returned outline_items=null (no records). Will import from PDF.");
  } else if (list1?.eventName === OUTLINE_DOMAIN_EVENTS.LOAD_SUCCESS) {
    const items = Array.isArray(list1?.data?.outlineItems) ? list1.data.outlineItems : [];
    logger.info(`[Outline][init] backend returned outline array (count=${items.length}). Will render without import.`);
  } else {
    logger.warn("[Outline][init] unexpected outline_list payload; treating as empty");
  }

  if (list1?.eventName === OUTLINE_DOMAIN_EVENTS.LOAD_EMPTY) {
    const pdfDoc = pdfDocument || getCurrentPDFDocument?.();
    if (!pdfDoc) {
      logger.warn("[Outline][init] pdfDocument missing after FILE.LOAD.SUCCESS");
      setListReady(true);
      return;
    }
    logger.info("[Outline][init] extracting native outline via OutlineDataProvider.getOutline(...)");
    await importNativeOutlineIfEmpty(pdfDoc);

    logger.info("[Outline][init] re-requesting outline-list after bulk-save...");
    const waitList2 = awaitOutlineDomainEvent({
      eventBus,
      types: [OUTLINE_DOMAIN_EVENTS.LOAD_SUCCESS, OUTLINE_DOMAIN_EVENTS.LOAD_FAILED],
      subscriberId: "OutlineFeature.await.init2"
    });
    await wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
    const list2 = await waitList2;

    if (list2?.eventName === OUTLINE_DOMAIN_EVENTS.LOAD_SUCCESS) {
      const items2 = Array.isArray(list2?.data?.outlineItems) ? list2.data.outlineItems : [];
      logger.info(`[Outline][init] final outline-list returned count=${items2.length}`);
      setListReady(true);
      tryPendingNavigate();
      return;
    }
    logger.warn("[Outline][init] final outline-list failed; rendering empty");
    setListReady(true);
    return;
  }

  if (list1?.eventName === OUTLINE_DOMAIN_EVENTS.LOAD_SUCCESS) {
    setListReady(true);
    tryPendingNavigate();
    return;
  }

  setListReady(true);
}
