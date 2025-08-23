/**
 * PDF Table Module - Main Entry Point
 * @module PDFTableModule
 */

// Import all components
import PDFTable from './pdf-table.js';
import PDFTableConfig from './pdf-table-config.js';
import PDFTableDataModel from './pdf-table-data-model.js';
import PDFTableRenderer from './pdf-table-renderer.js';
import PDFTableSelection from './pdf-table-selection.js';
import PDFTableSorting from './pdf-table-sorting.js';
import PDFTableFiltering from './pdf-table-filtering.js';
import PDFTablePagination from './pdf-table-pagination.js';
import PDFTableEvents from './pdf-table-events.js';
import PDFTableUtils from './pdf-table-utils.js';

// Import styles
import './pdf-table-styles.css';

// Export all components
export {
    PDFTable,
    PDFTableConfig,
    PDFTableDataModel,
    PDFTableRenderer,
    PDFTableSelection,
    PDFTableSorting,
    PDFTableFiltering,
    PDFTablePagination,
    PDFTableEvents,
    PDFTableUtils
};

// Export default
export default PDFTable;

// Global export for browser usage
if (typeof window !== 'undefined') {
    window.PDFTableModule = {
        PDFTable,
        PDFTableConfig,
        PDFTableDataModel,
        PDFTableRenderer,
        PDFTableSelection,
        PDFTableSorting,
        PDFTableFiltering,
        PDFTablePagination,
        PDFTableEvents,
        PDFTableUtils
    };
}