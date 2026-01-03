/* global qt, QWebChannel */

import { showSuccess } from "../../../../common/utils/notification.js";
import { notifyDomainError } from "../../../../common/utils/domain-error-notifier.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";

export function createAnchorSidebarToolbar({
  eventBus,
  logger,
  getSelectedId,
  getAnchors,
  getPdfId,
  openCreateDialog,
  openEditDialog,
  showError
}) {
  if (!eventBus) {
    throw new Error("[AnchorSidebarUI] createAnchorSidebarToolbar: eventBus is required");
  }
  if (!logger) {
    throw new Error("[AnchorSidebarUI] createAnchorSidebarToolbar: logger is required");
  }
  if (typeof getSelectedId !== "function") {
    throw new Error("[AnchorSidebarUI] createAnchorSidebarToolbar: getSelectedId must be a function");
  }
  if (typeof getAnchors !== "function") {
    throw new Error("[AnchorSidebarUI] createAnchorSidebarToolbar: getAnchors must be a function");
  }
  if (typeof getPdfId !== "function") {
    throw new Error("[AnchorSidebarUI] createAnchorSidebarToolbar: getPdfId must be a function");
  }
  if (typeof openCreateDialog !== "function") {
    throw new Error("[AnchorSidebarUI] createAnchorSidebarToolbar: openCreateDialog must be a function");
  }
  if (typeof openEditDialog !== "function") {
    throw new Error("[AnchorSidebarUI] createAnchorSidebarToolbar: openEditDialog must be a function");
  }
  if (typeof showError !== "function") {
    throw new Error("[AnchorSidebarUI] createAnchorSidebarToolbar: showError must be a function");
  }

  const bar = document.createElement("div");
  bar.className = "anchor-toolbar";
  bar.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #ddd;background:#f5f5f5;";

  const mkBtn = (id, label, tooltip) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.action = id;
    btn.textContent = label;
    btn.title = tooltip || label;
    btn.style.cssText = "padding:4px 10px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;";
    return btn;
  };

  const addBtn = mkBtn("add", "➕", "添加锚点（名称/页码/位置）");
  addBtn.addEventListener("click", () => openCreateDialog());

  const delBtn = mkBtn("delete", "🗑️", "删除选中锚点");
  delBtn.addEventListener("click", () => {
    const selectedId = getSelectedId();
    if (!selectedId) {return;}
    logger.info("Anchor delete clicked", { id: selectedId });
    eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DELETE, { anchorId: selectedId }, { actorId: "AnchorToolbar" });
  });

  const editBtn = mkBtn("edit", "✏️", "修改选中锚点（名称/页码/位置）");
  editBtn.addEventListener("click", () => openEditDialog());

  const copyTextRobust = async (text, labelForToast) => {
    try {
      const ta = document.createElement("textarea");
      ta.value = String(text);
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.left = "-1000px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      try { ta.focus(); } catch (err) { logger.debug("[AnchorSidebarToolbar] focus failed", err); }
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) {
        try { showSuccess(`已复制${labelForToast ? `(${labelForToast})` : ""}`, 2000); } catch (err) { void err; }
        return true;
      }
    } catch (err) { void err; }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(String(text));
        try { showSuccess(`已复制${labelForToast ? `(${labelForToast})` : ""}`, 2000); } catch (err) { void err; }
        return true;
      }
    } catch (err) { void err; }

    try {
      const ok = await new Promise((resolve) => {
        try {
          if (typeof qt === "undefined" || !qt.webChannelTransport) { resolve(false); return; }
          if (typeof QWebChannel === "undefined") { resolve(false); return; }
          new QWebChannel(qt.webChannelTransport, (channel) => {
            try {
              const bridge = channel?.objects?.pdfViewerBridge;
              if (bridge && typeof bridge.setClipboardText === "function") {
                Promise.resolve(bridge.setClipboardText(String(text)))
                  .then((res) => resolve(!!res))
                  .catch(() => resolve(false));
              } else {
                resolve(false);
              }
            } catch { resolve(false); }
          });
        } catch { resolve(false); }
      });
      if (ok) {
        try { showSuccess(`已复制${labelForToast ? `(${labelForToast})` : ""}`, 2000); } catch (err) { void err; }
        return true;
      }
    } catch (err) { void err; }

    notifyDomainError({
      message: "复制失败，请手动选择并复制",
      logger,
      scope: PDF_VIEWER_EVENTS.ANCHOR.COPY
    });
    return false;
  };

  const copyWrap = document.createElement("div");
  copyWrap.style.cssText = "position:relative; display:inline-block;";
  const copyBtn = mkBtn("copy", "📋", "复制/拷贝选项");
  const menu = document.createElement("div");
  menu.style.cssText = [
    "display:none", "position:absolute", "top:100%", "left:0",
    "background:#fff", "border:1px solid #ddd", "border-radius:4px",
    "box-shadow:0 2px 8px rgba(0,0,0,0.15)", "min-width:140px", "z-index:1000"
  ].join(";");

  const mkMenuItem = (text, title, onClick) => {
    const item = document.createElement("div");
    item.textContent = text;
    item.title = title;
    item.style.cssText = "padding:6px 10px; cursor:pointer; white-space:nowrap;";
    item.addEventListener("mouseenter", () => { item.style.background = "#f6f6f6"; });
    item.addEventListener("mouseleave", () => { item.style.background = ""; });
    item.addEventListener("click", () => { menu.style.display = "none"; onClick && onClick(); });
    return item;
  };

  const toggleMenu = () => { menu.style.display = (menu.style.display === "none" ? "block" : "none"); };
  const hideMenu = () => { menu.style.display = "none"; };

  menu.appendChild(mkMenuItem("拷贝副本", "基于当前锚点创建副本", () => {
    const selectedId = getSelectedId();
    if (!selectedId) {return;}
    const src = getAnchors().find((a) => a && a.uuid === selectedId);
    if (!src) {return;}
    const name = (src.name ? `${src.name}(副本)` : `${src.uuid}(副本)`);
    const newAnchor = {
      uuid: (() => {
        try {
          const hex = Array.from(crypto.getRandomValues(new Uint8Array(6))).map((b) => b.toString(16).padStart(2, "0")).join("");
          return `pdfanchor-${hex}`;
        } catch { return null; }
      })(),
      name,
      page_at: parseInt(src.page_at || 1, 10),
      position: (typeof src.position === "number" ? (src.position > 1 ? (src.position / 100) : src.position) : 0)
    };
    logger.info("Anchor clone requested", { from: selectedId, newAnchor });
    if (!newAnchor.uuid) { try { showError("无法生成锚点ID，克隆失败"); } catch (err) { void err; } return; }
    eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.CREATE, { anchor: newAnchor, pdf_uuid: getPdfId() }, { actorId: "AnchorToolbar" });
  }));

  menu.appendChild(mkMenuItem("复制锚点ID", "复制选中锚点ID", async () => {
    const selectedId = getSelectedId();
    if (!selectedId) {return;}
    await copyTextRobust(selectedId, "锚点ID");
    eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.COPY, { anchorId: selectedId }, { actorId: "AnchorToolbar" });
    eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.COPIED, { anchorId: selectedId }, { actorId: "AnchorToolbar" });
  }));

  menu.appendChild(mkMenuItem("复制文内链接", "复制 [[锚点id]]", async () => {
    const selectedId = getSelectedId();
    if (!selectedId) {return;}
    const link = `[[${selectedId}]]`;
    await copyTextRobust(link, "文内链接");
    eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.COPY, { anchorId: selectedId, wiki: true }, { actorId: "AnchorToolbar" });
    eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.COPIED, { anchorId: selectedId, wiki: true }, { actorId: "AnchorToolbar" });
  }));

  copyBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleMenu(); });
  document.addEventListener("click", hideMenu);
  copyWrap.appendChild(copyBtn);
  copyWrap.appendChild(menu);

  bar.appendChild(addBtn);
  bar.appendChild(delBtn);
  bar.appendChild(editBtn);
  bar.appendChild(copyWrap);

  const activateBtn = mkBtn("activate", "✅", "跳转并激活选中锚点");
  activateBtn.addEventListener("click", () => {
    const selectedId = getSelectedId();
    if (!selectedId) { return; }
    logger.info("Anchor navigate+activate requested from toolbar", { id: selectedId });
    eventBus.emit(
      PDF_VIEWER_EVENTS.ANCHOR.NAVIGATE.REQUESTED,
      { anchorId: selectedId, source: "ui-anchor-toolbar" },
      { actorId: "AnchorToolbar" }
    );
  });
  bar.appendChild(activateBtn);

  const deactivateBtn = mkBtn("deactivate", "🚫", "取消选中锚点的激活状态");
  deactivateBtn.addEventListener("click", () => {
    const selectedId = getSelectedId();
    if (!selectedId) { return; }
    logger.info("Anchor deactivate requested from toolbar", { id: selectedId });
    eventBus.emit(
      PDF_VIEWER_EVENTS.ANCHOR.ACTIVATE,
      { anchorId: selectedId, active: false },
      { actorId: "AnchorToolbar" }
    );
  });
  bar.appendChild(deactivateBtn);

  const cleanup = () => {
    try { document.removeEventListener("click", hideMenu); }
    catch (err) { logger.debug("[AnchorSidebarToolbar] remove document click listener failed", err); }
  };

  return { element: bar, cleanup };
}
