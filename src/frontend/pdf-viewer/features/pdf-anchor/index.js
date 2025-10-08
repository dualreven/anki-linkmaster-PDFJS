/**
 * PDF Anchor Feature
 * @module PDFAnchorFeature
 * @description 负责锚点的复制、激活与运行时位置追踪；支持从URL参数(anchor-id)启动时的导航与提示
 */

import { getLogger } from "../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_EVENTS } from "../../../common/event/event-constants.js";
import { success as toastSuccess, warning as toastWarning } from "../../../common/utils/thirdparty-toast.js";
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
    // 安装时主动检查 URL（避免错过 URL_PARAMS.PARSED 早期事件）
    try {
      this.#bootstrapFromURL();
    } catch(e){ this.#logger.warn("noop", e); }
    this.#logger.info("PDFAnchorFeature installed");
  }

  async uninstall() {
    this.#stopUpdateTimer();
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

        // URL 携带 anchor-id 时的处理：如果记录标记为激活，则提示并导航
        if (this.#pendingUrlAnchorId) {
          const a = this.#anchorsById.get(this.#pendingUrlAnchorId);
          if (a && a.is_active) {
            toastSuccess(`激活锚点, ${a.name || a.uuid}`);
            // 导航到最近一次记录的位置
            const pageAt = parseInt(a.page_at || 1, 10);
            const pos = typeof a.position === "number" ? Math.max(0, Math.min(100, a.position * 100)) : null;
            if (this.#navigationService && pageAt >= 1) {
              this.#navigationService.navigateTo({ pageAt, position: pos });
            }
            // 启动后台更新（3秒节拍）
            this.#activeAnchorId = a.uuid;
            this.#startUpdateTimer();
          } else if (a) {
            toastWarning(`锚点未激活: ${a.name || a.uuid}`);
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

    // 激活锚点
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.ACTIVATE,
      ({ anchorId, active = true }) => {
        const id = String(anchorId || "").trim();
        if (!id) {return;}
        this.#activeAnchorId = id;
        const a = this.#anchorsById.get(id) || { uuid: id };
        a.is_active = !!active;
        this.#anchorsById.set(id, a);
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.ACTIVATED, { anchorId: id, active: a.is_active }, { actorId: "PDFAnchorFeature" });
        try { toastSuccess(a.is_active ? `已激活锚点: ${a.name || id}` : `已停用锚点: ${a.name || id}`); } catch(e){ this.#logger.warn("noop", e); }
        // 立即记录一次当前位置
        this.#snapshotAndUpdate(id);
        // 启动周期更新
        this.#startUpdateTimer();
      },
      { subscriberId: "PDFAnchorFeature" }
    );

    // 页面销毁/关闭时清理
    window.addEventListener("beforeunload", () => this.#stopUpdateTimer());
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
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(id);
      } else {
        const ta = document.createElement("textarea");
        ta.value = id;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      toastSuccess(`已复制锚点ID: ${id}`);
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.COPIED, { anchorId: id }, { actorId: "PDFAnchorFeature" });
    } catch (e) {
      this.#logger.error("复制锚点ID失败", e);
    }
  }

  #startUpdateTimer() {
    this.#stopUpdateTimer();
    if (!this.#activeAnchorId) {return;}
    this.#updateTimer = setInterval(() => {
      this.#snapshotAndUpdate(this.#activeAnchorId);
    }, 3000);
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
