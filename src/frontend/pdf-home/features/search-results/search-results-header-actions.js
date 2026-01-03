import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES, PDF_MANAGEMENT_EVENTS } from "../../../common/event/event-constants.js";

function getSelectedIds(documentRef) {
  return Array.from(documentRef.querySelectorAll(".search-result-checkbox:checked"))
    .map((el) => el.getAttribute("data-id"))
    .filter(Boolean)
    .map((x) => String(x));
}

function emitGlobalOrThrow(scopedEventBus, event, payload) {
  if (!scopedEventBus || typeof scopedEventBus.emitGlobal !== "function") {
    throw new Error("[search-results-header-actions] scopedEventBus.emitGlobal is required");
  }
  scopedEventBus.emitGlobal(event, payload);
}

export function ensureSearchResultsHeaderActions({
  logger,
  headerElement,
  layoutController,
  getCurrentResults,
  globalEventBus,
  scopedEventBus,
  documentRef,
}) {
  const existingActions = headerElement.querySelector(".batch-actions");
  if (existingActions) {
    const existingToggle = existingActions.querySelector(".layout-toggle");
    if (existingToggle) {
      layoutController.bindLayoutButtons(existingToggle);
    }
    return;
  }

  const actionsDiv = documentRef.createElement("div");
  actionsDiv.className = "batch-actions";
  actionsDiv.innerHTML = `
    <button class="batch-action-btn batch-btn-review" title="批量复习选中项">
      🔁 复习
    </button>
    <button class="batch-action-btn batch-btn-read" title="批量阅读选中项">
      📖 阅读
    </button>
    <button class="batch-action-btn batch-btn-edit" title="批量编辑选中项">
      ✏️ 编辑
    </button>
    <button class="batch-action-btn batch-btn-delete" title="批量删除选中项">
      🗑️ 删除
    </button>
  `;

  const layoutToggle = documentRef.createElement("div");
  layoutToggle.className = "layout-toggle";
  layoutToggle.innerHTML = `
    <span class="layout-toggle__label">布局</span>
    <button type="button" class="layout-toggle__btn" data-layout="single" title="单栏">1栏</button>
    <button type="button" class="layout-toggle__btn" data-layout="double" title="双栏">2栏</button>
    <button type="button" class="layout-toggle__btn" data-layout="triple" title="三栏">3栏</button>
  `;
  actionsDiv.appendChild(layoutToggle);

  headerElement.appendChild(actionsDiv);

  const readBtn = actionsDiv.querySelector(".batch-btn-read");
  if (readBtn) {
    readBtn.addEventListener("click", async () => {
      try {
        const selectedIds = getSelectedIds(documentRef);
        if (!selectedIds.length) {
          logger.info("[SearchResultsFeature] 未选择任何条目，阅读操作中止");
          logger.warn("请先选择要阅读的PDF", { toast: { type: "warn", ms: 3000 } });
          return;
        }
        logger.info("[SearchResultsFeature] 发起阅读（批量，WS）", { count: selectedIds.length });
        for (const id of selectedIds) {
          const rid = `open-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const msg = {
            type: WEBSOCKET_MESSAGE_TYPES.OPEN_PDF,
            request_id: rid,
            metadata: { version: "1.0.0" },
            data: { pdf_id: id },
          };
          emitGlobalOrThrow(scopedEventBus, WEBSOCKET_EVENTS.MESSAGE.SEND, msg);
        }
      } catch (e) {
        logger.error("[SearchResultsFeature] 执行阅读失败", e);
      }
    });
  }

  const editBtn = actionsDiv.querySelector(".batch-btn-edit");
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      try {
        const selectedIds = getSelectedIds(documentRef);
        if (!selectedIds.length) {
          logger.info("[SearchResultsFeature] 未选择任何条目，编辑操作中止");
          logger.warn("未选择任何条目", { toast: { type: "warn", ms: 3000 } });
          return;
        }

        const firstId = String(selectedIds[0]);
        const record = (getCurrentResults() || []).find((r) => String(r?.id) === firstId);
        if (!record) {
          logger.warn("[SearchResultsFeature] 选中记录未在当前结果中找到", { id: firstId });
          logger.warn("无法获取选中的PDF记录", { toast: { type: "warn", ms: 3000 } });
          return;
        }

        logger.info("[SearchResultsFeature] 触发编辑请求", { id: record.id, filename: record.filename });
        globalEventBus.emit(PDF_MANAGEMENT_EVENTS.EDIT.REQUESTED, record);
      } catch (e) {
        logger.error("[SearchResultsFeature] 执行编辑失败", e);
      }
    });
  }

  layoutController.bindLayoutButtons(layoutToggle);

  logger.debug("[SearchResultsFeature] Batch action buttons created");
}

