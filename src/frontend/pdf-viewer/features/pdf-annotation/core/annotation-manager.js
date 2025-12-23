/**
 * AnnotationManager - 标注数据管理器
 * @module features/annotation/core/annotation-manager
 * @description 管理标注数据的CRUD操作和持久化
 *
 * 职责:
 * 1. 管理标注数据的增删改查
 * 2. 与后端通信（WebSocket）进行数据同步
 * 3. 维护内存中的标注列表
 * 4. 发布标注数据变更事件
 * 5. 按页码过滤和组织标注
 *
 * Phase 1实现: Mock模式（内存存储）
 * Phase 2实现: 真实WebSocket通信和后端持久化
 */

import { getLogger } from "../../../../common/utils/logger.js";
import { Annotation, AnnotationType } from "../../../../common/models/annotation.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_MESSAGE_TYPES } from "../../../../common/event/event-constants.js";

/**
 * 标注管理器类
 * @class AnnotationManager
 */
export class AnnotationManager {
  /**
   * 标注Map: id → Annotation实例
   * @type {Map<string, Annotation>}
   * @private
   */
  #annotations = new Map();

  /**
   * 事件总线
   * @type {EventBus}
   * @private
   */
  #eventBus;

  /**
   * 日志器
   * @type {Logger}
   * @private
   */
  #logger;

  /**
   * PDF文件ID
   * @type {string|null}
   * @private
   */
  #pdfId = null;

  /**
   * Mock模式（Phase 1）
   * @type {boolean}
   * @private
   */
  #mockMode = true;

  /**
   * 创建标注管理器
   * @param {EventBus} eventBus - 事件总线
   * @param {Logger} [logger] - 日志器
   * @param {Object} [container] - 依赖容器（用于获取 wsClient）
   */
  constructor(eventBus, logger, container) {
    if (!eventBus) {
      throw new Error("AnnotationManager requires eventBus");
    }

    this.#eventBus = eventBus;
    this.#logger = logger || getLogger("AnnotationManager");

    // 从容器中获取 wsClient（若可用）
    this.#initWSClient(container);

    // 设置事件监听器
    this.#setupEventListeners();

    this.#logger.info(`[AnnotationManager] Created (${this.#mockMode ? "Mock" : "Remote"} Mode)`);
  }

  #wsClient = null;

  #initWSClient(container) {
    try {
      if (!container) {return;}
      let ws = null;
      if (typeof container.getWSClient === "function") {
        ws = container.getWSClient();
      } else if (typeof container.getDependencies === "function") {
        const deps = container.getDependencies() || {};
        ws = deps.wsClient || null;
      } else if (typeof container.get === "function") {
        try { ws = container.get("wsClient"); } catch {  /* ignore */ }
      }
      if (ws && typeof ws.request === "function") {
        this.#wsClient = ws;
        this.#mockMode = false;
        this.#logger.info("[AnnotationManager] wsClient obtained from container; remote persistence enabled");
      } else {
        this.#logger.warn("[AnnotationManager] wsClient unavailable; fallback to mock mode");
      }
    } catch (e) {
      this.#logger.warn("[AnnotationManager] Failed to obtain wsClient", e);
    }
  }

  /**
   * 设置事件监听器
   * @private
   */
  #setupEventListeners() {
    // 创建标注 - 双重监听：
    // 1. 局部事件：来自 annotation feature 内部工具（TextHighlightTool, ScreenshotTool等）
    // 2. 全局事件：来自其他 feature（text-selection-quick-actions），仅处理高亮标注
    this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.CREATE, (data) => {
      this.#handleCreateAnnotation(data);
    }, { subscriberId: "AnnotationManager-local" });

    this.#eventBus.onGlobal(PDF_VIEWER_EVENTS.ANNOTATION.CREATE, (data) => {
      // 全局事件仅处理高亮标注（text-selection-quick-actions 只发送此类型）
      const annotation = data?.annotation;
      if (annotation?.type === AnnotationType.TEXT_HIGHLIGHT) {
        this.#handleCreateAnnotation(data);
      } else if (annotation) {
        this.#logger.warn("[AnnotationManager] Global CREATE event ignored - not a TEXT_HIGHLIGHT", {
          type: annotation.type
        });
      }
    }, { subscriberId: "AnnotationManager-global" });

    // 更新标注 - 只需局部监听（仅内部工具会发送）
    this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.UPDATE, (data) => {
      this.#handleUpdateAnnotation(data);
    }, { subscriberId: "AnnotationManager" });

    // 删除标注 - 只需局部监听（仅内部工具会发送）
    this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.DELETE, (data) => {
      this.#handleDeleteAnnotation(data);
    }, { subscriberId: "AnnotationManager" });

    // 加载标注 - 只需局部监听（内部操作）
    this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD, (data) => {
      this.#handleLoadAnnotations(data);
    }, { subscriberId: "AnnotationManager" });
  }

  /**
   * 设置PDF文件ID
   * @param {string} pdfId - PDF文件ID
   */
  setPdfId(pdfId) {
    this.#pdfId = pdfId;
    this.#logger.info(`[AnnotationManager] PDF ID set to: ${pdfId}`);
  }

  /**
   * 创建标注（内部处理）
   * @param {Object} data - 标注数据
   * @private
   */
  async #handleCreateAnnotation(data) {
    try {
      const { annotation } = data;

      if (!annotation) {
        throw new Error("Annotation data is required");
      }

      // 创建Annotation实例
      const annotationObj = annotation instanceof Annotation
        ? annotation
        : Annotation.fromJSON(annotation);

      // Phase 1/2: 根据运行态与依赖情况动态选择保存策略
      // 优先条件保存到后端：wsClient 存在且已连接，并且已设置 pdfId
      const canUseRemote = !!this.#wsClient
        && typeof this.#wsClient.isConnected === "function"
        && this.#wsClient.isConnected()
        && !!this.#pdfId;

      if (canUseRemote) {
        // 真实后端保存
        await this.#saveAnnotationToBackend(annotationObj);
      } else {
        // 兜底：在缺少 pdfId 或未建立WS连接时，本地Mock保存，确保功能不中断
        if (!this.#pdfId) {
          this.#logger.warn("[AnnotationManager] PDF ID not set, falling back to mock save");
        }
        if (!this.#wsClient || (typeof this.#wsClient.isConnected === "function" && !this.#wsClient.isConnected())) {
          this.#logger.warn("[AnnotationManager] wsClient not connected, falling back to mock save");
        }
        await this.#mockSaveAnnotation(annotationObj);
      }

      // 添加到内存
      this.#annotations.set(annotationObj.id, annotationObj);

      // 发布成功事件（使用局部事件，feature内部通信）
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.CREATED, {
        annotation: annotationObj
      });

      this.#logger.info(`[AnnotationManager] Annotation created: ${annotationObj.id} (${annotationObj.type})`);

    } catch (error) {
      this.#logger.error("[AnnotationManager] Failed to create annotation:", error);
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.CREATE_FAILED, {
        error: error.message
      });
    }
  }

  /**
   * Mock保存标注（Phase 1）
   * @param {Annotation} annotation - 标注对象
   * @returns {Promise<void>}
   * @private
   */
  async #mockSaveAnnotation(annotation) {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 100));

    this.#logger.info(`[AnnotationManager] [MOCK] Saved annotation: ${annotation.id}`);
    return { success: true, id: annotation.id };
  }

  /**
   * 保存标注到后端（Phase 2，待实现）
   * @param {Annotation} annotation - 标注对象
   * @returns {Promise<void>}
   * @private
   */
  async #saveAnnotationToBackend(annotation) {
    // 若无可用 wsClient 或尚未连接，降级为本地保存但不报错
    try {
      if (!this.#wsClient || typeof this.#wsClient.request !== "function") {
        this.#logger.warn("[AnnotationManager] wsClient not available; fallback to local save");
        return await this.#mockSaveAnnotation(annotation);
      }
      if (typeof this.#wsClient.isConnected === "function" && !this.#wsClient.isConnected()) {
        this.#logger.info("[AnnotationManager] WS not connected; fallback to local save (will not block UI)");
        return await this.#mockSaveAnnotation(annotation);
      }
      if (!this.#pdfId) {
        this.#logger.warn("[AnnotationManager] PDF ID not set; fallback to local save");
        return await this.#mockSaveAnnotation(annotation);
      }
      // 构造后端所需 payload，并做向后兼容映射（例如 comment 需要 position{x,y}）
      const annJson = annotation.toJSON ? annotation.toJSON() : annotation;
      try {
        if (annJson && annJson.type === AnnotationType.COMMENT) {
          const data = annJson.data = annJson.data || {};
          // 若缺少像素 position，且提供了百分比 positionPercent，则在保存前换算生成 position（满足后端校验）
          if ((!data.position || typeof data.position.x !== "number" || typeof data.position.y !== "number")
              && data.positionPercent && typeof data.positionPercent.yPercent === "number") {
            const xPercent = Number(data.positionPercent.xPercent ?? 0);
            const yPercent = Number(data.positionPercent.yPercent ?? 0);
            try {
              const pageNum = Number(annJson.pageNumber || 1);
              const pageEl = document?.getElementById?.("viewerContainer")?.querySelector?.(`.page[data-page-number="${pageNum}"]`) || null;
              const w = pageEl ? (pageEl.clientWidth || pageEl.offsetWidth || 0) : 0;
              const h = pageEl ? (pageEl.clientHeight || pageEl.offsetHeight || 0) : 0;
              const xPx = Math.max(0, Math.round((xPercent / 100) * (w || 1)));
              const yPx = Math.max(0, Math.round((yPercent / 100) * (h || 1)));
              data.position = { x: xPx, y: yPx };
              this.#logger.info("[AnnotationManager] Filled legacy position from percent for comment", { xPx, yPx, w, h });
            } catch (e) {
              this.#logger.warn("[AnnotationManager] Failed to compute legacy position from percent", e);
              // 仍确保 position 存在，避免后端直接拒绝（保守为 0,0）
              data.position = data.position || { x: 0, y: 0 };
            }
          }
        }
      } catch (mapErr) {
        this.#logger.warn("[AnnotationManager] Compatibility mapping error", mapErr);
      }

      const payload = {
        pdf_uuid: this.#pdfId,
        annotation: annJson,
      };
      return await this.#wsClient.request(
        WEBSOCKET_MESSAGE_TYPES.ANNOTATION_SAVE,
        payload,
        { timeout: 8000, metadata: { version: "1.0.0" } }
      );
    } catch (e) {
      // 远端失败不阻塞创建流程
      this.#logger.warn("[AnnotationManager] Remote save failed; fallback to local save", { error: e?.message });
      return await this.#mockSaveAnnotation(annotation);
    }
  }

  /**
   * 更新标注（内部处理）
   * @param {Object} data - 更新数据
   * @private
   */
  async #handleUpdateAnnotation(data) {
    try {
      const { id, changes } = data;

      if (!id) {
        throw new Error("Annotation ID is required");
      }

      const annotation = this.#annotations.get(id);
      if (!annotation) {
        throw new Error(`Annotation not found: ${id}`);
      }

      // 更新标注
      annotation.update(changes);

      // Phase 1: Mock保存
      if (this.#mockMode) {
        await this.#mockSaveAnnotation(annotation);
      } else {
        await this.#saveAnnotationToBackend(annotation);
      }

      // 发布成功事件（使用局部事件）
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.UPDATED, {
        annotation
      });

      this.#logger.info(`[AnnotationManager] Annotation updated: ${id}`);

    } catch (error) {
      this.#logger.error("[AnnotationManager] Failed to update annotation:", error);
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.UPDATE_FAILED, {
        error: error.message
      });
    }
  }

  /**
   * 删除标注（内部处理）
   * @param {Object} data - 删除数据
   * @private
   */
  async #handleDeleteAnnotation(data) {
    try {
      const { id } = data;

      if (!id) {
        throw new Error("Annotation ID is required");
      }

      const annotation = this.#annotations.get(id);
      if (!annotation) {
        throw new Error(`Annotation not found: ${id}`);
      }

      // Phase 1: Mock删除
      if (this.#mockMode) {
        await this.#mockDeleteAnnotation(id);
      } else {
        await this.#deleteAnnotationFromBackend(id);
      }

      // 从内存中删除
      this.#annotations.delete(id);

      // 发布成功事件（使用局部事件）
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DELETED, {
        id,
        annotation
      });

      this.#logger.info(`[AnnotationManager] Annotation deleted: ${id}`);

    } catch (error) {
      this.#logger.error("[AnnotationManager] Failed to delete annotation:", error);
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DELETE_FAILED, {
        error: error.message
      });
    }
  }

  /**
   * Mock删除标注（Phase 1）
   * @param {string} id - 标注ID
   * @returns {Promise<void>}
   * @private
   */
  async #mockDeleteAnnotation(id) {
    this.#logger.info(`[AnnotationManager] [MOCK] Deleted annotation: ${id}`);
    return { success: true, id };
  }

  // 从后端删除标注的方法在文件后部已实现，此处移除重复定义以避免 Babel 报错

  /**
   * 加载标注（内部处理）
   * @param {Object} data - 加载参数
   * @private
   */
  async #handleLoadAnnotations(data) {
    try {
      const { pdfId } = data;

      if (!pdfId) {
        throw new Error("PDF ID is required");
      }

      this.setPdfId(pdfId);

      // Phase 1: Mock加载（空列表）
      let annotations = [];
      if (this.#mockMode) {
        annotations = await this.#mockLoadAnnotations(pdfId);
      } else {
        annotations = await this.#loadAnnotationsFromBackend(pdfId);
      }

      // 更新内存
      this.#annotations.clear();
      annotations.forEach(ann => {
        this.#annotations.set(ann.id, ann);
      });

      // 发布成功事件（使用局部事件）
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED, {
        annotations,
        count: annotations.length
      });

      this.#logger.info(`[AnnotationManager] Annotations loaded: ${annotations.length} items`);

    } catch (error) {
      this.#logger.error("[AnnotationManager] Failed to load annotations:", error);
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD_FAILED, {
        error: error.message
      });
    }
  }

  /**
   * Mock加载标注（Phase 1）
   * @param {string} pdfId - PDF文件ID
   * @returns {Promise<Array<Annotation>>}
   * @private
   */
  async #mockLoadAnnotations(pdfId) {
    this.#logger.info(`[AnnotationManager] [MOCK] Loaded annotations for PDF: ${pdfId}`);
    return []; // Phase 1返回空列表
  }

  /**
   * 从后端加载标注（Phase 2，待实现）
   * @param {string} pdfId - PDF文件ID
   * @returns {Promise<Array<Annotation>>}
   * @private
   */
  async #loadAnnotationsFromBackend(pdfId) {
    if (!this.#wsClient || typeof this.#wsClient.request !== "function") {
      // Fail-Fast：不允许静默返回空数组，否则会导致 UI 误判“已加载完成(0条)”并阻止后续自动重试
      throw new Error("wsClient not available");
    }

    // 关键：不要在未连接时直接返回空。WSClient.request() 支持未连接排队，
    // 并会在连接建立后先完成注册、再 flush 发送请求，确保首开也能自动拿到标注列表。
    const resp = await this.#wsClient.request(
      WEBSOCKET_MESSAGE_TYPES.ANNOTATION_LIST,
      { pdf_uuid: pdfId },
      { timeout: 8000, metadata: { version: "1.0.0" } }
    );

    const items = Array.isArray(resp?.annotations) ? resp.annotations : [];
    const result = [];
    for (const obj of items) {
      try {
        result.push(Annotation.fromJSON({
          id: obj.id,
          type: obj.type,
          pageNumber: obj.pageNumber,
          data: obj.data || {},
          comments: obj.comments || [],
          createdAt: obj.createdAt,
          updatedAt: obj.updatedAt,
          title: obj.title,
        }));
      } catch (err) {
        // 跳过不符合当前模型校验的历史数据，避免整批加载失败
        this.#logger.warn("[AnnotationManager] Skip invalid annotation from backend", {
          id: obj?.id,
          type: obj?.type,
          error: err?.message
        });
      }
    }
    return result;
  }

  async #deleteAnnotationFromBackend(id) {
    if (!this.#wsClient || typeof this.#wsClient.request !== "function") {
      throw new Error("wsClient not available");
    }
    await this.#wsClient.request(
      WEBSOCKET_MESSAGE_TYPES.ANNOTATION_DELETE,
      { pdf_uuid: this.#pdfId, ann_id: id },
      { timeout: 5000, metadata: { version: "1.0.0" } }
    );
  }

  // ==================== 公共API ====================

  /**
   * 获取所有标注
   * @returns {Array<Annotation>} 标注数组
   */
  getAllAnnotations() {
    return Array.from(this.#annotations.values());
  }

  /**
   * 按页码获取标注
   * @param {number} pageNumber - 页码
   * @returns {Array<Annotation>} 标注数组
   */
  getAnnotationsByPage(pageNumber) {
    return this.getAllAnnotations().filter(ann => ann.pageNumber === pageNumber);
  }

  /**
   * 按类型获取标注
   * @param {string} type - 标注类型
   * @returns {Array<Annotation>} 标注数组
   */
  getAnnotationsByType(type) {
    return this.getAllAnnotations().filter(ann => ann.type === type);
  }

  /**
   * 获取标注数量
   * @returns {number} 标注数量
   */
  getCount() {
    return this.#annotations.size;
  }

  /**
   * 获取标注（按ID）
   * @param {string} id - 标注ID
   * @returns {Annotation|undefined} 标注对象
   */
  getAnnotation(id) {
    return this.#annotations.get(id);
  }

  /**
   * 清空所有标注
   */
  clear() {
    this.#annotations.clear();
    this.#logger.info("[AnnotationManager] All annotations cleared");
  }

  /**
   * 获取管理器状态（用于调试）
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      pdfId: this.#pdfId,
      annotationCount: this.#annotations.size,
      mockMode: this.#mockMode
    };
  }
}

export default AnnotationManager;
