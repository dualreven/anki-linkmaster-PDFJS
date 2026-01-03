import { SORTER_EVENTS } from "../../../common/event/event-constants.js";
import { PDFSorterFeatureConfig } from "./feature.config.js";

export function getDefaultSortFromConfig(config) {
  const { defaultSortField, defaultSortDirection } = config.sorter;
  return [{ field: defaultSortField, direction: defaultSortDirection }];
}

export function setSort(ctx, field, direction = "asc") {
  const { enabled, logger, config, getCurrentSort, setCurrentSort, scopedEventBus } = ctx;

  if (!enabled) {
    logger.warn("Cannot set sort: feature is disabled");
    return false;
  }

  const sortableFields = config.sorter.sortableFields;
  const fieldConfig = sortableFields.find((f) => f.field === field);

  if (!fieldConfig) {
    logger.error(`Field "${field}" is not sortable`);
    return false;
  }

  logger.info(`Setting sort: ${field} ${direction}`);
  setCurrentSort([{ field, direction }]);
  scopedEventBus?.emit(SORTER_EVENTS.SORT.CHANGED, getCurrentSort());
  return true;
}

export function addSort(ctx, field, direction = "asc") {
  const { enabled, logger, config, getCurrentSort, setCurrentSort, scopedEventBus } = ctx;

  if (!enabled) {
    logger.warn("Cannot add sort: feature is disabled");
    return false;
  }

  const { multiSort, maxSortFields } = config.sorter;

  if (!multiSort) {
    logger.warn("Multi-sort is not enabled");
    return false;
  }

  const currentSort = getCurrentSort();
  if (currentSort.length >= maxSortFields) {
    logger.warn(`Maximum sort fields (${maxSortFields}) reached`);
    return false;
  }

  const nextSort = [...currentSort];
  const existingIndex = nextSort.findIndex((s) => s.field === field);
  if (existingIndex !== -1) {
    nextSort[existingIndex].direction = direction;
  } else {
    nextSort.push({ field, direction });
  }

  setCurrentSort(nextSort);
  logger.info("Sort configuration updated:", getCurrentSort());
  scopedEventBus?.emit(SORTER_EVENTS.SORT.CHANGED, getCurrentSort());
  return true;
}

export function applyCurrentSort(ctx) {
  const { enabled, logger, getCurrentSort, sortManager, scopedEventBus } = ctx;

  if (!enabled) {
    logger.warn("Cannot apply sort: feature is disabled");
    return;
  }

  const currentSort = getCurrentSort();
  logger.info("Applying sort:", currentSort);

  try {
    sortManager?.applyMultiSort(currentSort);
    scopedEventBus?.emitGlobal(PDFSorterFeatureConfig.config.events.global.SORT_APPLIED, currentSort);
  } catch (error) {
    logger.error("[PDFSorterFeature] Failed to apply current sort", error);
  }
}

export function clearSort(ctx) {
  const { enabled, logger, config, setCurrentSort, scopedEventBus } = ctx;

  if (!enabled) {
    logger.warn("Cannot clear sort: feature is disabled");
    return false;
  }

  logger.info("Clearing sort");

  setCurrentSort(getDefaultSortFromConfig(config));
  scopedEventBus?.emit(SORTER_EVENTS.SORT.CHANGED, ctx.getCurrentSort());
  return true;
}

export function saveSortScheme(ctx, name) {
  const { enabled, logger, getCurrentSort, scopedEventBus } = ctx;

  if (!enabled) {
    logger.warn("Cannot save sort scheme: feature is disabled");
    return;
  }

  const scheme = {
    name,
    sort: [...getCurrentSort()],
    createdAt: new Date().toISOString(),
  };

  logger.info("Saving sort scheme:", scheme);
  scopedEventBus?.emit(SORTER_EVENTS.SORT.SAVED, scheme);
}

export function loadSortScheme(ctx, name) {
  const { enabled, logger, scopedEventBus } = ctx;

  if (!enabled) {
    logger.warn("Cannot load sort scheme: feature is disabled");
    return;
  }

  logger.info("Loading sort scheme:", name);
  scopedEventBus?.emit(SORTER_EVENTS.SORT.LOADED, { name });
}
