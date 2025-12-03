/**
 * PDF Anchor Feature
 * @module PDFAnchorFeature
 * @description 负责锚点的复制、激活与运行时位置追踪；支持通过内部导航事件进行受控跳转与提示（不再从 URL 参数触发导航）
 */

import { getLogger } from "../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { showSuccess, showError, showInfo } from "../../../common/utils/notification.js";
import { WEBSOCKET_MESSAGE_EVENTS } from "../../../common/event/event-constants.js";
import { PositionTracker } from "../../shared/position-tracker.js";
import { getCurrentPageAndPosition } from "../../../common/utils/pdf-page-detection-utils.js";

export class PDFAnchorFeature {
  #logger = getLogger("PDFAnchorFeature");
  #eventBus = null;
  #container = null;
  #navigationService = null;
  #anchorsById = new Map(); // uuid -> anchor {uuid,name,page_at,position,is_active}
  #activeAnchorId = null;
  #pendingAnchorIdForNavigate = null; // 等待锚点数据加载后再触发导航的锚点ID
  #lastNav = null; // 最近一次导航请求 { pageAt, position, anchorId, t0, method }

  /** @type {PositionTracker|null} */
  #positionTracker = null;
  /** @type {Object|null} */
  #domEventHub = null;
  /** @type {number|null} */
  #lastUpdateAt = null; // 最近一次位置写回时间戳（ms）

  get name() { return "pdf-anchor"; }
  get version() { return "1.0.0"; }
  get dependencies() {
    // 显式依赖 infra-nav-core（提供 navigationService），并保留对容器服务名的声明以通过缺失检查
    return ["infra-nav-core", "navigationService"];
  }

  async install(context) {
    this.#container = context.container || context;
    this.#eventBus = context.globalEventBus || this.#container.get("eventBus");
    if (!this.#eventBus) {throw new Error("[pdf-anchor] eventBus not found");}

    // navigationService from DI
    this.#navigationService = this.#container.get("navigationService");
    if (!this.#navigationService) {this.#logger.warn("navigationService not found, will fallback to DOM ops");}

    // 注册 Anchor 侧边栏 UI 到容器（供 SidebarManager 获取）
    try {
      const { AnchorSidebarUI } = await import("./components/anchor-sidebar-ui.js");
      const anchorUI = new AnchorSidebarUI(this.#eventBus);
      anchorUI.initialize();
      this.#container.registerGlobal?.("anchorSidebarUI", anchorUI);
      this.#logger.info("anchorSidebarUI registered globally");
    } catch (e) {
      this.#logger.warn("Failed to initialize/register anchorSidebarUI", e);
    }

    this.#setupEventListeners();
    this.#setupPositionTracker();
    this.#logger.info("PDFAnchorFeature installed");
  }

  async uninstall() {
    if (this.#positionTracker) {
      try {
        this.#positionTracker.deactivate();
      } catch (e) {
        this.#logger.warn("[pdf-anchor] position tracker deactivate failed during uninstall", e);
      }
      this.#positionTracker = null;
    }
    this.#anchorsById.clear();
    this.#activeAnchorId = null;
    this.#eventBus = null;
    this.#container = null;
    this.#navigationService = null;
    this.#domEventHub = null;
    this.#lastUpdateAt = null;
  }

  #setupEventListeners() {
    const safeOn = (evt, handler, opts) => {
      if (typeof evt === "string" && evt.length > 0) {
        return this.#eventBus.on(evt, handler, opts);
      } else {
        try { this.#logger.warn("[PDFAnchorFeature] 跳过订阅：事件未定义或非字符串", { evt, subscriberId: opts?.subscriberId }); } catch (e) { void e; /* logger-guard */ }
        return () => { /* no-op */ };
      }
    };

    // 收到锚点数据（数组或单条）
    safeOn(
      PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED,
      ({ anchors }) => {
        // 统一标准化列表：忽略后端传入的 is_active，
        // 会话内的激活状态仅由 #activeAnchorId 决定。
        const nextMap = new Map();
        const activeId = this.#activeAnchorId ? String(this.#activeAnchorId) : null;

        const pushAnchor = (raw) => {
          if (!raw || !raw.uuid) { return; }
          const id = String(raw.uuid);
          const normalized = {
            uuid: id,
            name: raw.name,
            page_at: raw.page_at,
            position: raw.position,
            // 会话内激活状态：仅由 activeId 决定
            is_active: !!(activeId && id === activeId)
          };
          nextMap.set(id, normalized);
        };

        if (Array.isArray(anchors)) {
          anchors.forEach(pushAnchor);
        } else if (anchors && anchors.uuid) {
          pushAnchor(anchors);
        }

        // 用标准化后的 Map 覆盖本地缓存
        this.#anchorsById = nextMap;

        // 当存在挂起的“按锚点导航”请求时：在锚点数据就绪后直接执行一次导航
        if (this.#pendingAnchorIdForNavigate) {
          const pendingId = this.#pendingAnchorIdForNavigate;
          const a = this.#anchorsById.get(pendingId);
          if (a) {
            try { showSuccess(`已识别锚点: ${a.name || a.uuid}`); } catch (e) { this.#logger.debug("[pdf-anchor] showSuccess failed (pending navigate)", e); }
            this.#navigateToAnchor(pendingId);
          }
          // 仅处理一次
          this.#pendingAnchorIdForNavigate = null;
        }
      },
      { subscriberId: "PDFAnchorFeature" }
    );

    // 复制动作在 UI 层处理（AnchorSidebarUI.copyTextRobust），此处不再重复处理

    // 在文件加载成功后，请求该PDF的锚点列表（确保重新打开能显示持久化数据）
    safeOn(
      PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
      () => {
        try {
          const params = new URLSearchParams(window.location.search);
          const pdfId = params.get("pdf-id");
          if (pdfId) {
            // [DIAGNOSTIC] 追踪 FILE.LOAD.SUCCESS 触发的请求
            this.#logger.warn("[DIAGNOSTIC] PDFAnchorFeature emitting ANCHOR.DATA.LOAD", {
              source: "FILE.LOAD.SUCCESS handler",
              location: "pdf-anchor/index.js:189-197",
              pdfId,
              timestamp: Date.now()
            });

            this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD, { pdf_uuid: pdfId }, { actorId: "PDFAnchorFeature" });
          }
        } catch (e) {
          this.#logger.warn("[pdf-anchor] FILE.LOAD.SUCCESS handler failed before emitting ANCHOR.DATA.LOAD", e);
        }
      },
      { subscriberId: "PDFAnchorFeature" }
    );

    // PDF 渲染就绪（首页渲染完成，DOM可用）
    const EVT_RENDER_READY = PDF_VIEWER_EVENTS?.RENDER?.READY;
    safeOn(
      EVT_RENDER_READY,
      (info) => {
        try { showSuccess(`PDF渲染完成：总页数 ${info?.totalPages ?? ""}`); } catch (e) { this.#logger.debug("[pdf-anchor] showSuccess failed (render ready)", e); }
      },
      { subscriberId: "PDFAnchorFeature" }
    );

    // 统一处理：来自 UI/WS 的 anchor 导航请求 → 若锚点已在本地缓存，则直接触发导航；否则先请求数据，待 ANCHOR.DATA.LOADED 后再导航
    safeOn(
      PDF_VIEWER_EVENTS.ANCHOR.NAVIGATE.REQUESTED,
      (data) => {
        try {
          const anchorId = (data?.anchorId || "").toString().trim();
          if (!anchorId) {return;}
          const a = this.#anchorsById.get(anchorId);
          if (a) {
            // 锚点已在本地：直接执行一次导航
            this.#navigateToAnchor(anchorId);
            return;
          }
          // 未加载：记录挂起锚点ID并请求加载，待数据到达后再导航
          this.#pendingAnchorIdForNavigate = anchorId;
          this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD, { anchorId }, { actorId: "PDFAnchorFeature" });
        } catch (e) {
          try { showError("锚点导航失败"); } catch (e2) { this.#logger.debug("[pdf-anchor] showError toast failed (navigate)", e2); }
          this.#logger.warn("anchor navigate failed", e);
        }
      },
      { subscriberId: "PDFAnchorFeature" }
    );

    // 兜底 WS 监听已移除：WebSocketAdapter 会稳定发出 ANCHOR.DATA.LOADED，避免二次转发造成重复处理

    // 创建锚点（兼容两种触发方式：
    // 1）UI 发出 { anchor: { uuid,name,page_at,position? } }（必须带 uuid；缺失直接报错，不做兜底）；
    // 2）无负载：由本特性采样当前位置生成新锚点（仅此路径允许生成 uuid），并以 __fromFeature:true 转发到 WS 持久化。）
    safeOn(
      PDF_VIEWER_EVENTS.ANCHOR.CREATE,
      (data) => {
        try {
          // 情况A：UI 已提供 anchor 负载（首选路径）
          if (data && typeof data === "object" && data.anchor && !data.__fromFeature) {
            const incoming = data.anchor || {};
            // 规范化字段
            const pageAt = parseInt(incoming.page_at || 1, 10) || 1;
            let pos = incoming.position;
            if (typeof pos === "number") {
              pos = pos > 1 ? (pos / 100) : pos; // 存储使用 0..1
            } else {
              pos = null;
            }
            // 严格要求：必须携带合法 uuid；缺失/非法直接报错，不做兜底
            if (typeof incoming.uuid !== "string" || !/^pdfanchor-[a-f0-9]{12}$/i.test(incoming.uuid)) {
              try { showError("创建锚点失败：缺少或非法的 uuid"); } catch (e) { void e; /* logger-guard */ }
              this.#logger.warn("[anchor] create blocked - invalid/missing uuid (UI path)", { incoming });
              return;
            }
            const id = incoming.uuid;
            const name = (incoming.name && String(incoming.name).trim())
              ? String(incoming.name).trim()
              : `第${pageAt}页 - ${this.#formatTime(new Date())}`;

            const anchor = { uuid: id, name, page_at: pageAt, position: pos, is_active: false };
            this.#anchorsById.set(id, anchor);
            this.#logger.info("[anchor] create(UI) accepted", { id, pageAt, position: pos, name });
            try { showSuccess(`已创建锚点: ${name}`); } catch (e) { void e; /* logger-guard */ }
            this.#emitList();
            return;
          }

          // 情况B：无负载（legacy/快捷创建）→ 采样当前位置并生成一条新锚点，再补齐负载并转发给 WS
          const snapshot = this.#getSnapshotForQuickCreate();
          const pageAt = snapshot.pageAt;
          const position = snapshot.position;
          const id = this.#makeAnchorId();
          const name = `第${pageAt}页 - ${this.#formatTime(new Date())}`;
          const anchor = { uuid: id, name, page_at: pageAt, position: position / 100, is_active: false };
          this.#anchorsById.set(id, anchor);
          this.#logger.info("[anchor] create(quick) accepted", { id, pageAt, position });
          try { showSuccess(`已创建锚点: ${name}`); } catch (e) { void e; /* logger-guard */ }
          this.#emitList();
          // 触发一次包含 anchor 的 CREATE 事件，交由 WebSocketAdapter 持久化（补齐 pdf_uuid）
          let pdfId = null;
          try {
            const params = new URLSearchParams(window.location.search);
            pdfId = params.get("pdf-id");
          } catch (e) { this.#logger.debug("[pdf-anchor] gate polling setup failed", e); }
          this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.CREATE, { anchor, pdf_uuid: pdfId, __fromFeature: true }, { actorId: "PDFAnchorFeature" });
        } catch (e) {
          this.#logger.warn("handle ANCHOR.CREATE failed", e);
          try { showError("创建锚点失败"); } catch (e) { void e; /* logger-guard */ }
        }
      },
      { subscriberId: "PDFAnchorFeature" }
    );

    // 删除锚点
    safeOn(
      PDF_VIEWER_EVENTS.ANCHOR.DELETE,
      ({ anchorId }) => {
        const id = String(anchorId || "").trim();
        if (!id) {return;}
        const existed = this.#anchorsById.get(id);
        this.#anchorsById.delete(id);
        try {
          if (existed) {
            showSuccess(`已删除锚点: ${existed.name || id}`);
          }
        } catch (e) {
          this.#logger.warn("[pdf-anchor] showSuccess failed on delete", e);
        }
        this.#emitList();
      },
      { subscriberId: "PDFAnchorFeature" }
    );

    // 修改锚点名称（简单对话框）
    safeOn(
      PDF_VIEWER_EVENTS.ANCHOR.UPDATE,
      ({ anchorId, update }) => {
        const id = String(anchorId || "").trim();
        if (!id) {return;}
        const a = this.#anchorsById.get(id);
        if (!a) {return;}
        let changed = false;
        if (update && typeof update.name === "string") {
          a.name = update.name.trim() || a.name;
          changed = true;
        }
        if (typeof update?.page_at === "number") { a.page_at = update.page_at; changed = true; }
        if (typeof update?.position === "number") { a.position = update.position / 100; changed = true; }
        if (changed) {
          this.#anchorsById.set(id, a);
          this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.UPDATED, { anchorId: id, page_at: a.page_at, position: Math.round((a.position||0)*100) }, { actorId: "PDFAnchorFeature" });
          this.#emitList();
        }
      },
      { subscriberId: "PDFAnchorFeature" }
    );

    // 激活锚点（单选语义：同时将其他锚点置为未激活）
    safeOn(
      PDF_VIEWER_EVENTS.ANCHOR.ACTIVATE,
      ({ anchorId, active = true }) => {
        const id = String(anchorId || "").trim();
        if (!id) {return;}
        const nextActive = !!active;

        // 更新选中项
        const a = this.#anchorsById.get(id) || { uuid: id };
        a.is_active = nextActive;
        this.#anchorsById.set(id, a);

        // 单选：当设置为激活时，其它全部取消激活
        if (nextActive) {
          for (const [aid, item] of this.#anchorsById.entries()) {
            if (aid !== id && item && item.is_active) {
              item.is_active = false;
              this.#anchorsById.set(aid, item);
            }
          }
        }

        // 广播当前项激活状态改变
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.ACTIVATED, { anchorId: id, active: a.is_active }, { actorId: "PDFAnchorFeature" });
        // 刷新整表，体现单选效果
        this.#emitList();

        // 提示
        try {
          showSuccess(nextActive ? `已激活锚点: ${a.name || id}` : `已停用锚点: ${a.name || id}`);
        } catch (e) {
          this.#logger.warn("[pdf-anchor] showSuccess failed on activate", e);
        }
        if (nextActive) {
          this.#activeAnchorId = id;
          // 重置节流计数，保证激活后第一笔有效位置变更可以写回
          this.#lastUpdateAt = null;
        } else {
          if (this.#activeAnchorId === id) { this.#activeAnchorId = null; }
        }
      },
      { subscriberId: "PDFAnchorFeature" }
    );

    // 页面导航变更：仅用于到达提示（不做自动采样）
    safeOn(
      PDF_VIEWER_EVENTS.NAVIGATION.CHANGED,
      (data) => {
        try {
          if (!this.#lastNav) {return;}
          if (this.#lastNav.method === "direct") {
            const pg = parseInt(data?.pageNumber || 0, 10);
            if (pg && pg === this.#lastNav.pageAt) {
              const dt = Date.now() - (this.#lastNav.t0 || Date.now());
              showSuccess(`跳转到达: 第${pg}页（~${dt}ms）`);
              this.#lastNav = null;
            }
          }
        } catch (e) { void e; /* logger-guard */ }
      },
      { subscriberId: "PDFAnchorFeature" }
    );

    // 导航成功/失败提示（统一链路反馈）
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.SUCCESS,
      (info) => {
        try {
          const pg = parseInt(info?.pageAt || 0, 10);
          const pos = (typeof info?.position === "number") ? `${info.position}%` : "(未提供)";
          const dur = parseInt(info?.duration || 0, 10);
          showSuccess(`跳转到达: 第${pg}页 ${pos}（${dur}ms）`);
          this.#lastNav = null;
        } catch (e) { void e; /* logger-guard */ }
      },
      { subscriberId: "PDFAnchorFeature" }
    );
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.FAILED,
      (err) => {
        try { showError(`[跳转失败] ${err?.message || "未知错误"}`); } catch (e) { void e; /* logger-guard */ }
      },
      { subscriberId: "PDFAnchorFeature" }
    );

    // WebSocket 错误提示：锚点域相关错误直接 toast 到前端，便于定位
    this.#eventBus.on(
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

  // 统一导航触发：通过导航事件（NAVIGATION.URL_PARAMS.REQUESTED），不再直接调用 navigationService
  #navigateToAnchor(anchorId) {
    try {
      const id = String(anchorId || "").trim();
      if (!id) {return;}
      const a = this.#anchorsById.get(id);
      if (!a) {
        try { showError("锚点导航失败：未找到锚点"); } catch (e) { this.#logger.debug("[pdf-anchor] showError failed (anchor not found)", e); }
        this.#logger.warn("[pdf-anchor] navigateToAnchor: anchor not found", { anchorId: id });
        return;
      }
      const pageAt = parseInt(a.page_at || 1, 10);
      if (!Number.isFinite(pageAt) || pageAt < 1) {
        try { showError("锚点导航失败：无效页码"); } catch (e) { this.#logger.debug("[pdf-anchor] showError failed (invalid page)", e); }
        this.#logger.warn("[pdf-anchor] navigateToAnchor: invalid page_at", { anchorId: id, page_at: a.page_at });
        return;
      }
      let pos = null;
      if (typeof a.position === "number" && !Number.isNaN(a.position)) {
        let raw = a.position;
        if (raw <= 1) { raw = raw * 100; }
        pos = Math.max(0, Math.min(100, Math.round(raw)));
      }
      try {
        const posText = (pos === null || Number.isNaN(pos)) ? "(未提供)" : `${pos}%`;
        showInfo(`执行跳转: 第${pageAt}页 ${posText}`);
      } catch (e) { void e; /* logger-guard */ }

      const t0 = Date.now();
      this.#lastNav = { pageAt, position: pos, anchorId: id, t0, method: "url" };
      let pdfId = null;
      try { pdfId = new URLSearchParams(window.location.search).get("pdf-id"); } catch { /* noop */ }
      const payload = { pdfId, anchorId: id, pageAt };
      if (typeof pos === "number" && !Number.isNaN(pos)) { payload.position = pos; }

      // 事件驱动激活该锚点（单选语义 + 模块解耦）
      try {
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.ANCHOR.ACTIVATE,
          { anchorId: id, active: true },
          { actorId: "PDFAnchorFeature" }
        );
      } catch (e) {
        this.#logger.debug("[pdf-anchor] emit ANCHOR.ACTIVATE failed (navigateToAnchor)", e);
      }

      this.#eventBus.emit(
        PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED,
        payload,
        { actorId: "PDFAnchorFeature" }
      );
      if (this.#positionTracker) {
        try {
          this.#positionTracker.freezeFor(3000);
        } catch (e) {
          this.#logger.debug("[pdf-anchor] position tracker freeze failed", e);
        }
      }
      this.#lastUpdateAt = null;
    } catch (e) {
      try { showError("锚点导航失败"); } catch (e2) { void e2; /* logger-guard */ }
      this.#logger.warn("[pdf-anchor] navigateToAnchor failed", e);
    }
  }

  #setupPositionTracker() {
    try {
      if (this.#container?.has?.("domEventHub")) {
        this.#domEventHub = this.#container.get("domEventHub");
      } else {
        this.#domEventHub = null;
      }
    } catch (e) {
      this.#logger.warn("[pdf-anchor] domEventHub not available, fallback to direct DOM listeners", e);
      this.#domEventHub = null;
    }

    try {
      this.#positionTracker = new PositionTracker({
        debounceMs: 200,
        domEventHub: this.#domEventHub,
        onPositionChange: (pageAt, position) => {
          this.#handlePositionChanged(pageAt, position);
        }
      });
    } catch (e) {
      this.#logger.error("[pdf-anchor] failed to create PositionTracker", e);
      this.#positionTracker = null;
      return;
    }

    this.#activateTrackerWhenReady();
  }

  #activateTrackerWhenReady() {
    if (!this.#positionTracker) {
      return;
    }

    let container = null;
    try {
      container = document.getElementById("viewerContainer");
    } catch (e) {
      this.#logger.warn("[pdf-anchor] getElementById(viewerContainer) failed", e);
    }

    if (container) {
      try {
        this.#positionTracker.activate(container);
        this.#logger.info("[pdf-anchor] position tracker activated");
      } catch (e) {
        this.#logger.error("[pdf-anchor] failed to activate position tracker", e);
      }
      return;
    }

    this.#logger.warn("[pdf-anchor] viewerContainer not ready, retrying position tracker activation...");
    setTimeout(() => {
      let retryContainer = null;
      try {
        retryContainer = document.getElementById("viewerContainer");
      } catch (e) {
        this.#logger.warn("[pdf-anchor] getElementById(viewerContainer) failed on retry", e);
      }
      if (retryContainer && this.#positionTracker) {
        try {
          this.#positionTracker.activate(retryContainer);
          this.#logger.info("[pdf-anchor] position tracker activated (retry)");
        } catch (e) {
          this.#logger.error("[pdf-anchor] failed to activate position tracker on retry", e);
        }
      } else {
        this.#logger.error("[pdf-anchor] viewerContainer still not found after retry");
      }
    }, 500);
  }

  #handlePositionChanged(pageAt, position) {
    if (!this.#activeAnchorId) {
      return;
    }

    const now = Date.now();
    if (this.#lastUpdateAt !== null && (now - this.#lastUpdateAt) < 1000) {
      this.#logger.debug("[pdf-anchor] position change ignored by throttle", {
        anchorId: this.#activeAnchorId,
        pageAt,
        position,
        sinceLastMs: now - this.#lastUpdateAt
      });
      return;
    }

    this.#lastUpdateAt = now;
    try {
      this.#updateActiveAnchorPosition(this.#activeAnchorId, pageAt, position);
    } catch (e) {
      this.#logger.warn("[pdf-anchor] handlePositionChanged failed", e);
    }
  }

  #updateActiveAnchorPosition(anchorId, pageAt, position) {
    const id = String(anchorId || "").trim();
    if (!id) { return; }

    const pageAtNum = parseInt(pageAt || 1, 10) || 1;
    let posNum = null;
    if (typeof position === "number" && Number.isFinite(position)) {
      const clipped = Math.max(0, Math.min(100, position));
      posNum = Math.round(clipped);
    }

    const anchor = this.#anchorsById.get(id) || { uuid: id };
    anchor.page_at = pageAtNum;
    anchor.position = typeof posNum === "number" ? (posNum / 100) : null; // 存储时使用 0..1
    this.#anchorsById.set(id, anchor);

    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.ANCHOR.UPDATE,
      { anchorId: id, update: { page_at: pageAtNum, position: posNum } },
      { actorId: "PDFAnchorFeature" }
    );

    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.ANCHOR.UPDATED,
      { anchorId: id, page_at: pageAtNum, position: posNum },
      { actorId: "PDFAnchorFeature" }
    );
  }

  #getSnapshotForQuickCreate() {
    // 优先使用 PositionTracker 的 snapshot
    if (this.#positionTracker && this.#positionTracker.isActive) {
      try {
        const snap = this.#positionTracker.snapshot();
        if (snap && Number.isFinite(snap.pageAt) && Number.isFinite(snap.position)) {
          return { pageAt: snap.pageAt, position: snap.position };
        }
      } catch (e) {
        this.#logger.debug("[pdf-anchor] PositionTracker.snapshot failed for quick create", e);
      }
    }

    // 回退到直接使用 DOM + 工具函数
    try {
      const viewerContainer = document.getElementById("viewerContainer");
      if (viewerContainer) {
        const snap = getCurrentPageAndPosition(viewerContainer);
        if (snap && Number.isFinite(snap.pageAt) && Number.isFinite(snap.position)) {
          return { pageAt: snap.pageAt, position: snap.position };
        }
      }
    } catch (e) {
      this.#logger.error("[pdf-anchor] getCurrentPageAndPosition failed for quick create", e);
    }

    // 最后兜底到固定位置（Fail‑Fast：不抛错，但不会写入无效位置）
    return { pageAt: 1, position: 0 };
  }

  #emitList() {
    const list = Array.from(this.#anchorsById.values());
    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED, { anchors: list }, { actorId: "PDFAnchorFeature" });
  }

  #makeAnchorId() {
    // 生成 pdfanchor- + 12位hex
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    return `pdfanchor-${hex}`;
  }

  #formatTime(d) {
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    return `${hh}:${mm}`;
  }
}

export default PDFAnchorFeature;

