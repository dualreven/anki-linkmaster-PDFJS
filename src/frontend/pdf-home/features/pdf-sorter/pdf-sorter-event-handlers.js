import { SEARCH_EVENTS } from "../../../common/event/event-constants.js";

export function buildBackendSortRulesFromMultiSortConfigs(configs) {
  if (!Array.isArray(configs) || configs.length === 0) { return []; }

  return configs.map((c) => ({
    field: String(c?.field || ""),
    direction: String(c?.direction || "asc").toLowerCase() === "desc" ? "desc" : "asc",
  }));
}

export function buildBackendSortRulesFromWeightedFormula(formula) {
  return [{ field: "weighted", direction: "desc", formula: String(formula || "") }];
}

export async function handleApplySort({ data, sortManager, globalEventBus, logger, showError }) {
  if (!logger) { throw new Error("[PDFSorterFeature] handleApplySort: logger is required"); }
  if (!data || typeof data !== "object") { throw new Error("[PDFSorterFeature] handleApplySort: data is required"); }

  logger.info("[PDFSorterFeature] Handling apply sort", data);

  try {
    if (data.type === "multi") {
      if (!sortManager) { throw new Error("[PDFSorterFeature] handleApplySort: sortManager is required for multi-sort"); }
      await sortManager.applyMultiSort(data.configs);

      try {
        const sortRules = buildBackendSortRulesFromMultiSortConfigs(data.configs);
        if (sortRules.length > 0) {
          globalEventBus.emit(SEARCH_EVENTS.QUERY.REQUESTED, { sort: sortRules });
        }
      } catch (e) {
        logger?.warn("[PDFSorterFeature] Failed to emit backend multi-sort request", e);
      }
      return;
    }

    if (data.type === "weighted") {
      if (!sortManager) { throw new Error("[PDFSorterFeature] handleApplySort: sortManager is required for weighted-sort"); }
      await sortManager.applyWeightedSort(data.formula);

      try {
        const sortRules = buildBackendSortRulesFromWeightedFormula(data.formula);
        globalEventBus.emit(SEARCH_EVENTS.QUERY.REQUESTED, { sort: sortRules });
      } catch (e) {
        logger?.warn("[PDFSorterFeature] Failed to emit backend weighted sort request", e);
      }
      return;
    }

    throw new Error(`[PDFSorterFeature] handleApplySort: unsupported type "${String(data.type)}"`);
  } catch (error) {
    logger.error("[PDFSorterFeature] Failed to apply sort", error);
    try { showError(`排序失败: ${error?.message || error}`, 5000); } catch (e) { void e; /* logger-guard */ }
    throw error;
  }
}
