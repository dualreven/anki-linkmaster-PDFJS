/**
 * PDF Anchor Feature
 * @module PDFAnchorFeature
 * @description 负责锚点的复制、激活与运行时位置追踪；支持从URL参数(anchor-id)启动时的导航与提示
 */

import { getLogger } from "../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { showSuccess, showError, showInfo } from "../../../common/utils/notification.js";
import { WEBSOCKET_MESSAGE_EVENTS } from "../../../common/event/event-constants.js";
// 使用 url-navigation 公共 API，避免跨特性直接依赖内部实现
import { parseUrlParams } from "../url-navigation/public.js";

// 仅在开发模式允许 DEV 测试锚点注入（pdfanchor-test）
// 注：为兼容 Jest 与部分打包环境，避免直接访问 import.meta；
// 在 Node/Jest 下以 NODE_ENV/JEST_WORKER_ID 判定，在浏览器下默认走非 DEV 路径。
const isDevEnvironment = (() => {
  try {
    const env = (typeof process !== "undefined" && process && process.env) ? process.env : {};
    return env.NODE_ENV === "development" || typeof env.JEST_WORKER_ID !== "undefined";
  } catch (_) { return false; }
})();

export class PDFAnchorFeature {
  #logger = getLogger("PDFAnchorFeature");
  #eventBus = null;
  #container = null;
  #navigationService = null;
  // 心跳总开关：默认关闭（仅保留实现，不自动启动）
  static ENABLE_HEARTBEAT = false;
  static HEARTBEAT_INTERVAL_MS = 3000;

  #anchorsById = new Map(); // uuid -> anchor {uuid,name,page_at,position,is_active}
  #activeAnchorId = null;
  #updateTimer = null;
  #pendingUrlAnchorId = null;
  #scrollHintShown = false;
  #scrollListeners = [];
  #scrollAttached = false;
  #scrollRetryTimer = null;
  #scrollAttachAttempts = 0;
  #freezeUntilMs = 0;
  #autoUpdateEnabled = true;
  #pendingNav = null; // 延迟到 FILE.LOAD.SUCCESS 后再执行的导航参数 { pageAt, position }
  #lastNav = null; // 最近一次导航请求 { pageAt, position, anchorId, t0, method }
  #useGateNav = true; // 启用“并发闸门”（统一走 URL 事件）
  #gateAnchorReady = false; // 锚点数据已达
  #gateRenderReady = false; // PDF渲染就绪
  #gateNavDone = false; // 闸门导航已执行
  #lastSnapshot = null; // 最近一次心跳上报 { pageAt, position }

  get name() { return "pdf-anchor"; }
  get version() { return "1.0.0"; }
  get dependencies() { return ["navigationService"]; }

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
    // 简化模式：不依赖页面事件与滚动诊断，改为纯心跳回写
    // 安装时主动检查 URL（避免错过 URL_PARAMS.PARSED 早期事件）
    try {
      this.#bootstrapFromURL();
    } catch(e){ this.#logger.warn("noop", e); }
    this.#logger.info("PDFAnchorFeature installed");
  }

  async uninstall() {
    this.#stopUpdateTimer();
    try { this.#removeScrollDiagnostics(); } catch (_) {}
    this.#anchorsById.clear();
    this.#activeAnchorId = null;
    this.#eventBus = null;
    this.#container = null;
  }

  #setupEventListeners() {
    const safeOn = (evt, handler, opts) => {
      if (typeof evt === "string" && evt.length > 0) {
        return this.#eventBus.on(evt, handler, opts);
      } else {
        try { this.#logger.warn("[PDFAnchorFeature] 跳过订阅：事件未定义或非字符串", { evt, subscriberId: opts?.subscriberId }); } catch(_) {}
        return () => {};
      }
    };

    // URL 参数解析：捕捉 anchor-id（防御：事件名必须为字符串）
    const EVT_URL_PARSED = PDF_VIEWER_EVENTS?.NAVIGATION?.URL_PARAMS?.PARSED;
    if (typeof EVT_URL_PARSED === "string") {
      safeOn(
        EVT_URL_PARSED,
        (data) => {
          const anchorId = (data?.anchorId || "").toString().trim();
          if (!anchorId) {return;}

          // 支持开发测试ID：仅在开发模式可用；正式ID：pdfanchor- + 12hex
          const isDevTest = isDevEnvironment && /^pdfanchor-test$/i.test(anchorId);
          const isValid = /^pdfanchor-[a-f0-9]{12}$/i.test(anchorId);

          if (isDevTest) {
            const id = anchorId.toLowerCase();
            this.#pendingUrlAnchorId = id;
            this.#logger.info("Detected DEV anchor-id from URL:", id);
            // 直接注入一条激活的测试锚点数据
            const testAnchor = { uuid: id, name: "测试锚点", page_at: 1, position: null, is_active: true };
            this.#anchorsById.set(id, testAnchor);
            this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED, { anchors: [testAnchor] }, { actorId: "PDFAnchorFeature" });
            return;
          }

          if (isValid) {
            this.#pendingUrlAnchorId = anchorId.toLowerCase();
            this.#logger.info("Detected anchor-id from URL:", this.#pendingUrlAnchorId);
            // 请求加载指定锚点数据（交由后端/适配器实现）
            this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD, { anchorId: this.#pendingUrlAnchorId }, { actorId: "PDFAnchorFeature" });
          }
        },
        { subscriberId: "PDFAnchorFeature" }
      );
    } else {
      this.#logger.warn("URL_PARAMS.PARSED event undefined; skip subscription");
    }

    // 收到锚点数据（数组或单条）
    safeOn(
      PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED,
      ({ anchors }) => {
        if (Array.isArray(anchors)) {
          anchors.forEach(a => { if (a?.uuid) {this.#anchorsById.set(String(a.uuid), a);} });
        } else if (anchors && anchors.uuid) {
          this.#anchorsById.set(String(anchors.uuid), anchors);
        }

        // URL 携带 anchor-id 时的处理：设置挂起导航，等待渲染/文件就绪后统一发 URL_PARAMS.REQUESTED（避免过早或重复）
        if (this.#pendingUrlAnchorId) {
          const a = this.#anchorsById.get(this.#pendingUrlAnchorId);
          if (a) {
            showSuccess(`已识别锚点: ${a.name || a.uuid}`);
            // 记录最近一次位置，延迟到 FILE.LOAD.SUCCESS 后再导航，避免 PDF 未就绪时的无效 GOTO
            const pageAt = parseInt(a.page_at || 1, 10);
            const pos = typeof a.position === "number" ? Math.max(0, Math.min(100, a.position * 100)) : null;
            this.#pendingNav = (pageAt >= 1) ? { pageAt, position: pos, anchorId: a.uuid } : null;
            try {
              const posText = (pos === null || Number.isNaN(pos)) ? "(未提供)" : `${pos}%`;
              showInfo(`计划跳转: 第${pageAt}页 ${posText}`);
            } catch(_) {}
            // 统一走 URL 导航闸门路径
            this.#gateAnchorReady = true;
            this.#tryNavigateWhenGatesReady();
            // 跟踪对象与滚动诊断
            this.#activeAnchorId = a.uuid;
            this.#startUpdateTimer();
            try { this.#ensureScrollDiagnostics(); } catch(_) {}
          }
          // 仅处理一次
          this.#pendingUrlAnchorId = null;
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
            this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD, { pdf_uuid: pdfId }, { actorId: "PDFAnchorFeature" });
          }
        } catch(e){ this.#logger.warn("noop", e); }
        // Gate 兼容：部分环境不会发出 RENDER.READY，这里将 FILE.LOAD.SUCCESS 视作“加载完成”信号
        if (this.#useGateNav) {
          this.#gateRenderReady = true;
          this.#tryNavigateWhenGatesReady();
          // DOM 就绪兜底：短轮询检测 .page 出现后也视作渲染可用
          try {
            const deadline = Date.now() + 8000; // 最长 8s 轮询 DOM
            const iv = setInterval(() => {
              if (this.#gateRenderReady) { clearInterval(iv); return; }
              try {
                const vc = document.getElementById("viewerContainer");
                if (vc && vc.querySelector(".page")) {
                  this.#gateRenderReady = true; clearInterval(iv); this.#tryNavigateWhenGatesReady();
                }
              } catch(_) {}
              if (Date.now() >= deadline) { try { clearInterval(iv); } catch(_) {} }
            }, 150);
          } catch(_) {}
        }
        // 文件加载完成后安装滚动诊断（如果尚未安装），以便激活锚点后滚动能及时采样
        try { this.#ensureScrollDiagnostics(); } catch(_) {}
      },
      { subscriberId: "PDFAnchorFeature" }
    );

    // PDF 渲染就绪（首页渲染完成，DOM可用）
    const EVT_RENDER_READY = PDF_VIEWER_EVENTS?.RENDER?.READY;
    safeOn(
      EVT_RENDER_READY,
      (info) => {
        try { showSuccess(`PDF渲染完成：总页数 ${info?.totalPages ?? ""}`); } catch(_) {}
        this.#gateRenderReady = true;
        this.#tryNavigateWhenGatesReady();
        // 渲染完成后再试一次安装滚动监听
        try { this.#ensureScrollDiagnostics(); } catch(_) {}
      },
      { subscriberId: "PDFAnchorFeature" }
    );

    // 统一处理：来自 URLJumpDispatcher/WS 的 anchor 导航请求 → 设置挂起，待门闸就绪后统一发 URL_PARAMS.REQUESTED
    safeOn(
      PDF_VIEWER_EVENTS.ANCHOR.NAVIGATE.REQUESTED,
      (data) => {
        try {
          const anchorId = (data?.anchorId || "").toString().trim();
          if (!anchorId) {return;}
          const a = this.#anchorsById.get(anchorId);
          if (a) {
            // 设置挂起导航，等待渲染与文件就绪后统一发 URL_PARAMS.REQUESTED
            const pageAt = parseInt(a.page_at || 1, 10);
            const pos = typeof a.position === "number" ? Math.max(0, Math.min(100, Math.round(a.position * 100))) : null;
            if (pageAt >= 1) {
              this.#pendingNav = { pageAt, position: pos, anchorId };
              this.#gateAnchorReady = true;
              this.#tryNavigateWhenGatesReady();
              return;
            }
          }
          // 未加载：请求加载并走闸门
          this.#pendingUrlAnchorId = anchorId;
          this.#gateAnchorReady = false;
          this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD, { anchorId }, { actorId: "PDFAnchorFeature" });
        } catch (e) {
          try { showError("锚点导航失败"); } catch(_) {}
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
              try { showError("创建锚点失败：缺少或非法的 uuid"); } catch(_) {}
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
            try { showSuccess(`已创建锚点: ${name}`); } catch(_) {}
            this.#emitList();
            return;
          }

          // 情况B：无负载（legacy/快捷创建）→ 采样当前位置并生成一条新锚点，再补齐负载并转发给 WS
          const { pageAt, position } = this.#getCurrentPageAndPosition();
          const id = this.#makeAnchorId();
          const name = `第${pageAt}页 - ${this.#formatTime(new Date())}`;
          const anchor = { uuid: id, name, page_at: pageAt, position: position / 100, is_active: false };
          this.#anchorsById.set(id, anchor);
          this.#logger.info("[anchor] create(quick) accepted", { id, pageAt, position });
          try { showSuccess(`已创建锚点: ${name}`); } catch(_) {}
          this.#emitList();
          // 触发一次包含 anchor 的 CREATE 事件，交由 WebSocketAdapter 持久化（补齐 pdf_uuid）
          let pdfId = null;
          try {
            const params = new URLSearchParams(window.location.search);
            pdfId = params.get("pdf-id");
          } catch(_) {}
          this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.CREATE, { anchor, pdf_uuid: pdfId, __fromFeature: true }, { actorId: "PDFAnchorFeature" });
        } catch (e) {
          this.#logger.warn("handle ANCHOR.CREATE failed", e);
          try { showError("创建锚点失败"); } catch(_) {}
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
        try { if (existed) {showSuccess(`已删除锚点: ${existed.name || id}`);} } catch(e){ this.#logger.warn("noop", e); }
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

        // 提示 + 心跳
        try { showSuccess(nextActive ? `已激活锚点: ${a.name || id}` : `已停用锚点: ${a.name || id}`); } catch(e){ this.#logger.warn("noop", e); }
        if (nextActive) {
          this.#activeAnchorId = id;
          // 不在激活瞬间写回页码，避免初始化期间采样到错误页面（导致倒退并被持久化）
          this.#startUpdateTimer();
          this.#autoUpdateEnabled = true;
          // 启用滚动诊断：在文档区域滚动时采样并写回（心跳关闭的情况下，保持滚动驱动的即时性）
          try { this.#ensureScrollDiagnostics(); } catch(_) {}
        } else {
          if (this.#activeAnchorId === id) { this.#activeAnchorId = null; }
          this.#stopUpdateTimer();
          try { this.#removeScrollDiagnostics(); } catch(_) {}
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
        } catch(_) {}
      },
      { subscriberId: "PDFAnchorFeature" }
    );

    // URL 导航成功/失败提示（统一链路反馈）
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.SUCCESS,
      (info) => {
        try {
          const pg = parseInt(info?.pageAt || 0, 10);
          const pos = (typeof info?.position === "number") ? `${info.position}%` : "(未提供)";
          const dur = parseInt(info?.duration || 0, 10);
          showSuccess(`跳转到达: 第${pg}页 ${pos}（${dur}ms）`);
          this.#lastNav = null;
        } catch(_) {}
      },
      { subscriberId: "PDFAnchorFeature" }
    );
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.FAILED,
      (err) => {
        try { showError(`[跳转失败] ${err?.message || "未知错误"}`); } catch(_) {}
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
        } catch(_) {}
      },
      { subscriberId: "PDFAnchorFeature" }
    );

    // 页面销毁/关闭时清理
    window.addEventListener("beforeunload", () => this.#stopUpdateTimer());
  }

  // 统一导航触发：通过 URL 导航事件（URL_PARAMS.REQUESTED），不再直接调用 navigationService

  // 并发闸门：同时满足“锚点数据已达”与“PDF渲染就绪”后再执行 URL 导航
  #tryNavigateWhenGatesReady() {
    try {
      if (!this.#useGateNav) { return; }
      if (this.#gateNavDone) { return; }
      if (!this.#gateAnchorReady || !this.#gateRenderReady) { return; }
      if (!this.#pendingNav) { return; }
      const { pageAt, position, anchorId } = this.#pendingNav;
      // 对齐 URLNavigationFeature 的稳定窗口：延迟约 1 秒后再发起 REQUESTED
      const t0 = Date.now();
      setTimeout(() => {
        try {
          try {
            const posText = (position === null || Number.isNaN(position)) ? "(未提供)" : `${position}%`;
            showInfo(`执行跳转: 第${pageAt}页 ${posText}`);
          } catch(_) {}
          this.#lastNav = { pageAt, position, anchorId, t0, method: "url" };
          const pdfId = (() => { try { return new URLSearchParams(window.location.search).get("pdf-id"); } catch { return null; } })();
          const payload = { pdfId, anchorId, pageAt };
          if (typeof position === "number") { payload.position = position; }
          this.#eventBus.emit(
            PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED,
            payload,
            { actorId: "PDFAnchorFeature" }
          );
          this.#freezeUntilMs = Date.now() + 3000;
          this.#autoUpdateEnabled = false;
          this.#pendingNav = null;
          this.#gateNavDone = true;
        } catch(_) {}
      }, 1000);
    } catch(_) {}
  }

  #ensureScrollDiagnostics() {
    if (this.#scrollAttached) { return; }
    let viewerContainer = null;
    try { viewerContainer = document.getElementById("viewerContainer"); } catch (_) {}

    if (!viewerContainer) {
      // 第一次提示：请在文档区域滚动
      if (!this.#scrollHintShown) {
        this.#scrollHintShown = true;
        showInfo("未找到文档滚动容器，请在文档区域滚动以更新锚点位置");
      }
      // 安排一次重试（最多 40 次 ≈ 8s）
      if (!this.#scrollRetryTimer && this.#scrollAttachAttempts < 40) {
        this.#scrollRetryTimer = setTimeout(() => {
          this.#scrollRetryTimer = null;
          this.#scrollAttachAttempts += 1;
          try { this.#ensureScrollDiagnostics(); } catch(_) {}
        }, 200);
      }
      return;
    }

    // 在文档区域滚动时，若存在激活锚点，立即采样更新（去抖动）
    let debounceTimer = null;
    const onDocScroll = () => {
      if (!this.#activeAnchorId) {return;}
      // 用户滚动后允许自动回写（解除 URL 启动保护）
      this.#autoUpdateEnabled = true;
      if (Date.now() < this.#freezeUntilMs) {return;}
      if (debounceTimer) { clearTimeout(debounceTimer); }
      debounceTimer = setTimeout(() => {
        try { this.#snapshotAndUpdate(this.#activeAnchorId); } catch (e) { this.#logger.warn("snapshot on doc scroll failed", e); }
      }, 120);
    };
    viewerContainer.addEventListener("scroll", onDocScroll, { passive: true });
    this.#scrollListeners.push(() => viewerContainer.removeEventListener("scroll", onDocScroll));
    this.#scrollAttached = true;

    // 如果用户滚动了窗口而非文档容器，提示一次
    const onWinScroll = () => {
      if (this.#scrollHintShown) {return;}
      this.#scrollHintShown = true;
      showInfo("检测到窗口滚动，请在文档区域内滚动以更新锚点位置");
    };
    window.addEventListener("scroll", onWinScroll, { passive: true });
    this.#scrollListeners.push(() => window.removeEventListener("scroll", onWinScroll));
  }

  #removeScrollDiagnostics() {
    try { this.#scrollListeners.forEach(off => { try { off(); } catch(_){} }); } finally { this.#scrollListeners = []; }
    this.#scrollAttached = false;
    if (this.#scrollRetryTimer) { try { clearTimeout(this.#scrollRetryTimer); } catch(_) {} this.#scrollRetryTimer = null; }
    this.#scrollAttachAttempts = 0;
  }

  #bootstrapFromURL() {
    const parsed = parseUrlParams();
    const anchorId = (parsed?.anchorId || "").toString().trim();
    if (!anchorId) {return;}

    const isDevTest = /^pdfanchor-test$/i.test(anchorId);
    const isValid = /^pdfanchor-[a-f0-9]{12}$/i.test(anchorId);

    if (isDevTest) {
      const id = anchorId.toLowerCase();
      this.#pendingUrlAnchorId = id;
      const testAnchor = { uuid: id, name: "测试锚点", page_at: 1, position: null, is_active: true };
      this.#anchorsById.set(id, testAnchor);
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED, { anchors: [testAnchor] }, { actorId: "PDFAnchorFeature" });
      return;
    }

    if (isValid) {
      this.#pendingUrlAnchorId = anchorId.toLowerCase();
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD, { anchorId: this.#pendingUrlAnchorId }, { actorId: "PDFAnchorFeature" });
    }
  }

  // 复制动作已下沉到 UI 层，特性层不再提供复制实现，减少重复与环境差异

  #startUpdateTimer() {
    this.#stopUpdateTimer();
    // 仅当显式开启且存在激活锚点时才启动心跳（默认不启用）
    if (!PDFAnchorFeature.ENABLE_HEARTBEAT) { return; }
    if (!this.#activeAnchorId) { return; }
    this.#updateTimer = setInterval(() => {
      try {
        // 冷却期内不写回，避免刚跳转时采样错误位置
        if (Date.now() < this.#freezeUntilMs) { return; }
        if (!this.#autoUpdateEnabled) { return; }
        if (!this.#activeAnchorId) { return; }
        // 采样当前位置
        const snap = this.#getCurrentPageAndPosition();
        // 仅在变化时上报，减少噪音
        const changed = !this.#lastSnapshot
          || this.#lastSnapshot.pageAt !== snap.pageAt
          || this.#lastSnapshot.position !== snap.position;
        if (!changed) { return; }
        this.#lastSnapshot = { ...snap };
        this.#snapshotAndUpdate(this.#activeAnchorId);
      } catch (e) {
        this.#logger.warn("[anchor] heartbeat tick failed", e);
      }
    }, PDFAnchorFeature.HEARTBEAT_INTERVAL_MS);
  }

  #stopUpdateTimer() {
    if (this.#updateTimer) {
      try { clearInterval(this.#updateTimer); } catch(e){ this.#logger.warn("noop", e); }
      this.#updateTimer = null;
    }
  }

  #snapshotAndUpdate(anchorId) {
    const { pageAt, position } = this.#getCurrentPageAndPosition();
    // 更新内存
    const a = this.#anchorsById.get(anchorId) || { uuid: anchorId };
    a.page_at = pageAt;
    a.position = typeof position === "number" ? position / 100 : null; // 存储时使用0~1
    this.#anchorsById.set(anchorId, a);

    // 发出更新请求事件（交由后端持久化）
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.ANCHOR.UPDATE,
      { anchorId, update: { page_at: pageAt, position: position } },
      { actorId: "PDFAnchorFeature" }
    );

    // 同步UI（可选）
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.ANCHOR.UPDATED,
      { anchorId, page_at: pageAt, position: position },
      { actorId: "PDFAnchorFeature" }
    );
  }

  #getCurrentPageAndPosition() {
    try {
      const viewerContainer = document.getElementById("viewerContainer");
      if (!viewerContainer) {return { pageAt: 1, position: 0 };}
      const centerY = viewerContainer.scrollTop + viewerContainer.clientHeight / 2;
      const pages = Array.from(viewerContainer.querySelectorAll(".page"));
      let best = { pageAt: 1, position: 0, dist: Number.POSITIVE_INFINITY };
      for (const el of pages) {
        const pageNo = parseInt(el.getAttribute("data-page-number"), 10) || 1;
        const top = el.offsetTop;
        const height = el.offsetHeight || 1;
        const bottom = top + height;
        if (centerY >= top && centerY <= bottom) {
          const rel = (centerY - top) / height; // 0..1
          return { pageAt: pageNo, position: Math.round(rel * 100) };
        } else {
          // 距离最近的页面
          const dist = Math.min(Math.abs(centerY - top), Math.abs(centerY - bottom));
          if (dist < best.dist) {best = { pageAt: pageNo, position: centerY < top ? 0 : 100, dist };}
        }
      }
      return { pageAt: best.pageAt, position: best.position };
    } catch (e) {
      this.#logger.error("获取当前页码与位置失败", e);
      return { pageAt: 1, position: 0 };
    }
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

