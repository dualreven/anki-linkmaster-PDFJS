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

export class AnchorSidebarUI {
  #eventBus;
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
  #loadTimeoutTimer;
  #lastRequestPayload;
  #anchors = [];
  #activeId = null; // 会话内激活的锚点ID（仅内存，不持久化）
  #selectedId = null;
  #subscriptions;

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("AnchorSidebarUI");
    this.#instanceId = `ancui-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36).slice(-4)}`;
    this.#subscriptions = createSubscriptionBag({ loggerName: "AnchorSidebarUI" });
  }

  initialize() {
    if (this.#initialized) { this.#logger.info("AnchorSidebarUI.initialize called twice; ignored"); return; }
    this.#initialized = true;
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

    // 事件订阅：加载请求（用于显示“加载中/超时”并记录最近一次请求参数）
    this.#subscriptions.add(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD,
      (payload) => {
        this.#lastRequestPayload = payload || {};
        this.#showLoading();
        this.#clearError();
        this.#startLoadTimeout();
      },
      { subscriberId: `AnchorSidebarUI:${this.#instanceId}` }
    ));

    // 事件订阅：数据加载（忽略后端 is_active，激活态仅由会话内事件驱动）
    this.#subscriptions.add(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED,
      ({ anchors }) => {
        this.#logger.info("Anchor data loaded", { count: anchors?.length || 0 });
        this.#hideLoading();
        this.#clearError();
        this.#clearLoadTimeout();
        const list = Array.isArray(anchors) ? anchors : [];
        // 标准化：仅保留字段，不信任 payload 中的 is_active
        this.#anchors = list.map((a) => ({
          uuid: a?.uuid ? String(a.uuid) : "",
          name: a?.name ?? "",
          page_at: a?.page_at,
          position: a?.position,
          // 冷启动时一律视为未激活；实际激活由 ANCHOR.ACTIVATED 事件决定
        })).filter((a) => a.uuid);
        this.#renderAnchors(this.#anchors);
      },
      { subscriberId: `AnchorSidebarUI:${this.#instanceId}` }
    ));

    // 事件订阅：数据加载失败（来自 WS 适配器桥接 anchor:get/list:failed）
    this.#subscriptions.add(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD_FAILED,
      ({ error, type }) => {
        this.#hideLoading();
        this.#clearLoadTimeout();
        const msg = (error && (error.message || error.err || error.detail)) ? (error.message || error.err || error.detail) : "无法加载锚点数据";
        // 显示时不使用硬编码事件字符串，优先展示来自消息的类型或通用提示
        const label = type || "anchor-load-failed";
        this.#showError(`[${label}] ${msg}`);
      },
      { subscriberId: `AnchorSidebarUI:${this.#instanceId}` }
    ));

    // 监听锚点更新与激活状态变更以刷新表格
    this.#subscriptions.add(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.UPDATED,
      ({ anchorId, page_at, position }) => {
        const idx = this.#anchors.findIndex(a => a.uuid === anchorId);
        if (idx >= 0) {
          this.#anchors[idx].page_at = page_at;
          if (typeof position === "number") { this.#anchors[idx].position = position; }
          this.#renderAnchors(this.#anchors);
        }
      },
      { subscriberId: `AnchorSidebarUI:${this.#instanceId}` }
    ));

    this.#subscriptions.add(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.ACTIVATED,
      ({ anchorId, active }) => {
        const id = String(anchorId || "").trim();
        if (!id) { return; }
        const nextActive = !!active;
        if (nextActive) {
          this.#activeId = id;
        } else if (this.#activeId === id) {
          this.#activeId = null;
        }
        // 可选：同步内存中的 is_active 字段，便于调试/其他消费者复用
        this.#anchors = (this.#anchors || []).map((a) => {
          if (!a || !a.uuid) { return a; }
          const copy = { ...a };
          copy.is_active = (nextActive && String(copy.uuid) === id);
          return copy;
        });
        this.#renderAnchors(this.#anchors);
      },
      { subscriberId: `AnchorSidebarUI:${this.#instanceId}` }
    ));

    // 打开侧栏后基于 URL 的 pdf-id 主动请求一次列表，防止第一次列表在侧栏订阅前已发出
    try {
      const params = new URLSearchParams(window.location.search);
      this.#pdfId = params.get("pdf-id") || null;
      if (this.#pdfId) {
        // [DIAGNOSTIC] 追踪 AnchorSidebarUI 初始化时的请求
        this.#logger.warn("[DIAGNOSTIC] AnchorSidebarUI emitting ANCHOR.DATA.LOAD", {
          source: "AnchorSidebarUI.initialize()",
          location: "anchor-sidebar-ui.js:121-129",
          pdfId: this.#pdfId,
          timestamp: Date.now()
        });

        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD,
          { pdf_uuid: this.#pdfId },
          { actorId: "AnchorSidebarUI" }
        );
      }
    } catch (e) { this.#logger.warn("request list on init failed", e); }

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
    if (this.#loadTimeoutTimer) { try { clearTimeout(this.#loadTimeoutTimer); } catch(_){} this.#loadTimeoutTimer = null; }
    this.#anchors = [];
    this.#selectedId = null;
    this.#logger.info("AnchorSidebarUI destroyed");
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
        // 本地即时刷新
        try {
          const idx = this.#anchors.findIndex(x => x && x.uuid === this.#selectedId);
          if (idx >= 0) {
            if (update.name) { this.#anchors[idx].name = update.name; }
            if (typeof update.page_at === "number") { this.#anchors[idx].page_at = update.page_at; }
            if (typeof update.position === "number") { this.#anchors[idx].position = (update.position > 1 ? (update.position / 100) : update.position); }
            this.#renderAnchors(this.#anchors);
          }
        } catch (_) {}
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

  #startLoadTimeout() {
    try { if (this.#loadTimeoutTimer) { clearTimeout(this.#loadTimeoutTimer); } } catch(_) {}
    const timeoutMs = 5000;
    this.#loadTimeoutTimer = setTimeout(() => {
      // 若超时且仍未加载成功，显示错误提示
      try {
        // 仅当尚未有数据渲染时提示（以 #anchors 是否为空粗略判断）
        if (!Array.isArray(this.#anchors) || this.#anchors.length === 0) {
          this.#showError("请求超时，未能从后端获取锚点数据");
        }
      } catch(_) {}
    }, timeoutMs);
  }

  #clearLoadTimeout() { if (this.#loadTimeoutTimer) { try { clearTimeout(this.#loadTimeoutTimer); } catch(_) {} this.#loadTimeoutTimer = null; } }

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
      this.#showLoading();
      this.#startLoadTimeout();
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
