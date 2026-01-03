import { SorterPanel } from "./components/sorter-panel.js";
import { ModeSelector } from "./components/mode-selector.js";
import { MultiSortBuilder } from "./components/multi-sort-builder.js";
import { WeightedSortEditor } from "./components/weighted-sort-editor.js";

export function createSorterUIComponents({ logger, scopedEventBus, config }) {
  if (!logger) { throw new Error("[PDFSorterFeature] createSorterUIComponents: logger is required"); }
  if (!scopedEventBus) { throw new Error("[PDFSorterFeature] createSorterUIComponents: scopedEventBus is required"); }
  if (!config) { throw new Error("[PDFSorterFeature] createSorterUIComponents: config is required"); }

  logger.debug("[DEBUG PDFSorterFeature] Creating UI components...");

  const sorterPanel = new SorterPanel(logger, scopedEventBus);
  logger.debug("[DEBUG PDFSorterFeature] SorterPanel created:", sorterPanel);
  sorterPanel.render();
  logger.debug("[DEBUG PDFSorterFeature] SorterPanel rendered");

  const modeSelector = new ModeSelector(logger, scopedEventBus, { defaultMode: 2 });
  modeSelector.render(sorterPanel.getModeSelectorContainer());

  const multiSortBuilder = new MultiSortBuilder(logger, scopedEventBus, {
    availableFields: config.sorter.sortableFields,
    maxFields: config.sorter.maxSortFields,
  });
  multiSortBuilder.render(sorterPanel.getMultiSortContainer());

  const weightedSortEditor = new WeightedSortEditor(logger, scopedEventBus, {
    availableFields: config.sorter.sortableFields,
  });
  weightedSortEditor.render(sorterPanel.getWeightedSortContainer());

  logger.info("[PDFSorterFeature] UI components created");

  return {
    sorterPanel,
    modeSelector,
    multiSortBuilder,
    weightedSortEditor,
  };
}

