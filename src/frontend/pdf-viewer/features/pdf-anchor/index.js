/**
 * PDF Anchor Feature
 * @module PDFAnchorFeature
 * @description 负责锚点的复制、激活与运行时位置追踪；支持通过内部导航事件进行受控跳转与提示（不再从 URL 参数触发导航）
 * 详细说明：docs/standards/pdf-anchor-feature.md
 */

import { getLogger } from "../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { getCurrentPageAndPosition } from "../../../common/utils/pdf-page-detection-utils.js";
import { setupAnchorEventListeners } from "./anchor-event-listeners.js";
import { navigateToAnchor } from "./anchor-navigation.js";
import { setupAnchorPositionTracker } from "./anchor-position-tracker.js";

export class PDFAnchorFeature {
  #logger = getLogger("PDFAnchorFeature");
  #eventBus = null;
  #container = null;
  #navigationService = null;
  #anchorsById = new Map(); // uuid -> anchor {uuid,name,page_at,position,is_active}
  #activeAnchorId = null;
  #pendingAnchorIdForNavigate = null; // 等待锚点数据加载后再触发导航的锚点ID
  #lastNav = null; // 最近一次导航请求 { pageAt, position, anchorId, t0, method }

  /** @type {PositionTracker|null} */
  #positionTracker = null;
  /** @type {number|null} */
  #lastUpdateAt = null; // 最近一次位置写回时间戳（ms）

  get name() { return "pdf-anchor"; }
  get version() { return "1.0.0"; }
  get dependencies() {
    // 显式依赖 infra-nav-core（提供 navigationService），并保留对容器服务名的声明以通过缺失检查
    return ["infra-nav-core", "navigationService"];
  }

  async install(context) {
    this.#container = context.container || context;
    this.#eventBus = context.globalEventBus || this.#container.get("eventBus");
    if (!this.#eventBus) {throw new Error("[pdf-anchor] eventBus not found");}

    // navigationService from DI
    this.#navigationService = this.#container.get("navigationService");
    if (!this.#navigationService) {this.#logger.warn("navigationService not found, will fallback to DOM ops");}

    // 注册 Anchor 侧边栏 UI 到容器（供 SidebarManager 获取）
    try {
      const { AnchorSidebarUI } = await import("./components/anchor-sidebar-ui.js");
      const anchorUI = new AnchorSidebarUI(this.#eventBus);
      anchorUI.initialize();
      this.#container.registerGlobal?.("anchorSidebarUI", anchorUI);
      this.#logger.info("anchorSidebarUI registered globally");
    } catch (e) {
      this.#logger.warn("Failed to initialize/register anchorSidebarUI", e);
    }

    this.#setupEventListeners();
    this.#setupPositionTracker();
    this.#logger.info("PDFAnchorFeature installed");
  }

  async uninstall() {
    if (this.#positionTracker) {
      try {
        this.#positionTracker.deactivate();
      } catch (e) {
        this.#logger.warn("[pdf-anchor] position tracker deactivate failed during uninstall", e);
      }
      this.#positionTracker = null;
    }
    this.#anchorsById.clear();
    this.#activeAnchorId = null;
    this.#eventBus = null;
    this.#container = null;
    this.#navigationService = null;
    this.#lastUpdateAt = null;
  }

  #setupEventListeners() {
    setupAnchorEventListeners({
      logger: this.#logger,
      eventBus: this.#eventBus,
      getAnchorsById: () => this.#anchorsById,
      setAnchorsById: (m) => { this.#anchorsById = m; },
      getActiveAnchorId: () => this.#activeAnchorId,
      setActiveAnchorId: (v) => { this.#activeAnchorId = v; },
      getPendingAnchorIdForNavigate: () => this.#pendingAnchorIdForNavigate,
      setPendingAnchorIdForNavigate: (v) => { this.#pendingAnchorIdForNavigate = v; },
      getLastNav: () => this.#lastNav,
      setLastNav: (v) => { this.#lastNav = v; },
      setLastUpdateAt: (v) => { this.#lastUpdateAt = v; },
      getSnapshotForQuickCreate: () => this.#getSnapshotForQuickCreate(),
      navigateToAnchor: (anchorId) => this.#navigateToAnchor(anchorId),
      emitList: () => this.#emitList(),
    });
  }

  // 统一导航触发：通过导航事件（NAVIGATION.URL_PARAMS.REQUESTED），不再直接调用 navigationService
  #navigateToAnchor(anchorId) {
    navigateToAnchor({
      logger: this.#logger,
      eventBus: this.#eventBus,
      anchorsById: this.#anchorsById,
      positionTracker: this.#positionTracker,
      anchorId,
      setLastNav: (v) => { this.#lastNav = v; },
      setLastUpdateAt: (v) => { this.#lastUpdateAt = v; },
    });
  }

  #setupPositionTracker() {
    try {
      this.#positionTracker = setupAnchorPositionTracker({
        logger: this.#logger,
        container: this.#container,
        eventBus: this.#eventBus,
        getAnchorsById: () => this.#anchorsById,
        getActiveAnchorId: () => this.#activeAnchorId,
        setLastUpdateAt: (v) => { this.#lastUpdateAt = v; },
        getLastUpdateAt: () => this.#lastUpdateAt,
      });
    } catch (e) {
      this.#logger.error("[pdf-anchor] failed to create PositionTracker", e);
      this.#positionTracker = null;
    }
  }

  #getSnapshotForQuickCreate() {
    // 优先使用 PositionTracker 的 snapshot
    if (this.#positionTracker && this.#positionTracker.isActive) {
      try {
        const snap = this.#positionTracker.snapshot();
        if (snap && Number.isFinite(snap.pageAt) && Number.isFinite(snap.position)) {
          return { pageAt: snap.pageAt, position: snap.position };
        }
      } catch (e) {
        this.#logger.debug("[pdf-anchor] PositionTracker.snapshot failed for quick create", e);
      }
    }

    // 回退到直接使用 DOM + 工具函数
    try {
      const viewerContainer = document.getElementById("viewerContainer");
      if (viewerContainer) {
        const snap = getCurrentPageAndPosition(viewerContainer);
        if (snap && Number.isFinite(snap.pageAt) && Number.isFinite(snap.position)) {
          return { pageAt: snap.pageAt, position: snap.position };
        }
      }
    } catch (e) {
      this.#logger.error("[pdf-anchor] getCurrentPageAndPosition failed for quick create", e);
    }

    // 最后兜底到固定位置（Fail‑Fast：不抛错，但不会写入无效位置）
    return { pageAt: 1, position: 0 };
  }

  #emitList() {
    const list = Array.from(this.#anchorsById.values());
    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED, { anchors: list }, { actorId: "PDFAnchorFeature" });
  }
}

export default PDFAnchorFeature;

