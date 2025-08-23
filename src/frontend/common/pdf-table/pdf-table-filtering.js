/**
 * PDF Table Filtering - Data Filtering Management
 * @module PDFTableFiltering
 */

class PDFTableFiltering {
    /**
     * Create a new PDFTableFiltering instance
     * @param {PDFTable} table - Parent table instance
     */
    constructor(table) {
        this.table = table;
        this.state = table.state;
        this.config = table.config;
        this.events = table.events;
        
        // Filtering state
        this.filters = new Map();
        this.globalFilter = null;
        this.filterHistory = [];
        this.activeFilters = 0;
        
        // Setup event listeners
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.events.on('filter-changed', this.handleFilterChanged.bind(this));
        this.events.on('data-changed', this.handleDataChanged.bind(this));
    }

    /**
     * Handle filter changed events
     * @param {Object} event - Filter changed event
     */
    handleFilterChanged(event) {
        this.updateFilterIndicators();
    }

    /**
     * Handle data changed events
     * @param {Array} data - New data
     */
    handleDataChanged(data) {
        // Reapply filters when data changes
        this.applyAllFilters(data);
    }

    /**
     * Apply filtering to data
     * @param {Array} data - Data to filter
     * @returns {Array} Filtered data
     */
    apply(data) {
        if (this.filters.size === 0 && !this.globalFilter) {
            return data;
        }
        
        let filteredData = [...data];
        
        // Apply global filter first
        if (this.globalFilter) {
            filteredData = filteredData.filter(row => this.globalFilter(row));
        }
        
        // Apply column filters
        for (const [columnId, filterConfig] of this.filters) {
            const column = this.config.getColumn(columnId);
            if (!column) continue;
            
            filteredData = filteredData.filter(row => {
                const value = row[column.field];
                return this.applyColumnFilter(value, filterConfig, column);
            });
        }
        
        return filteredData;
    }

    /**
     * Apply column filter
     * @param {*} value - Value to filter
     * @param {Object} filterConfig - Filter configuration
     * @param {Object} column - Column configuration
     * @returns {boolean} Filter result
     */
    applyColumnFilter(value, filterConfig, column) {
        const { type, operator, operand, customFilter } = filterConfig;
        
        // Use custom filter if provided
        if (customFilter) {
            return customFilter(value, column);
        }
        
        // Handle null/undefined values
        if (value == null) {
            return operator === 'empty' || operator === 'not_empty';
        }
        
        // Apply filter based on type
        switch (type) {
            case 'text':
                return this.applyTextFilter(value, operator, operand);
            case 'number':
                return this.applyNumberFilter(value, operator, operand);
            case 'date':
                return this.applyDateFilter(value, operator, operand);
            case 'boolean':
                return this.applyBooleanFilter(value, operator, operand);
            case 'array':
                return this.applyArrayFilter(value, operator, operand);
            default:
                return true;
        }
    }

    /**
     * Apply text filter
     * @param {string} value - Value to filter
     * @param {string} operator - Filter operator
     * @param {string} operand - Filter operand
     * @returns {boolean} Filter result
     */
    applyTextFilter(value, operator, operand) {
        const text = String(value).toLowerCase();
        const search = String(operand).toLowerCase();
        
        switch (operator) {
            case 'equals':
                return text === search;
            case 'not_equals':
                return text !== search;
            case 'contains':
                return text.includes(search);
            case 'not_contains':
                return !text.includes(search);
            case 'starts_with':
                return text.startsWith(search);
            case 'ends_with':
                return text.endsWith(search);
            case 'empty':
                return text === '';
            case 'not_empty':
                return text !== '';
            default:
                return true;
        }
    }

    /**
     * Apply number filter
     * @param {number} value - Value to filter
     * @param {string} operator - Filter operator
     * @param {number} operand - Filter operand
     * @returns {boolean} Filter result
     */
    applyNumberFilter(value, operator, operand) {
        const num = Number(value);
        
        if (isNaN(num)) return false;
        
        switch (operator) {
            case 'equals':
                return num === operand;
            case 'not_equals':
                return num !== operand;
            case 'greater_than':
                return num > operand;
            case 'less_than':
                return num < operand;
            case 'greater_equal':
                return num >= operand;
            case 'less_equal':
                return num <= operand;
            case 'between':
                return num >= operand[0] && num <= operand[1];
            default:
                return true;
        }
    }

    /**
     * Apply date filter
     * @param {string} value - Value to filter
     * @param {string} operator - Filter operator
     * @param {string|Array} operand - Filter operand
     * @returns {boolean} Filter result
     */
    applyDateFilter(value, operator, operand) {
        const date = new Date(value);
        
        if (isNaN(date.getTime())) return false;
        
        switch (operator) {
            case 'equals':
                return date.toDateString() === new Date(operand).toDateString();
            case 'before':
                return date < new Date(operand);
            case 'after':
                return date > new Date(operand);
            case 'between':
                return date >= new Date(operand[0]) && date <= new Date(operand[1]);
            case 'today':
                const today = new Date();
                return date.toDateString() === today.toDateString();
            case 'this_week':
                const weekStart = new Date();
                weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                weekStart.setHours(0, 0, 0, 0);
                return date >= weekStart;
            case 'this_month':
                const monthStart = new Date();
                monthStart.setDate(1);
                monthStart.setHours(0, 0, 0, 0);
                return date >= monthStart;
            default:
                return true;
        }
    }

    /**
     * Apply boolean filter
     * @param {boolean} value - Value to filter
     * @param {string} operator - Filter operator
     * @param {boolean} operand - Filter operand
     * @returns {boolean} Filter result
     */
    applyBooleanFilter(value, operator, operand) {
        switch (operator) {
            case 'equals':
                return value === operand;
            case 'not_equals':
                return value !== operand;
            default:
                return true;
        }
    }

    /**
     * Apply array filter
     * @param {Array} value - Value to filter
     * @param {string} operator - Filter operator
     * @param {string|Array} operand - Filter operand
     * @returns {boolean} Filter result
     */
    applyArrayFilter(value, operator, operand) {
        if (!Array.isArray(value)) return false;
        
        switch (operator) {
            case 'contains':
                return value.includes(operand);
            case 'not_contains':
                return !value.includes(operand);
            case 'contains_any':
                return Array.isArray(operand) && value.some(item => operand.includes(item));
            case 'contains_all':
                return Array.isArray(operand) && operand.every(item => value.includes(item));
            case 'empty':
                return value.length === 0;
            case 'not_empty':
                return value.length > 0;
            default:
                return true;
        }
    }

    /**
     * Add column filter
     * @param {string} columnId - Column ID
     * @param {Object} filterConfig - Filter configuration
     */
    addFilter(columnId, filterConfig) {
        const column = this.config.getColumn(columnId);
        if (!column || !column.filterable) {
            throw new Error(`Column ${columnId} is not filterable`);
        }
        
        this.filters.set(columnId, filterConfig);
        this.activeFilters++;
        
        this.events.emit('filter-added', { columnId, filterConfig });
        this.events.emit('filter-changed', { columnId, active: true });
    }

    /**
     * Remove column filter
     * @param {string} columnId - Column ID
     */
    removeFilter(columnId) {
        if (this.filters.has(columnId)) {
            this.filters.delete(columnId);
            this.activeFilters--;
            
            this.events.emit('filter-removed', { columnId });
            this.events.emit('filter-changed', { columnId, active: false });
        }
    }

    /**
     * Set global filter
     * @param {Function} filterFn - Global filter function
     */
    setGlobalFilter(filterFn) {
        this.globalFilter = filterFn;
        this.events.emit('global-filter-changed', { active: !!filterFn });
    }

    /**
     * Clear global filter
     */
    clearGlobalFilter() {
        this.globalFilter = null;
        this.events.emit('global-filter-changed', { active: false });
    }

    /**
     * Clear all filters
     */
    clearAllFilters() {
        this.filters.clear();
        this.globalFilter = null;
        this.activeFilters = 0;
        
        this.events.emit('all-filters-cleared');
        this.events.emit('filter-changed', { cleared: true });
    }

    /**
     * Apply all filters to data
     * @param {Array} data - Data to filter
     * @returns {Array} Filtered data
     */
    applyAllFilters(data) {
        return this.apply(data);
    }

    /**
     * Get active filters
     * @returns {Array} Active filters
     */
    getActiveFilters() {
        const activeFilters = [];
        
        for (const [columnId, filterConfig] of this.filters) {
            activeFilters.push({
                columnId,
                filterConfig,
                column: this.config.getColumn(columnId)
            });
        }
        
        if (this.globalFilter) {
            activeFilters.push({
                type: 'global',
                filterConfig: this.globalFilter
            });
        }
        
        return activeFilters;
    }

    /**
     * Get filter for column
     * @param {string} columnId - Column ID
     * @returns {Object|null} Filter configuration
     */
    getColumnFilter(columnId) {
        return this.filters.get(columnId) || null;
    }

    /**
     * Check if column has filter
     * @param {string} columnId - Column ID
     * @returns {boolean} Column has filter
     */
    hasColumnFilter(columnId) {
        return this.filters.has(columnId);
    }

    /**
     * Check if any filters are active
     * @returns {boolean} Filters are active
     */
    hasActiveFilters() {
        return this.filters.size > 0 || this.globalFilter !== null;
    }

    /**
     * Get filter statistics
     * @returns {Object} Filter statistics
     */
    getFilterStats() {
        return {
            totalFilters: this.filters.size,
            activeFilters: this.activeFilters,
            hasGlobalFilter: this.globalFilter !== null,
            filterableColumns: this.config.getFilterableColumns().length
        };
    }

    /**
     * Update filter indicators in UI
     */
    updateFilterIndicators() {
        // Update column filter indicators
        const headers = document.querySelectorAll('.pdf-table__header-cell');
        
        headers.forEach(header => {
            const columnId = header.dataset.columnId;
            const indicator = header.querySelector('.pdf-table__filter-indicator');
            
            if (indicator) {
                indicator.classList.toggle('pdf-table__filter-indicator--active', 
                    this.filters.has(columnId));
            }
        });
    }

    /**
     * Create text filter
     * @param {string} columnId - Column ID
     * @param {string} operator - Filter operator
     * @param {string} value - Filter value
     */
    addTextFilter(columnId, operator, value) {
        this.addFilter(columnId, {
            type: 'text',
            operator,
            operand: value
        });
    }

    /**
     * Create number filter
     * @param {string} columnId - Column ID
     * @param {string} operator - Filter operator
     * @param {number} value - Filter value
     */
    addNumberFilter(columnId, operator, value) {
        this.addFilter(columnId, {
            type: 'number',
            operator,
            operand: value
        });
    }

    /**
     * Create date filter
     * @param {string} columnId - Column ID
     * @param {string} operator - Filter operator
     * @param {string|Array} value - Filter value
     */
    addDateFilter(columnId, operator, value) {
        this.addFilter(columnId, {
            type: 'date',
            operator,
            operand: value
        });
    }

    /**
     * Create custom filter
     * @param {string} columnId - Column ID
     * @param {Function} filterFn - Custom filter function
     */
    addCustomFilter(columnId, filterFn) {
        this.addFilter(columnId, {
            type: 'custom',
            customFilter: filterFn
        });
    }

    /**
     * Destroy filtering manager
     */
    destroy() {
        // Remove event listeners
        this.events.off('filter-changed', this.handleFilterChanged);
        this.events.off('data-changed', this.handleDataChanged);
        
        // Clear filters
        this.filters.clear();
        this.globalFilter = null;
        this.filterHistory = [];
        this.activeFilters = 0;
    }
}

// Export for use in other modules
// ES6 Module Export
export default PDFTableFiltering;

// Legacy export for compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFTableFiltering;
} else if (typeof window !== 'undefined') {
    window.PDFTableFiltering = PDFTableFiltering;
}