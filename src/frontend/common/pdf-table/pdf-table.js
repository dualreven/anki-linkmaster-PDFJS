/**
 * PDF Table Module - Main Table Class
 * @module PDFTable
 */

class PDFTable {
    /**
     * Create a new PDFTable instance
     * @param {HTMLElement|string} container - Container element or selector
     * @param {Object} config - Table configuration
     */
    constructor(container, config = {}) {
        // Validate container
        if (typeof container === 'string') {
            this.container = document.querySelector(container);
        } else {
            this.container = container;
        }
        
        if (!this.container) {
            throw new Error('Container element not found');
        }
        
        // State management
        this.state = {
            data: [],
            filteredData: [],
            sortedData: [],
            selectedRows: new Set(),
            currentPage: 1,
            pageSize: config.pageSize || 10,
            sortColumn: null,
            sortDirection: 'asc',
            isLoading: false,
            error: null
        };
        
        // Initialize core components
        this.config = new PDFTableConfig(config);
        this.events = new PDFTableEvents();
        this.dataModel = new PDFTableDataModel();
        this.renderer = new PDFTableRenderer(this);
        
        // Initialize functional modules
        this.selection = new PDFTableSelection(this);
        this.sorting = new PDFTableSorting(this);
        this.filtering = new PDFTableFiltering(this);
        this.pagination = new PDFTablePagination(this);
        
        // Internal state
        this._initialized = false;
        this._destroyed = false;
    }
    
    /**
     * Initialize the table
     */
    async initialize() {
        if (this._initialized) {
            console.warn('PDFTable is already initialized');
            return;
        }
        
        try {
            this.state.isLoading = true;
            
            // Setup container structure
            this.setupContainer();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load initial data if provided
            if (this.config.data.length > 0) {
                await this.loadData(this.config.data);
            }
            
            // Initial render
            await this.render();
            
            this._initialized = true;
            this.events.emit('initialized', this);
            
        } catch (error) {
            this.state.error = error.message;
            this.events.emit('error', error);
            throw error;
        } finally {
            this.state.isLoading = false;
        }
    }
    
    /**
     * Setup container structure
     */
    setupContainer() {
        this.container.innerHTML = '';
        this.container.className = `pdf-table-container pdf-table-container--${this.config.theme}`;
        
        // Create table wrapper
        this.tableWrapper = document.createElement('div');
        this.tableWrapper.className = 'pdf-table-wrapper';
        
        // Create loading indicator
        this.loadingIndicator = document.createElement('div');
        this.loadingIndicator.className = 'pdf-table-loading';
        this.loadingIndicator.innerHTML = '<div class="pdf-table-loading-spinner"></div>';
        this.loadingIndicator.style.display = 'none';
        
        // Create error message
        this.errorMessage = document.createElement('div');
        this.errorMessage.className = 'pdf-table-error';
        this.errorMessage.style.display = 'none';
        
        // Assemble container
        this.container.appendChild(this.loadingIndicator);
        this.container.appendChild(this.errorMessage);
        this.container.appendChild(this.tableWrapper);
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Internal event listeners
        this.events.on('data-changed', () => this.updateDisplay());
        this.events.on('selection-changed', () => this.updateDisplay());
        this.events.on('sort-changed', () => this.updateDisplay());
        this.events.on('filter-changed', () => this.updateDisplay());
        this.events.on('page-changed', () => this.updateDisplay());
    }
    
    /**
     * Load data into the table
     * @param {Array} data - Array of data objects
     */
    async loadData(data) {
        try {
            this.state.isLoading = true;
            
            // 防御性编程：确保数据是数组
            if (!Array.isArray(data)) {
                console.warn('PDFTable.loadData: 数据不是数组，重置为空数组');
                data = [];
            }
            
            // 验证数据
            const validationErrors = this.dataModel.validateData(data);
            
            if (validationErrors.length > 0) {
                console.error('数据验证失败，但系统将尝试渲染有效部分:', validationErrors);
                
                // 向用户显示一个非阻塞的错误提示
                this.showNonBlockingError('部分PDF数据格式不正确，可能无法完全显示。');

                // 策略：过滤掉无效数据，而不是完全失败
                let validData = data;
                
                if (validationErrors.some(err => err.row !== undefined)) {
                    // 有行级错误，过滤掉无效行
                    const invalidRowIndices = new Set(
                        validationErrors.filter(err => err.row !== undefined).map(err => err.row)
                    );
                    validData = data.filter((_, index) => !invalidRowIndices.has(index));
                } else {
                    // 全局错误，尝试使用所有数据
                    validData = data;
                }
                
                console.log(`保留有效数据: ${validData.length}/${data.length} 条记录`);
                
                // 如果过滤后仍有有效数据，则继续渲染
                if (validData.length > 0) {
                    this.processValidatedData(validData);
                } else {
                    // 如果所有数据都无效，则显示空状态
                    this.displayEmptyState('所有PDF数据均无效，无法加载。');
                }
                
            } else {
                // 验证通过，正常处理
                this.processValidatedData(data);
            }
            
        } catch (error) {
            // 捕获意外的运行时错误
            console.error('加载数据时发生严重错误:', error);
            this.displayErrorState(`加载失败: ${error.message}`);
            
            // 不再向上抛出异常，避免上层组件崩溃
            // throw error; 
        } finally {
            this.state.isLoading = false;
        }
    }

    /**
     * 处理验证通过的数据
     * @param {Array} data - 验证通过的数据
     */
    processValidatedData(data) {
        // Update state
        this.state.data = data;
        this.state.filteredData = [...data];
        this.state.sortedData = [...data];
        
        // Reset pagination
        this.state.currentPage = 1;
        
        // Emit events
        this.events.emit('data-loaded', data);
        this.events.emit('data-changed', data);
    }

    /**
     * 显示非阻塞错误提示
     * @param {string} message - 错误消息
     */
    showNonBlockingError(message) {
        // 创建临时错误提示
        const errorDiv = document.createElement('div');
        errorDiv.className = 'pdf-table-error-notification';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f8d7da;
            color: #721c24;
            padding: 12px 16px;
            border: 1px solid #f5c6cb;
            border-radius: 4px;
            z-index: 1000;
            max-width: 300px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        `;
        errorDiv.textContent = message;
        
        document.body.appendChild(errorDiv);
        
        // 3秒后自动消失
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 3000);
    }

    /**
     * 显示空状态
     * @param {string} message - 空状态消息
     */
    displayEmptyState(message) {
        this.state.data = [];
        this.state.filteredData = [];
        this.state.sortedData = [];
        
        // 创建空状态UI
        const emptyState = document.createElement('div');
        emptyState.className = 'pdf-table-empty-state';
        emptyState.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <div style="font-size: 48px; margin-bottom: 20px;">📄</div>
                <h3>暂无PDF文件</h3>
                <p style="margin: 20px 0; color: #999;">${message || '点击添加按钮导入您的第一个PDF文件'}</p>
            </div>
        `;
        
        this.container.innerHTML = '';
        this.container.appendChild(emptyState);
        
        this.events.emit('data-changed', []);
    }

    /**
     * 显示错误状态
     * @param {string} message - 错误消息
     */
    displayErrorState(message) {
        this.state.data = [];
        this.state.filteredData = [];
        this.state.sortedData = [];
        
        // 创建错误状态UI
        const errorState = document.createElement('div');
        errorState.className = 'pdf-table-error-state';
        errorState.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                <h3>加载失败</h3>
                <p style="margin: 20px 0; color: #999;">${message}</p>
                <button class="pdf-table-retry-btn" style="
                    padding: 10px 20px; 
                    background: #007bff; 
                    color: white; 
                    border: none; 
                    border-radius: 4px; 
                    cursor: pointer;
                ">重试</button>
            </div>
        `;
        
        // 添加重试事件
        const retryBtn = errorState.querySelector('.pdf-table-retry-btn');
        retryBtn.addEventListener('click', () => {
            this.events.emit('retry-load');
        });
        
        this.container.innerHTML = '';
        this.container.appendChild(errorState);
        
        this.events.emit('data-changed', []);
    }
    
    /**
     * Add a single row to the table
     * @param {Object} rowData - Row data object
     */
    async addRow(rowData) {
        try {
            // Validate row data
            const validationErrors = this.dataModel.validateItem(rowData);
            if (validationErrors.length > 0) {
                throw new Error(`Row validation failed: ${validationErrors.join(', ')}`);
            }
            
            // Add to data
            this.state.data.push(rowData);
            this.state.filteredData.push(rowData);
            this.state.sortedData.push(rowData);
            
            // Emit events
            this.events.emit('row-added', rowData);
            this.events.emit('data-changed', this.state.data);
            
        } catch (error) {
            this.state.error = error.message;
            this.events.emit('error', error);
            throw error;
        }
    }
    
    /**
     * Update a row in the table
     * @param {string|number} rowId - Row identifier
     * @param {Object} updates - Updates to apply
     */
    async updateRow(rowId, updates) {
        try {
            const rowIndex = this.state.data.findIndex(row => row.id === rowId);
            if (rowIndex === -1) {
                throw new Error(`Row with id ${rowId} not found`);
            }
            
            // Update row data
            const updatedRow = { ...this.state.data[rowIndex], ...updates };
            
            // Validate updated row
            const validationErrors = this.dataModel.validateItem(updatedRow);
            if (validationErrors.length > 0) {
                throw new Error(`Updated row validation failed: ${validationErrors.join(', ')}`);
            }
            
            // Update state
            this.state.data[rowIndex] = updatedRow;
            
            // Update filtered and sorted data
            const filteredIndex = this.state.filteredData.findIndex(row => row.id === rowId);
            if (filteredIndex !== -1) {
                this.state.filteredData[filteredIndex] = updatedRow;
            }
            
            const sortedIndex = this.state.sortedData.findIndex(row => row.id === rowId);
            if (sortedIndex !== -1) {
                this.state.sortedData[sortedIndex] = updatedRow;
            }
            
            // Emit events
            this.events.emit('row-updated', updatedRow);
            this.events.emit('data-changed', this.state.data);
            
        } catch (error) {
            this.state.error = error.message;
            this.events.emit('error', error);
            throw error;
        }
    }
    
    /**
     * Remove a row from the table
     * @param {string|number} rowId - Row identifier
     */
    async removeRow(rowId) {
        try {
            const rowIndex = this.state.data.findIndex(row => row.id === rowId);
            if (rowIndex === -1) {
                throw new Error(`Row with id ${rowId} not found`);
            }
            
            const removedRow = this.state.data[rowIndex];
            
            // Remove from state
            this.state.data.splice(rowIndex, 1);
            this.state.filteredData = this.state.filteredData.filter(row => row.id !== rowId);
            this.state.sortedData = this.state.sortedData.filter(row => row.id !== rowId);
            
            // Remove from selection
            this.state.selectedRows.delete(rowId);
            
            // Emit events
            this.events.emit('row-removed', removedRow);
            this.events.emit('data-changed', this.state.data);
            
        } catch (error) {
            this.state.error = error.message;
            this.events.emit('error', error);
            throw error;
        }
    }
    
    /**
     * Get processed data (filtered, sorted, paginated)
     * @returns {Array} Processed data
     */
    getProcessedData() {
        let data = [...this.state.data];
        
        // Apply filtering
        data = this.filtering.apply(data);
        this.state.filteredData = data;
        
        // Apply sorting
        data = this.sorting.apply(data);
        this.state.sortedData = data;
        
        // Apply pagination
        data = this.pagination.apply(data);
        
        return data;
    }
    
    /**
     * Update the table display
     */
    async updateDisplay() {
        if (this.state.isLoading) {
            this.showLoading();
            return;
        }
        
        if (this.state.error) {
            this.showError(this.state.error);
            return;
        }
        
        this.hideLoading();
        this.hideError();
        
        const processedData = this.getProcessedData();
        await this.renderer.render(processedData);
    }
    
    /**
     * Render the table
     */
    async render() {
        await this.updateDisplay();
    }
    
    /**
     * Show loading indicator
     */
    showLoading() {
        this.loadingIndicator.style.display = 'flex';
    }
    
    /**
     * Hide loading indicator
     */
    hideLoading() {
        this.loadingIndicator.style.display = 'none';
    }
    
    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
    }
    
    /**
     * Hide error message
     */
    hideError() {
        this.errorMessage.style.display = 'none';
    }
    
    /**
     * Get selected rows
     * @returns {Array} Selected row data
     */
    getSelectedRows() {
        return Array.from(this.state.selectedRows).map(id => 
            this.state.data.find(row => row.id === id)
        ).filter(Boolean);
    }
    
    /**
     * Get all data
     * @returns {Array} All row data
     */
    getData() {
        return [...this.state.data];
    }
    
    /**
     * Get visible data (processed)
     * @returns {Array} Visible row data
     */
    getVisibleData() {
        return this.getProcessedData();
    }
    
    /**
     * Set table theme
     * @param {string} theme - Theme name
     */
    setTheme(theme) {
        this.config.setTheme(theme);
        this.container.className = `pdf-table-container pdf-table-container--${this.config.theme}`;
        this.render();
    }
    
    /**
     * Export table data to CSV
     * @param {string} filename - Output filename
     */
    exportToCSV(filename = 'table-data.csv') {
        const csv = this.convertToCSV(this.state.data);
        this.downloadCSV(csv, filename);
    }
    
    /**
     * Convert data to CSV format
     * @param {Array} data - Data to convert
     * @returns {string} CSV string
     */
    convertToCSV(data) {
        if (data.length === 0) return '';
        
        const headers = this.config.columns.filter(col => col.visible).map(col => col.title);
        const rows = data.map(row => 
            this.config.columns.filter(col => col.visible).map(col => {
                const value = row[col.field];
                return this.escapeCsvValue(value);
            })
        );
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
    
    /**
     * Escape CSV value
     * @param {*} value - Value to escape
     * @returns {string} Escaped value
     */
    escapeCsvValue(value) {
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value).replace(/"/g, '""');
    }
    
    /**
     * Download CSV file
     * @param {string} csv - CSV content
     * @param {string} filename - Filename
     */
    downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    }
    
    /**
     * Destroy the table
     */
    destroy() {
        if (this._destroyed) return;
        
        this._destroyed = true;
        
        // Destroy components
        this.renderer.destroy();
        this.selection.destroy();
        this.sorting.destroy();
        this.filtering.destroy();
        this.pagination.destroy();
        
        // Remove event listeners
        this.events.removeAllListeners();
        
        // Clear container
        this.container.innerHTML = '';
        
        // Clear state
        this.state = {
            data: [],
            filteredData: [],
            sortedData: [],
            selectedRows: new Set(),
            currentPage: 1,
            pageSize: this.config.pageSize,
            sortColumn: null,
            sortDirection: 'asc',
            isLoading: false,
            error: null
        };
        
        this.events.emit('destroyed', this);
    }
    
    /**
     * Check if table is initialized
     * @returns {boolean}
     */
    isInitialized() {
        return this._initialized;
    }
    
    /**
     * Check if table is destroyed
     * @returns {boolean}
     */
    isDestroyed() {
        return this._destroyed;
    }
}

// ES6 Module Export
export default PDFTable;

// Legacy export for compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFTable;
} else if (typeof window !== 'undefined') {
    window.PDFTable = PDFTable;
}