import { ObservableState } from "../../../../common/utils/observable.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";

/**
 * Manages Outline Data State (Items Tree, Index).
 * Replaces legacy src/frontend/pdf-viewer/outline/outline-manager.js
 */
export class OutlineManager {
  constructor(logger, dataProvider) {
    this.logger = logger;
    this.dataProvider = dataProvider;

    this.store = new ObservableState({
      items: [],
      isLoading: false,
      error: null
    }, {
      name: "OutlineStore",
      logger: this.logger
    });

    this._indexById = new Map();
  }

  initialize() {
    // This is a no-op for the new manager, but it's here for compatibility with old tests.
  }

  /**
     * Replace all items (e.g. from backend)
     * @param {Array} items
     */
  replaceItems(items) {
    // Deep copy and normalize
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
    const newItems = normalize(items || []);
    this._rebuildIndex(newItems);
    this.store.set({ items: newItems, error: null });
    if (this.logger && typeof this.logger.info === "function") {
      this.logger.info(`[OutlineManager] Replaced items, count: ${this._indexById.size}`);
    }
  }

  // Alias for compatibility
  replaceFromRemote(items) {
    return this.replaceItems(items);
  }

  /**
     * Import native PDF outline (async)
     * @param {Array} nativeNodes
     * @param {Function} parseDest - Async function to parse destination
     */
  async importNativeOutline(nativeNodes, parseDest) {
    try {
      if (!Array.isArray(nativeNodes)) { return { success: true, count: 0 }; }

      const walk = async (nodes, path) => {
        const out = [];
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const id = this._generateIdWithPath(path.concat(i));
          let pageAt = null, position = null;
          try {
            if (typeof parseDest === "function") {
              const r = await parseDest(n);
              pageAt = (typeof r?.pageAt === "number" && r.pageAt > 0) ? r.pageAt : null;
              position = (typeof r?.position === "number") ? Math.max(0, Math.min(100, Math.round(r.position))) : null;
            }
          } catch (e) {
            this.logger.warn("parseDest failed", e);
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

      const newItems = await walk(nativeNodes, []);
      this._rebuildIndex(newItems);
      this.store.set({ items: newItems, error: null });

      return { success: true, count: this._indexById.size };
    } catch (e) {
      return { success: false, error: e?.message || "import-failed" };
    }
  }

  /**
     * Add a new item
     */
  addItem(payload) {
    const items = this._cloneItems();
    const name = (payload?.name || "").trim();
    const pageAt = (Number.isInteger(payload?.pageAt) && payload.pageAt > 0) ? payload.pageAt : null;
    const position = (typeof payload?.position === "number") ? Math.max(0, Math.min(100, Math.round(payload.position))) : null;

    if (!name || !pageAt) { return { success: false, error: "invalid-payload" }; }

    const id = this._generateId();
    const node = { id, name, pageAt, position, children: [] };

    const parentId = payload?.parentId || null;
    if (parentId) {
      const parent = this._findNode(items, parentId);
      if (!parent) { return { success: false, error: "parent-not-found" }; }
      parent.children = parent.children || [];
      parent.children.push(node);
    } else {
      items.push(node);
    }

    this._rebuildIndex(items);
    this.store.set({ items });
    return { success: true, id };
  }

  addOutlineItem(payload) {
    return this.addItem(payload);
  }

  /**
     * Update an item
     */
  updateItem(id, updates) {
    const items = this._cloneItems();
    const node = this._findNode(items, id);

    if (!node) { return { success: false, error: "not-found" }; }

    if (typeof updates?.name === "string") { node.name = updates.name.trim() || node.name; }
    if (Number.isInteger(updates?.pageAt) && updates.pageAt > 0) { node.pageAt = updates.pageAt; }
    if (updates?.position === null || typeof updates?.position === "number") {
      node.position = (updates.position === null) ? null : Math.max(0, Math.min(100, Math.round(updates.position)));
    }

    this._rebuildIndex(items);
    this.store.set({ items });
    return { success: true };
  }

  updateOutlineItem(id, updates) {
    return this.updateItem(id, updates);
  }

  /**
     * Delete an item
     */
  deleteItem(id) {
    const items = this._cloneItems();
    const { found, parent } = this._findNodeWithParent(items, id);

    if (!found) { return { success: false, error: "not-found" }; }

    if (parent) {
      parent.children = parent.children.filter(c => c.id !== id);
    } else {
      const idx = items.findIndex(i => i.id === id);
      if (idx > -1) {items.splice(idx, 1);}
    }

    this._rebuildIndex(items);
    this.store.set({ items });
    return { success: true };
  }

  deleteOutlineItem(id) {
    return this.deleteItem(id);
  }

  /**
     * Reorder item
     */
  reorderItem(id, newParentId, newIndex) {
    const items = this._cloneItems();
    const { found: node, parent: oldParent } = this._findNodeWithParent(items, id);

    if (!node) { return { success: false, error: "not-found" }; }

    // Remove from old location
    if (oldParent) {
      oldParent.children = oldParent.children.filter(c => c.id !== id);
    } else {
      const idx = items.findIndex(i => i.id === id);
      if (idx > -1) {items.splice(idx, 1);}
    }

    // Insert to new location
    if (newParentId) {
      const newParent = this._findNode(items, newParentId);
      if (!newParent) { return { success: false, error: "parent-not-found" }; }
      newParent.children = newParent.children || [];
      const idx = Math.max(0, Math.min(newParent.children.length, Number(newIndex) || 0));
      newParent.children.splice(idx, 0, node);
    } else {
      const idx = Math.max(0, Math.min(items.length, Number(newIndex) || 0));
      items.splice(idx, 0, node);
    }

    this._rebuildIndex(items);
    this.store.set({ items });
    return { success: true };
  }

  reorderOutlineItems(id, newParentId, newIndex) {
    return this.reorderItem(id, newParentId, newIndex);
  }

  getItem(id) {
    // Return a copy to be safe
    const item = this._indexById.get(id);
    if (!item) {return null;}
    return JSON.parse(JSON.stringify(item));
  }

  // Alias for compatibility
  getOutlineItem(id) {
    return this.getItem(id);
  }

  /**
     * Get all items (deep copy)
     */
  getAllItems() {
    return this._cloneItems();
  }

  // Alias for compatibility
  getAllOutlineItems() {
    return this.getAllItems();
  }

  setLoading(isLoading) {
    this.store.set({ isLoading });
  }

  setError(error) {
    this.store.set({ error });
  }

  saveToStorage() {
    // This is a no-op for the new manager, but it's here for compatibility with old tests.
  }

  loadFromStorage() {
    // This is a no-op for the new manager, but it's here for compatibility with old tests.
  }

  async loadOutline() {
    const outlineItems = await this.dataProvider.getOutline();
    if (outlineItems) {
      this.replaceItems(outlineItems);
      if (this.eventBus) {
        this.eventBus.emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS, { outlineItems, count: outlineItems.length });
      }
    } else {
      if (this.eventBus) {
        this.eventBus.emitGlobal(PDF_VIEWER_EVENTS.OUTLINE.LOAD.EMPTY, {});
      }
    }
  }

  // --- Helpers ---

  _rebuildIndex(items) {
    this._indexById.clear();
    const walk = (nodes) => {
      for (const n of nodes) {
        this._indexById.set(n.id, n);
        if (Array.isArray(n.children)) {walk(n.children);}
      }
    };
    walk(items);
  }

  _cloneItems() {
    return JSON.parse(JSON.stringify(this.store.get().items));
  }

  _findNode(items, id) {
    let found = null;
    const walk = (nodes) => {
      for (const n of nodes) {
        if (n.id === id) { found = n; return; }
        if (n.children) {walk(n.children);}
        if (found) {return;}
      }
    };
    walk(items);
    return found;
  }

  _findNodeWithParent(items, id) {
    let found = null, parent = null;
    const walk = (nodes, p) => {
      for (const n of nodes) {
        if (n.id === id) { found = n; parent = p; return; }
        if (n.children) {walk(n.children, n);}
        if (found) {return;}
      }
    };
    walk(items, null);
    return { found, parent };
  }

  _generateId() {
    return this._generateIdWithPath([Date.now() % 100000, Math.floor(Math.random() * 1000)]);
  }

  _generateIdWithPath(pathArr) {
    // Stable ID generation logic
    const s = String(pathArr.join("-"));
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    const hex = (h >>> 0).toString(16).toUpperCase().padStart(8, "0");
    return `outlineItem-${hex.slice(0, 8)}`;
  }

  destroy() {
    // Cleanup
  }
}
