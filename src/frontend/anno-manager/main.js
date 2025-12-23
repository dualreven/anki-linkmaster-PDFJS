import { getLogger } from "../common/utils/logger.js";
import { showInfo, showError } from "../common/utils/notification.js";
import { attachBasicWindowControls } from "../common/window/basic-window-controls.js";
import eventBus from "../common/event/event-bus.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../common/event/event-constants.js";
import { Annotation } from "../common/models/annotation.js";

const logger = getLogger("AnnoManagerWindow");
let wsInboundInitialized = false;

function getCurrentPdfIdFromLocation() {
  try {
    const search = typeof window !== "undefined" ? window.location.search || "" : "";
    const params = new URLSearchParams(search);
    const v = params.get("pdf-id") || params.get("pdf_id");
    if (v && v.trim()) {
      return v.trim();
    }
  } catch (e) {
    logger.warn("[AnnoManager] Failed to parse pdf-id from URL", e);
  }
  return null;
}

function setupWsInboundHandlers() {
  if (wsInboundInitialized) {
    return;
  }
  wsInboundInitialized = true;

  eventBus.on(
    WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
    (message) => {
      try {
        const type = message?.type;
        const data = message?.data || {};
        if (type === WEBSOCKET_MESSAGE_TYPES.ANNOTATION_LIST_COMPLETED) {
          const items = Array.isArray(data.annotations) ? data.annotations : [];
          renderAnnotationResults(items);
        } else if (type === WEBSOCKET_MESSAGE_TYPES.ANNOTATION_LIST_FAILED) {
          const msg = data?.message || "加载标注列表失败";
          logger.error("[AnnoManager] annotation:list:failed", { data });
          showError(`标注列表加载失败：${msg}`, 4000);
        }
      } catch (e) {
        logger.error("[AnnoManager] Failed to handle WS inbound message", e);
      }
    },
    { subscriberId: "AnnoManagerWsInbound" }
  );
}

function renderAnnotationResults(rawItems) {
  const container = document.getElementById("anno-manager-results");
  const countBadge = document.getElementById("anno-manager-count-badge");
  if (!container) {
    return;
  }

  container.innerHTML = "";

  const items = [];
  for (const obj of rawItems || []) {
    try {
      const ann = Annotation.fromJSON(obj);
      items.push(ann);
    } catch (e) {
      logger.warn("[AnnoManager] skip invalid annotation from backend", { obj, error: e?.message });
    }
  }

  if (countBadge) {
    countBadge.textContent = `共 ${items.length} 条`;
  }

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "anno-manager-empty-tip";
    empty.textContent = "未找到标注。可以调整搜索条件或从 PDF 导入标注。";
    container.appendChild(empty);
    return;
  }

  items.forEach((ann) => {
    const item = document.createElement("div");
    item.className = "anno-manager-result-item";

    const header = document.createElement("div");
    header.className = "anno-manager-result-header";

    const title = document.createElement("div");
    title.className = "anno-manager-result-title";
    const iconSpan = document.createElement("span");
    iconSpan.className = "anno-manager-result-icon";
    iconSpan.textContent = ann.getTypeIcon();

    const titleSpan = document.createElement("span");
    titleSpan.textContent = ann.title || "（未命名标注）";

    title.appendChild(iconSpan);
    title.appendChild(titleSpan);

    const meta = document.createElement("div");
    meta.className = "anno-manager-result-meta";
    const pdfId = (ann && ann.data && ann.data.pdfId) || null;
    meta.textContent = `PDF: ${pdfId || "未知"} · P.${ann.pageNumber}`;

    header.appendChild(title);
    header.appendChild(meta);

    const body = document.createElement("div");
    body.className = "anno-manager-result-body";
    body.textContent = ann.getDescription();

    item.appendChild(header);
    item.appendChild(body);
    container.appendChild(item);
  });
}

/**
 * 初始化标注管理器基础布局：侧边栏分区 + 结果列表空状态 + 视图模式按钮状态
 * 仅负责前端骨架，不做真实数据查询。
 */
export function initAnnoManagerLayout() {
  const sidebar = document.getElementById("anno-manager-sidebar");
  if (sidebar && !sidebar.dataset.initialized) {
    sidebar.innerHTML = "";

    const sections = [
      {
        id: "filters",
        title: "搜索条件",
        body: "在此展示当前生效的过滤条件（类型 / 重要性 / 是否有卡片），支持单独清除与一键清空。"
      },
      {
        id: "recent-added",
        title: "最近添加",
        body: "按创建时间倒序列出最近添加的标注，点击可在右侧结果列表中定位到对应条目。"
      },
      {
        id: "recent-visited",
        title: "最近访问",
        body: "记录最近在 pdf-viewer 中访问过的标注，方便在管理器中快速回溯。"
      }
    ];

    sections.forEach((section) => {
      const wrapper = document.createElement("section");
      wrapper.className = "anno-manager-sidebar-section";
      wrapper.dataset.sectionId = section.id;

      const title = document.createElement("h2");
      title.className = "anno-manager-sidebar-section-title";
      title.textContent = section.title;

      const body = document.createElement("div");
      body.className = "anno-manager-sidebar-section-body";
      body.textContent = section.body;

      wrapper.appendChild(title);
      wrapper.appendChild(body);
      sidebar.appendChild(wrapper);
    });

    sidebar.dataset.initialized = "1";
  }

  const results = document.getElementById("anno-manager-results");
  if (results && !results.dataset.initialized) {
    const empty = document.createElement("div");
    empty.className = "anno-manager-empty-tip";
    empty.textContent = "暂无标注数据。输入搜索条件或从 PDF 导入标注后，会在此处展示结果列表。";
    results.appendChild(empty);

    results.dataset.initialized = "1";
  }

  const countBadge = document.getElementById("anno-manager-count-badge");
  if (countBadge) {
    countBadge.textContent = "共 0 条";
  }

  const viewModeContainer = document.querySelector(".anno-manager-view-modes");
  if (viewModeContainer && !viewModeContainer.dataset.initialized) {
    viewModeContainer.addEventListener("click", (evt) => {
      const btn = /** @type {HTMLElement|null} */ (evt.target.closest?.(".view-mode-btn") || null);
      if (!btn) {
        return;
      }
      const mode = btn.getAttribute("data-view-mode") || "list";
      viewModeContainer.querySelectorAll(".view-mode-btn").forEach((el) => {
        el.classList.toggle("active", el === btn);
      });

      const container = document.getElementById("anno-manager-results");
      if (!container) {
        return;
      }

      container.classList.remove("anno-manager-results-list", "anno-manager-results-grid-2", "anno-manager-results-grid-3", "anno-manager-results-graph");
      if (mode === "list") {
        container.classList.add("anno-manager-results-list");
      } else if (mode === "grid-2") {
        container.classList.add("anno-manager-results-grid-2");
      } else if (mode === "grid-3") {
        container.classList.add("anno-manager-results-grid-3");
      } else if (mode === "graph") {
        container.classList.add("anno-manager-results-graph");
      }

      logger.info("[AnnoManager] view mode changed", { mode });
    });

    viewModeContainer.dataset.initialized = "1";
  }

  const searchInput = document.getElementById("anno-manager-search-input");
  if (searchInput && !searchInput.dataset?.initialized) {
    searchInput.addEventListener("keydown", (evt) => {
      if (evt.key !== "Enter") {
        return;
      }
      const value = searchInput.value.trim();
      logger.info("[AnnoManager] search requested", { query: value });
      showInfo(value ? `搜索：“${value}”（数据接入开发中）` : "请输入搜索关键字", 2000);
    });
    searchInput.dataset.initialized = "1";
  }

  const filterBtn = document.getElementById("anno-manager-filter-btn");
  if (filterBtn && !filterBtn.dataset?.initialized) {
    filterBtn.addEventListener("click", () => {
      showInfo("筛选条件面板开发中…", 2000);
    });
    filterBtn.dataset.initialized = "1";
  }

  const sortBtn = document.getElementById("anno-manager-sort-btn");
  if (sortBtn && !sortBtn.dataset?.initialized) {
    sortBtn.addEventListener("click", () => {
      showInfo("排序选项面板开发中…", 2000);
    });
    sortBtn.dataset.initialized = "1";
  }

  const importBtn = document.getElementById("anno-manager-import-btn");
  if (importBtn && !importBtn.dataset?.initialized) {
    importBtn.addEventListener("click", () => {
      const pdfId = getCurrentPdfIdFromLocation();
      if (!pdfId) {
        logger.error("[AnnoManager] import from PDF requested but pdf-id is missing in URL");
        showError("无法从 PDF 导入：当前窗口缺少 pdf-id 参数", 4000);
        return;
      }

      logger.info("[AnnoManager] import from PDF requested", { pdfId });
      try {
        eventBus.emit(
          WEBSOCKET_EVENTS.MESSAGE.SEND,
          {
            type: WEBSOCKET_MESSAGE_TYPES.ANNOTATION_LIST,
            data: { pdf_uuid: pdfId }
          },
          { actorId: "AnnoManager" }
        );
        showInfo(`正在从 PDF(${pdfId}) 加载标注…`, 2000);
      } catch (e) {
        logger.error("[AnnoManager] Failed to send annotation:list:requested", e);
        showError("发送标注列表请求失败", 4000);
      }
    });
    importBtn.dataset.initialized = "1";
  }
}

async function bootstrap() {
  logger.info("[AnnoManager] bootstrap start (layout skeleton)");

  try {
    await attachBasicWindowControls({
      clientId: "anno-manager",
      moduleName: "anno-manager",
      bridgeName: "simpleWindowBridge",
      containerSelector: "#window-controls-slot"
    });

    initAnnoManagerLayout();
    setupWsInboundHandlers();
    showInfo("标注管理器窗口已打开", 2000);
  } catch (e) {
    logger.error("[AnnoManager] bootstrap failed", e, {
      toast: { type: "error", ms: 4000 }
    });
  }
}

if (typeof window !== "undefined" && !(window && window.__ANNO_MANAGER_TEST__)) {
  bootstrap();
}
