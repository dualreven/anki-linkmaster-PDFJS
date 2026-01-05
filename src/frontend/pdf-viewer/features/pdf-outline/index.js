/**
 * PDF Outline（主文件为装配/委托层；详见 `docs/standards/pdf-outline-feature.md`）
 */

import { getLogger } from "../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../common/event/event-constants.js";
import { OutlineManager } from "./services/outline.manager.js"; // New Manager
import { OutlineDialog } from "../../outline/components/outline-dialog.js";
import { OutlineDataProvider } from "../../outline/outline-data-provider.js";
import { createSubscriptionBag } from "../../../common/event/subscription-bag.js";
import { getCurrentPdfIdFromWindow } from "../../shared/url-context.js";
import { flattenOutlineTreeForBulkSave } from "./outline-bulk-save-flattener.js";
import { parseOutlineNormalizedDest as parseOutlineNormalizedDestImpl } from "./outline-native-dest-parser.js";
import { runOutlineInitialLoadFlowAfterFile } from "./outline-initial-load-flow.js";
import { handleOutlineNavigateById, tryOutlinePendingNavigate } from "./outline-navigate-by-id.js";
import { handleOutlineCreate, handleOutlineUpdate, handleOutlineDelete, handleOutlineReorder } from "./outline-crud-handlers.js";

export class OutlineFeature {
  #logger;
  #eventBus;
  #container;
  #outlineManager;
  #dialog;
  #outlineDataProvider;
  #wsClient = null;
  #navigationService = null;
  #subscriptions = createSubscriptionBag({ loggerName: "Feature.pdf-outline" });
  #enabled = false;
  #pendingNavigateId = null;
  #listReady = false;

  get name() { return "pdf-outline"; }
  get version() { return "1.0.0"; }
  // 与实际已注册的基础Feature对齐：pdf-manager、infra-ui、infra-nav-core
  get dependencies() { return ["pdf-manager", "infra-ui", "infra-nav-core"]; }

  async install(context) {
    this.#logger = context.logger || getLogger("Feature.pdf-outline");
    // 严格：必须提供 scopedEventBus，禁止回退
    if (!context.scopedEventBus) {
      throw new Error("[Feature.pdf-outline] scopedEventBus is required (no fallback).");
    }
    this.#eventBus = context.scopedEventBus;
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

    // 初始化存储管理器
    const wsClient = (typeof this.#container.getWSClient === "function")
      ? this.#container.getWSClient()
      : (this.#container.get?.("wsClient") || null);
    this.#wsClient = wsClient || null;

    // 原生大纲提供者
    this.#outlineDataProvider = new OutlineDataProvider();

    // 使用新的 Observable OutlineManager
    this.#outlineManager = new OutlineManager(this.#logger, this.#outlineDataProvider);
    // No initialize method needed for new manager

    // 暴露给其他组件（如侧边栏 UI）
    try { this.#container.register("outlineManager", this.#outlineManager); } catch (e) { void e; /* logger-guard */ }

    // 对话框（复用现有组件）
    this.#dialog = new OutlineDialog();

    // 事件监听
    this.#setupEventListeners();

    // 取消超时等待逻辑：改为“PDF 文件加载成功后再请求数据库大纲（事件驱动，无超时）”
    try {
      const unsub = this.#eventBus.onGlobal(
        PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
        async (data) => {
          try { unsub?.(); } catch (e) { void e; /* logger-guard */ }
          this.#logger.info("[Outline][init] FILE.LOAD.SUCCESS captured → start initial outline flow");
          await this.#runInitialLoadFlowAfterFile({ pdfDocument: data?.pdfDocument || null });
        },
        { subscriberId: "OutlineFeature.init" }
      );
    } catch (e) { this.#logger.warn("[Outline] failed to attach FILE.LOAD.SUCCESS hook", e); }

    this.#enabled = true;
    this.#logger.info("pdf-outline installed");

    // 注册 Outline 侧边栏 UI 到容器（供 SidebarManager 获取）
    try {
      if (typeof window !== "undefined" && window.__DISABLE_OUTLINE_UI === true) {
        this.#logger.info("[Outline] UI disabled by __DISABLE_OUTLINE_UI flag (test environment)");
      } else {
        const { OutlineSidebarUI } = await import("./components/outline-sidebar-ui.js");
        // Inject Manager instead of just EventBus
        const outlineUI = new OutlineSidebarUI(this.#eventBus, this.#outlineManager);
        outlineUI.initialize();
        this.#container.registerGlobal?.("outlineSidebarUI", outlineUI);
        this.#logger.info("outlineSidebarUI registered globally");
      }
    } catch (e) {
      this.#logger.warn("Failed to initialize/register outlineSidebarUI", e);
    }
  }

  /**
   * 使用 bulk-save 一次性发送扁平化大纲列表
   * @param {string} pdfId
   * @param {Array<{id,name,pageAt,position,children?:any[]}>} items
   */
  async #persistOutlineTreeViaBulk(pdfId, items) {
    const genId = () => {
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
      let s = "outlineItem-";
      for (let i = 0; i < 8; i++) { s += alphabet[Math.floor(Math.random() * alphabet.length)]; }
      return s;
    };
    const flat = flattenOutlineTreeForBulkSave(items || [], { generateOutlineId: genId });
    await this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_BULK_SAVE, { pdf_uuid: pdfId, items: flat }, { metadata: { version: "1.0.0" } });
  }

  async uninstall() {
    this.#subscriptions.clear();
    if (this.#outlineManager) { this.#outlineManager.destroy(); }
    this.#outlineManager = null;
    if (this.#dialog) {
      try {
        this.#dialog.close();
      } catch (e) {
        void e; /* logger-guard */
      }
      this.#dialog = null;
    }
    this.#enabled = false;
  }

  isEnabled() { return this.#enabled; }

  #getPdfId() {
    try {
      const pdfId = getCurrentPdfIdFromWindow();
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

  #setupEventListeners() {
    const onGlobal = this.#eventBus.onGlobal.bind(this.#eventBus);
    // 消费后端返回的 outline 列表（非初始化阶段的普通刷新）
    this.#subscriptions.add(onGlobal(
      WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
      async (message) => {
        try {
          const t = String(message?.type || "");
          if (t === WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED) {
            // 初始化期间：仅在最终“数组回执”时渲染一次，避免空态/临时ID提前渲染
            if (this.#initialLoadStarted && !this.#listReady) {
              const items0 = message?.data?.outline_items;
              if (Array.isArray(items0)) {
                await this.#outlineManager.replaceItems(items0); // Use replaceItems
                this.#listReady = true;
                // 不主动 refresh；依赖 WebSocketAdapter 的桥接已发出一次 SUCCESS，避免重复
                this.#tryPendingNavigate();
                return;
              }
              return;
            }
            const items = message?.data?.outline_items || [];
            const count = Array.isArray(items) ? items.length : 0;
            // 空列表时不触发刷新（遵循“只渲染一次最终态”）
            if (count === 0) { return; }
            // 非初始化场景：正常刷新（toast 仅在有数据时传入，避免传 undefined 违反 lint 规则）
            if (this.#initializing) { return; }
            // 非初始化场景：正常刷新（toast 仅在有数据时传入，避免传 undefined 违反 lint 规则）
            if (count > 0) {
              this.#logger.info(`[Outline] 收到 OUTLINE_LIST_COMPLETED，items=${count}`, { toast: { type: "success", ms: 2500 } });
            } else {
              this.#logger.info(`[Outline] 收到 OUTLINE_LIST_COMPLETED，items=${count}`);
            }
            await this.#outlineManager.replaceItems(items); // Use replaceItems
            this.#listReady = true;
            this.#refreshList("backend");
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
    this.#subscriptions.add(onGlobal(
      PDF_VIEWER_EVENTS.OUTLINE.CREATE.REQUESTED,
      (data) => this.#handleCreate(data),
      { subscriberId: "OutlineFeature" }
    ));

    this.#subscriptions.add(onGlobal(
      PDF_VIEWER_EVENTS.OUTLINE.UPDATE.REQUESTED,
      (data) => this.#handleUpdate(data),
      { subscriberId: "OutlineFeature" }
    ));

    this.#subscriptions.add(onGlobal(
      PDF_VIEWER_EVENTS.OUTLINE.DELETE.REQUESTED,
      (data) => this.#handleDelete(data),
      { subscriberId: "OutlineFeature" }
    ));

    this.#subscriptions.add(onGlobal(
      PDF_VIEWER_EVENTS.OUTLINE.REORDER.REQUESTED,
      (data) => this.#handleReorder(data),
      { subscriberId: "OutlineFeature" }
    ));

    // 导航请求（与本特性统一的事件契约）
    this.#subscriptions.add(onGlobal(
      PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.REQUESTED,
      (data) => this.#handleNavigate(data),
      { subscriberId: "OutlineFeature" }
    ));
    this.#subscriptions.add(onGlobal(
      PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE_BY_ID.REQUESTED,
      (data, metadata) => {
        this.#logger.info("[Outline] 收到 OUTLINE.NAVIGATE_BY_ID.REQUESTED 事件", {
          payload: data,
          actorId: metadata?.actorId || null
        }, { toast: { type: "info", ms: 2000 } });
        this.#handleNavigateById(data, metadata);
      },
      { subscriberId: "OutlineFeature" }
    ));

    // UI 晚到时的主动拉取
    this.#subscriptions.add(onGlobal(
      PDF_VIEWER_EVENTS.OUTLINE.LOAD.REQUESTED,
      () => {
        try {
          if (this.#listReady) { this.#refreshList("backend"); }
          else { this.#logger.info("[Outline] LOAD.REQUESTED ignored until backend list ready"); }
        } catch (e) { void e; /* logger-guard */ }
      },
      { subscriberId: "OutlineFeature" }
    ));
  }

  /**
   * 当后端为空时，从 PDF 原生大纲导入并持久化
   * @param {any} pdfDocument - PDF.js 文档对象
   * @returns {Promise<void>}
   * @private
   */
  async #importNativeOutlineIfEmpty(pdfDocument) {
    try {
      // 提取 PDF 原生大纲
      const nativeOutline = await this.#outlineDataProvider.getOutline(pdfDocument);
      if (!Array.isArray(nativeOutline) || nativeOutline.length === 0) {
        this.#logger.info("[Outline] No native PDF outlines found; skip import");
        return;
      }
      this.#logger.info(`[Outline] Native PDF outline extracted: rootCount=${nativeOutline.length}`);
      // 导入并标准化 dest → { pageAt, position }
      const result = await this.#outlineManager.importNativeOutline(
        nativeOutline,
        (native) => this.#parseOutlineNormalizedDest(native, pdfDocument)
      );
      if (result?.success) {
        this.#logger.info(`[Outline] Imported ${result.count} native outlines; persisting to backend...`);
        // 将导入的大纲立即持久化到后端 DB，保证后续编辑/重命名/删除能够成功
        try {
          const pdfId = this.#getPdfId();
          if (this.#wsClient && pdfId) {
            const outlineItems = this.#outlineManager.getAllItems() || []; // Use getAllItems
            this.#logger.info("[Outline][IMPORT] Persisting imported outlines via bulk-save...", {
              pdf_uuid: pdfId,
              count: outlineItems.length
            });
            await this.#persistOutlineTreeViaBulk(pdfId, outlineItems);
            this.#logger.info("[Outline][IMPORT] Persist completed");
          } else {
            this.#logger.error("[Outline][IMPORT] wsClient/pdfId not ready — aborting persist", { toast: { type: "error", ms: 4500 } });
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
    return parseOutlineNormalizedDestImpl({
      logger: this.#logger,
      outlineDataProvider: this.#outlineDataProvider,
      nativeBookmark,
      pdfDocumentArg
    });
  }

  #refreshList(source = "backend") {
    const outlineItems = this.#outlineManager.getAllItems(); // Use getAllItems
    this.#eventBus.emitGlobal(
      PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS,
      { outlineItems, count: this.#count(outlineItems), source },
      { actorId: "OutlineManager" }
    );
  }

  async #handleNavigate({ outlineItem }) {
    try {
      if (!outlineItem) {
        this.#logger.warn("Outline navigate request missing outline item");
        return;
      }
      const pageAt = (typeof outlineItem?.pageAt === "number" && outlineItem.pageAt > 0) ? outlineItem.pageAt : null;
      if (!pageAt) {
        this.#logger.warn("Outline item missing pageAt");
        this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.FAILED, { error: "invalid-destination" }, { actorId: "OutlineManager" });
        return;
      }
      const position = (typeof outlineItem?.position === "number") ? outlineItem.position : null;
      // 直接使用核心导航服务执行跳转，不再经由 URL 导航模块
      if (!this.#navigationService) {
        this.#logger.warn("[Outline] navigationService 未就绪，无法执行导航");
        this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.FAILED, { error: "navigation-service-missing" }, { actorId: "OutlineManager" });
        return;
      }
      await this.#navigationService.navigateTo({ pageAt, position });
    } catch (e) {
      this.#logger.warn("Outline navigate failed", e);
      this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.FAILED, { error: e?.message || "exception" }, { actorId: "OutlineManager" });
    }
  }

  // ========== 新实现：基于事件的一次性初始加载（无超时） ==========
  #initializing = false;
  #initialLoadStarted = false;

  async #runInitialLoadFlowAfterFile({ pdfDocument } = {}) {
    if (this.#initialLoadStarted) { return; }
    this.#initialLoadStarted = true;
    this.#initializing = true;
    try {
      await runOutlineInitialLoadFlowAfterFile({
        logger: this.#logger,
        eventBus: this.#eventBus,
        wsClient: this.#wsClient,
        getPdfId: () => this.#getPdfId(),
        outlineManager: this.#outlineManager,
        setListReady: (v) => { this.#listReady = Boolean(v); },
        refreshList: (source) => this.#refreshList(source),
        tryPendingNavigate: () => this.#tryPendingNavigate(),
        importNativeOutlineIfEmpty: (pdfDoc) => this.#importNativeOutlineIfEmpty(pdfDoc),
        pdfDocument
      });
    } catch (e) {
      this.#logger.warn("[Outline][init] initial load flow failed", e);
      this.#listReady = true;
      this.#refreshList("backend");
    } finally {
      this.#initializing = false;
    }
  }

  async #handleNavigateById({ outlineItemId }, metadata = {}) {
    try {
      await handleOutlineNavigateById({
        logger: this.#logger,
        eventBus: this.#eventBus,
        outlineManager: this.#outlineManager,
        outlineItemId,
        metadata,
        listReady: this.#listReady,
        setPendingNavigateId: (id) => { this.#pendingNavigateId = id; },
        navigateToOutlineItem: async (outlineItem) => this.#handleNavigate({ outlineItem })
      });
    } catch (e) {
      this.#logger.warn("Outline navigate-by-id failed", e, { toast: { type: "error", ms: 3000 } });
      this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.FAILED, { error: e?.message || "exception" }, { actorId: "OutlineManager" });
    }
  }

  #tryPendingNavigate() {
    tryOutlinePendingNavigate({
      logger: this.#logger,
      eventBus: this.#eventBus,
      outlineManager: this.#outlineManager,
      listReady: this.#listReady,
      pendingNavigateId: this.#pendingNavigateId,
      clearPendingNavigateId: () => { this.#pendingNavigateId = null; },
      navigateToOutlineItem: (outlineItem) => { this.#handleNavigate({ outlineItem }); }
    });
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
    } catch (e) { void e; /* logger-guard */ return 1; }
  }

  #handleCreate() {
    handleOutlineCreate({
      logger: this.#logger,
      dialog: this.#dialog,
      wsClient: this.#wsClient,
      getPdfId: () => this.#getPdfId(),
      getCurrentPage: () => this.#getCurrentPage()
    });
  }

  #handleUpdate({ outlineItemId, update: directUpdate }) {
    handleOutlineUpdate({
      logger: this.#logger,
      dialog: this.#dialog,
      wsClient: this.#wsClient,
      getPdfId: () => this.#getPdfId(),
      outlineManager: this.#outlineManager,
      outlineItemId,
      directUpdate
    });
  }

  async #handleDelete({ outlineItemId, cascade: directCascade }) {
    await handleOutlineDelete({
      logger: this.#logger,
      dialog: this.#dialog,
      wsClient: this.#wsClient,
      getPdfId: () => this.#getPdfId(),
      outlineManager: this.#outlineManager,
      outlineItemId,
      directCascade
    });
  }

  async #handleReorder(data) {
    await handleOutlineReorder({
      logger: this.#logger,
      wsClient: this.#wsClient,
      getPdfId: () => this.#getPdfId(),
      outlineItemId: data?.outlineItemId,
      newParentId: data?.newParentId,
      newIndex: data?.newIndex
    });
  }
}

export default OutlineFeature;
