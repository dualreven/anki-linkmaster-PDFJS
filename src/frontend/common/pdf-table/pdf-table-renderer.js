/**
 * PDF Table Renderer - DOM Rendering and Management
 * @module PDFTableRenderer
 */

class PDFTableRenderer {
    /**
     * Create a new PDFTableRenderer instance
     * @param {PDFTable} table - Parent table instance
     */
    constructor(table) {
        this.table = table;
        this.container = table.tableWrapper;
        this.config = table.config;
        this.dataModel = table.dataModel;
        
        // Rendering state
        this.cache = new Map();
        this.renderScheduled = false;
        this.lastRenderTime = 0;
        this.renderCount = 0;
        
        // DOM elements
        this.tableElement = null;
        this.thead = null;
        this.tbody = null;
        this.paginationElement = null;
        
        // Virtual scroll support
        this.virtualScroll = this.config.get('virtualScroll');
        this.virtualScrollRowHeight = this.config.get('virtualScrollRowHeight');
        this.virtualScrollBufferSize = this.config.get('virtualScrollBufferSize');
        this.visibleRows = [];
        
        // Performance optimization
        this.rowPool = new PDFTableRowPool();
        this.cellPool = new PDFTableCellPool();
        
        // Custom renderers
        this.customRenderers = this.setupCustomRenderers();
        
        // Initialize
        this.setupEventListeners();
    }

    /**
     * Setup custom renderers
     * @returns {Object} Custom renderers
     */
    setupCustomRenderers() {
        return {
            selectRenderer: (value, row, column) => {
                const isSelected = this.table.state.selectedRows.has(row.id);
                return `<input type="checkbox" class="pdf-table-checkbox" data-row-id="${row.id}" ${isSelected ? 'checked' : ''}>`;
            },
            
            importanceRenderer: (value, row, column) => {
                const icons = {
                    high: '⚡',
                    medium: '⭐',
                    low: '🔍'
                };
                return `<span class="pdf-table-importance pdf-table-importance--${value}">${icons[value] || ''} ${value}</span>`;
            },
            
            actionsRenderer: (value, row, column) => {
                return `
                    <div class="pdf-table-actions">
                        <button class="pdf-table-btn pdf-table-btn--primary" data-action="open" data-row-id="${row.id}">打开</button>
                        <button class="pdf-table-btn pdf-table-btn--danger" data-action="delete" data-row-id="${row.id}">删除</button>
                    </div>
                `;
            },
            
            ...this.config.get('customRenderers')
        };
    }

    /**
     * Setup event listeners (idempotent)
     */
    setupEventListeners() {
        if (this._setupDone) return;
        this._setupDone = true;

        // Create and store bound handlers so we can remove them later
        if (this.config.get('responsive')) {
            this._resizeHandler = this.debounce(this.handleResize.bind(this), 100);
            window.addEventListener('resize', this._resizeHandler);
        }

        if (this.virtualScroll) {
            this._scrollHandler = this.debounce(this.handleScroll.bind(this), 16);
            // container may be replaced; attach to container element reference
            if (this.container && this.container.addEventListener) {
                this.container.addEventListener('scroll', this._scrollHandler);
            }
        }
    }

    /**
     * Main render method
     * @param {Array} data - Data to render
     */
    async render(data = null) {
        const startTime = performance.now();
        // Diagnostics: record whether caller passed data and snapshot lengths
        try {
            const callerHasData = Array.isArray(data);
            const callerLen = callerHasData ? data.length : -1;
            const stateLen = this.table && this.table.state && Array.isArray(this.table.state.sortedData) ? this.table.state.sortedData.length : -1;
            console.info('DEBUG_RENDERER: render called, callerHasData=', callerHasData, 'callerLen=', callerLen, 'stateLen=', stateLen);
        } catch (e) {}

        // Normalize data: prefer provided data, fallback to table state
        const renderData = Array.isArray(data) ? data : (this.table && this.table.state && Array.isArray(this.table.state.sortedData) ? this.table.state.sortedData : []);

        try {
            // Ensure we're writing into the live table wrapper element under the table's container.
            try {
                const liveWrapper = this.table.container && this.table.container.querySelector && this.table.container.querySelector('.pdf-table-wrapper');
                if (liveWrapper) {
                    this.container = liveWrapper;
                }
            } catch (e) {
                // ignore
            }

            // Schedule render if already scheduled
            if (this.renderScheduled) {
                return;
            }

            this.renderScheduled = true;

            // Use requestAnimationFrame for better performance
            await new Promise(resolve => {
                requestAnimationFrame(async () => {
                    try {
                        await this.performRender(renderData);
                        resolve();
                    } catch (error) {
                        console.error('Render error:', error);
                        resolve();
                    }
                });
            });

        } catch (error) {
            console.error('Render error:', error);
            this.table.events.emit('render-error', error);
        } finally {
            this.renderScheduled = false;
            this.lastRenderTime = performance.now() - startTime;
            this.renderCount++;

            // Emit render complete event
            this.table.events.emit('render-complete', {
                duration: this.lastRenderTime,
                renderCount: this.renderCount,
                dataLength: Array.isArray(renderData) ? renderData.length : 0
            });
        }
    }

    /**
     * Perform the actual rendering
     * @param {Array} data - Data to render
     */
    async performRender(data) {
        // Diagnostics: record whether we received data and what state holds at entry
        try {
            const paramIsArray = Array.isArray(data);
            const paramLen = paramIsArray ? data.length : -1;
            const stateArray = this.table && this.table.state && Array.isArray(this.table.state.sortedData) ? this.table.state.sortedData : null;
            const stateLen = stateArray ? stateArray.length : -1;
            console.info('DEBUG_RENDERER: performRender entry paramIsArray=', paramIsArray, 'paramLen=', paramLen, 'stateLen=', stateLen);
        } catch (e) {}

        // Defensive copy: ensure we operate on a snapshot and not a possibly-mutated array
        const safeData = Array.isArray(data) ? data.slice() : (this.table && this.table.state && Array.isArray(this.table.state.sortedData) ? this.table.state.sortedData.slice() : []);

        // Debug: incoming data
        try {
            console.info("DEBUG_RENDERER: performRender called, dataLength=", Array.isArray(safeData) ? safeData.length : 0);
        } catch (e) {}

        // Use safeData for rendering
        data = safeData;

        // Clear container
        this.clearContainer();
        
        // Create table structure
        this.createTableStructure();

        // Ensure tableWrapper remains attached to the main container (defensive)
        try {
            if (this.table && this.table.tableWrapper && this.table.container && this.table.tableWrapper.parentElement !== this.table.container) {
                this.table.container.appendChild(this.table.tableWrapper);
            }
        } catch (e) {
            console.warn('Could not re-attach tableWrapper to container:', e);
        }
        
        // Render header
        await this.renderHeader();
        
        // Render body
        if (this.virtualScroll) {
            await this.renderVirtualBody(data);
        } else {
            await this.renderBody(data);
        }

        // Debug: output generated table HTML (truncated) and row counts
        try {
            const tableHtml = this.tableElement ? (this.tableElement.outerHTML && this.tableElement.outerHTML.slice(0, 2000)) : "null";
            const rowCount = this.tbody ? (this.tbody.querySelectorAll('tr[data-row-id]').length || this.tbody.rows.length) : 0;
        } catch (e) {}
        
        // Render pagination if enabled
        if (this.config.get('pagination')) {
            await this.renderPagination(data);
        }
        
        // Attach event listeners
        this.attachEventListeners();
        
        // Update cache
        this.updateCache(data);
    }

    /**
     * 清空表格容器的 DOM 内容并重置渲染器缓存与对象池。
     * @returns {void}
     */
    clearContainer() {
        this.container.innerHTML = '';
        this.cache.clear();
        this.rowPool.clear();
        this.cellPool.clear();
    }

    /**
     * 创建表格的 DOM 结构（table/thead/tbody 等），并将其插入到容器中。
     * @returns {void}
     */
    createTableStructure() {
        this.tableElement = document.createElement('table');
        this.tableElement.className = `pdf-table pdf-table--${this.config.get('theme')}`;
        
        // Add responsive wrapper if needed
        if (this.config.get('responsive')) {
            const responsiveWrapper = document.createElement('div');
            responsiveWrapper.className = 'pdf-table-responsive';
            responsiveWrapper.appendChild(this.tableElement);
            this.container.appendChild(responsiveWrapper);
        } else {
            this.container.appendChild(this.tableElement);
        }
        
        // Create table sections
        if (this.config.get('showHeader')) {
            this.thead = document.createElement('thead');
            this.tableElement.appendChild(this.thead);
        }
        
        this.tbody = document.createElement('tbody');
        this.tableElement.appendChild(this.tbody);
        
        // Set table styles
        this.applyTableStyles();
    }

    /**
     * 将配置中的样式应用到 table 元素上，并根据配置添加条件类名。
     * @returns {void}
     */
    applyTableStyles() {
        const styles = this.config.get('style') || {};
        
        Object.entries(styles).forEach(([property, value]) => {
            this.tableElement.style[property] = value;
        });
        
        // Add conditional classes
        if (this.config.get('border')) {
            this.tableElement.classList.add('pdf-table--bordered');
        }
        
        if (this.config.get('striped')) {
            this.tableElement.classList.add('pdf-table--striped');
        }
        
        if (this.config.get('hover')) {
            this.tableElement.classList.add('pdf-table--hover');
        }
        
        if (this.config.get('compact')) {
            this.tableElement.classList.add('pdf-table--compact');
        }
    }

    /**
     * 渲染表头行，根据可见列配置创建 th 元素并插入 thead。
     * @returns {Promise<void>} 异步完成渲染。
     */
    async renderHeader() {
        if (!this.thead) return;
        
        const headerRow = document.createElement('tr');
        headerRow.className = 'pdf-table__header-row';
        
        const visibleColumns = this.config.getVisibleColumns();
        
        visibleColumns.forEach(column => {
            const th = document.createElement('th');
            th.className = `pdf-table__header-cell pdf-table__header-cell--${column.align}`;
            th.dataset.columnId = column.id;
            th.style.width = this.getColumnWidth(column);
            
            // Add header content
            const headerContent = document.createElement('div');
            headerContent.className = 'pdf-table__header-content';
            
            // Add title
            const title = document.createElement('span');
            title.className = 'pdf-table__header-title';
            title.textContent = column.title;
            headerContent.appendChild(title);
            
            // Add sort indicator if sortable
            if (column.sortable && this.config.get('sortable')) {
                const sortIndicator = document.createElement('span');
                sortIndicator.className = 'pdf-table__sort-indicator';
                this.updateSortIndicator(sortIndicator, column.id);
                headerContent.appendChild(sortIndicator);
            }
            
            th.appendChild(headerContent);
            headerRow.appendChild(th);
        });
        
        this.thead.appendChild(headerRow);
    }

    /**
     * 渲染表格主体（非虚拟滚动模式）。
     * @param {Array<Object>} data - 要渲染的行数据数组，每项为一条 PDF 元数据。
     * @returns {Promise<void>} 异步完成渲染。
     */
    async renderBody(data) {
        if (!this.tbody) return;
        
        const fragment = document.createDocumentFragment();
        const visibleColumns = this.config.getVisibleColumns();
        
        data.forEach((row, index) => {
            const tr = this.createTableRow(row, index, visibleColumns);
            fragment.appendChild(tr);
        });
        
        this.tbody.appendChild(fragment);
        
        // Handle empty state
        if (data.length === 0) {
            this.renderEmptyState();
        }
    }

    /**
     * 渲染虚拟滚动模式下的表格主体，仅渲染可见区间的行并使用上下 spacers 保持高度。
     * @param {Array<Object>} data - 完整的数据数组，用于计算可见区间。
     * @returns {Promise<void>} 异步完成渲染。
     */
    async renderVirtualBody(data) {
        if (!this.tbody) return;
        
        // Calculate visible range
        const scrollTop = this.container.scrollTop;
        const containerHeight = this.container.clientHeight;
        const rowHeight = this.virtualScrollRowHeight;
        
        const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - this.virtualScrollBufferSize);
        const endIndex = Math.min(data.length, startIndex + Math.ceil(containerHeight / rowHeight) + this.virtualScrollBufferSize * 2);
        
        // Create spacer elements
        const topSpacer = document.createElement('tr');
        topSpacer.style.height = `${startIndex * rowHeight}px`;
        topSpacer.className = 'pdf-table__spacer';
        
        const bottomSpacer = document.createElement('tr');
        bottomSpacer.style.height = `${(data.length - endIndex) * rowHeight}px`;
        bottomSpacer.className = 'pdf-table__spacer';
        
        // Add spacers
        this.tbody.appendChild(topSpacer);
        
        // Render visible rows
        const visibleColumns = this.config.getVisibleColumns();
        const fragment = document.createDocumentFragment();
        
        for (let i = startIndex; i < endIndex; i++) {
            const row = data[i];
            const tr = this.createTableRow(row, i, visibleColumns);
            tr.style.position = 'absolute';
            tr.style.top = `${i * rowHeight}px`;
            tr.style.width = '100%';
            fragment.appendChild(tr);
        }
        
        this.tbody.appendChild(fragment);
        this.tbody.appendChild(bottomSpacer);
        
        // Store visible rows for event handling
        this.visibleRows = data.slice(startIndex, endIndex);
    }

    /**
     * 创建单个表格行的 DOM（tr）。
     * @param {Object} row - 单条行数据对象。
     * @param {number} index - 在数据数组中的索引位置。
     * @param {Array<Object>} columns - 当前可见列的配置数组。
     * @returns {HTMLTableRowElement} 新创建的 tr 元素。
     */
    createTableRow(row, index, columns) {
        // Get row from pool or create new
        const tr = this.rowPool.get();
        tr.className = 'pdf-table__row';
        tr.dataset.rowId = row.id;
        tr.dataset.rowIndex = index;
        
        // Add row classes
        if (index % 2 === 0 && this.config.get('striped')) {
            tr.classList.add('pdf-table__row--striped');
        }
        
        if (this.table.state.selectedRows.has(row.id)) {
            tr.classList.add('pdf-table__row--selected');
        }
        
        // Add row height
        if (this.config.get('rowHeight')) {
            tr.style.height = `${this.config.get('rowHeight')}px`;
        }
        
        // Clear existing cells
        while (tr.firstChild) {
            const cell = tr.firstChild;
            tr.removeChild(cell);
            this.cellPool.release(cell);
        }
        
        // Create cells
        columns.forEach(column => {
            const td = this.createTableCell(row, column);
            tr.appendChild(td);
        });
        
        return tr;
    }

    /**
     * Create table cell
     * @param {Object} row - Row data
     * @param {Object} column - Column configuration
     * @returns {HTMLTableCellElement} Table cell element
     */
    createTableCell(row, column) {
        // Get cell from pool or create new
        const td = this.cellPool.get();
        td.className = `pdf-table__cell pdf-table__cell--${column.align}`;
        td.dataset.columnId = column.id;
        
        // Apply cell styles
        if (column.cellStyle) {
            Object.entries(column.cellStyle).forEach(([property, value]) => {
                td.style[property] = value;
            });
        }
        
        // Render cell content
        const content = this.renderCellContent(row, column);
        td.innerHTML = content;
        
        return td;
    }

    /**
     * Render cell content
     * @param {Object} row - Row data
     * @param {Object} column - Column configuration
     * @returns {string} Cell content HTML
     */
    renderCellContent(row, column) {
        const value = row[column.field];
        
        // Use custom renderer if available
        if (column.renderer && this.customRenderers[column.renderer]) {
            return this.customRenderers[column.renderer](value, row, column);
        }
        
        // Use formatter if available
        if (column.formatter) {
            return this.dataModel.formatField(column.field, value, row);
        }
        
        // Default rendering
        return this.escapeHtml(value);
    }

    /**
     * Render pagination
     * @param {Array} data - Data to render
     */
    async renderPagination(data) {
        if (!this.config.get('pagination')) return;
        
        const totalPages = Math.ceil(data.length / this.table.state.pageSize);
        const currentPage = this.table.state.currentPage;
        
        if (totalPages <= 1) return;
        
        // Create pagination container
        this.paginationElement = document.createElement('div');
        this.paginationElement.className = 'pdf-table__pagination';
        
        // Create pagination info
        const info = document.createElement('div');
        info.className = 'pdf-table__pagination-info';
        const start = (currentPage - 1) * this.table.state.pageSize + 1;
        const end = Math.min(currentPage * this.table.state.pageSize, data.length);
        info.textContent = this.config.getText('paginationInfo')
            .replace('{start}', start)
            .replace('{end}', end)
            .replace('{total}', data.length);
        
        // Create pagination controls
        const controls = document.createElement('div');
        controls.className = 'pdf-table__pagination-controls';
        
        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.className = 'pdf-table__pagination-btn';
        prevBtn.textContent = this.config.getText('paginationPrev');
        prevBtn.disabled = currentPage === 1;
        prevBtn.dataset.action = 'prev';
        
        // Page buttons
        const pageButtons = this.createPageButtons(currentPage, totalPages);
        
        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'pdf-table__pagination-btn';
        nextBtn.textContent = this.config.getText('paginationNext');
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.dataset.action = 'next';
        
        // Assemble pagination
        controls.appendChild(prevBtn);
        pageButtons.forEach(btn => controls.appendChild(btn));
        controls.appendChild(nextBtn);
        
        this.paginationElement.appendChild(info);
        this.paginationElement.appendChild(controls);
        
        this.container.appendChild(this.paginationElement);
    }

    /**
     * Create page buttons
     * @param {number} currentPage - Current page
     * @param {number} totalPages - Total pages
     * @returns {Array} Page buttons
     */
    createPageButtons(currentPage, totalPages) {
        const buttons = [];
        const maxButtons = 5;
        
        let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);
        
        if (endPage - startPage + 1 < maxButtons) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const btn = document.createElement('button');
            btn.className = 'pdf-table__pagination-btn';
            btn.textContent = i;
            btn.dataset.page = i;
            
            if (i === currentPage) {
                btn.classList.add('pdf-table__pagination-btn--active');
            }
            
            buttons.push(btn);
        }
        
        return buttons;
    }

    /**
     * Render empty state
     */
    renderEmptyState() {
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'pdf-table__row pdf-table__row--empty';
        
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = this.config.getVisibleColumns().length;
        emptyCell.className = 'pdf-table__cell pdf-table__cell--empty';
        emptyCell.textContent = this.config.getText('emptyText');
        
        emptyRow.appendChild(emptyCell);
        this.tbody.appendChild(emptyRow);
    }

    /**
     * Attach event listeners (idempotent per renderer instance)
     */
    attachEventListeners() {
        if (!this.tableElement) return;
        if (this._listenersAttached) return;
        this._listenersAttached = true;

        // Header click events (sorting)
        if (this.thead) {
            this._onTheadClick = (e) => {
                const th = e.target.closest('th');
                if (th) {
                    const columnId = th.dataset.columnId;
                    const column = this.config.getColumn(columnId);
                    if (column && column.sortable) {
                        this.table.events.emit('header-click', { columnId, event: e });
                    }
                }
            };
            this.thead.addEventListener('click', this._onTheadClick);
        }

        // Row click events
        if (this.tbody) {
            this._onTbodyClick = (e) => {
                const tr = e.target.closest('tr');
                if (tr && tr.dataset.rowId) {
                    const rowId = tr.dataset.rowId;
                    const rowData = this.table.state.data.find(row => row.id === rowId);
                    if (rowData) {
                        this.table.events.emit('row-click', { rowData, event: e });
                    }
                }

                const button = e.target.closest('button');
                if (button) {
                    const action = button.dataset.action;
                    const rowId = button.dataset.rowId;
                    const page = button.dataset.page;

                    if (action && rowId) {
                        this.table.events.emit('button-click', { action, rowId, event: e });
                    } else if (action === 'prev' || action === 'next') {
                        this.table.events.emit('pagination-click', { action, event: e });
                    } else if (page) {
                        this.table.events.emit('page-click', { page: parseInt(page), event: e });
                    }
                }

                const checkbox = e.target.closest('.pdf-table-checkbox');
                if (checkbox) {
                    const rowId = checkbox.dataset.rowId;
                    this.table.events.emit('checkbox-click', { rowId, checked: checkbox.checked, event: e });
                }
            };
            this.tbody.addEventListener('click', this._onTbodyClick);
        }

        // Pagination events
        if (this.paginationElement) {
            this._onPaginationClick = (e) => {
                const button = e.target.closest('button');
                if (button) {
                    const action = button.dataset.action;
                    const page = button.dataset.page;

                    if (action === 'prev' || action === 'next') {
                        this.table.events.emit('pagination-click', { action, event: e });
                    } else if (page) {
                        this.table.events.emit('page-click', { page: parseInt(page), event: e });
                    }
                }
            };
            this.paginationElement.addEventListener('click', this._onPaginationClick);
        }
    }

    /**
     * Update sort indicator
     * @param {HTMLElement} indicator - Sort indicator element
     * @param {string} columnId - Column ID
     */

    /**
     * Destroy renderer and remove attached listeners
     */
    destroy() {
        try {
            if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
        } catch (e) {}
        try {
            if (this._scrollHandler && this.container && this.container.removeEventListener) this.container.removeEventListener('scroll', this._scrollHandler);
        } catch (e) {}
        try {
            if (this.thead && this._onTheadClick) this.thead.removeEventListener('click', this._onTheadClick);
        } catch (e) {}
        try {
            if (this.tbody && this._onTbodyClick) this.tbody.removeEventListener('click', this._onTbodyClick);
        } catch (e) {}
        try {
            if (this.paginationElement && this._onPaginationClick) this.paginationElement.removeEventListener('click', this._onPaginationClick);
        } catch (e) {}

        // Clear pools and caches
        try { this.rowPool.clear(); } catch (e) {}
        try { this.cellPool.clear(); } catch (e) {}
        this.cache.clear();
    }

    /**
     * Update sort indicator
     * @param {HTMLElement} indicator - Sort indicator element
     * @param {string} columnId - Column ID
     */
    updateSortIndicator(indicator, columnId) {
        const sortColumn = this.table.state.sortColumn;
        const sortDirection = this.table.state.sortDirection;
        
        indicator.className = 'pdf-table__sort-indicator';
        
        if (sortColumn === columnId) {
            indicator.classList.add(`pdf-table__sort-indicator--${sortDirection}`);
        }
    }

    /**
     * Get column width
     * @param {Object} column - Column configuration
     * @returns {string} Column width
     */
    getColumnWidth(column) {
        if (column.width === 'auto') return '';
        if (typeof column.width === 'number') return `${column.width}px`;
        return column.width;
    }

    /**
     * Handle window resize
     */
    handleResize() {
        if (this.config.get('responsive')) {
            this.render(this.table.getVisibleData());
        }
    }

    /**
     * Handle virtual scroll
     */
    handleScroll() {
        if (this.virtualScroll) {
            this.render(this.table.getVisibleData());
        }
    }

    /**
     * Update cache
     * @param {Array} data - Data to cache
     */
    updateCache(data) {
        // Clear old cache
        this.cache.clear();
        
        // Cache rendered rows
        data.forEach(row => {
            this.cache.set(row.id, row);
        });
    }

    /**
     * Get row element by ID
     * @param {string} rowId - Row ID
     * @returns {HTMLTableRowElement|null} Row element
     */
    getRowElement(rowId) {
        return this.tbody?.querySelector(`tr[data-row-id="${rowId}"]`) || null;
    }

    /**
     * Get all row elements
     * @returns {Array} Row elements
     */
    getRowElements() {
        return Array.from(this.tbody?.querySelectorAll('tr[data-row-id]') || []);
    }

    /**
     * Escape HTML
     * @param {*} value - Value to escape
     * @returns {string} Escaped HTML
     */
    escapeHtml(value) {
        if (value === null || value === undefined) return '';
        if (typeof value !== 'string') value = String(value);
        
        const div = document.createElement('div');
        div.textContent = value;
        return div.innerHTML;
    }

    /**
     * Debounce function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Destroy renderer
     */
    destroy() {
        // Clear container
        this.clearContainer();
        
        // Clear pools
        this.rowPool.clear();
        this.cellPool.clear();
        
        // Clear cache
        this.cache.clear();
        
        // Reset state
        this.tableElement = null;
        this.thead = null;
        this.tbody = null;
        this.paginationElement = null;
        this.visibleRows = [];
    }
}

/**
 * Table row pool for performance optimization
 */
class PDFTableRowPool {
    constructor() {
        this.pool = [];
        this.maxSize = 100;
    }

    get() {
        return this.pool.pop() || document.createElement('tr');
    }

    release(row) {
        if (this.pool.length < this.maxSize) {
            // Clear row content
            while (row.firstChild) {
                row.removeChild(row.firstChild);
            }
            
            // Clear row attributes and classes
            row.className = '';
            row.removeAttribute('data-row-id');
            row.removeAttribute('data-row-index');
            row.style.cssText = '';
            
            this.pool.push(row);
        }
    }

    clear() {
        this.pool = [];
    }
}

/**
 * Table cell pool for performance optimization
 */
class PDFTableCellPool {
    constructor() {
        this.pool = [];
        this.maxSize = 200;
    }

    get() {
        return this.pool.pop() || document.createElement('td');
    }

    release(cell) {
        if (this.pool.length < this.maxSize) {
            // Clear cell content
            cell.innerHTML = '';
            
            // Clear cell attributes and classes
            cell.className = '';
            cell.removeAttribute('data-column-id');
            cell.style.cssText = '';
            
            this.pool.push(cell);
        }
    }

    clear() {
        this.pool = [];
    }
}

// Export for use in other modules
// ES6 Module Export
export default PDFTableRenderer;

// Legacy export for compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFTableRenderer;
} else if (typeof window !== 'undefined') {
    window.PDFTableRenderer = PDFTableRenderer;
}