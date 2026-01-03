import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_MESSAGE_EVENTS } from "../../../common/event/event-constants.js";
import { showError, showSuccess } from "../../../common/utils/notification.js";
import { formatHHMM, makePdfAnchorId } from "./anchor-utils.js";

export function setupAnchorEventListeners({
  logger,
  eventBus,
  getAnchorsById,
  setAnchorsById,
  getActiveAnchorId,
  setActiveAnchorId,
  getPendingAnchorIdForNavigate,
  setPendingAnchorIdForNavigate,
  getLastNav,
  setLastNav,
  setLastUpdateAt,
  getSnapshotForQuickCreate,
  navigateToAnchor,
  emitList,
}) {
  eventBus.on(
    PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED,
    ({ anchors }) => {
      const nextMap = new Map();
      const activeId = getActiveAnchorId() ? String(getActiveAnchorId()) : null;

      const pushAnchor = (raw) => {
        if (!raw || !raw.uuid) { return; }
        const id = String(raw.uuid);
        nextMap.set(id, {
          uuid: id,
          name: raw.name,
          page_at: raw.page_at,
          position: raw.position,
          is_active: !!(activeId && id === activeId),
        });
      };

      if (Array.isArray(anchors)) {
        anchors.forEach(pushAnchor);
      } else if (anchors && anchors.uuid) {
        pushAnchor(anchors);
      }

      setAnchorsById(nextMap);

      const pendingId = getPendingAnchorIdForNavigate();
      if (pendingId) {
        const a = getAnchorsById().get(pendingId);
        if (a) {
          try { showSuccess(`已识别锚点: ${a.name || a.uuid}`); } catch (e) { logger.debug("[pdf-anchor] showSuccess failed (pending navigate)", e); }
          navigateToAnchor(pendingId);
        }
        setPendingAnchorIdForNavigate(null);
      }
    },
    { subscriberId: "PDFAnchorFeature" }
  );

  eventBus.on(
    PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
    () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const pdfId = params.get("pdf-id");
        if (pdfId) {
          logger.warn("[DIAGNOSTIC] PDFAnchorFeature emitting ANCHOR.DATA.LOAD", {
            source: "FILE.LOAD.SUCCESS handler",
            location: "pdf-anchor/index.js (event listeners)",
            pdfId,
            timestamp: Date.now(),
          });
          eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD, { pdf_uuid: pdfId }, { actorId: "PDFAnchorFeature" });
        }
      } catch (e) {
        logger.warn("[pdf-anchor] FILE.LOAD.SUCCESS handler failed before emitting ANCHOR.DATA.LOAD", e);
      }
    },
    { subscriberId: "PDFAnchorFeature" }
  );

  eventBus.on(
    PDF_VIEWER_EVENTS.RENDER.READY,
    (info) => {
      try { showSuccess(`PDF渲染完成：总页数 ${info?.totalPages ?? ""}`); } catch (e) { logger.debug("[pdf-anchor] showSuccess failed (render ready)", e); }
    },
    { subscriberId: "PDFAnchorFeature" }
  );

  eventBus.on(
    PDF_VIEWER_EVENTS.ANCHOR.NAVIGATE.REQUESTED,
    (data) => {
      try {
        const anchorId = String(data?.anchorId || "").trim();
        if (!anchorId) { return; }
        const a = getAnchorsById().get(anchorId);
        if (a) {
          navigateToAnchor(anchorId);
          return;
        }
        setPendingAnchorIdForNavigate(anchorId);
        eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD, { anchorId }, { actorId: "PDFAnchorFeature" });
      } catch (e) {
        try { showError("锚点导航失败"); } catch (e2) { logger.debug("[pdf-anchor] showError toast failed (navigate)", e2); }
        logger.warn("anchor navigate failed", e);
      }
    },
    { subscriberId: "PDFAnchorFeature" }
  );

  eventBus.on(
    PDF_VIEWER_EVENTS.ANCHOR.CREATE,
    (data) => {
      try {
        if (data && typeof data === "object" && data.anchor && !data.__fromFeature) {
          const incoming = data.anchor || {};
          const pageAt = parseInt(incoming.page_at || 1, 10) || 1;
          let pos = incoming.position;
          if (typeof pos === "number") {
            pos = pos > 1 ? (pos / 100) : pos;
          } else {
            pos = null;
          }

          if (typeof incoming.uuid !== "string" || !/^pdfanchor-[a-f0-9]{12}$/i.test(incoming.uuid)) {
            try { showError("创建锚点失败：缺少或非法的 uuid"); } catch (e) { void e; /* logger-guard */ }
            logger.warn("[anchor] create blocked - invalid/missing uuid (UI path)", { incoming });
            return;
          }

          const id = incoming.uuid;
          const name = (incoming.name && String(incoming.name).trim())
            ? String(incoming.name).trim()
            : `第${pageAt}页 - ${formatHHMM(new Date())}`;

          const anchor = { uuid: id, name, page_at: pageAt, position: pos, is_active: false };
          getAnchorsById().set(id, anchor);
          logger.info("[anchor] create(UI) accepted", { id, pageAt, position: pos, name });
          try { showSuccess(`已创建锚点: ${name}`); } catch (e) { void e; /* logger-guard */ }
          emitList();
          return;
        }

        const snapshot = getSnapshotForQuickCreate();
        const pageAt = snapshot.pageAt;
        const position = snapshot.position;
        const id = makePdfAnchorId();
        const name = `第${pageAt}页 - ${formatHHMM(new Date())}`;
        const anchor = { uuid: id, name, page_at: pageAt, position: position / 100, is_active: false };
        getAnchorsById().set(id, anchor);
        logger.info("[anchor] create(quick) accepted", { id, pageAt, position });
        try { showSuccess(`已创建锚点: ${name}`); } catch (e) { void e; /* logger-guard */ }
        emitList();

        let pdfId = null;
        try {
          const params = new URLSearchParams(window.location.search);
          pdfId = params.get("pdf-id");
        } catch (e) {
          logger.debug("[pdf-anchor] gate polling setup failed", e);
        }
        eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.CREATE, { anchor, pdf_uuid: pdfId, __fromFeature: true }, { actorId: "PDFAnchorFeature" });
      } catch (e) {
        logger.warn("handle ANCHOR.CREATE failed", e);
        try { showError("创建锚点失败"); } catch (e2) { void e2; /* logger-guard */ }
      }
    },
    { subscriberId: "PDFAnchorFeature" }
  );

  eventBus.on(
    PDF_VIEWER_EVENTS.ANCHOR.DELETE,
    ({ anchorId }) => {
      const id = String(anchorId || "").trim();
      if (!id) { return; }
      const existed = getAnchorsById().get(id);
      getAnchorsById().delete(id);
      try {
        if (existed) {
          showSuccess(`已删除锚点: ${existed.name || id}`);
        }
      } catch (e) {
        logger.warn("[pdf-anchor] showSuccess failed on delete", e);
      }
      emitList();
    },
    { subscriberId: "PDFAnchorFeature" }
  );

  eventBus.on(
    PDF_VIEWER_EVENTS.ANCHOR.UPDATE,
    ({ anchorId, update }) => {
      const id = String(anchorId || "").trim();
      if (!id) { return; }
      const a = getAnchorsById().get(id);
      if (!a) { return; }
      let changed = false;
      if (update && typeof update.name === "string") {
        a.name = update.name.trim() || a.name;
        changed = true;
      }
      if (typeof update?.page_at === "number") { a.page_at = update.page_at; changed = true; }
      if (typeof update?.position === "number") { a.position = update.position / 100; changed = true; }
      if (changed) {
        getAnchorsById().set(id, a);
        eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.UPDATED, { anchorId: id, page_at: a.page_at, position: Math.round((a.position || 0) * 100) }, { actorId: "PDFAnchorFeature" });
        emitList();
      }
    },
    { subscriberId: "PDFAnchorFeature" }
  );

  eventBus.on(
    PDF_VIEWER_EVENTS.ANCHOR.ACTIVATE,
    ({ anchorId, active = true }) => {
      const id = String(anchorId || "").trim();
      if (!id) { return; }
      const nextActive = !!active;

      const a = getAnchorsById().get(id) || { uuid: id };
      a.is_active = nextActive;
      getAnchorsById().set(id, a);

      if (nextActive) {
        for (const [aid, item] of getAnchorsById().entries()) {
          if (aid !== id && item && item.is_active) {
            item.is_active = false;
            getAnchorsById().set(aid, item);
          }
        }
      }

      eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.ACTIVATED, { anchorId: id, active: a.is_active }, { actorId: "PDFAnchorFeature" });
      emitList();

      try {
        showSuccess(nextActive ? `已激活锚点: ${a.name || id}` : `已停用锚点: ${a.name || id}`);
      } catch (e) {
        logger.warn("[pdf-anchor] showSuccess failed on activate", e);
      }

      if (nextActive) {
        setActiveAnchorId(id);
        setLastUpdateAt(null);
      } else if (getActiveAnchorId() === id) {
        setActiveAnchorId(null);
      }
    },
    { subscriberId: "PDFAnchorFeature" }
  );

  eventBus.on(
    PDF_VIEWER_EVENTS.NAVIGATION.CHANGED,
    (data) => {
      try {
        const lastNav = getLastNav();
        if (!lastNav) { return; }
        if (lastNav.method !== "direct") { return; }
        const pg = parseInt(data?.pageNumber || 0, 10);
        if (!pg) { return; }
        if (pg === lastNav.pageAt) {
          const dt = Date.now() - (lastNav.t0 || Date.now());
          showSuccess(`跳转到达: 第${pg}页（~${dt}ms）`);
          setLastNav(null);
        }
      } catch (e) { void e; /* logger-guard */ }
    },
    { subscriberId: "PDFAnchorFeature" }
  );

  eventBus.on(
    PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.SUCCESS,
    (info) => {
      try {
        const pg = parseInt(info?.pageAt || 0, 10);
        const pos = (typeof info?.position === "number") ? `${info.position}%` : "(未提供)";
        const dur = parseInt(info?.duration || 0, 10);
        showSuccess(`跳转到达: 第${pg}页 ${pos}（${dur}ms）`);
        setLastNav(null);
      } catch (e) { void e; /* logger-guard */ }
    },
    { subscriberId: "PDFAnchorFeature" }
  );
  eventBus.on(
    PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.FAILED,
    (err) => {
      try { showError(`[跳转失败] ${err?.message || "未知错误"}`); } catch (e) { void e; /* logger-guard */ }
    },
    { subscriberId: "PDFAnchorFeature" }
  );

  eventBus.on(
    WEBSOCKET_MESSAGE_EVENTS.ERROR,
    (err) => {
      try {
        const t = String(err?.received_type || err?.type || "");
        if (t.startsWith("anchor:")) {
          const msg = err?.error?.message || err?.message || "锚点相关操作失败";
          showError(`[锚点错误] ${msg}`);
        }
      } catch (e) { void e; /* logger-guard */ }
    },
    { subscriberId: "PDFAnchorFeature" }
  );
}
