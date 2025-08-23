/**
 * PDF Table Selection - Row Selection Management
 * @module PDFTableSelection
 */

class PDFTableSelection {
    /**
     * Create a new PDFTableSelection instance
     * @param {PDFTable} table - Parent table instance
     */
    constructor(table) {
        this.table = table;
        this.state = table.state;
        this.config = table.config;
        this.events = table.events;
        
        // Selection state
        this.selectedRows = this.state.selectedRows || new Set();
        this.lastSelectedRow = null;
        this.isSelecting = false;
        this.selectionRange = null;
        
        // Settings
        this.multiSelect = this.config.get('multiSelect');
        this.selectAll = this.config.get('selectAll');
        this.rowClickSelect = this.config.get('rowClickSelect');
        
        // Setup event listeners
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Row click events
        this.events.on('row-click', this.handleRowClick.bind(this));
        
        // Checkbox click events
        this.events.on('checkbox-click', this.handleCheckboxClick.bind(this));
        
        // Header click events (for select all)
        this.events.on('header-click', this.handleHeaderClick.bind(this));
        
        // Keyboard events
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        
        // Data change events
        this.events.on('data-changed', this.handleDataChange.bind(this));
    }

    /**
     * Handle row click events
     * @param {Object} event - Row click event
     */
    handleRowClick(event) {
        if (!this.config.get('selectable') || !this.rowClickSelect) return;
        
        const { rowData, event: clickEvent } = event;
        const rowId = rowData.id;
        
        // Ignore if clicking on interactive elements
        if (clickEvent.target.closest('button, input, select, a')) {
            return;
        }
        
        // Handle different selection modes
        if (clickEvent.ctrlKey || clickEvent.metaKey) {
            // Multi-select with Ctrl/Cmd
            this.toggleRowSelection(rowId);
        } else if (clickEvent.shiftKey) {
            // Range selection with Shift
            this.handleRangeSelection(rowId);
        } else {
            // Single selection
            this.selectSingleRow(rowId);
        }
        
        this.lastSelectedRow = rowId;
        this.events.emit('selection-changed', this.getSelectedRows());
    }

    /**
     * Handle checkbox click events
     * @param {Object} event - Checkbox click event
     */
    handleCheckboxClick(event) {
        if (!this.config.get('selectable')) return;
        
        const { rowId, checked } = event;
        
        if (checked) {
            this.selectedRows.add(rowId);
        } else {
            this.selectedRows.delete(rowId);
        }
        
        this.updateRowVisualState(rowId);
        this.updateSelectAllCheckbox();
        this.events.emit('selection-changed', this.getSelectedRows());
    }

    /**
     * Handle header click events (for select all)
     * @param {Object} event - Header click event
     */
    handleHeaderClick(event) {
        if (!this.config.get('selectable') || !this.selectAll) return;
        
        const { columnId } = event;
        const column = this.config.getColumn(columnId);
        
        // Check if this is the select column
        if (column && column.id === 'select') {
            this.toggleSelectAll();
        }
    }

    /**
     * Handle keyboard events
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyDown(event) {
        if (!this.config.get('selectable')) return;
        
        switch (event.key) {
            case 'a':
            case 'A':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.selectAllRows();
                }
                break;
            case 'Escape':
                this.clearSelection();
                break;
            case 'ArrowUp':
            case 'ArrowDown':
            case 'ArrowLeft':
            case 'ArrowRight':
                this.handleArrowKeyNavigation(event);
                break;
        }
    }

    /**
     * Handle key up events
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyUp(event) {
        // Handle any key up events if needed
    }

    /**
     * Handle data change events
     * @param {Array} data - New data
     */
    handleDataChange(data) {
        // Remove selections for rows that no longer exist
        const existingIds = new Set(data.map(row => row.id));
        const removedIds = Array.from(this.selectedRows).filter(id => !existingIds.has(id));
        
        removedIds.forEach(id => {
            this.selectedRows.delete(id);
        });
        
        if (removedIds.length > 0) {
            this.events.emit('selection-changed', this.getSelectedRows());
        }
    }

    /**
     * Toggle row selection
     * @param {string} rowId - Row ID
     */
    toggleRowSelection(rowId) {
        if (this.selectedRows.has(rowId)) {
            this.selectedRows.delete(rowId);
        } else {
            this.selectedRows.add(rowId);
        }
        
        this.updateRowVisualState(rowId);
        this.updateSelectAllCheckbox();
    }

    /**
     * Select single row
     * @param {string} rowId - Row ID
     */
    selectSingleRow(rowId) {
        if (!this.multiSelect) {
            this.selectedRows.clear();
        }
        
        this.selectedRows.add(rowId);
        this.updateAllRowsVisualState();
        this.updateSelectAllCheckbox();
    }

    /**
     * Handle range selection
     * @param {string} endRowId - End row ID
     */
    handleRangeSelection(endRowId) {
        if (!this.multiSelect || !this.lastSelectedRow) {
            this.selectSingleRow(endRowId);
            return;
        }
        
        const visibleRows = this.getVisibleRows();
        const startIndex = visibleRows.findIndex(row => row.id === this.lastSelectedRow);
        const endIndex = visibleRows.findIndex(row => row.id === endRowId);
        
        if (startIndex === -1 || endIndex === -1) {
            this.selectSingleRow(endRowId);
            return;
        }
        
        const [start, end] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];
        
        // Clear selection if not holding Ctrl
        if (!this.isMultiSelectKeyPressed()) {
            this.selectedRows.clear();
        }
        
        // Select range
        for (let i = start; i <= end; i++) {
            this.selectedRows.add(visibleRows[i].id);
        }
        
        this.updateAllRowsVisualState();
        this.updateSelectAllCheckbox();
    }

    /**
     * Toggle select all
     */
    toggleSelectAll() {
        const visibleRows = this.getVisibleRows();
        
        if (this.areAllVisibleRowsSelected()) {
            // Deselect all
            visibleRows.forEach(row => this.selectedRows.delete(row.id));
        } else {
            // Select all
            visibleRows.forEach(row => this.selectedRows.add(row.id));
        }
        
        this.updateAllRowsVisualState();
        this.updateSelectAllCheckbox();
        this.events.emit('selection-changed', this.getSelectedRows());
    }

    /**
     * Select all rows
     */
    selectAllRows() {
        const visibleRows = this.getVisibleRows();
        visibleRows.forEach(row => this.selectedRows.add(row.id));
        
        this.updateAllRowsVisualState();
        this.updateSelectAllCheckbox();
        this.events.emit('selection-changed', this.getSelectedRows());
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.selectedRows.clear();
        this.updateAllRowsVisualState();
        this.updateSelectAllCheckbox();
        this.events.emit('selection-changed', []);
    }

    /**
     * Update row visual state
     * @param {string} rowId - Row ID
     */
    updateRowVisualState(rowId) {
        const rowElement = this.table.renderer.getRowElement(rowId);
        if (rowElement) {
            rowElement.classList.toggle('pdf-table__row--selected', 
                this.selectedRows.has(rowId));
            
            // Update checkbox
            const checkbox = rowElement.querySelector('.pdf-table-checkbox');
            if (checkbox) {
                checkbox.checked = this.selectedRows.has(rowId);
            }
        }
    }

    /**
     * Update all rows visual state
     */
    updateAllRowsVisualState() {
        this.selectedRows.forEach(rowId => {
            this.updateRowVisualState(rowId);
        });
        
        // Update unselected rows
        const allRows = this.table.renderer.getRowElements();
        allRows.forEach(rowElement => {
            const rowId = rowElement.dataset.rowId;
            if (rowId && !this.selectedRows.has(rowId)) {
                rowElement.classList.remove('pdf-table__row--selected');
                
                const checkbox = rowElement.querySelector('.pdf-table-checkbox');
                if (checkbox) {
                    checkbox.checked = false;
                }
            }
        });
    }

    /**
     * Update select all checkbox
     */
    updateSelectAllCheckbox() {
        const selectAllCheckbox = document.querySelector('.pdf-table__select-all-checkbox');
        if (selectAllCheckbox) {
            const visibleRows = this.getVisibleRows();
            const selectedCount = Array.from(this.selectedRows).filter(id => 
                visibleRows.some(row => row.id === id)
            ).length;
            
            if (visibleRows.length === 0) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            } else if (selectedCount === 0) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            } else if (selectedCount === visibleRows.length) {
                selectAllCheckbox.checked = true;
                selectAllCheckbox.indeterminate = false;
            } else {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = true;
            }
        }
    }

    /**
     * Get selected rows
     * @returns {Array} Selected row data
     */
    getSelectedRows() {
        return Array.from(this.selectedRows).map(id => 
            this.table.state.data.find(row => row.id === id)
        ).filter(Boolean);
    }

    /**
     * Get selected row IDs
     * @returns {Array} Selected row IDs
     */
    getSelectedRowIds() {
        return Array.from(this.selectedRows);
    }

    /**
     * Get visible rows
     * @returns {Array} Visible row data
     */
    getVisibleRows() {
        return this.table.getVisibleData();
    }

    /**
     * Check if row is selected
     * @param {string} rowId - Row ID
     * @returns {boolean} Row is selected
     */
    isRowSelected(rowId) {
        return this.selectedRows.has(rowId);
    }

    /**
     * Check if all visible rows are selected
     * @returns {boolean} All visible rows are selected
     */
    areAllVisibleRowsSelected() {
        const visibleRows = this.getVisibleRows();
        if (visibleRows.length === 0) return false;
        
        return visibleRows.every(row => this.selectedRows.has(row.id));
    }

    /**
     * Check if any rows are selected
     * @returns {boolean} Any rows are selected
     */
    hasSelection() {
        return this.selectedRows.size > 0;
    }

    /**
     * Get selection count
     * @returns {number} Number of selected rows
     */
    getSelectionCount() {
        return this.selectedRows.size;
    }

    /**
     * Check if multi-select key is pressed
     * @returns {boolean} Multi-select key is pressed
     */
    isMultiSelectKeyPressed() {
        // This would need to be tracked in mousedown/keydown events
        // For now, return false
        return false;
    }

    /**
     * Handle arrow key navigation
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleArrowKeyNavigation(event) {
        if (!this.lastSelectedRow) return;
        
        const visibleRows = this.getVisibleRows();
        const currentIndex = visibleRows.findIndex(row => row.id === this.lastSelectedRow);
        
        if (currentIndex === -1) return;
        
        let newIndex = currentIndex;
        
        switch (event.key) {
            case 'ArrowUp':
                newIndex = Math.max(0, currentIndex - 1);
                break;
            case 'ArrowDown':
                newIndex = Math.min(visibleRows.length - 1, currentIndex + 1);
                break;
            case 'ArrowLeft':
            case 'ArrowRight':
                // Horizontal navigation not implemented for now
                return;
        }
        
        if (newIndex !== currentIndex) {
            event.preventDefault();
            
            const newRow = visibleRows[newIndex];
            if (event.shiftKey && this.multiSelect) {
                this.handleRangeSelection(newRow.id);
            } else {
                this.selectSingleRow(newRow.id);
            }
            
            this.lastSelectedRow = newRow.id;
            
            // Scroll to selected row
            this.scrollToRow(newRow.id);
        }
    }

    /**
     * Scroll to row
     * @param {string} rowId - Row ID
     */
    scrollToRow(rowId) {
        const rowElement = this.table.renderer.getRowElement(rowId);
        if (rowElement) {
            rowElement.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    }

    /**
     * Select rows by criteria
     * @param {Function} criteria - Selection criteria function
     * @returns {Array} Selected rows
     */
    selectRowsByCriteria(criteria) {
        const visibleRows = this.getVisibleRows();
        const selected = visibleRows.filter(criteria);
        
        selected.forEach(row => {
            this.selectedRows.add(row.id);
        });
        
        this.updateAllRowsVisualState();
        this.updateSelectAllCheckbox();
        this.events.emit('selection-changed', this.getSelectedRows());
        
        return selected;
    }

    /**
     * Select rows by IDs
     * @param {Array} rowIds - Row IDs to select
     */
    selectRowsByIds(rowIds) {
        if (!Array.isArray(rowIds)) return;
        
        rowIds.forEach(rowId => {
            this.selectedRows.add(rowId);
        });
        
        this.updateAllRowsVisualState();
        this.updateSelectAllCheckbox();
        this.events.emit('selection-changed', this.getSelectedRows());
    }

    /**
     * Deselect rows by IDs
     * @param {Array} rowIds - Row IDs to deselect
     */
    deselectRowsByIds(rowIds) {
        if (!Array.isArray(rowIds)) return;
        
        rowIds.forEach(rowId => {
            this.selectedRows.delete(rowId);
        });
        
        this.updateAllRowsVisualState();
        this.updateSelectAllCheckbox();
        this.events.emit('selection-changed', this.getSelectedRows());
    }

    /**
     * Invert selection
     */
    invertSelection() {
        const visibleRows = this.getVisibleRows();
        
        visibleRows.forEach(row => {
            if (this.selectedRows.has(row.id)) {
                this.selectedRows.delete(row.id);
            } else {
                this.selectedRows.add(row.id);
            }
        });
        
        this.updateAllRowsVisualState();
        this.updateSelectAllCheckbox();
        this.events.emit('selection-changed', this.getSelectedRows());
    }

    /**
     * Get selection info
     * @returns {Object} Selection information
     */
    getSelectionInfo() {
        const selectedRows = this.getSelectedRows();
        const visibleRows = this.getVisibleRows();
        
        return {
            count: this.selectedRows.size,
            totalCount: visibleRows.length,
            percentage: visibleRows.length > 0 ? (this.selectedRows.size / visibleRows.length) * 100 : 0,
            rows: selectedRows,
            ids: Array.from(this.selectedRows)
        };
    }

    /**
     * Destroy selection manager
     */
    destroy() {
        // Remove event listeners
        this.events.off('row-click', this.handleRowClick);
        this.events.off('checkbox-click', this.handleCheckboxClick);
        this.events.off('header-click', this.handleHeaderClick);
        this.events.off('data-changed', this.handleDataChange);
        
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        
        // Clear selection
        this.clearSelection();
        
        // Reset state
        this.selectedRows.clear();
        this.lastSelectedRow = null;
        this.isSelecting = false;
        this.selectionRange = null;
    }
}

// Export for use in other modules
// ES6 Module Export
export default PDFTableSelection;

// Legacy export for compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFTableSelection;
} else if (typeof window !== 'undefined') {
    window.PDFTableSelection = PDFTableSelection;
}