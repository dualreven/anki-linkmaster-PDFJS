/**
 * PDF Anchor Feature
 * @module PDFAnchorFeature
 * @description 负责锚点的复制、激活与运行时位置追踪；支持从URL参数(anchor-id)启动时的导航与提示
 */

import { getLogger } from "../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_EVENTS } from "../../../common/event/event-constants.js";
import { success as toastSuccess, warning as toastWarning, error as toastError } from "../../../common/utils/thirdparty-toast.js";
import { WEBSOCKET_MESSAGE_EVENTS } from "../../../common/event/event-constants.js";
import { URLParamsParser } from "../url-navigation/components/url-params-parser.js";

export class PDFAnchorFeature {
  #logger = getLogger("PDFAnchorFeature");
  #eventBus = null;
  #container = null;
  #navigationService = null;

  #anchorsById = new Map(); // uuid -> anchor {uuid,name,page_at,position,is_active}
  #activeAnchorId = null;
  #updateTimer = null;
  #pendingUrlAnchorId = null;
  #scrollHintShown = false;
  #scrollListeners = [];
  #freezeUntilMs = 0;
  #autoUpdateEnabled = true;
  #pendingNav = null; // 延迟到 FILE.LOAD.SUCCESS 后再执行的导航参数 { pageAt, position }
  #navReadyRetryTimer = null; // 短暂重试定时器（处理LOAD.SUCCESS已过但pagesCount稍后才>0的竞态）
  #navInitDelayTimer = null; // 等待PDFViewer完全初始化后的延迟导航定时器

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
    if (this.#navReadyRetryTimer) { try { clearInterval(this.#navReadyRetryTimer); } catch(_){} this.#navReadyRetryTimer = null; }
    if (this.#navInitDelayTimer) { try { clearTimeout(this.#navInitDelayTimer); } catch(_){} this.#navInitDelayTimer = null; }
    this.#anchorsById.clear();
    this.#activeAnchorId = null;
    this.#eventBus = null;
    this.#container = null;
  }

  #setupEventListeners() {
    // URL 参数解析：捕捉 anchor-id
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.PARSED,
      (data) => {
        const anchorId = (data?.anchorId || "").toString().trim();
        if (!anchorId) {return;}

        // 支持开发测试ID：pdfanchor-test；正式ID：pdfanchor- + 12hex
        const isDevTest = /^pdfanchor-test$/i.test(anchorId);
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

    // 收到锚点数据（数组或单条）
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED,
      ({ anchors }) => {
        if (Array.isArray(anchors)) {
          anchors.forEach(a => { if (a?.uuid) {this.#anchorsById.set(String(a.uuid), a);} });
        } else if (anchors && anchors.uuid) {
          this.#anchorsById.set(String(anchors.uuid), anchors);
        }

        // URL 携带 anchor-id 时的处理：无须依赖“激活”属性，作为本次会话的跟踪锚点
        if (this.#pendingUrlAnchorId) {
          const a = this.#anchorsById.get(this.#pendingUrlAnchorId);
          if (a) {
            toastSuccess(`跟踪锚点: ${a.name || a.uuid}`);
            // 记录最近一次位置，延迟到 FILE.LOAD.SUCCESS 后再导航，避免 PDF 未就绪时的无效 GOTO
            const pageAt = parseInt(a.page_at || 1, 10);
            const pos = typeof a.position === "number" ? Math.max(0, Math.min(100, a.position * 100)) : null;
            this.#pendingNav = (pageAt >= 1) ? { pageAt, position: pos } : null;
            // 如果文件已加载完成（缓存命中导致 FILE.LOAD.SUCCESS 已经发射过），立即执行导航；否则短暂轮询等待pagesCount>0
            this.#performPendingNavIfReady();
            this.#ensureNavigateWhenLoaded();
            // 启动后台更新（3秒节拍）
            this.#activeAnchorId = a.uuid;
            this.#startUpdateTimer();
            // URL 启动跟踪时也应启用滚动诊断，以便用户滚动即可回写位置
            try { this.#ensureScrollDiagnostics(); } catch(_) {}
          }
          // 仅处理一次
          this.#pendingUrlAnchorId = null;
        }
      },
      { subscriberId: "PDFAnchorFeature" }
    );

    // 复制锚点ID
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.COPY,
      ({ anchorId }) => this.#copyToClipboard(anchorId),
      { subscriberId: "PDFAnchorFeature" }
    );

    // 在文件加载成功后，请求该PDF的锚点列表（确保重新打开能显示持久化数据）
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
      () => {
        try {
          const params = new URLSearchParams(window.location.search);
          const pdfId = params.get("pdf-id");
          if (pdfId) {
            this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD, { pdf_uuid: pdfId }, { actorId: "PDFAnchorFeature" });
          }
        } catch(e){ this.#logger.warn("noop", e); }
        // 若存在待执行的锚点导航，此时（PDF 加载完成后）再执行，避免初始化期竞态
        try { this.#performPendingNavIfReady(); } catch(_) {}
        // 文件加载完成后安装滚动诊断（如果尚未安装），以便激活锚点后滚动能及时采样
        try { this.#ensureScrollDiagnostics(); } catch(_) {}
      },
      { subscriberId: "PDFAnchorFeature" }
    );

    // 兜底：直接监听 WS 收到的消息（避免适配器初始化竞态导致首次列表错过）
    this.#eventBus.on(
      WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
      (message) => {
        try {
          const type = String(message?.type || "");
          if (type === "anchor:get:completed" || type === "anchor:list:completed") {
            const anchors = message?.data?.anchors || (message?.data?.anchor ? [message.data.anchor] : []);
            this.#logger.info("[anchor] RECEIVED fallback -> emit ANCHOR.DATA.LOADED", { type, count: Array.isArray(anchors) ? anchors.length : 0 });
            this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED, { anchors }, { actorId: "PDFAnchorFeature" });
          }
        } catch(e){ this.#logger.warn("noop", e); }
      },
      { subscriberId: "PDFAnchorFeature" }
    );

    // 创建锚点
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.CREATE,
      (data) => {
        if (data && data.anchor) {return;} // 避免递归
        const { pageAt, position } = this.#getCurrentPageAndPosition();
        const id = this.#makeAnchorId();
        const name = `第${pageAt}页 - ${this.#formatTime(new Date())}`;
        const anchor = { uuid: id, name, page_at: pageAt, position: position / 100, is_active: false };
        this.#anchorsById.set(id, anchor);
        try { toastSuccess(`已创建锚点: ${name}`); } catch(e){ this.#logger.warn("noop", e); }
        this.#emitList();
        // 触发一次包含 anchor 的 CREATE 事件，交由 WebSocketAdapter 持久化
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.CREATE, { anchor }, { actorId: "PDFAnchorFeature" });
      },
      { subscriberId: "PDFAnchorFeature" }
    );

    // 删除锚点
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.DELETE,
      ({ anchorId }) => {
        const id = String(anchorId || "").trim();
        if (!id) {return;}
        const existed = this.#anchorsById.get(id);
        this.#anchorsById.delete(id);
        try { if (existed) {toastSuccess(`已删除锚点: ${existed.name || id}`);} } catch(e){ this.#logger.warn("noop", e); }
        this.#emitList();
      },
      { subscriberId: "PDFAnchorFeature" }
    );

    // 修改锚点名称（简单对话框）
    this.#eventBus.on(
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
    this.#eventBus.on(
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
        try { toastSuccess(nextActive ? `已激活锚点: ${a.name || id}` : `已停用锚点: ${a.name || id}`); } catch(e){ this.#logger.warn("noop", e); }
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

    // 页面导航变更时，若存在已激活的锚点，则立即采样并更新一次（提升滚动时的即时性）
    // 简化模式：不再基于 NAVIGATION.CHANGED 做自动采样
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.CHANGED,
      () => { /* no-op: disable event-driven sampling */ },
      { subscriberId: 'PDFAnchorFeature' }
    );

    // WebSocket 错误提示：锚点域相关错误直接 toast 到前端，便于定位
    this.#eventBus.on(
      WEBSOCKET_MESSAGE_EVENTS.ERROR,
      (err) => {
        try {
          const t = String(err?.received_type || err?.type || "");
          if (t.startsWith('anchor:')) {
            const msg = err?.error?.message || err?.message || '锚点相关操作失败';
            toastError(`[锚点错误] ${msg}`);
          }
        } catch(_) {}
      },
      { subscriberId: 'PDFAnchorFeature' }
    );

    // 页面销毁/关闭时清理
    window.addEventListener("beforeunload", () => this.#stopUpdateTimer());
  }

  // 若 PDF 已加载且存在待导航，则立即执行；否则等待 FILE.LOAD.SUCCESS
  #performPendingNavIfReady() {
    try {
      if (!this.#pendingNav || !this.#navigationService) { return; }
      const pvm = this.#container?.get?.('pdfViewerManager');
      let loaded = !!(pvm && typeof pvm.pagesCount === 'number' && pvm.pagesCount > 0);
      if (!loaded) {
        try {
          const vc = document.getElementById('viewerContainer');
          loaded = !!(vc && vc.querySelector('.page'));
        } catch(_) { /* no-op */ }
      }
      if (!loaded) { return; }
      // 文件已加载，但为确保 PDFViewer 完全初始化，对齐 URL 导航策略：延迟执行导航
      if (this.#navInitDelayTimer) { try { clearTimeout(this.#navInitDelayTimer); } catch(_){} this.#navInitDelayTimer = null; }
      this.#navInitDelayTimer = setTimeout(() => {
        try {
          if (!this.#pendingNav) { return; }
          const { pageAt, position } = this.#pendingNav;
          this.#navigationService.navigateTo({ pageAt, position });
          this.#freezeUntilMs = Date.now() + 3000; // 冻结3秒，避免初始化误采样
          this.#autoUpdateEnabled = false; // 等待用户滚动后再允许回写
          this.#pendingNav = null;
        } catch(_) { /* no-op */ }
        finally {
          if (this.#navInitDelayTimer) { try { clearTimeout(this.#navInitDelayTimer); } catch(_){} this.#navInitDelayTimer = null; }
          if (this.#navReadyRetryTimer) { try { clearInterval(this.#navReadyRetryTimer); } catch(_){} this.#navReadyRetryTimer = null; }
        }
      }, 2500); // 与 URLNavigationFeature 保持一致的初始化等待
    } catch(_) {}
  }

  // 若未加载完成，短时间内轮询等待 pagesCount>0 再执行导航（解决事件先后竞态）
  #ensureNavigateWhenLoaded() {
    try {
      if (!this.#pendingNav || this.#navReadyRetryTimer) { return; }
      const deadline = Date.now() + 3000; // 最多等待3秒
      this.#navReadyRetryTimer = setInterval(() => {
        if (!this.#pendingNav) { clearInterval(this.#navReadyRetryTimer); this.#navReadyRetryTimer = null; return; }
        const pvm = this.#container?.get?.('pdfViewerManager');
        const loaded = !!(pvm && typeof pvm.pagesCount === 'number' && pvm.pagesCount > 0);
        if (loaded) {
          this.#performPendingNavIfReady();
        } else if (Date.now() >= deadline) {
          try { clearInterval(this.#navReadyRetryTimer); } catch(_){}
          this.#navReadyRetryTimer = null;
        }
      }, 100);
    } catch(_) {}
  }

  #ensureScrollDiagnostics() {
    let viewerContainer = null;
    try { viewerContainer = document.getElementById("viewerContainer"); } catch (_) {}

    if (!viewerContainer) {
      if (!this.#scrollHintShown) {
        this.#scrollHintShown = true;
        toastWarning('未找到文档滚动容器，请在文档区域滚动以更新锚点位置');
      }
      return;
    }

    // 在文档区域滚动时，若存在激活锚点，立即采样更新（去抖动）
    let debounceTimer = null;
    const onDocScroll = () => {
      if (!this.#activeAnchorId) return;
      // 用户滚动后允许自动回写（解除 URL 启动保护）
      this.#autoUpdateEnabled = true;
      if (Date.now() < this.#freezeUntilMs) return;
      if (debounceTimer) { clearTimeout(debounceTimer); }
      debounceTimer = setTimeout(() => {
        try { this.#snapshotAndUpdate(this.#activeAnchorId); } catch (e) { this.#logger.warn('snapshot on doc scroll failed', e); }
      }, 120);
    };
    viewerContainer.addEventListener('scroll', onDocScroll, { passive: true });
    this.#scrollListeners.push(() => viewerContainer.removeEventListener('scroll', onDocScroll));

    // 如果用户滚动了窗口而非文档容器，提示一次
    const onWinScroll = () => {
      if (this.#scrollHintShown) return;
      this.#scrollHintShown = true;
      toastWarning('检测到窗口滚动，请在文档区域内滚动以更新锚点位置');
    };
    window.addEventListener('scroll', onWinScroll, { passive: true });
    this.#scrollListeners.push(() => window.removeEventListener('scroll', onWinScroll));
  }

  #removeScrollDiagnostics() {
    try { this.#scrollListeners.forEach(off => { try { off(); } catch(_){} }); } finally { this.#scrollListeners = []; }
  }

  #bootstrapFromURL() {
    const parsed = URLParamsParser.parse();
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

  async #copyToClipboard(anchorId) {
    const id = String(anchorId || "").trim();
    if (!id) {return;}
    try {
      // 先同步尝试 execCommand，保留用户激活上下文
      try {
        const ta = document.createElement('textarea');
        ta.value = String(id);
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.left = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        try { ta.focus(); } catch(_) {}
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) {
          toastSuccess(`已复制锚点ID: ${id}`);
          this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.COPIED, { anchorId: id }, { actorId: "PDFAnchorFeature" });
          return;
        }
      } catch(_) {}

      // Clipboard API
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(id);
          toastSuccess(`已复制锚点ID: ${id}`);
          this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.COPIED, { anchorId: id }, { actorId: "PDFAnchorFeature" });
          return;
        }
      } catch(_) {}

      // QWebChannel（PyQt）
      try {
        const ok = await new Promise((resolve) => {
          try {
            if (typeof qt === 'undefined' || !qt.webChannelTransport) { resolve(false); return; }
            if (typeof QWebChannel === 'undefined') { resolve(false); return; }
            new QWebChannel(qt.webChannelTransport, (channel) => {
              try {
                const bridge = channel?.objects?.pdfViewerBridge;
                if (bridge && typeof bridge.setClipboardText === 'function') {
                  Promise.resolve(bridge.setClipboardText(String(id)))
                    .then((res) => resolve(!!res))
                    .catch(() => resolve(false));
                } else {
                  resolve(false);
                }
              } catch(_) { resolve(false); }
            });
          } catch(_) { resolve(false); }
        });
        if (ok) {
          toastSuccess(`已复制锚点ID: ${id}`);
          this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.COPIED, { anchorId: id }, { actorId: "PDFAnchorFeature" });
          return;
        }
      } catch(_) {}

      // 全部失败
      toastError('复制失败，请手动选择并复制');
    } catch (e) {
      this.#logger.error("复制锚点ID失败", e);
    }
  }

  #startUpdateTimer() {
    // 暂停心跳机制：不再自动更新页码/位置（应用户要求）
    this.#stopUpdateTimer();
    this.#updateTimer = null;
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
