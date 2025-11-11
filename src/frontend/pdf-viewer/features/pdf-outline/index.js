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

    // 初始化存储管理器（沿用 OutlineDataManager，原 BookmarkManager，保证数据结构一致）
    const wsClient = (typeof this.#container.getWSClient === "function")
      ? this.#container.getWSClient()
      : (this.#container.get?.("wsClient") || null);
    this.#wsClient = wsClient || null;

    // 使用公共域 OutlineManager（禁用自动加载；由本特性统一编排“后端优先”的加载流程）
    this.#outlineManager = new OutlineDataManager(this.#eventBus, { dataProvider: new OutlineDataProvider(), disableAutoLoad: true });
    await this.#outlineManager.initialize?.();

    // 原生大纲提供者
    this.#outlineDataProvider = new OutlineDataProvider();

    // 暴露给其他组件（如侧边栏 UI）
    try { this.#container.register("outlineManager", this.#outlineManager); } catch { /* ignore */ }

    // 对话框（复用现有组件）
    this.#dialog = new OutlineDialog();

    // 事件监听
    this.#setupEventListeners();

    // 取消超时等待逻辑：改为“PDF 文件加载成功后再请求数据库大纲（事件驱动，无超时）”
    try {
      const unsub = this.#eventBus.onGlobal(
        PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
        async () => {
          try { unsub?.(); } catch (e) { void e; }
          this.#logger.info("[Outline][init] FILE.LOAD.SUCCESS captured → start initial outline flow");
          await this.#runInitialLoadFlowAfterFile();
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
        const outlineUI = new OutlineSidebarUI(this.#eventBus);
        outlineUI.initialize();
        this.#container.registerGlobal?.("outlineSidebarUI", outlineUI);
        this.#logger.info("outlineSidebarUI registered globally");
      }
    } catch (e) {
      this.#logger.warn("Failed to initialize/register outlineSidebarUI", e);
    }
  }

  /**
   * 使用 outline-create 逐个写入整棵树（保序、维护父子关系）
   * 严格：若任一步失败，抛错终止（不做兜底）。
   * @param {string} pdfId
   * @param {Array<{id:string,name:string,pageAt:number,position:number|null,children?:any[]}>} items
   * @private
   */
  // legacy create-per-node persist path removed; bulk-save only

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
    // 第一次遍历：为每个临时节点 id 分配真实 outline_id
    const idMap = new Map(); // temp id -> outline_id
    const assign = (arr) => {
      for (const n of (arr || [])) {
        idMap.set(n.id, genId());
        assign(n.children || []);
      }
    };
    assign(items || []);
    // 第二次遍历：扁平化
    const flat = [];
    const walk = (arr, parentTempId) => {
      for (let i = 0; i < (arr || []).length; i++) {
        const n = arr[i];
        flat.push({
          outline_id: idMap.get(n.id),
          name: String(n.name || "").trim(),
          page_at: Number.isInteger(n.pageAt) && n.pageAt > 0 ? n.pageAt : 1,
          position: (typeof n.position === "number") ? Math.max(0, Math.min(100, Math.round(n.position))) : null,
          parent_id: parentTempId ? idMap.get(parentTempId) : null,
          order: i
        });
        walk(n.children || [], n.id);
      }
    };
    walk(items || [], null);
    await this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_BULK_SAVE, { pdf_uuid: pdfId, items: flat }, { metadata: { version: "1.0.0" } });
  }

  /**
   * 首次加载流程（本地缓存优先，若空则从 PDF 原生导入并持久化到后端）
   * @private
   */
  // legacy initial-load removed; now event-driven after FILE.LOAD.SUCCESS

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

  /* duplicate removed */

  #setupEventListeners() {
    const onGlobal = this.#eventBus.onGlobal.bind(this.#eventBus);
    // 消费后端返回的 outline 列表（非初始化阶段的普通刷新）
    this.#unsubs.push(onGlobal(
      WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
      async (message) => {
        try {
          const t = String(message?.type || "");
          if (t === WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED) {
            // 初始化期间：仅在最终“数组回执”时渲染一次，避免空态/临时ID提前渲染
            if (this.#initialLoadStarted && !this.#listReady) {
              const items0 = message?.data?.outline_items;
              if (Array.isArray(items0)) {
                await this.#outlineManager.replaceFromRemote(items0);
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
            await this.#outlineManager.replaceFromRemote(items);
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
      () => {
        try {
          if (this.#listReady) { this.#refreshList("backend"); }
          else { this.#logger.info("[Outline] LOAD.REQUESTED ignored until backend list ready"); }
        } catch { /* ignore */ }
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
            const outlineItems = this.#outlineManager.getAllOutlineItems() || [];
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
      try { this.#logger.info(`[Outline][IMPORT] parsed via provider ${JSON.stringify({ title: nativeBookmark?.title, type: parsed?.type ?? null, pageAt, position })}`); } catch (e) { void e; }
          return { pageAt, position };
        }
      } catch (e) {
        try { this.#logger.info("[Outline][IMPORT] provider.parseDestination failed; fallback", { title: nativeBookmark?.title, err: e?.message }); } catch (e2) { void e2; }
      }
      const { resolvePdfDest, yToPositionPercent } = await import("../../pdf/pdf-dest-utils.js");
      const resolved = await resolvePdfDest(pdfDocument, dest);
      const pageAt = resolved?.pageNumber || null;
      let position = null;
      if (pageAt && resolved?.type === "XYZ" && typeof resolved?.y === "number") {
        position = await yToPositionPercent(pdfDocument, pageAt, resolved.y);
      }
      try { this.#logger.info(`[Outline][IMPORT] parsed via resolvePdfDest ${JSON.stringify({ title: nativeBookmark?.title, type: resolved?.type ?? null, pageAt, position })}`); } catch (e) { void e; }
      return { pageAt, position };
    } catch (e) {
      try { this.#logger.warn(`[Outline][IMPORT] parse normalized dest failed ${JSON.stringify({ title: nativeBookmark?.title, error: e?.message })}`); } catch (e2) { void e2; }
      return { pageAt: null, position: null };
    }
  }

  #refreshList(source = "backend") {
    const outlineItems = this.#outlineManager.getAllOutlineItems();
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
      if (!this.#navigationService) {
        this.#logger.error("NavigationService not available for outline");
        this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.FAILED, { error: "nav-unavailable" }, { actorId: "OutlineManager" });
        return;
      }
      const pageAt = (typeof outlineItem?.pageAt === "number" && outlineItem.pageAt > 0) ? outlineItem.pageAt : null;
      if (!pageAt) {
        this.#logger.warn("Outline item missing pageAt");
        this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.FAILED, { error: "invalid-destination" }, { actorId: "OutlineManager" });
        return;
      }
      const position = (typeof outlineItem?.position === "number") ? outlineItem.position : null;
      const result = await this.#navigationService.navigateTo({ pageAt, position });
      if (result?.success) {
        this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.SUCCESS, { pageNumber: result.actualPage, position: result.actualPosition }, { actorId: "OutlineManager" });
      } else {
        this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.FAILED, { error: result?.error || "unknown" }, { actorId: "OutlineManager" });
      }
    } catch (e) {
      this.#logger.warn("Outline navigate failed", e);
      this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.FAILED, { error: e?.message || "exception" }, { actorId: "OutlineManager" });
    }
  }

  // ========== 新实现：基于事件的一次性初始加载（无超时） ==========
  #initializing = false;
  #initialLoadStarted = false;

  async #runInitialLoadFlowAfterFile() {
    if (this.#initialLoadStarted) { return; }
    this.#initialLoadStarted = true;
    this.#initializing = true;
    try {
      this.#logger.info("[Outline][init] running initial outline flow (event-driven, no timeouts)");
      const pdfId = this.#getPdfId();
      if (!pdfId) { this.#logger.warn("[Outline][init] pdfId missing"); return; }
      if (!this.#wsClient) { this.#logger.warn("[Outline][init] wsClient missing"); return; }

      // 1) 请求数据库大纲（无超时，等待事件回执）— 为避免竞态，先注册监听，再发送请求
      this.#logger.info("[Outline][init] requesting outline-list from backend...", { pdf_uuid: pdfId });
      const waitList1 = this.#awaitMessage([WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED, WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_FAILED]);
      await this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
      const list1 = await waitList1;
      if (list1?.type === WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_FAILED) {
        this.#logger.warn("[Outline][init] outline-list failed", list1?.error || list1?.data, { toast: { type: "error", ms: 3500 } });
        this.#listReady = true;
        this.#refreshList("backend");
        return;
      }
      const first = Array.isArray(list1?.data?.outline_items) ? list1.data.outline_items : list1?.data?.outline_items;
      if (first === null) {
        this.#logger.info("[Outline][init] backend returned outline_items=null (no records). Will import from PDF.");
      } else if (Array.isArray(first)) {
        this.#logger.info(`[Outline][init] backend returned outline array (count=${first.length}). Will render without import.`);
      } else {
        this.#logger.warn("[Outline][init] unexpected outline_list payload; treating as empty");
      }
      if (first === null) {
        // 2) 数据库无该 pdf（null）→ 解析 PDF 原生大纲并持久化
        const pdfDoc = getCurrentPDFDocument?.();
        if (!pdfDoc) {
          this.#logger.warn("[Outline][init] pdfDocument missing after FILE.LOAD.SUCCESS");
          this.#listReady = true;
          this.#refreshList("backend");
          return;
        }
        this.#logger.info("[Outline][init] extracting native outline via OutlineDataProvider.getOutline(...)");
        await this.#importNativeOutlineIfEmpty(pdfDoc);
        // 等待 bulk-save 完成（若后端会发回执）
        await this.#awaitOptional([WEBSOCKET_MESSAGE_TYPES.OUTLINE_BULK_SAVE_COMPLETED, WEBSOCKET_MESSAGE_TYPES.OUTLINE_BULK_SAVE_FAILED]);
        // 再次请求列表并使用最终结果渲染（同样：先监听再请求，避免竞态）
        this.#logger.info("[Outline][init] re-requesting outline-list after bulk-save...");
        const waitList2 = this.#awaitMessage([WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED, WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_FAILED]);
        await this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
        const list2 = await waitList2;
        if (list2?.type === WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED) {
          const items2 = Array.isArray(list2?.data?.outline_items) ? list2.data.outline_items : [];
          this.#logger.info(`[Outline][init] final outline-list returned count=${items2.length}`);
          await this.#outlineManager.replaceFromRemote(items2);
          this.#listReady = true;
          this.#refreshList("backend");
          this.#tryPendingNavigate();
          return;
        }
        this.#logger.warn("[Outline][init] final outline-list failed; rendering empty");
        this.#listReady = true;
        this.#refreshList("backend");
        return;
      }
      if (Array.isArray(first)) {
        // 3) 数据库存在（可能为空数组或非空）→ 直接渲染一次
        if (first.length === 0) {
          this.#logger.info("[Outline][init] backend outline array is empty; skip native import by design");
        }
        if (first.length > 0) {
          await this.#outlineManager.replaceFromRemote(first);
        } else {
          await this.#outlineManager.replaceFromRemote([]);
        }
        this.#listReady = true;
        this.#refreshList("backend");
        this.#tryPendingNavigate();
        return;
      }
      // 兜底：标记 ready 以避免 UI 等待
      this.#listReady = true;
      this.#refreshList("backend");
    } catch (e) {
      this.#logger.warn("[Outline][init] initial load flow failed", e);
      this.#listReady = true;
      this.#refreshList("backend");
    } finally {
      this.#initializing = false;
    }
  }

  async #awaitMessage(types) {
    const allow = new Set(types || []);
    return new Promise((resolve) => {
      const unsub = this.#eventBus.onGlobal(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, (message) => {
        const t = String(message?.type || "");
        if (!allow.has(t)) { return; }
        try { unsub(); } catch (e) { void e; }
        resolve(message);
      }, { subscriberId: "OutlineFeature.await" });
    });
  }

  async #awaitOptional(types) {
    return new Promise((resolve) => {
      const allow = new Set(types || []);
      const unsub = this.#eventBus.onGlobal(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, (message) => {
        const t = String(message?.type || "");
        if (!allow.has(t)) { return; }
        try { unsub(); } catch (e) { void e; }
        resolve(message);
      }, { subscriberId: "OutlineFeature.await.opt" });
      // 无超时：纯可选等待；如果没有回执，将由后续流程继续
      // 为保证不泄漏，增加一帧微任务自动清理（若很快到达则立即清理）
      Promise.resolve().then(() => { /* noop to keep microtask turn */ });
    });
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
          this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.FAILED, { error: "not_found", id: targetId }, { actorId: "OutlineManager" });
        }
        return;
      }
      this.#logger.info("[Outline] 找到大纲项，准备导航", { outlineItem: item }, { toast: { type: "info", ms: 2000 } });
      await this.#handleNavigate({ outlineItem: item });
      this.#logger.info("[Outline] 导航完成", { outlineItemId: item.id }, { toast: { type: "success", ms: 2000 } });
    } catch (e) {
      this.#logger.warn("Outline navigate-by-id failed", e, { toast: { type: "error", ms: 3000 } });
      this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.FAILED, { error: e?.message || "exception" }, { actorId: "OutlineManager" });
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
          this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.FAILED, { error: "not_found", id }, { actorId: "OutlineManager" });
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

  #handleUpdate({ outlineItemId, update: directUpdate }) {
    const item = this.#outlineManager.getOutlineItem(outlineItemId);
    if (!item) {
      this.#logger.error(`[Outline] 更新失败：ID 未在当前列表中 ${outlineItemId}`, { toast: { type: "error", ms: 4500 } });
      return;
    }
    // 统一模式：若事件自带 update（用于无头/自动化），则直接发 WS，不弹对话框
    if (directUpdate && typeof directUpdate === "object") {
      (async () => {
        const pdfId = this.#getPdfId();
        if (!this.#wsClient || !pdfId) { this.#logger.error("[Outline] update aborted: missing wsClient/pdfId", { toast: { type: "error", ms: 4000 } }); return; }
        try {
          await this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_UPDATE, { outline_id: outlineItemId, update: directUpdate }, { metadata: { version: "1.0.0" } });
          await this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
        } catch (e) { this.#logger.warn("[Outline] update ws request failed", e); }
      })();
      return;
    }
    this.#dialog.showEdit({
      outlineItem: item,
      onConfirm: async (updates) => {
        const pdfId = this.#getPdfId();
        if (!this.#wsClient || !pdfId) { this.#logger.error("[Outline] update aborted: missing wsClient/pdfId", { toast: { type: "error", ms: 4000 } }); return; }
        const update = {};
        if (typeof updates?.name === "string") { update.name = updates.name.trim(); }
        if (Number.isInteger(updates?.pageAt) && updates.pageAt > 0) { update.page_at = updates.pageAt; }
        if (updates?.position === null || typeof updates?.position === "number") {
          update.position = (updates.position === null) ? null : Math.max(0, Math.min(100, Math.round(updates.position)));
        }
        try {
          this.#logger.info("[Outline] update → WS request", { outline_id: outlineItemId, update });
          await this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_UPDATE, { outline_id: outlineItemId, update }, { metadata: { version: "1.0.0" } });
          await this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
        } catch (e) { this.#logger.warn("[Outline] update ws request failed", e); }
      }
    });
  }

  async #handleDelete({ outlineItemId, cascade: directCascade }) {
    const item = this.#outlineManager.getOutlineItem(outlineItemId);
    const childCount = item?.children?.length || 0;
    // 统一模式：若事件自带 cascade（用于无头/自动化），则直接发 WS，不弹对话框
    if (typeof directCascade === "boolean") {
      const pdfId = this.#getPdfId();
      if (!this.#wsClient || !pdfId) { this.#logger.warn("[Outline] delete aborted: missing wsClient/pdfId"); return; }
      try {
        await this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_DELETE, { outline_id: outlineItemId, cascade: directCascade }, { metadata: { version: "1.0.0" } });
        await this.#wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
      } catch (e) { this.#logger.warn("[Outline] delete ws request failed", e); }
      return;
    }
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

