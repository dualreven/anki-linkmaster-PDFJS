import { ObservableState } from "../../../../common/utils/observable.js";
import { Annotation, AnnotationType } from "../../../../common/models/annotation.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_MESSAGE_TYPES } from "../../../../common/event/event-constants.js";
import { computePositionFromPercent } from "./annotation-position-utils.js";

/**
 * AnnotationManager V2 (Observable)
 */
export class AnnotationManager {
    constructor(eventBus, logger, container) {
        this.eventBus = eventBus;
        this.logger = logger;
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
        this._setupEventListeners(); // Keep listening for Tool events
    }

    _initWSClient(container) {
        try {
            if (!container) return;
            let ws = null;
            if (typeof container.getWSClient === "function") {
                ws = container.getWSClient();
            } else if (typeof container.get === "function") {
                try { ws = container.get("wsClient"); } catch { }
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

    _setupEventListeners() {
        // Listen to Tool Events (Create Request)
        this.eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.CREATE, (data) => {
            this.createAnnotation(data.annotation);
        }, { subscriberId: "AnnotationManagerV2" });

        this.eventBus.onGlobal(PDF_VIEWER_EVENTS.ANNOTATION.CREATE, (data) => {
            const annotation = data?.annotation;
            if (annotation?.type === AnnotationType.TEXT_HIGHLIGHT) {
                this.createAnnotation(data.annotation);
            }
        }, { subscriberId: "AnnotationManagerV2-Global" });

        this.eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.UPDATE, (data) => {
            this.updateAnnotation(data.id, data.changes);
        }, { subscriberId: "AnnotationManagerV2" });

        this.eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.DELETE, (data) => {
            this.deleteAnnotation(data.id);
        }, { subscriberId: "AnnotationManagerV2" });

        this.eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD, (data) => {
            this.loadAnnotations(data.pdfId);
        }, { subscriberId: "AnnotationManagerV2" });
    }

    setPdfId(pdfId) {
        this.store.set({ pdfId });
    }

    async createAnnotation(annotationData) {
        try {
            const ann = annotationData instanceof Annotation ? annotationData : Annotation.fromJSON(annotationData);
            
            // Optimistic Update
            const current = this.store.get().annotations;
            this.store.set({ annotations: [ann, ...current] });

            // Persist
            if (this.mockMode) {
                await this._mockSave(ann);
            } else {
                await this._remoteSave(ann);
            }

            this.eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.CREATED, { annotation: ann });
        } catch (e) {
            this.logger.error("Create failed", e);
            // Rollback? (Not implemented for simplicity, assume retry)
            this.eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.CREATE_FAILED, { error: e.message });
        }
    }

    async updateAnnotation(id, changes) {
        try {
            const current = this.store.get().annotations;
            const index = current.findIndex(a => a.id === id);
            if (index === -1) throw new Error("Not found");

            const ann = current[index];
            ann.update(changes);
            
            // Immutable update for Reactivity
            const next = [...current];
            next[index] = ann; // Note: Annotation object is mutated, but array ref changed
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
            this.store.set({ annotations: list, isLoading: false });
            this.eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED, { annotations: list, count: list.length });
        } catch (e) {
            this.store.set({ isLoading: false, error: e.message });
            this.eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD_FAILED, { error: e.message });
        }
    }

    // --- Private Persist ---

    async _mockSave(ann) { return new Promise(r => setTimeout(r, 100)); }

    async _remoteSave(ann) {
        const pdfId = this.store.get().pdfId;
        if (!this.wsClient || !pdfId) return;
        const payload = { pdf_uuid: pdfId, annotation: ann.toJSON ? ann.toJSON() : ann };
        await this.wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANNOTATION_SAVE, payload, { metadata: { version: "1.0.0" } });
    }

    async _remoteDelete(id) {
        const pdfId = this.store.get().pdfId;
        if (!this.wsClient || !pdfId) return;
        await this.wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANNOTATION_DELETE, { pdf_uuid: pdfId, ann_id: id }, { metadata: { version: "1.0.0" } });
    }

    async _remoteLoad(pdfId) {
        if (!this.wsClient) return [];
        const resp = await this.wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANNOTATION_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
        return (resp?.annotations || []).map(obj => Annotation.fromJSON(obj));
    }

    getAllAnnotations() {
        return this.store.get().annotations;
    }

    getAnnotation(id) {
        return this.store.get().annotations.find(a => a.id === id) || null;
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
}