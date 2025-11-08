/**
 * @file PDF Outline 功能域（新大纲，基于第三方树形库展示）
 * @module features/pdf-outline
 */

import { getLogger } from "../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../common/event/event-constants.js";
import OutlineDataManager from "../../outline/outline-manager.js";
import { OutlineDialog } from "../../outline/components/outline-dialog.js";
import { OutlineDataProvider } from "../../outline/outline-data-provider.js";
import { getCurrentPDFDocument } from "../../pdf/current-document-registry.js";

export class OutlineManager {
  #logger;
  #eventBus;
  #container;
  #outlineManager;
  #dialog;
  #outlineDataProvider;
  #wsClient = null;
  #navigationService = null;
  #unsubs = [];
  #enabled = false;
  #pendingNavigateId = null;
  #listReady = false;

  get name() { return "pdf-outline"; }
  get version() { return "1.0.0"; }
  // 与实际已注册的基础Feature对齐：pdf-manager、infra-ui、infra-nav-core
  get dependencies() { return ["pdf-manager", "infra-ui", "infra-nav-core"]; }

  async install(context) {
    this.#logger = context.logger || getLogger("Feature.pdf-outline");
    this.#eventBus = context.scopedEventBus || context.globalEventBus;
    this.#container = context.container;

    // 导航服务（由 CoreNavigationFeature 注册）
    try {
      this.#navigationService = this.#container.get("navigationService");
      if (!this.#navigationService) {
        this.#logger.warn("NavigationService not found in container, outline navigation will not work");
      }
    } catch (e) {
      this.#logger.warn("Failed to resolve navigationService from container", e);
    }

    // 初始化存储管理器（沿用 OutlineDataManager，原 BookmarkManager，保证数据结构一致）
    const wsClient = (typeof this.#container.getWSClient === "function")
      ? this.#container.getWSClient()
      : (this.#container.get?.("wsClient") || null);
    this.#wsClient = wsClient || null;

    // 使用公共域 OutlineManager（事件驱动，无需 wsClient 参数）
    this.#outlineManager = new OutlineDataManager(this.#eventBus, { dataProvider: new OutlineDataProvider() });
    await this.#outlineManager.initialize?.();

    // 原生大纲提供者
    this.#outlineDataProvider = new OutlineDataProvider();

    // 暴露给其他组件（如侧边栏 UI）
    try { this.#container.register("outlineManager", this.#outlineManager); } catch { /* ignore */ }

    // 对话框（复用现有组件）
    this.#dialog = new OutlineDialog();

    // 事件监听
    this.#setupEventListeners();

    // 尝试加载（DB-first），PDF未就绪则等 FILE.LOAD.SUCCESS
    // 为了提升冷启动稳定性，这里设置上限等待时间，避免远端存储超时阻塞应用启动
    try {
      const TIMEBOX_MS = 1500;
      await Promise.race([
        this.#tryInitialLoad(),
        new Promise((resolve) => setTimeout(resolve, TIMEBOX_MS))
      ]);
    } catch (e) {
      this.#logger.warn("Initial outline load skipped due to timeout/error", e);
    }

    this.#enabled = true;
    this.#logger.info("pdf-outline installed");

    // 注册 Outline 侧边栏 UI 到容器（供 SidebarManager 获取）
    try {
      const { OutlineSidebarUI } = await import("./components/outline-sidebar-ui.js");
      const outlineUI = new OutlineSidebarUI(this.#eventBus);
      outlineUI.initialize();
      this.#container.registerGlobal?.("outlineSidebarUI", outlineUI);
      this.#logger.info("outlineSidebarUI registered globally");
    } catch (e) {
      this.#logger.warn("Failed to initialize/register outlineSidebarUI", e);
    }
  }

  /* duplicate method removed */

  async uninstall() {
    this.#unsubs.forEach(u => { try { u(); } catch { /* ignore */ } });
    this.#unsubs = [];
    if (this.#outlineManager) { this.#outlineManager.destroy(); }
    this.#outlineManager = null;
    if (this.#dialog) { try { this.#dialog.close(); } catch { /* ignore */ } this.#dialog = null; }
    this.#enabled = false;
  }

  isEnabled() { return this.#enabled; }

  #getPdfId() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const pdfId = urlParams.get("pdf-id");
      if (pdfId) { return pdfId; }
      const pdfManager = this.#container?.resolve?.("pdfManager");
      if (pdfManager?.currentPdfId) { return pdfManager.currentPdfId; }
      if (window.PDF_PATH) {
        const filename = window.PDF_PATH.split("/").pop().split(".")[0];
        return filename;
      }
      return null;
    } catch (e) {
      this.#logger.warn("getPdfId failed", e);
      return null;
    }
  }

  async #tryInitialLoad() {
    try {
      const pdfDocument = getCurrentPDFDocument();
      // 先尝试读取存储
      await this.#outlineManager.loadFromStorage();
      try { this.#logger.info(`[Outline] 存储加载完成: ${(this.#outlineManager.getAllOutlineItems()||[]).length} 条`, { toast: true }); } catch {}
      // 若当前无大纲且已拿到 pdfDocument，则尝试从 PDF 原生大纲导入
      try {
        const hasAny = (this.#outlineManager.getAllOutlineItems() || []).length > 0;
        if (!hasAny && pdfDocument) {
          try { this.#logger.info("[Outline] 尝试从PDF导入原生大纲…", { toast: true }); } catch {}
          await this.#importNativeOutlineIfEmpty(pdfDocument);
        }
      } catch { /* ignore auto-import errors to keep viewer usable */ }
      // 最终刷新一次列表（无论是否导入）
      this.#refreshList();
      try { this.#logger.info(`[Outline] 列表已刷新: ${(this.#outlineManager.getAllOutlineItems()||[]).length} 条`, { toast: true }); } catch {}
      // 标记列表就绪
      this.#listReady = true;
      // 列表就绪后尝试处理挂起的按ID导航请求
      try { this.#tryPendingNavigate(); } catch {}
    } catch (e) {
      this.#logger.warn("initial load failed", e);
      this.#refreshList();
    }
  }

  #setupEventListeners() {
    const onGlobal = (this.#eventBus.onGlobal || this.#eventBus.on).bind(this.#eventBus);
    // 文件加载后尝试本地加载并刷新
    this.#unsubs.push(onGlobal(
      PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
      async () => {
        try {
          await this.#outlineManager.loadFromStorage();
          await this.#tryInitialLoad();
          this.#refreshList();
          this.#listReady = true;
          this.#tryPendingNavigate();
          // 主动拉取后端真相，消除本地缓存与远端的不一致
          try {
            const pdfId = this.#getPdfId();
            if (this.#wsClient && pdfId) {
              await this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
            }
          } catch (e) { this.#logger.warn("[Outline] initial outline-list request failed", e); }
        } catch (e) {
          this.#logger.warn("[Outline] initial load failed after file load", e);
        }
      },
      { subscriberId: "OutlineFeature" }
    ));

    // WS 建立后再拉取一次
    this.#unsubs.push(onGlobal(
      WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED,
      async () => {
        try {
          await this.#outlineManager.loadFromStorage();
          this.#refreshList();
          // 连接建立后再次以远端为准同步
          try {
            const pdfId = this.#getPdfId();
            if (this.#wsClient && pdfId) {
              await this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
            }
          } catch (e) { this.#logger.warn("[Outline] outline-list on connect failed", e); }
        } catch { /* ignore */ }
      },
      { subscriberId: "OutlineFeature" }
    ));

    // 消费后端返回的 outline 列表，写入 OutlineManager 内存并刷新 UI
    this.#unsubs.push(onGlobal(
      WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
      (message) => {
        try {
          const t = String(message?.type || "");
          if (t === WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED) {
            const items = message?.data?.outline_items || [];
            this.#logger.info(`[Outline] 收到 OUTLINE_LIST_COMPLETED，items=${Array.isArray(items) ? items.length : 0}`);
            await this.#outlineManager.replaceFromRemote(items);
            this.#listReady = true;
            this.#refreshList();
            this.#tryPendingNavigate();
          } else if (t === WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_FAILED) {
            this.#logger.warn("[Outline] OUTLINE_LIST_FAILED", message?.error || message?.data);
          }
        } catch (e) {
          this.#logger.warn("[Outline] handle WS message failed", e);
        }
      },
      { subscriberId: "OutlineFeature" }
    ));

    // 创建/更新/删除/拖拽（使用 OUTLINE 事件名）
    this.#unsubs.push(onGlobal(
      PDF_VIEWER_EVENTS.OUTLINE.CREATE.REQUESTED,
      (data) => this.#handleCreate(data),
      { subscriberId: "OutlineFeature" }
    ));

    this.#unsubs.push(onGlobal(
      PDF_VIEWER_EVENTS.OUTLINE.UPDATE.REQUESTED,
      (data) => this.#handleUpdate(data),
      { subscriberId: "OutlineFeature" }
    ));

    this.#unsubs.push(onGlobal(
      PDF_VIEWER_EVENTS.OUTLINE.DELETE.REQUESTED,
      (data) => this.#handleDelete(data),
      { subscriberId: "OutlineFeature" }
    ));

    this.#unsubs.push(onGlobal(
      PDF_VIEWER_EVENTS.OUTLINE.REORDER.REQUESTED,
      (data) => this.#handleReorder(data),
      { subscriberId: "OutlineFeature" }
    ));

    // 导航请求（与本特性统一的事件契约）
    this.#unsubs.push(onGlobal(
      PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.REQUESTED,
      (data) => this.#handleNavigate(data),
      { subscriberId: "OutlineFeature" }
    ));
    this.#unsubs.push(onGlobal(
      PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE_BY_ID.REQUESTED,
      (data) => {
        this.#logger.info("[Outline] 收到 OUTLINE.NAVIGATE_BY_ID.REQUESTED 事件", data, { toast: { type: "info", ms: 2000 } });
        this.#handleNavigateById(data);
      },
      { subscriberId: "OutlineFeature" }
    ));

    // UI 晚到时的主动拉取
    this.#unsubs.push(onGlobal(
      PDF_VIEWER_EVENTS.OUTLINE.LOAD.REQUESTED,
      () => { try { this.#refreshList(); } catch { /* ignore */ } },
      { subscriberId: "OutlineFeature" }
    ));
  }

  /**
   * 当存储为空时，从 PDF 原生大纲导入并持久化
   * @param {any} pdfDocument - PDF.js 文档对象
   * @returns {Promise<void>}
   * @private
   */
  async #importNativeOutlineIfEmpty(pdfDocument) {
    try {
      const current = this.#outlineManager.getAllOutlineItems() || [];
      if (current.length > 0) {
        return; // 已有大纲，跳过导入
      }
      // 提取 PDF 原生大纲
      const nativeOutline = await this.#outlineDataProvider.getOutline(pdfDocument);
      if (!Array.isArray(nativeOutline) || nativeOutline.length === 0) {
        this.#logger.info("[Outline] No native PDF outlines found; skip import");
        return;
      }
      // 导入并标准化 dest → { pageAt, position }
      const result = await this.#outlineManager.importNativeOutline(
        nativeOutline,
        (native) => this.#parseOutlineNormalizedDest(native, pdfDocument)
      );
      if (result?.success) {
        this.#logger.info(`[Outline] Imported ${result.count} native outlines; reloading from storage...`);
        try { await this.#outlineManager.loadFromStorage(); } catch { /* ignore */ }
        // 将导入的大纲立即持久化到后端 DB，保证后续编辑/重命名/删除能够成功
        try {
          const pdfId = this.#getPdfId();
          if (this.#wsClient && pdfId) {
            const outlineItems = this.#outlineManager.getAllOutlineItems();
            const rootIds = Array.isArray(outlineItems) ? outlineItems.map(n => n.id).filter(Boolean) : [];
            this.#logger.info("[Outline][IMPORT] Persisting imported outlines to backend...", {
              pdf_uuid: pdfId,
              count: outlineItems?.length || 0
            });
            await this.#wsClient.request(
              WEBSOCKET_MESSAGE_TYPES.BOOKMARK_SAVE,
              { pdf_uuid: pdfId, bookmarks: outlineItems, root_ids: rootIds },
              { metadata: { version: "1.0.0" } }
            );
            // 保存成功后，主动拉取一次最新大纲树，确保与 DB 对齐
            await this.#wsClient.request(
              WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST,
              { pdf_uuid: pdfId },
              { metadata: { version: "1.0.0" } }
            );
            this.#logger.info("[Outline][IMPORT] Persist completed and outline tree reloaded");
          } else {
            this.#logger.warn("[Outline][IMPORT] Skip backend persist: wsClient/pdfId not ready");
          }
        } catch (e) {
          this.#logger.warn("[Outline][IMPORT] Persist imported outlines failed", e, { toast: { type: "warn", ms: 3500 } });
        }
      } else {
        this.#logger.warn(`[Outline] Import native outlines failed: ${result?.error || "unknown"}`);
      }
    } catch (e) {
      this.#logger.warn("[Outline] Auto-import native outlines failed", e);
    }
  }

  /**
   * 解析原生书签目的地为统一的 { pageAt, position }
  * 与 Outline 特性的历史解析逻辑保持一致（严格字段与容错策略）。
  * @param {Object} nativeBookmark - 来自 OutlineDataProvider 的原生大纲节点
   * @param {any} pdfDocumentArg - 可选的 PDF.js 文档对象
   * @returns {Promise<{pageAt:number|null, position:number|null}>}
   * @private
   */
  async #parseOutlineNormalizedDest(nativeBookmark, pdfDocumentArg = null) {
    try {
      const dest = nativeBookmark?.dest;
      if (dest === null || dest === undefined) {
        this.#logger.info("[Outline][IMPORT] dest missing; skip", { title: nativeBookmark?.title });
        return { pageAt: null, position: null };
      }
      // 优先使用从事件传入的 pdfDocument，避免并发导致解析失败
      const pdfDocument = pdfDocumentArg || getCurrentPDFDocument();
      if (!pdfDocument) {
        this.#logger.info("[Outline][IMPORT] pdfDocument missing during parse; skip", { title: nativeBookmark?.title });
        return { pageAt: null, position: null };
      }
      // 优先通过 OutlineDataProvider（已持有同一 pdfDocument）解析
      try {
        if (this.#outlineDataProvider && typeof this.#outlineDataProvider.parseDestination === "function") {
          const parsed = await this.#outlineDataProvider.parseDestination(dest);
          const pageAt = parsed?.pageNumber || null;
          let position = null;
          if (pageAt && parsed?.type === "XYZ" && typeof parsed?.y === "number") {
            const { yToPositionPercent } = await import("../../pdf/pdf-dest-utils.js");
            position = await yToPositionPercent(pdfDocument, pageAt, parsed.y);
          }
          try { this.#logger.info(`[Outline][IMPORT] parsed via provider ${JSON.stringify({ title: nativeBookmark?.title, type: parsed?.type ?? null, pageAt, position })}`); } catch {}
          return { pageAt, position };
        }
      } catch (e) {
        try { this.#logger.info("[Outline][IMPORT] provider.parseDestination failed; fallback", { title: nativeBookmark?.title, err: e?.message }); } catch {}
      }
      const { resolvePdfDest, yToPositionPercent } = await import("../../pdf/pdf-dest-utils.js");
      const resolved = await resolvePdfDest(pdfDocument, dest);
      const pageAt = resolved?.pageNumber || null;
      let position = null;
      if (pageAt && resolved?.type === "XYZ" && typeof resolved?.y === "number") {
        position = await yToPositionPercent(pdfDocument, pageAt, resolved.y);
      }
      try { this.#logger.info(`[Outline][IMPORT] parsed via resolvePdfDest ${JSON.stringify({ title: nativeBookmark?.title, type: resolved?.type ?? null, pageAt, position })}`); } catch {}
      return { pageAt, position };
    } catch (e) {
      try { this.#logger.warn(`[Outline][IMPORT] parse normalized dest failed ${JSON.stringify({ title: nativeBookmark?.title, error: e?.message })}`); } catch {}
      return { pageAt: null, position: null };
    }
  }

  #refreshList() {
    const outlineItems = this.#outlineManager.getAllOutlineItems();
    const emitGlobal = (this.#eventBus.emitGlobal || this.#eventBus.emit).bind(this.#eventBus);
    emitGlobal(
      PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS,
      { outlineItems, count: this.#count(outlineItems), source: "pdf-outline" },
      { actorId: "OutlineManager" }
    );
  }

  async #handleNavigate({ outlineItem }) {
    try {
      if (!outlineItem) {
        this.#logger.warn("Outline navigate request missing outline item");
        return;
      }
      if (!this.#navigationService) {
        this.#logger.error("NavigationService not available for outline");
      (this.#eventBus.emitGlobal || this.#eventBus.emit).call(this.#eventBus, PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.FAILED, { error: "nav-unavailable" }, { actorId: "OutlineManager" });
        return;
      }
      const pageAt = (typeof outlineItem?.pageAt === "number" && outlineItem.pageAt > 0) ? outlineItem.pageAt : null;
      if (!pageAt) {
        this.#logger.warn("Outline item missing pageAt");
      (this.#eventBus.emitGlobal || this.#eventBus.emit).call(this.#eventBus, PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.FAILED, { error: "invalid-destination" }, { actorId: "OutlineManager" });
        return;
      }
      const position = (typeof outlineItem?.position === "number") ? outlineItem.position : null;
      const result = await this.#navigationService.navigateTo({ pageAt, position });
      if (result?.success) {
        (this.#eventBus.emitGlobal || this.#eventBus.emit).call(this.#eventBus, PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.SUCCESS, { pageNumber: result.actualPage, position: result.actualPosition }, { actorId: "OutlineManager" });
      } else {
        (this.#eventBus.emitGlobal || this.#eventBus.emit).call(this.#eventBus, PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.FAILED, { error: result?.error || "unknown" }, { actorId: "OutlineManager" });
      }
    } catch (e) {
      this.#logger.warn("Outline navigate failed", e);
      (this.#eventBus.emitGlobal || this.#eventBus.emit).call(this.#eventBus, PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.FAILED, { error: e?.message || "exception" }, { actorId: "OutlineManager" });
    }
  }

  async #handleNavigateById({ outlineItemId }) {
    try {
      this.#logger.info("[Outline] 开始处理按ID导航请求", {
        outlineItemId: outlineItemId,
        listReady: this.#listReady
      }, { toast: { type: "info", ms: 2000 } });
      const targetId = (outlineItemId || "").trim();
      this.#logger.info("[Outline] 提取的目标ID", {
        targetId: targetId,
        targetIdLength: targetId.length,
        targetIdType: typeof targetId
      }, { toast: { type: "info", ms: 2000 } });
      if (!targetId) {
        this.#logger.warn("[Outline] 导航请求缺少ID", { receivedData: { outlineItemId } }, { toast: { type: "error", ms: 3000 } });
        return;
      }
      const item = this.#outlineManager.getOutlineItem(targetId);
      this.#logger.info("[Outline] 查找大纲项结果", {
        targetId: targetId,
        outlineItemFound: !!item,
        outlineItem: item,
        listReady: this.#listReady,
        allOutlineItemsCount: this.#outlineManager.getAllOutlineItems().length
      }, { toast: { type: "info", ms: 2000 } });
      if (!item) {
        // 未找到：若列表尚未就绪，则暂存等待；若已就绪，则直接给出 toast 提示
        if (!this.#listReady) {
          this.#pendingNavigateId = targetId;
          this.#logger.info(`[Outline] 记录挂起的按ID导航请求: ${targetId}`, { toast: { type: "info", ms: 2000 } });
        } else {
          this.#logger.error(`[Outline] 大纲项不存在或未加载：${targetId}`, { toast: { type: "error", ms: 4500 } });
          (this.#eventBus.emitGlobal || this.#eventBus.emit).call(this.#eventBus, PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.FAILED, { error: "not_found", id: targetId }, { actorId: "OutlineManager" });
        }
        return;
      }
      this.#logger.info("[Outline] 找到大纲项，准备导航", { outlineItem: item }, { toast: { type: "info", ms: 2000 } });
      await this.#handleNavigate({ outlineItem: item });
      this.#logger.info("[Outline] 导航完成", { outlineItemId: item.id }, { toast: { type: "success", ms: 2000 } });
    } catch (e) {
      this.#logger.warn("Outline navigate-by-id failed", e, { toast: { type: "error", ms: 3000 } });
      (this.#eventBus.emitGlobal || this.#eventBus.emit).call(this.#eventBus, PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.FAILED, { error: e?.message || "exception" }, { actorId: "OutlineManager" });
    }
  }

  #tryPendingNavigate() {
    try {
      const id = this.#pendingNavigateId;
      if (!id) {return;}
      const item = this.#outlineManager.getOutlineItem(id);
      if (!item) {
        // 列表已就绪但仍未找到 → 提示不存在
        if (this.#listReady) {
          this.#logger.error(`[Outline] 大纲项不存在或未加载：${id}`, { toast: { type: "error", ms: 4500 } });
          (this.#eventBus.emitGlobal || this.#eventBus.emit).call(this.#eventBus, PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.FAILED, { error: "not_found", id }, { actorId: "OutlineManager" });
          this.#pendingNavigateId = null;
        }
        return;
      }
      this.#pendingNavigateId = null;
      this.#logger.info(`[Outline] 处理挂起的按ID导航: ${id}`);
      this.#handleNavigate({ outlineItem: item });
    } catch { /* ignore */ }
  }

  #count(nodes) {
    if (!Array.isArray(nodes)) { return 0; }
    let total = 0;
    const walk = (arr) => { arr.forEach(n => { total += 1; if (n.children?.length) { walk(n.children); } }); };
    walk(nodes);
    return total;
  }

  #getCurrentPage() {
    try {
      const pdfViewerManager = this.#container?.resolve?.("pdfViewerManager");
      if (pdfViewerManager?.currentPageNumber) { return pdfViewerManager.currentPageNumber; }
      return 1;
    } catch { /* ignore */ return 1; }
  }

  // 已移除：#getCurrentScrollPercent 未使用

  #handleCreate() {
    const currentPage = this.#getCurrentPage();
    this.#dialog.showAdd({
      currentPage,
      onConfirm: async (data) => {
        // 统一模型：pageAt + position（百分比或 null）→ 后端优先
        const pdfId = this.#getPdfId();
        const name = String(data.name || "").trim();
        const pageAt = Number.isInteger(data.pageAt) && data.pageAt > 0 ? data.pageAt : currentPage;
        const position = (typeof data.position === "number" && isFinite(data.position))
          ? Math.max(0, Math.min(100, Math.round(data.position)))
          : null;
        if (!this.#wsClient || !pdfId || !name || !pageAt) {
          this.#logger.warn("[Outline] create aborted: missing wsClient/pdfId/name/pageAt");
          return;
        }
        try {
          this.#logger.info("[Outline] create → WS request", { pdf_uuid: pdfId, name, page_at: pageAt, position });
          await this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_CREATE, { pdf_uuid: pdfId, name, page_at: pageAt, position }, { metadata: { version: "1.0.0" } });
          // 主动拉取最新列表
          await this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
        } catch (e) {
          this.#logger.warn("[Outline] create ws request failed", e);
        }
      },
      onCancel: () => {}
    });
  }

  #handleUpdate({ outlineItemId }) {
    const item = this.#outlineManager.getOutlineItem(outlineItemId);
    if (!item) { return; }
    this.#dialog.showEdit({
      outlineItem: item,
      onConfirm: async (updates) => {
        const pdfId = this.#getPdfId();
        if (!this.#wsClient || !pdfId) { this.#logger.warn("[Outline] update aborted: missing wsClient/pdfId"); return; }
        const update = {};
        if (typeof updates?.name === "string") { update.name = updates.name.trim(); }
        if (Number.isInteger(updates?.pageAt) && updates.pageAt > 0) { update.page_at = updates.pageAt; }
        if (updates?.position === null || typeof updates?.position === "number") {
          update.position = (updates.position === null) ? null : Math.max(0, Math.min(100, Math.round(updates.position)));
        }
        try {
          await this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_UPDATE, { outline_id: outlineItemId, update }, { metadata: { version: "1.0.0" } });
          await this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
        } catch (e) { this.#logger.warn("[Outline] update ws request failed", e); }
      }
    });
  }

  async #handleDelete({ outlineItemId }) {
    const item = this.#outlineManager.getOutlineItem(outlineItemId);
    const childCount = item?.children?.length || 0;
    this.#dialog.showDelete({
      outlineItem: item,
      childCount,
      onConfirm: async (cascade) => {
        const pdfId = this.#getPdfId();
        if (!this.#wsClient || !pdfId) { this.#logger.warn("[Outline] delete aborted: missing wsClient/pdfId"); return; }
        try {
          await this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_DELETE, { outline_id: outlineItemId, cascade: cascade !== false }, { metadata: { version: "1.0.0" } });
          await this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
        } catch (e) { this.#logger.warn("[Outline] delete ws request failed", e); }
      }
    });
  }

  async #handleReorder(data) {
    const { outlineItemId, newParentId, newIndex } = data;
    const pdfId = this.#getPdfId();
    if (!this.#wsClient || !pdfId) { this.#logger.warn("[Outline] reorder aborted: missing wsClient/pdfId"); return; }
    try {
      await this.#wsClient.request(
        WEBSOCKET_MESSAGE_TYPES.OUTLINE_REORDER,
        { outline_id: outlineItemId, new_parent_id: newParentId || null, new_index: Number(newIndex) || 0 },
        { metadata: { version: "1.0.0" } }
      );
      await this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
    } catch (e) { this.#logger.warn("[Outline] reorder ws request failed", e); }
  }
}

export default OutlineManager;

