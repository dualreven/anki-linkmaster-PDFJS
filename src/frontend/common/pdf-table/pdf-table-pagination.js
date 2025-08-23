/**
 * PDF Table Pagination - Pagination Management
 * @module PDFTablePagination
 */

class PDFTablePagination {
    /**
     * Create a new PDFTablePagination instance
     * @param {PDFTable} table - Parent table instance
     */
    constructor(table) {
        this.table = table;
        this.state = table.state;
        this.config = table.config;
        this.events = table.events;
        
        // Pagination state
        this.currentPage = this.state.currentPage || 1;
        this.pageSize = this.state.pageSize || 10;
        this.totalItems = 0;
        this.totalPages = 0;
        
        // Settings
        this.enabled = this.config.get('pagination');
        this.pageSizeOptions = this.config.get('pageSizeOptions') || [10, 20, 50, 100];
        
        // Setup event listeners
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.events.on('page-changed', this.handlePageChanged.bind(this));
        this.events.on('page-click', this.handlePageClick.bind(this));
        this.events.on('pagination-click', this.handlePaginationClick.bind(this));
        this.events.on('data-changed', this.handleDataChanged.bind(this));
    }

    /**
     * Handle page changed events
     * @param {Object} event - Page changed event
     */
    handlePageChanged(event) {
        this.currentPage = event.page;
        this.updatePaginationUI();
    }

    /**
     * Handle page click events
     * @param {Object} event - Page click event
     */
    handlePageClick(event) {
        const { page } = event;
        this.goToPage(page);
    }

    /**
     * Handle pagination click events
     * @param {Object} event - Pagination click event
     */
    handlePaginationClick(event) {
        const { action } = event;
        
        switch (action) {
            case 'prev':
                this.previousPage();
                break;
            case 'next':
                this.nextPage();
                break;
        }
    }

    /**
     * Handle data changed events
     * @param {Array} data - New data
     */
    handleDataChanged(data) {
        this.totalItems = data.length;
        this.totalPages = Math.ceil(this.totalItems / this.pageSize);
        
        // Adjust current page if necessary
        if (this.currentPage > this.totalPages && this.totalPages > 0) {
            this.currentPage = this.totalPages;
        }
        
        this.updatePaginationUI();
    }

    /**
     * Apply pagination to data
     * @param {Array} data - Data to paginate
     * @returns {Array} Paginated data
     */
    apply(data) {
        if (!this.enabled || this.totalPages <= 1) {
            return data;
        }
        
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = Math.min(startIndex + this.pageSize, data.length);
        
        return data.slice(startIndex, endIndex);
    }

    /**
     * Go to specific page
     * @param {number} page - Page number
     */
    goToPage(page) {
        if (page < 1 || page > this.totalPages) {
            return;
        }
        
        this.currentPage = page;
        this.state.currentPage = page;
        
        this.events.emit('page-changed', page);
        this.table.updateDisplay();
    }

    /**
     * Go to first page
     */
    firstPage() {
        this.goToPage(1);
    }

    /**
     * Go to last page
     */
    lastPage() {
        this.goToPage(this.totalPages);
    }

    /**
     * Go to previous page
     */
    previousPage() {
        if (this.currentPage > 1) {
            this.goToPage(this.currentPage - 1);
        }
    }

    /**
     * Go to next page
     */
    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.goToPage(this.currentPage + 1);
        }
    }

    /**
     * Set page size
     * @param {number} pageSize - New page size
     */
    setPageSize(pageSize) {
        if (pageSize < 1 || pageSize > 1000) {
            throw new Error('Page size must be between 1 and 1000');
        }
        
        this.pageSize = pageSize;
        this.state.pageSize = pageSize;
        
        // Reset to first page
        this.currentPage = 1;
        this.state.currentPage = 1;
        
        this.events.emit('page-size-changed', pageSize);
        this.table.updateDisplay();
    }

    /**
     * Get pagination info
     * @returns {Object} Pagination information
     */
    getPaginationInfo() {
        const startItem = this.totalItems === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
        const endItem = Math.min(this.currentPage * this.pageSize, this.totalItems);
        
        return {
            currentPage: this.currentPage,
            totalPages: this.totalPages,
            totalItems: this.totalItems,
            pageSize: this.pageSize,
            startItem,
            endItem,
            hasPrevious: this.currentPage > 1,
            hasNext: this.currentPage < this.totalPages,
            isFirstPage: this.currentPage === 1,
            isLastPage: this.currentPage === this.totalPages
        };
    }

    /**
     * Update pagination UI
     */
    updatePaginationUI() {
        const paginationElement = document.querySelector('.pdf-table__pagination');
        if (!paginationElement) return;
        
        const info = this.getPaginationInfo();
        
        // Update info text
        const infoElement = paginationElement.querySelector('.pdf-table__pagination-info');
        if (infoElement) {
            infoElement.textContent = this.config.getText('paginationInfo')
                .replace('{start}', info.startItem)
                .replace('{end}', info.endItem)
                .replace('{total}', info.totalItems);
        }
        
        // Update button states
        const prevBtn = paginationElement.querySelector('[data-action="prev"]');
        const nextBtn = paginationElement.querySelector('[data-action="next"]');
        
        if (prevBtn) {
            prevBtn.disabled = !info.hasPrevious;
        }
        
        if (nextBtn) {
            nextBtn.disabled = !info.hasNext;
        }
        
        // Update page buttons
        this.updatePageButtons(paginationElement);
    }

    /**
     * Update page buttons
     * @param {HTMLElement} paginationElement - Pagination element
     */
    updatePageButtons(paginationElement) {
        const pageButtons = paginationElement.querySelectorAll('.pdf-table__pagination-btn[data-page]');
        
        pageButtons.forEach(btn => {
            const page = parseInt(btn.dataset.page);
            btn.classList.toggle('pdf-table__pagination-btn--active', page === this.currentPage);
        });
    }

    /**
     * Enable/disable pagination
     * @param {boolean} enabled - Enable pagination
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        this.table.updateDisplay();
    }

    /**
     * Check if pagination is enabled
     * @returns {boolean} Pagination is enabled
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Get available page sizes
     * @returns {Array} Available page sizes
     */
    getAvailablePageSizes() {
        return [...this.pageSizeOptions];
    }

    /**
     * Get current page size
     * @returns {number} Current page size
     */
    getPageSize() {
        return this.pageSize;
    }

    /**
     * Get current page
     * @returns {number} Current page
     */
    getCurrentPage() {
        return this.currentPage;
    }

    /**
     * Get total pages
     * @returns {number} Total pages
     */
    getTotalPages() {
        return this.totalPages;
    }

    /**
     * Get total items
     * @returns {number} Total items
     */
    getTotalItems() {
        return this.totalItems;
    }

    /**
     * Check if has previous page
     * @returns {boolean} Has previous page
     */
    hasPreviousPage() {
        return this.currentPage > 1;
    }

    /**
     * Check if has next page
     * @returns {boolean} Has next page
     */
    hasNextPage() {
        return this.currentPage < this.totalPages;
    }

    /**
     * Destroy pagination manager
     */
    destroy() {
        // Remove event listeners
        this.events.off('page-changed', this.handlePageChanged);
        this.events.off('page-click', this.handlePageClick);
        this.events.off('pagination-click', this.handlePaginationClick);
        this.events.off('data-changed', this.handleDataChanged);
        
        // Reset state
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalItems = 0;
        this.totalPages = 0;
    }
}

// Export for use in other modules
// ES6 Module Export
export default PDFTablePagination;

// Legacy export for compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFTablePagination;
} else if (typeof window !== 'undefined') {
    window.PDFTablePagination = PDFTablePagination;
}