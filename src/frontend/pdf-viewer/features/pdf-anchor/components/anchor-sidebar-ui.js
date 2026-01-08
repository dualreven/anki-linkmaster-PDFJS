/* eslint no-empty: "off", no-unused-vars: "off" */
/**
 * 锚点侧边栏 UI
 * @file 渲染锚点工具栏与表格列表
 * @module features/pdf-anchor/components/anchor-sidebar-ui
 * 详细说明：`docs/standards/pdf-anchor-sidebar-ui.md`
 */

import { getLogger } from "../../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { notifyDomainError } from "../../../../common/utils/domain-error-notifier.js";
import { createSubscriptionBag } from "../../../../common/ws/ws-subscription-bag.js";
import { createSidebarRoot } from "../../../shared/sidebar-shell.js";

import { createAnchorSidebarToolbar } from "./anchor-sidebar-toolbar.js";
import { showAnchorDialog } from "./anchor-sidebar-dialog.js";
import { createAnchorSidebarTable } from "./anchor-sidebar-table.js";
import { AnchorManager } from "../services/anchor.manager.js";

export class AnchorSidebarUI {
  #eventBus;
  #anchorManager;
  #logger;
  #instanceId;
  #initialized = false;
  #sidebarContent; // 整个侧栏内容容器（工具栏 + 表格）
  #pdfId;
  #toolbar;
  #toolbarCleanup;
  #table;
  #emptyDiv;
  #loadingDiv;
  #errorDiv;
  #lastRequestPayload;
  #anchors = [];
  #activeId = null;
  #selectedId = null;
  #subscriptions;
  #useLegacyBridge = false;

  constructor(eventBus, anchorManager = null) {
    if (!eventBus) { throw new Error("[pdf-anchor] AnchorSidebarUI: eventBus is required"); }
    this.#eventBus = eventBus;
    this.#logger = getLogger("AnchorSidebarUI");
    this.#instanceId = `ancui-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36).slice(-4)}`;
    this.#subscriptions = createSubscriptionBag({ loggerName: "AnchorSidebarUI" });

    if (anchorManager) {
      this.#anchorManager = anchorManager;
    } else {
      // 兼容：UI-only 测试 / 冒烟用例可直接 new AnchorSidebarUI(eventBus)
      this.#anchorManager = new AnchorManager(getLogger("AnchorManager"));
      this.#useLegacyBridge = true;
    }
  }

  initialize() {
    if (this.#initialized) { this.#logger.info("AnchorSidebarUI.initialize called twice; ignored"); return; }
    this.#initialized = true;

    // 读取 pdf-id（用于 CREATE / LOAD 重试等命令 payload）
    try {
      const params = new URLSearchParams(window.location.search);
      this.#pdfId = params.get("pdf-id") || null;
    } catch (e) {
      this.#logger.warn("[AnchorSidebarUI] parse url params failed", e);
      this.#pdfId = null;
    }
    // 内容容器（使用共享 sidebar 壳子）
    this.#sidebarContent = createSidebarRoot();

    // 工具栏
    this.#toolbar = this.#createToolbar();
    this.#sidebarContent.appendChild(this.#toolbar);

    // 表格
    this.#table = createAnchorSidebarTable();
    this.#sidebarContent.appendChild(this.#table);

    // 初始渲染空态（失败不阻断 UI，但记录调试信息）
    try { this.#renderAnchors([]); } catch (e) { this.#logger.debug("[AnchorSidebarUI] initial render failed", e); }
    try {
      const off = this.#anchorManager.store.subscribe(
        (state) => { this.#renderFromStore(state); },
        { fireImmediately: true }
      );
      this.#subscriptions.add(off);
    } catch (e) {
      this.#logger.error("[AnchorSidebarUI] subscribe store failed", e);
      throw e;
    }

    if (this.#useLegacyBridge) {
      this.#setupLegacyBridge();
    }

    this.#logger.info("AnchorSidebarUI initialized");
  }

  getContentElement() { return this.#sidebarContent; }

  destroy() {
    this.#subscriptions?.clear();
    try { this.#toolbarCleanup?.(); } catch(_) {}
    this.#sidebarContent = null;
    this.#toolbar = null;
    this.#toolbarCleanup = null;
    this.#table = null;
    this.#anchors = [];
    this.#selectedId = null;
    this.#logger.info("AnchorSidebarUI destroyed");
  }

  #setupLegacyBridge() {
    // 兼容：只创建 UI 不安装 Feature 的场景（EventBus -> store）
    this.#subscriptions.add(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD,
      (payload) => {
        try { this.#anchorManager.markLoading(payload || {}); } catch (e) { this.#logger.warn("[AnchorSidebarUI] legacy markLoading failed", e); }
      },
      { subscriberId: `AnchorSidebarUI:${this.#instanceId}` }
    ));

    this.#subscriptions.add(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED,
      ({ anchors }) => {
        try { this.#anchorManager.applyLoadedAnchors(Array.isArray(anchors) ? anchors : []); } catch (e) { this.#logger.warn("[AnchorSidebarUI] legacy applyLoadedAnchors failed", e); }
      },
      { subscriberId: `AnchorSidebarUI:${this.#instanceId}` }
    ));

    this.#subscriptions.add(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD_FAILED,
      ({ error, type }) => {
        const msg = (error && (error.message || error.err || error.detail))
          ? (error.message || error.err || error.detail)
          : "无法加载锚点数据";
        try { this.#anchorManager.markLoadFailed({ message: String(msg), type: String(type || "anchor-load-failed") }); } catch (e) { this.#logger.warn("[AnchorSidebarUI] legacy markLoadFailed failed", e); }
      },
      { subscriberId: `AnchorSidebarUI:${this.#instanceId}` }
    ));

    this.#subscriptions.add(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.UPDATED,
      ({ anchorId, page_at, position }) => {
        try { this.#anchorManager.applyAnchorUpdate(anchorId, { page_at, position }); } catch (e) { this.#logger.warn("[AnchorSidebarUI] legacy applyAnchorUpdate failed", e); }
      },
      { subscriberId: `AnchorSidebarUI:${this.#instanceId}` }
    ));

    this.#subscriptions.add(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.ACTIVATED,
      ({ anchorId, active }) => {
        try { this.#anchorManager.setActive(anchorId, !!active); } catch (e) { this.#logger.warn("[AnchorSidebarUI] legacy setActive failed", e); }
      },
      { subscriberId: `AnchorSidebarUI:${this.#instanceId}` }
    ));
  }

  #renderFromStore(state) {
    const s = state && typeof state === "object" ? state : {};
    const anchors = Array.isArray(s.anchors) ? s.anchors : [];
    this.#activeId = s.activeId ? String(s.activeId) : null;
    this.#lastRequestPayload = (s.lastRequestPayload && typeof s.lastRequestPayload === "object") ? s.lastRequestPayload : null;

    if (s.isLoading) {
      this.#showLoading();
    } else {
      this.#hideLoading();
    }

    if (s.error && typeof s.error === "object") {
      const msg = s.error.message || "无法加载锚点数据";
      const type = s.error.type;
      const label = type ? `[${type}] ${msg}` : msg;
      this.#showError(label);
    } else {
      this.#clearError();
    }

    this.#renderAnchors(anchors);
  }

  #createToolbar() {
    const result = createAnchorSidebarToolbar({
      eventBus: this.#eventBus,
      logger: this.#logger,
      getSelectedId: () => this.#selectedId,
      getAnchors: () => this.#anchors,
      getPdfId: () => this.#pdfId,
      openCreateDialog: () => this.#openCreateDialog(),
      openEditDialog: () => this.#openEditDialog(),
      showError: (message) => this.#showError(message)
    });
    this.#toolbarCleanup = result.cleanup;
    return result.element;
  }

  #openCreateDialog() {
    const curr = (() => {
      try {
        const viewer = document.getElementById("viewerContainer");
        if (!viewer) { return { pageAt: 1, position: "" }; }
        const centerY = viewer.scrollTop + viewer.clientHeight / 2;
        const pages = Array.from(viewer.querySelectorAll(".page"));
        let best = { pageAt: 1, position: "", dist: Number.POSITIVE_INFINITY };
        for (const el of pages) {
          const pageNo = parseInt(el.getAttribute("data-page-number") || "1", 10) || 1;
          const top = el.offsetTop; const height = el.offsetHeight || 1; const bottom = top + height;
          if (centerY >= top && centerY <= bottom) {
            const rel = (centerY - top) / height;
            return { pageAt: pageNo, position: String(Math.round(rel * 100)) };
          }
          const dist = Math.min(Math.abs(centerY - top), Math.abs(centerY - bottom));
          if (dist < best.dist) { best = { pageAt: pageNo, position: centerY < top ? "0" : "100", dist }; }
        }
        return { pageAt: best.pageAt, position: best.position };
      } catch { return { pageAt: 1, position: "" }; }
    })();

    showAnchorDialog({
      title: "添加锚点",
      initial: { name: "", page_at: String(curr.pageAt), position: String(curr.position) },
      onConfirm: (vals) => {
        const makeAnchorId = () => {
          try {
            const hex = Array.from(crypto.getRandomValues(new Uint8Array(6)))
              .map(b => b.toString(16).padStart(2, "0"))
              .join("");
            return `pdfanchor-${hex}`;
          } catch(_) {
            // 按“禁止兜底”原则，此处若无法生成 uuid，直接提示并返回
            this.#showError("无法生成锚点ID，请重试或检查运行环境");
            return null;
          }
        };
        const name = String(vals.name || "").trim();
        if (!name) { return; }
        let page_at = parseInt(String(vals.page_at || "1").trim(), 10); if (!Number.isFinite(page_at) || page_at < 1) { page_at = 1; }
        const posStr = String(vals.position || "").trim();
        const uuid = makeAnchorId(); if (!uuid) { return; }
        const anchor = { uuid, name, page_at };
        if (posStr !== "") {
          let position = Number(posStr); if (!Number.isFinite(position)) { position = 0; }
          position = Math.max(0, Math.min(100, position));
          anchor.position = position;
        }
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.CREATE, { anchor, pdf_uuid: this.#pdfId }, { actorId: "AnchorToolbar" });
      }
    });
  }

  #openEditDialog() {
    if (!this.#selectedId) { return; }
    const a = this.#anchors.find(x => x && x.uuid === this.#selectedId) || {};
    const currName = a.name || "";
    const currPage = parseInt(a.page_at || 1, 10) || 1;
    const currPos = (() => {
      const p = a.position;
      if (typeof p !== "number") {return "";}
      return (p <= 1 ? String(Math.round(p * 100)) : String(Math.round(p)));
    })();

    showAnchorDialog({
      title: "修改锚点",
      initial: { name: currName, page_at: String(currPage), position: String(currPos) },
      onConfirm: (vals) => {
        const update = {};
        const name = String(vals.name || "").trim();
        if (name && name !== currName) { update.name = name; }
        let page_at = parseInt(String(vals.page_at || "").trim(), 10);
        if (Number.isFinite(page_at) && page_at >= 1 && page_at !== currPage) { update.page_at = page_at; }
        const posStr = String(vals.position || "").trim();
        if (posStr !== "") {
          let position = Number(posStr);
          if (Number.isFinite(position)) {
            position = Math.max(0, Math.min(100, position));
            // 只有变化时才写入
            const oldPct = (typeof a.position === "number" ? (a.position <= 1 ? Math.round(a.position * 100) : Math.round(a.position)) : null);
            if (oldPct === null || oldPct !== Math.round(position)) { update.position = position; }
          }
        }
        if (Object.keys(update).length === 0) { return; }
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.UPDATE, { anchorId: this.#selectedId, update }, { actorId: "AnchorToolbar" });
      }
    });
  }

  // dialog/table 已拆分到独立模块

  #showLoading() {
    try {
      if (!this.#table) {return;}
      if (!this.#loadingDiv) {
        this.#loadingDiv = document.createElement("div");
        this.#loadingDiv.className = "anchor-loading";
        this.#loadingDiv.textContent = "正在加载锚点…";
        this.#loadingDiv.style.cssText = "margin:10px;color:#666;";
      }
      // 插入到表格容器顶部（确保与空态/错误态同层级）
      this.#table.insertBefore(this.#loadingDiv, this.#table.firstChild);
    } catch(_) {}
  }

  #hideLoading() {
    if (this.#loadingDiv && this.#loadingDiv.parentNode) {
      try { this.#loadingDiv.parentNode.removeChild(this.#loadingDiv); } catch(_) {}
    }
  }

  #showError(message) {
    const text = String(message || "未知错误");
    try {
      if (!this.#table) {return;}
      if (!this.#errorDiv) {
        this.#errorDiv = document.createElement("div");
        this.#errorDiv.className = "anchor-error";
        this.#errorDiv.style.cssText = "margin:10px;color:#c00;background:#fff4f4;border:1px solid #f3c0c0;padding:8px;border-radius:4px;";
      } else {
        this.#errorDiv.innerHTML = "";
      }

      const msgSpan = document.createElement("span");
      msgSpan.textContent = `加载锚点失败：${text}`;
      const retryBtn = document.createElement("button");
      retryBtn.type = "button";
      retryBtn.textContent = "重试";
      retryBtn.style.cssText = "margin-left:8px;padding:2px 8px;";
      retryBtn.addEventListener("click", () => this.#retryLastRequest());

      this.#errorDiv.appendChild(msgSpan);
      this.#errorDiv.appendChild(retryBtn);

      this.#table.insertBefore(this.#errorDiv, this.#table.firstChild);
    } catch(_) {}

    notifyDomainError({
      message: `加载锚点失败：${text}`,
      logger: this.#logger,
      scope: PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD_FAILED
    });
  }

  #clearError() {
    if (this.#errorDiv && this.#errorDiv.parentNode) {
      try { this.#errorDiv.parentNode.removeChild(this.#errorDiv); } catch(_) {}
    }
  }

  #retryLastRequest() {
    try {
      const payload = this.#lastRequestPayload || {};
      // 优先复用最近一次请求；若无则从 URL 推断 pdf-id 发起列表请求
      let req = payload;
      if (!req || Object.keys(req).length === 0) {
        try {
          const params = new URLSearchParams(window.location.search);
          const pdfId = params.get("pdf-id");
          if (pdfId) { req = { pdf_uuid: pdfId }; }
        } catch(_) {}
      }
      // 清理错误并重新发起
      this.#clearError();
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD, req || {}, { actorId: "AnchorSidebarUI" });
    } catch(_) {}
  }

  #renderAnchors(anchors) {
    this.#anchors = anchors || [];
    const tbody = this.#sidebarContent?.querySelector("tbody[data-role=\"anchor-tbody\"]");
    if (!tbody) {return;}
    tbody.innerHTML = "";

    if (!Array.isArray(this.#anchors) || this.#anchors.length === 0) {
      if (!this.#emptyDiv) {
        this.#emptyDiv = document.createElement("div");
        this.#emptyDiv.className = "anchor-empty";
        this.#emptyDiv.textContent = "暂无锚点，点击“添加”创建";
        this.#emptyDiv.style.cssText = "margin:10px;color:#999;";
        // 在表格容器上方提示
        const wrap = this.#table;
        wrap.insertBefore(this.#emptyDiv, wrap.firstChild);
      }
      return;
    } else {
      // 移除空态
      if (this.#emptyDiv && this.#emptyDiv.parentNode) {
        try { this.#emptyDiv.parentNode.removeChild(this.#emptyDiv); } catch(_) {}
        this.#emptyDiv = null;
      }
    }

    this.#anchors.forEach(a => {
      const tr = document.createElement("tr");
      tr.dataset.anchorId = a.uuid;
      tr.style.cssText = "cursor:pointer;";
      tr.addEventListener("click", () => {
        this.#selectedId = a.uuid;
        this.#highlightSelection(a.uuid);
      });

      const tdName = document.createElement("td"); tdName.textContent = a.name || "(未命名)"; tdName.title = a?.uuid ? String(a.uuid) : ""; tdName.style.cssText = "padding:6px;border-bottom:1px solid #f2f2f2;";
      const tdPage = document.createElement("td"); tdPage.textContent = String(a.page_at || ""); tdPage.style.cssText = "padding:6px;border-bottom:1px solid #f2f2f2;";
      const tdPos = document.createElement("td");
      let posText = "";
      try {
        if (typeof a?.position === "number" && !Number.isNaN(a.position)) {
          let p = a.position;
          if (p <= 1) { p = p * 100; }
          posText = String(Math.round(p));
        }
      } catch(_) { posText = ""; }
      tdPos.textContent = posText;
      tdPos.style.cssText = "padding:6px;border-bottom:1px solid #f2f2f2;";

      const tdActive = document.createElement("td");
      // 会话内激活态：仅当 uuid === #activeId 时为 true
      const active = !!(this.#activeId && a && a.uuid && String(a.uuid) === String(this.#activeId));
      tdActive.textContent = active ? "是" : "否";
      tdActive.style.cssText = "padding:6px;border-bottom:1px solid #f2f2f2;";

      tr.appendChild(tdName);
      tr.appendChild(tdPage);
      tr.appendChild(tdPos);
      tr.appendChild(tdActive);
      tbody.appendChild(tr);
    });

    // 若当前会话有激活锚点，则优先选中激活项；否则保持“无选中”状态
    if (!this.#selectedId && this.#activeId) {
      this.#selectedId = String(this.#activeId);
    }
    if (this.#selectedId) {
      this.#highlightSelection(this.#selectedId);
    }
  }

  #highlightSelection(id) {
    const rows = this.#sidebarContent?.querySelectorAll("tbody[data-role=\"anchor-tbody\"] tr") || [];
    rows.forEach(r => {
      if (r.dataset.anchorId === id) {
        r.style.background = "#e3f2fd";
      } else {
        r.style.background = "";
      }
    });
  }
}

export default AnchorSidebarUI;
