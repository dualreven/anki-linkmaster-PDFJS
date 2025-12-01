/**
 * OutlineManager（原 BookmarkManager）
 * @file 协调大纲数据加载、侧边栏UI与页面导航
 * @module OutlineManager
 */

import { getLogger } from "../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { getCurrentPDFDocument } from "../pdf/current-document-registry.js";
import { OutlineDataProvider } from "./outline-data-provider.js";

export class OutlineManager {
  #eventBus;
  #logger;
  #dataProvider;
  #ui;
  #options;
  #unsubs = [];
  #initialized = false;
  /** @type {Array<{id:string,name:string,pageAt:number,position:number|null,children?:any[]}>} */
  #outlineItems = [];
  /** @type {Map<string, any>} */
  #indexById = new Map();

  constructor(eventBus, options = {}) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("OutlineManager");
    this.#dataProvider = options.dataProvider || new OutlineDataProvider();
    this.#options = options || {};
    this.#ui = null; // 初始化时创建
  }

  initialize() {
    if (this.#initialized) {return;}
    this.#logger.info("Initializing OutlineManager...");

    // 注意：UI 由 infra-sidebar 统一注册，这里不再直接创建 OutlineSidebarUIClassic，避免重复订阅
    this.#ui = null;

    // 若显式禁用自动加载，则不注册任何自动触发的订阅（改由 Feature 统一编排）
    if (!this.#options.disableAutoLoad) {
      // 监听全局文件加载成功（来自 PDFManagerFeature，使用全局事件总线）
      // 严格使用全局事件；未提供 onGlobal 视为契约错误
      this.#unsubs.push(this.#eventBus.onGlobal(
        PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
        () => this.loadOutline(),
        { subscriberId: "OutlineManager" }
      ));

      // 监听全局的 OUTLINE 刷新请求（UI 可能通过全局发射）
      this.#unsubs.push(this.#eventBus.onGlobal(
        PDF_VIEWER_EVENTS.OUTLINE.LOAD.REQUESTED,
        () => this.loadOutline(),
        { subscriberId: "OutlineManager" }
      ));
    } else {
      this.#logger.info("Auto load disabled by options.disableAutoLoad=true");
    }

    this.#unsubs.push(
      this.#eventBus.onGlobal(
        PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.REQUESTED,
        (data) => this.#handleNavigateRequested(data),
        { subscriberId: "OutlineManager" }
      )
    );

    this.#initialized = true;
    this.#logger.info("OutlineManager initialized");
  }

  /**
   * 返回当前内存中的全部大纲（深拷贝，防止外部意外修改）
   */
  getAllOutlineItems() {
    return JSON.parse(JSON.stringify(this.#outlineItems || []));
  }

  /**
   * 通过 ID 获取单个大纲项（浅拷贝）
   * @param {string} id
   */
  getOutlineItem(id) {
    if (typeof id !== "string" || id.trim() === "") { return null; }
    const node = this.#indexById.get(id.trim());
    return node ? { ...node, children: Array.isArray(node.children) ? node.children.map(c => ({ ...c })) : [] } : null;
  }

  /**
   * 将“原生大纲”（OutlineDataProvider.getOutline 返回的 nodes）导入为统一结构
   * 并写入内存/索引；不自动持久化。
   * @param {Array} nativeNodes
   * @param {(n:any)=>Promise<{pageAt:number|null,position:number|null}>} parseDest
   * @returns {Promise<{success:boolean,count?:number,error?:string}>}
   */
  async importNativeOutline(nativeNodes, parseDest) {
    try {
      if (!Array.isArray(nativeNodes)) { return { success: true, count: 0 }; }
      const walk = async (nodes, path) => {
        const out = [];
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const id = this.#makeOutlineId(path.concat(i));
          let pageAt = null, position = null;
          try {
            if (typeof parseDest === "function") {
              const r = await parseDest(n);
              pageAt = (typeof r?.pageAt === "number" && r.pageAt > 0) ? r.pageAt : null;
              position = (typeof r?.position === "number") ? Math.max(0, Math.min(100, Math.round(r.position))) : null;
            }
          } catch (e) {
            this.#logger.warn("parseDest failed", e);
          }
          const mapped = {
            id,
            name: n.title || "(Untitled)",
            pageAt,
            position,
            children: []
          };
          mapped.children = await walk(n.items || [], path.concat(i));
          out.push(mapped);
        }
        return out;
      };
      this.#outlineItems = await walk(nativeNodes, []);
      this.#rebuildIndex();
      return { success: true, count: this.#indexById.size };
    } catch (e) {
      return { success: false, error: e?.message || "import-failed" };
    }
  }

  /**
   * 从 LocalStorage 读取持久化大纲（若不可用则忽略）
   */
  async loadFromStorage() {
    try {
      const storage = this.#getStorage();
      const key = this.#getStorageKey();
      if (!storage || !key) { return; }
      const raw = storage.getItem(key);
      if (!raw) { return; }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.#outlineItems = parsed;
        this.#rebuildIndex();
      }
    } catch (e) {
      this.#logger.warn("loadFromStorage failed", e);
    }
  }

  /**
   * 写入 LocalStorage（若不可用则忽略）
   */
  async saveToStorage() {
    try {
      const storage = this.#getStorage();
      const key = this.#getStorageKey();
      if (!storage || !key) { return; }
      // 严格：仅存标准字段
      const clone = this.#cloneForPersist(this.#outlineItems);
      storage.setItem(key, JSON.stringify(clone));
    } catch (e) {
      this.#logger.warn("saveToStorage failed", e);
    }
  }

  /**
   * 新增根级大纲项
   * @param {{name:string,pageAt:number,position:number|null,parentId?:string}} payload
   */
  async addOutlineItem(payload) {
    try {
      const name = (payload?.name || "").trim();
      const pageAt = (Number.isInteger(payload?.pageAt) && payload.pageAt > 0) ? payload.pageAt : null;
      const position = (typeof payload?.position === "number") ? Math.max(0, Math.min(100, Math.round(payload.position))) : null;
      if (!name || !pageAt) { return { success: false, error: "invalid-payload" }; }
      const id = this.#makeOutlineId([Date.now() % 100000, Math.floor(Math.random() * 1000)]);
      const node = { id, name, pageAt, position, children: [] };
      const parentId = payload?.parentId || null;
      if (parentId) {
        const parent = this.#indexById.get(parentId);
        if (!parent) { return { success: false, error: "parent-not-found" }; }
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        this.#outlineItems.push(node);
      }
      this.#indexById.set(id, node);
      return { success: true, id };
    } catch (e) {
      return { success: false, error: e?.message || "add-failed" };
    }
  }

  /**
   * 更新大纲项
   */
  async updateOutlineItem(id, updates) {
    try {
      const node = this.#indexById.get(id);
      if (!node) { return { success: false, error: "not-found" }; }
      if (typeof updates?.name === "string") { node.name = updates.name.trim() || node.name; }
      if (Number.isInteger(updates?.pageAt) && updates.pageAt > 0) { node.pageAt = updates.pageAt; }
      if (updates?.position === null || typeof updates?.position === "number") {
        node.position = (updates.position === null) ? null : Math.max(0, Math.min(100, Math.round(updates.position)));
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e?.message || "update-failed" };
    }
  }

  /**
   * 删除大纲项
   */
  async deleteOutlineItem(id, cascade = true) {
    try {
      const res = this.#removeNodeById(id, cascade);
      if (!res) { return { success: false, error: "not-found" }; }
      return { success: true };
    } catch (e) {
      return { success: false, error: e?.message || "delete-failed" };
    }
  }

  /**
   * 重排（拖拽）
   */
  async reorderOutlineItems(outlineItemId, newParentId, newIndex) {
    try {
      const extracted = this.#extractNode(outlineItemId);
      if (!extracted) { return { success: false, error: "not-found" }; }
      const { node } = extracted;
      if (newParentId) {
        const parent = this.#indexById.get(newParentId);
        if (!parent) { return { success: false, error: "parent-not-found" }; }
        parent.children = parent.children || [];
        const idx = Math.max(0, Math.min(parent.children.length, Number(newIndex) || 0));
        parent.children.splice(idx, 0, node);
      } else {
        const idx = Math.max(0, Math.min(this.#outlineItems.length, Number(newIndex) || 0));
        this.#outlineItems.splice(idx, 0, node);
      }
      this.#rebuildIndex();
      return { success: true };
    } catch (e) {
      return { success: false, error: e?.message || "reorder-failed" };
    }
  }

  async loadOutline() {
    try {
      const emitGlobal = (this.#eventBus.emitGlobal || this.#eventBus.emit).bind(this.#eventBus);
      const pdfDocument = getCurrentPDFDocument();
      if (!pdfDocument) {
        this.#logger.info("No current PDF document, skip outline loading");
        // 仍保持事件语义，但优先尝试从存储恢复
        await this.loadFromStorage();
        const hasAny = Array.isArray(this.#outlineItems) && this.#outlineItems.length > 0;
        if (hasAny) {
          emitGlobal(
            PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS,
            { outlineItems: this.getAllOutlineItems(), count: this.#count(this.#outlineItems), source: "storage" },
            { actorId: "OutlineManager" }
          );
          this.#logger.info(`[Outline] load success from storage: count=${this.#outlineItems.length}`);
        } else {
          emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.LOAD.EMPTY, {}, { actorId: "OutlineManager" });
          this.#logger.info("[Outline] empty (no pdfDocument; storage empty)");
        }
        return;
      }

      // 读取 PDF 原生大纲并标准化为统一模型
      const native = await this.#dataProvider.getOutline(pdfDocument);
      if (!native || native.length === 0) {
        // 尝试存储恢复，否则发 EMPTY
        await this.loadFromStorage();
        const hasAny = Array.isArray(this.#outlineItems) && this.#outlineItems.length > 0;
        if (!hasAny) {
          emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.LOAD.EMPTY, {}, { actorId: "OutlineManager" });
          this.#logger.info("[Outline] empty (pdf-native outline empty; storage empty)");
          return;
        }
      } else {
        // 为兼容旧测试：先直接发一次原生成功事件（count 以原生结构计算）
        try {
          emitGlobal(
            PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS,
            { outlineItems: native, count: this.#count(native), source: "pdf-native" },
            { actorId: "OutlineManager" }
          );
          this.#logger.info(`[Outline] native outline detected: count=${this.#count(native)}`);
        } catch { /* ignore */ }
        await this.importNativeOutline(native, async (n) => {
          const r = await this.#dataProvider.parseDestination(n.dest);
          // 与 Feature 统一：仅保留 pageAt/position （position 百分比）
          let position = null;
          if (r?.type === "XYZ" && typeof r?.y === "number") {
            try {
              const { yToPositionPercent } = await import("../pdf/pdf-dest-utils.js");
              position = await yToPositionPercent(pdfDocument, r.pageNumber, r.y);
            } catch { /* ignore */ }
          }
          return { pageAt: r?.pageNumber || null, position };
        });
      }

      emitGlobal(
        PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS,
        { outlineItems: this.getAllOutlineItems(), count: this.#count(this.#outlineItems), source: "pdf" },
        { actorId: "OutlineManager" }
      );
      this.#logger.info(`[Outline] load success: count=${this.#count(this.#outlineItems)}, source=pdf`);
    } catch (error) {
      this.#logger.error("Failed to load outlines:", error);
      const emitGlobal = (this.#eventBus.emitGlobal || this.#eventBus.emit).bind(this.#eventBus);
      emitGlobal(
        PDF_VIEWER_EVENTS.OUTLINE.LOAD.FAILED,
        { error, message: error.message },
        { actorId: "OutlineManager" }
      );
    }
  }

  async #handleNavigateRequested(data) {
    this.#logger.info("Navigate requested, data:", data);
    try {
      const outlineItem = data?.outlineItem;
      if (!outlineItem) {throw new Error("outlineItem is required");}

      this.#logger.info("Parsing destination:", outlineItem.dest);
      const result = await this.#dataProvider.parseDestination(outlineItem.dest);
      this.#logger.info("Parsed destination result:", result);

      // 统一通过 URL 导航入口（按页级跳转；如需位置百分比，可在上游解析时提供）
      this.#eventBus.emitGlobal(
        PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED,
        { pageAt: result.pageNumber },
        { actorId: "OutlineManager" }
      );

      this.#eventBus.emitGlobal(
        PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.SUCCESS,
        { pageNumber: result.pageNumber, position: { x: result.x, y: result.y } },
        { actorId: "OutlineManager" }
      );
    } catch (error) {
      this.#logger.error("Outline navigate failed:", error);
      this.#eventBus.emitGlobal(
        PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE.FAILED,
        { error, message: error.message },
        { actorId: "OutlineManager" }
      );
    }
  }

  #count(nodes) {
    if (!Array.isArray(nodes)) {return 0;}
    return nodes.reduce((acc, n) => acc + 1 + this.#count(n.items || []), 0);
  }

  destroy() {
    this.#unsubs.forEach(u => {
      try {
        u();
      } catch (e) {
        void e; /* logger-guard */
      }
    });
    this.#unsubs = [];
    if (this.#ui) {
      try {
        this.#ui.destroy();
      } catch (e) {
        void e; /* logger-guard */
      }
    }
    this.#logger.info("OutlineManager destroyed");
  }

  // ---------- 工具方法 ----------
  #rebuildIndex() {
    this.#indexById.clear();
    const walk = (nodes) => {
      for (const n of nodes) {
        this.#indexById.set(n.id, n);
        if (Array.isArray(n.children) && n.children.length) { walk(n.children); }
      }
    };
    walk(this.#outlineItems || []);
  }

  /**
   * 使用后端返回的大纲树替换内存数据（深拷贝并重建索引）
   * @param {Array<{id:string,name:string,pageAt:number,position:number|null,children?:any[]}>} items
   */
  async replaceFromRemote(items) {
    try {
      const normalize = (arr) => {
        if (!Array.isArray(arr)) { return []; }
        return arr.map(n => ({
          id: String(n.id || "").trim(),
          name: typeof n.name === "string" ? n.name : "(Untitled)",
          pageAt: (Number.isInteger(n.pageAt) && n.pageAt > 0) ? n.pageAt : 1,
          position: (typeof n.position === "number") ? Math.max(0, Math.min(100, Math.round(n.position))) : null,
          children: normalize(n.children || [])
        }));
      };
      this.#outlineItems = normalize(items || []);
      this.#rebuildIndex();
      this.#logger.info(`[OutlineManager] 已从远端同步大纲，节点数=${this.#indexById.size}`);
      // 按新规范：去掉本地缓存机制，不再写入 LocalStorage
    } catch (e) {
      this.#logger.warn("[OutlineManager] replaceFromRemote failed", e);
    }
  }

  #cloneForPersist(nodes) {
    const copy = (arr) => {
      return (arr || []).map(n => ({
        id: n.id,
        name: n.name,
        pageAt: n.pageAt,
        position: (typeof n.position === "number") ? n.position : null,
        children: copy(n.children || [])
      }));
    };
    return copy(nodes || []);
  }

  #extractNode(id) {
    let found = null, parentFound = null, idxFound = -1;
    const walk = (arr, parent) => {
      for (let i = 0; i < arr.length; i++) {
        const n = arr[i];
        if (n.id === id) { found = n; parentFound = parent; idxFound = i; return true; }
        if (Array.isArray(n.children) && walk(n.children, n)) { return true; }
      }
      return false;
    };
    if (walk(this.#outlineItems, null)) {
      if (parentFound) { parentFound.children.splice(idxFound, 1); }
      else { this.#outlineItems.splice(idxFound, 1); }
      return { node: found, parent: parentFound };
    }
    return null;
  }

  #removeNodeById(id, cascade) {
    // cascade=true 与 false 在树结构下行为等价（删除节点即连同子节点一起移除）
    const res = this.#extractNode(id);
    if (res) {
      this.#rebuildIndex();
      return true;
    }
    return false;
  }

  #getStorage() {
    try { return window?.localStorage || null; } catch { return null; }
  }
  #getStorageKey() {
    const id = this.#resolvePdfId();
    return id ? `pdf-outline:${id}` : null;
  }
  #resolvePdfId() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const v = urlParams.get("pdf-id");
      if (v && v.trim()) { return v.trim(); }
      if (typeof window.PDF_PATH === "string" && window.PDF_PATH) {
        const filename = window.PDF_PATH.split("/").pop().split(".")[0];
        if (filename) { return filename; }
      }
    } catch { /* ignore */ }
    return "default";
  }
  #makeOutlineId(pathArr) {
    // 根据路径生成稳定短 ID：outlineItem-XXXXXXXX（基于简单 hash）
    const s = String(pathArr.join("-"));
    let h = 2166136261 >>> 0; // FNV-1a 起始
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    const hex = (h >>> 0).toString(16).toUpperCase().padStart(8, "0");
    return `outlineItem-${hex.slice(0, 8)}`;
  }
}

export default OutlineManager;

