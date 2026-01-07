import { ObservableState } from "../../../../common/utils/observable.js";
import { getLogger } from "../../../../common/utils/logger.js";
import { normalizePercentToStoredPosition } from "../anchor-utils.js";

function normalizeAnchorId(anchorId) {
  const id = String(anchorId || "").trim();
  if (!id) {
    throw new Error("[pdf-anchor] anchorId is required");
  }
  return id;
}

function normalizeIncomingStoredPosition(position) {
  if (position === null || position === undefined) {
    return null;
  }
  if (typeof position !== "number" || Number.isNaN(position)) {
    throw new Error("[pdf-anchor] position must be a number or null");
  }
  let v = position;
  if (v > 1) {
    v = v / 100;
  }
  if (!Number.isFinite(v)) {
    throw new Error("[pdf-anchor] position must be a finite number");
  }
  return Math.max(0, Math.min(1, v));
}

function toAnchorsById(anchors) {
  const m = new Map();
  for (const a of anchors) {
    if (!a || !a.uuid) { continue; }
    m.set(String(a.uuid), a);
  }
  return m;
}

export class AnchorManager {
  /**
   * 单一真源：store（ObservableState）
   * 说明：命令入口在 Feature 的 EventBus 监听器层；UI 仅订阅 store 渲染。
   */
  constructor(logger = getLogger("AnchorManager")) {
    this.logger = logger;
    this.store = new ObservableState({
      anchors: [],
      anchorsById: new Map(),
      activeId: null,
      isLoading: false,
      error: null, // { message, type }
      lastRequestPayload: null,
    }, {
      name: "AnchorStore",
      logger: this.logger,
    });
  }

  getAnchors() {
    return this.store.get().anchors;
  }

  getAnchorsById() {
    return this.store.get().anchorsById;
  }

  getAnchorById(anchorId) {
    const id = normalizeAnchorId(anchorId);
    return this.store.get().anchorsById.get(id) || null;
  }

  getActiveAnchorId() {
    return this.store.get().activeId;
  }

  markLoading(payload) {
    const req = (payload && typeof payload === "object") ? payload : {};
    this.store.set({ isLoading: true, error: null, lastRequestPayload: req });
  }

  markLoadFailed({ message, type } = {}) {
    const msg = (typeof message === "string" && message.trim()) ? message.trim() : "无法加载锚点数据";
    const t = (typeof type === "string" && type.trim()) ? type.trim() : "anchor-load-failed";
    this.store.set({ isLoading: false, error: { message: msg, type: t } });
  }

  applyLoadedAnchors(anchors) {
    const list = Array.isArray(anchors) ? anchors : [];
    const normalized = list
      .map((a) => {
        if (!a || !a.uuid) { return null; }
        const uuid = String(a.uuid);
        const name = (a.name ?? "");
        const pageAt = parseInt(a.page_at || 1, 10) || 1;
        const position = normalizeIncomingStoredPosition(a.position);
        return { uuid, name, page_at: pageAt, position };
      })
      .filter(Boolean);

    this.store.set({
      anchors: normalized,
      anchorsById: toAnchorsById(normalized),
      isLoading: false,
      error: null,
    });
  }

  upsertAnchor(anchor) {
    if (!anchor || typeof anchor !== "object") {
      throw new Error("[pdf-anchor] upsertAnchor requires an object");
    }
    const id = normalizeAnchorId(anchor.uuid);
    const name = anchor.name ?? "";
    const pageAt = parseInt(anchor.page_at || 1, 10) || 1;
    const position = normalizeIncomingStoredPosition(anchor.position);

    const cur = this.store.get();
    const existed = cur.anchorsById.get(id) || null;
    const next = { uuid: id, name, page_at: pageAt, position };

    const nextAnchors = existed
      ? cur.anchors.map((a) => (a.uuid === id ? { ...a, ...next } : a))
      : [...cur.anchors, next];

    this.store.set({ anchors: nextAnchors, anchorsById: toAnchorsById(nextAnchors) });
  }

  deleteAnchor(anchorId) {
    const id = normalizeAnchorId(anchorId);
    const cur = this.store.get();
    const existed = cur.anchorsById.get(id) || null;
    if (!existed) { return; }

    const nextAnchors = cur.anchors.filter((a) => a.uuid !== id);
    const nextActiveId = (cur.activeId === id) ? null : cur.activeId;
    this.store.set({
      anchors: nextAnchors,
      anchorsById: toAnchorsById(nextAnchors),
      activeId: nextActiveId,
    });
  }

  applyAnchorUpdate(anchorId, update) {
    const id = normalizeAnchorId(anchorId);
    if (!update || typeof update !== "object") {
      throw new Error("[pdf-anchor] applyAnchorUpdate requires update object");
    }

    const cur = this.store.get();
    const existed = cur.anchorsById.get(id) || null;
    if (!existed) { return; }

    const next = { ...existed };
    let changed = false;

    if (typeof update.name === "string") {
      const n = update.name.trim();
      if (n && n !== next.name) {
        next.name = n;
        changed = true;
      }
    }

    if (typeof update.page_at === "number" && Number.isFinite(update.page_at)) {
      next.page_at = update.page_at;
      changed = true;
    }

    if (typeof update.position === "number" && Number.isFinite(update.position)) {
      next.position = normalizePercentToStoredPosition(update.position);
      changed = true;
    }

    if (!changed) { return; }

    const nextAnchors = cur.anchors.map((a) => (a.uuid === id ? next : a));
    this.store.set({ anchors: nextAnchors, anchorsById: toAnchorsById(nextAnchors) });
  }

  setActive(anchorId, active = true) {
    const id = normalizeAnchorId(anchorId);
    const nextActive = !!active;

    const cur = this.store.get();
    const existed = cur.anchorsById.get(id) || null;
    const nextAnchors = existed
      ? cur.anchors
      : [...cur.anchors, { uuid: id, name: "", page_at: 1, position: null }];

    this.store.set({
      anchors: nextAnchors,
      anchorsById: toAnchorsById(nextAnchors),
      activeId: nextActive ? id : (cur.activeId === id ? null : cur.activeId),
    });
  }

  reset() {
    this.store.replace({
      anchors: [],
      anchorsById: new Map(),
      activeId: null,
      isLoading: false,
      error: null,
      lastRequestPayload: null,
    });
  }

  destroy() {
    this.reset();
  }
}

export default AnchorManager;

