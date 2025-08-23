/**
 * PDF Table Sorting - Column Sorting Management
 * @module PDFTableSorting
 */

class PDFTableSorting {
    /**
     * Create a new PDFTableSorting instance
     * @param {PDFTable} table - Parent table instance
     */
    constructor(table) {
        this.table = table;
        this.state = table.state;
        this.config = table.config;
        this.events = table.events;
        
        // Sorting state
        this.sortColumn = this.state.sortColumn || null;
        this.sortDirection = this.state.sortDirection || 'asc';
        this.multiSort = false;
        this.sortHistory = [];
        
        // Setup event listeners
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.events.on('header-click', this.handleHeaderClick.bind(this));
        this.events.on('sort-changed', this.handleSortChanged.bind(this));
    }

    /**
     * Handle header click events
     * @param {Object} event - Header click event
     */
    handleHeaderClick(event) {
        if (!this.config.get('sortable')) return;
        
        const { columnId, event: clickEvent } = event;
        const column = this.config.getColumn(columnId);
        
        if (!column || !column.sortable) return;
        
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
        
        // Handle different sorting modes
        if (clickEvent.shiftKey && this.multiSort) {
            this.handleMultiSort(columnId);
        } else {
            this.handleSingleSort(columnId);
        }
    }

    /**
     * Handle single column sorting
     * @param {string} columnId - Column ID
     */
    handleSingleSort(columnId) {
        if (this.sortColumn === columnId) {
            // Toggle direction
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            // New column
            this.sortColumn = columnId;
            this.sortDirection = 'asc';
        }
        
        // Clear multi-sort history
        this.sortHistory = [{ columnId, direction: this.sortDirection }];
        
        this.updateState();
        this.events.emit('sort-changed', { columnId, direction: this.sortDirection });
    }

    /**
     * Handle multi-column sorting
     * @param {string} columnId - Column ID
     */
    handleMultiSort(columnId) {
        const existingIndex = this.sortHistory.findIndex(item => item.columnId === columnId);
        
        if (existingIndex !== -1) {
            // Toggle direction for existing column
            this.sortHistory[existingIndex].direction = 
                this.sortHistory[existingIndex].direction === 'asc' ? 'desc' : 'asc';
        } else {
            // Add new column to sort history
            this.sortHistory.push({ columnId, direction: 'asc' });
        }
        
        // Update primary sort column and direction
        if (this.sortHistory.length > 0) {
            const primary = this.sortHistory[0];
            this.sortColumn = primary.columnId;
            this.sortDirection = primary.direction;
        }
        
        this.updateState();
        this.events.emit('sort-changed', { 
            columnId, 
            direction: this.sortHistory.find(item => item.columnId === columnId)?.direction || 'asc',
            multiSort: true,
            sortHistory: this.sortHistory
        });
    }

    /**
     * Handle sort changed events
     * @param {Object} event - Sort changed event
     */
    handleSortChanged(event) {
        this.updateSortIndicators();
    }

    /**
     * Apply sorting to data
     * @param {Array} data - Data to sort
     * @returns {Array} Sorted data
     */
    apply(data) {
        if (!this.sortColumn || this.sortHistory.length === 0) {
            return data;
        }
        
        const sortedData = [...data];
        
        // Apply multi-sort if enabled
        if (this.multiSort && this.sortHistory.length > 1) {
            sortedData.sort((a, b) => this.multiSortCompare(a, b));
        } else {
            // Single column sort
            const column = this.config.getColumn(this.sortColumn);
            if (!column) return data;
            
            sortedData.sort((a, b) => this.compareValues(a, b, column));
        }
        
        return sortedData;
    }

    /**
     * Multi-column comparison
     * @param {Object} a - First item
     * @param {Object} b - Second item
     * @returns {number} Comparison result
     */
    multiSortCompare(a, b) {
        for (const sortItem of this.sortHistory) {
            const column = this.config.getColumn(sortItem.columnId);
            if (!column) continue;
            
            const result = this.compareValues(a, b, column, sortItem.direction);
            if (result !== 0) {
                return result;
            }
        }
        return 0;
    }

    /**
     * Compare values for sorting
     * @param {Object} a - First item
     * @param {Object} b - Second item
     * @param {Object} column - Column configuration
     * @param {string} direction - Sort direction
     * @returns {number} Comparison result
     */
    compareValues(a, b, column, direction = this.sortDirection) {
        const aValue = a[column.field];
        const bValue = b[column.field];
        
        // Handle null/undefined values
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return direction === 'asc' ? -1 : 1;
        if (bValue == null) return direction === 'asc' ? 1 : -1;
        
        // Use custom comparator if provided
        if (column.comparator) {
            return column.comparator(aValue, bValue, direction);
        }
        
        // Type-based comparison
        const result = this.compareByType(aValue, bValue, column.type || 'string');
        
        return direction === 'desc' ? -result : result;
    }

    /**
     * Compare values by type
     * @param {*} a - First value
     * @param {*} b - Second value
     * @param {string} type - Value type
     * @returns {number} Comparison result
     */
    compareByType(a, b, type) {
        switch (type) {
            case 'number':
                return a - b;
            case 'date':
                return new Date(a) - new Date(b);
            case 'string':
                return a.localeCompare(b, this.config.get('locale') || 'zh-CN');
            case 'boolean':
                return a === b ? 0 : a ? 1 : -1;
            default:
                // Default to string comparison
                return String(a).localeCompare(String(b), this.config.get('locale') || 'zh-CN');
        }
    }

    /**
     * Set sort column and direction
     * @param {string} columnId - Column ID
     * @param {string} direction - Sort direction
     */
    setSort(columnId, direction = 'asc') {
        const column = this.config.getColumn(columnId);
        if (!column || !column.sortable) {
            throw new Error(`Column ${columnId} is not sortable`);
        }
        
        this.sortColumn = columnId;
        this.sortDirection = direction;
        this.sortHistory = [{ columnId, direction }];
        
        this.updateState();
        this.events.emit('sort-changed', { columnId, direction });
    }

    /**
     * Add sort column (for multi-sort)
     * @param {string} columnId - Column ID
     * @param {string} direction - Sort direction
     */
    addSort(columnId, direction = 'asc') {
        const column = this.config.getColumn(columnId);
        if (!column || !column.sortable) {
            throw new Error(`Column ${columnId} is not sortable`);
        }
        
        // Remove if already exists
        this.sortHistory = this.sortHistory.filter(item => item.columnId !== columnId);
        
        // Add to history
        this.sortHistory.push({ columnId, direction });
        
        // Update primary sort
        if (this.sortHistory.length > 0) {
            const primary = this.sortHistory[0];
            this.sortColumn = primary.columnId;
            this.sortDirection = primary.direction;
        }
        
        this.updateState();
        this.events.emit('sort-changed', { columnId, direction, multiSort: true, sortHistory: this.sortHistory });
    }

    /**
     * Remove sort column
     * @param {string} columnId - Column ID
     */
    removeSort(columnId) {
        this.sortHistory = this.sortHistory.filter(item => item.columnId !== columnId);
        
        // Update primary sort
        if (this.sortHistory.length > 0) {
            const primary = this.sortHistory[0];
            this.sortColumn = primary.columnId;
            this.sortDirection = primary.direction;
        } else {
            this.sortColumn = null;
            this.sortDirection = 'asc';
        }
        
        this.updateState();
        this.events.emit('sort-changed', { columnId, direction: null, removed: true });
    }

    /**
     * Clear all sorting
     */
    clearSort() {
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.sortHistory = [];
        
        this.updateState();
        this.events.emit('sort-changed', { cleared: true });
    }

    /**
     * Update sort state
     */
    updateState() {
        this.state.sortColumn = this.sortColumn;
        this.state.sortDirection = this.sortDirection;
    }

    /**
     * Update sort indicators in UI
     */
    updateSortIndicators() {
        const indicators = document.querySelectorAll('.pdf-table__sort-indicator');
        
        indicators.forEach(indicator => {
            const th = indicator.closest('th');
            const columnId = th?.dataset.columnId;
            
            if (columnId) {
                indicator.className = 'pdf-table__sort-indicator';
                
                if (this.sortColumn === columnId) {
                    indicator.classList.add(`pdf-table__sort-indicator--${this.sortDirection}`);
                }
                
                // Show multi-sort indicators
                if (this.multiSort) {
                    const sortIndex = this.sortHistory.findIndex(item => item.columnId === columnId);
                    if (sortIndex !== -1) {
                        indicator.classList.add('pdf-table__sort-indicator--multi');
                        indicator.setAttribute('data-sort-order', sortIndex + 1);
                    }
                }
            }
        });
    }

    /**
     * Get current sort information
     * @returns {Object} Sort information
     */
    getSortInfo() {
        return {
            column: this.sortColumn,
            direction: this.sortDirection,
            multiSort: this.multiSort,
            sortHistory: [...this.sortHistory]
        };
    }

    /**
     * Get sortable columns
     * @returns {Array} Sortable columns
     */
    getSortableColumns() {
        return this.config.getSortableColumns();
    }

    /**
     * Check if column is sortable
     * @param {string} columnId - Column ID
     * @returns {boolean} Column is sortable
     */
    isColumnSortable(columnId) {
        const column = this.config.getColumn(columnId);
        return column && column.sortable;
    }

    /**
     * Enable/disable multi-sort
     * @param {boolean} enabled - Enable multi-sort
     */
    setMultiSort(enabled) {
        this.multiSort = enabled;
        if (!enabled) {
            // Clear multi-sort history
            this.sortHistory = this.sortHistory.slice(0, 1);
        }
    }

    /**
     * Get sort order for column
     * @param {string} columnId - Column ID
     * @returns {string|null} Sort direction
     */
    getColumnSortOrder(columnId) {
        const sortItem = this.sortHistory.find(item => item.columnId === columnId);
        return sortItem ? sortItem.direction : null;
    }

    /**
     * Check if column is being sorted
     * @param {string} columnId - Column ID
     * @returns {boolean} Column is being sorted
     */
    isColumnSorted(columnId) {
        return this.sortHistory.some(item => item.columnId === columnId);
    }

    /**
     * Get sort priority for column
     * @param {string} columnId - Column ID
     * @returns {number} Sort priority (0-based index)
     */
    getColumnSortPriority(columnId) {
        return this.sortHistory.findIndex(item => item.columnId === columnId);
    }

    /**
     * Destroy sorting manager
     */
    destroy() {
        // Remove event listeners
        this.events.off('header-click', this.handleHeaderClick);
        this.events.off('sort-changed', this.handleSortChanged);
        
        // Clear state
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.sortHistory = [];
    }
}

// Export for use in other modules
// ES6 Module Export
export default PDFTableSorting;

// Legacy export for compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFTableSorting;
} else if (typeof window !== 'undefined') {
    window.PDFTableSorting = PDFTableSorting;
}