import { ObservableState } from "../../../../common/utils/observable.js";
import { Annotation } from "../../../../common/models/annotation.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_MESSAGE_TYPES } from "../../../../common/event/event-constants.js";
import { getLogger } from "../../../../common/utils/logger.js";

/**
 * AnnotationManager V2 (Observable)
 */
export class AnnotationManager {
  constructor(eventBus, logger, container) {
    this.eventBus = eventBus;
    this.logger = logger || getLogger("AnnotationManager");
    this.wsClient = null;
    this.mockMode = true;

    this.store = new ObservableState({
      annotations: [],
      isLoading: false,
      error: null,
      pdfId: null
    }, {
      name: "AnnotationStore",
      logger: this.logger
    });

    this._initWSClient(container);
  }

  _initWSClient(container) {
    try {
      if (!container) {return;}
      let ws = null;
      if (typeof container.getWSClient === "function") {
        ws = container.getWSClient();
      } else if (typeof container.get === "function") {
        try { ws = container.get("wsClient"); } catch (e) { void e; /* logger-guard */ }
      }
      if (ws && typeof ws.request === "function") {
        this.wsClient = ws;
        this.mockMode = false;
        this.logger.info("[AnnotationManager] Remote persistence enabled");
      }
    } catch (e) {
      this.logger.warn("[AnnotationManager] Failed to obtain wsClient", e);
    }
  }

  setPdfId(pdfId) {
    this.store.set({ pdfId });
  }

  async createAnnotation(annotationData) {
    try {
      const ann = annotationData instanceof Annotation ? annotationData : Annotation.fromJSON(annotationData);

      const current = this.store.get().annotations;
      this.store.set({ annotations: [ann, ...current] });

      if (this.mockMode) {
        await this._mockSave(ann);
      } else {
        await this._remoteSave(ann);
      }

      this.eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.CREATED, { annotation: ann });
    } catch (e) {
      this.logger.error("Create failed", e);
      this.eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.CREATE_FAILED, { error: e.message });
    }
  }

  async updateAnnotation(id, changes) {
    try {
      const current = this.store.get().annotations;
      const index = current.findIndex(a => a.id === id);
      if (index === -1) {
        this.logger.warn(`[AnnotationManager] Update failed: ID ${id} not found in store`);
        return;
      }

      const ann = current[index];
      ann.update(changes);

      const next = [...current];
      next[index] = ann;
      this.store.set({ annotations: next });

      if (this.mockMode) {
        await this._mockSave(ann);
      } else {
        await this._remoteSave(ann);
      }

      this.eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.UPDATED, { annotation: ann });
    } catch (e) {
      this.logger.error("Update failed", e);
    }
  }

  async deleteAnnotation(id) {
    try {
      const current = this.store.get().annotations;
      const next = current.filter(a => a.id !== id);
      this.store.set({ annotations: next });

      if (this.mockMode) {
        // mock delete
      } else {
        await this._remoteDelete(id);
      }

      this.eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DELETED, { id });
    } catch (e) {
      this.logger.error("Delete failed", e);
    }
  }

  async loadAnnotations(pdfId) {
    this.setPdfId(pdfId);
    this.store.set({ isLoading: true });
    try {
      let list = [];
      if (this.mockMode) {
        list = [];
      } else {
        list = await this._remoteLoad(pdfId);
      }
      this.store.set({ annotations: list, isLoading: false, error: null });
      this.eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED, { annotations: list, count: list.length });
    } catch (e) {
      this.store.set({ isLoading: false, error: e.message });
      this.eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD_FAILED, { error: e.message });
    }
  }

  async _mockSave(ann) { return new Promise(r => setTimeout(r, 10)); }

  async _remoteSave(ann) {
    const pdfId = this.store.get().pdfId;
    if (!this.wsClient || !pdfId) {return;}
    const payload = { pdf_uuid: pdfId, annotation: ann.toJSON ? ann.toJSON() : ann };
    await this.wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANNOTATION_SAVE, payload, { metadata: { version: "1.0.0" } });
  }

  async _remoteDelete(id) {
    const pdfId = this.store.get().pdfId;
    if (!this.wsClient || !pdfId) {return;}
    await this.wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANNOTATION_DELETE, { pdf_uuid: pdfId, ann_id: id }, { metadata: { version: "1.0.0" } });
  }

  async _remoteLoad(pdfId) {
    if (!this.wsClient) {return [];}
    const resp = await this.wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANNOTATION_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
    const items = Array.isArray(resp?.annotations) ? resp.annotations : [];
    const parsed = [];
    for (const obj of items) {
      try {
        const ann = (obj instanceof Annotation) ? obj : Annotation.fromJSON(obj);
        parsed.push(ann);
      } catch (e) {
        this.logger.warn("[AnnotationManager] Skipping invalid annotation from backend", {
          id: obj?.id,
          type: obj?.type,
          pageNumber: obj?.pageNumber,
          error: e?.message || String(e),
        });
      }
    }
    return parsed;
  }

  getAllAnnotations() {
    return this.store.get().annotations;
  }

  getAnnotation(id) {
    return this.store.get().annotations.find(a => a.id === id) || null;
  }

  getAnnotationsByPage(pageNumber) {
    return this.getAllAnnotations().filter(ann => ann.pageNumber === pageNumber);
  }

  getAnnotationsByType(type) {
    return this.getAllAnnotations().filter(ann => ann.type === type);
  }

  getCount() {
    return this.getAllAnnotations().length;
  }

  clear() {
    this.store.set({ annotations: [] });
  }

  getStatus() {
    const state = this.store.get();
    return {
      pdfId: state.pdfId,
      annotationCount: state.annotations.length,
      mockMode: this.mockMode
    };
  }

  destroy() {
    // Should ideally unsubscribe, but for now we rely on bag in Feature
  }
}
