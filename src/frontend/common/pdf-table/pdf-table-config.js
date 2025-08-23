/**
 * PDF Table Configuration Management
 * @module PDFTableConfig
 */

class PDFTableConfig {
    /**
     * Default column configuration
     */
    static DEFAULT_COLUMNS = [
        {
            id: 'select',
            title: '选择',
            field: 'select',
            width: 50,
            align: 'center',
            sortable: false,
            filterable: false,
            visible: true,
            renderer: 'selectRenderer'
        },
        {
            id: 'filename',
            title: '文件名',
            field: 'filename',
            width: 200,
            align: 'left',
            sortable: true,
            filterable: true,
            visible: true
        },
        {
            id: 'title',
            title: '标题',
            field: 'title',
            width: 200,
            align: 'left',
            sortable: true,
            filterable: true,
            visible: true
        },
        {
            id: 'size',
            title: '大小',
            field: 'size',
            width: 100,
            align: 'right',
            sortable: true,
            filterable: false,
            visible: true,
            formatter: 'fileSizeFormatter'
        },
        {
            id: 'import_date',
            title: '导入日期',
            field: 'import_date',
            width: 120,
            align: 'center',
            sortable: true,
            filterable: true,
            visible: true,
            formatter: 'dateFormatter'
        },
        {
            id: 'access_date',
            title: '访问日期',
            field: 'access_date',
            width: 120,
            align: 'center',
            sortable: true,
            filterable: true,
            visible: true,
            formatter: 'dateFormatter'
        },
        {
            id: 'importance',
            title: '重要性',
            field: 'importance',
            width: 100,
            align: 'center',
            sortable: true,
            filterable: true,
            visible: true,
            renderer: 'importanceRenderer'
        },
        {
            id: 'unread_pages',
            title: '未读页数',
            field: 'unread_pages',
            width: 100,
            align: 'right',
            sortable: true,
            filterable: false,
            visible: true,
            formatter: 'pageProgressFormatter'
        },
        {
            id: 'total_pages',
            title: '总页数',
            field: 'total_pages',
            width: 100,
            align: 'right',
            sortable: true,
            filterable: false,
            visible: true
        },
        {
            id: 'annotations_count',
            title: '标注数量',
            field: 'annotations_count',
            width: 100,
            align: 'right',
            sortable: true,
            filterable: false,
            visible: true
        },
        {
            id: 'cards_count',
            title: '卡片数量',
            field: 'cards_count',
            width: 100,
            align: 'right',
            sortable: true,
            filterable: false,
            visible: true
        },
        {
            id: 'actions',
            title: '操作',
            field: 'actions',
            width: 120,
            align: 'center',
            sortable: false,
            filterable: false,
            visible: true,
            renderer: 'actionsRenderer'
        }
    ];

    /**
     * Default configuration
     */
    static DEFAULT_CONFIG = {
        columns: [],
        data: [],
        pageSize: 20,
        sortable: true,
        filterable: true,
        selectable: true,
        pagination: true,
        responsive: true,
        theme: 'default',
        locale: 'zh-CN',
        customRenderers: {},
        customFormatters: {},
        eventHandlers: {},
        rowHeight: 40,
        headerHeight: 50,
        border: true,
        striped: true,
        hover: true,
        compact: false,
        showHeader: true,
        showFooter: false,
        virtualScroll: false,
        virtualScrollRowHeight: 40,
        virtualScrollBufferSize: 5,
        exportEnabled: true,
        searchEnabled: true,
        columnResizeEnabled: true,
        columnReorderEnabled: false,
        multiSelect: true,
        selectAll: true,
        rowClickSelect: true,
        emptyText: '暂无数据',
        loadingText: '加载中...',
        errorText: '加载失败',
        retryText: '重试',
        searchText: '搜索...',
        clearSearchText: '清除',
        selectAllText: '全选',
        paginationInfo: '{start}-{end} 共 {total} 条',
        paginationPrev: '上一页',
        paginationNext: '下一页',
        exportText: '导出',
        exportCSVText: '导出 CSV',
        exportJSONText: '导出 JSON',
        exportExcelText: '导出 Excel'
    };

    /**
     * Available themes
     */
    static THEMES = {
        default: 'default',
        dark: 'dark',
        compact: 'compact',
        modern: 'modern',
        classic: 'classic'
    };

    /**
     * Available locales
     */
    static LOCALES = {
        'zh-CN': '简体中文',
        'zh-TW': '繁體中文',
        'en-US': 'English',
        'ja-JP': '日本語',
        'ko-KR': '한국어'
    };

    /**
     * Create a new PDFTableConfig instance
     * @param {Object} config - Configuration object
     */
    constructor(config = {}) {
        // Merge with default configuration
        this.config = this.mergeConfig(config);
        
        // Normalize columns
        this.columns = this.normalizeColumns(this.config.columns);
        
        // Validate configuration
        this.validateConfig();
        
        // Freeze configuration to prevent runtime modifications
        this.freezeConfig();
    }

    /**
     * Merge configuration with defaults
     * @param {Object} config - User configuration
     * @returns {Object} Merged configuration
     */
    mergeConfig(config) {
        const merged = { ...PDFTableConfig.DEFAULT_CONFIG };
        
        // Deep merge
        Object.keys(config).forEach(key => {
            if (typeof config[key] === 'object' && config[key] !== null && !Array.isArray(config[key])) {
                merged[key] = { ...merged[key], ...config[key] };
            } else {
                merged[key] = config[key];
            }
        });
        
        return merged;
    }

    /**
     * Normalize columns configuration
     * @param {Array} columns - Columns configuration
     * @returns {Array} Normalized columns
     */
    normalizeColumns(columns) {
        if (!columns || columns.length === 0) {
            return PDFTableConfig.DEFAULT_COLUMNS.map(col => this.normalizeColumn(col));
        }
        
        return columns.map(col => this.normalizeColumn(col));
    }

    /**
     * Normalize a single column configuration
     * @param {Object} column - Column configuration
     * @returns {Object} Normalized column
     */
    normalizeColumn(column) {
        const defaultColumn = PDFTableConfig.DEFAULT_COLUMNS.find(
            def => def.id === column.id || def.field === column.field
        );
        
        const normalized = {
            id: column.id || this.generateColumnId(column),
            field: column.field,
            title: column.title || column.field || '',
            width: column.width || 'auto',
            minWidth: column.minWidth || 80,
            maxWidth: column.maxWidth || 500,
            sortable: column.sortable !== false,
            filterable: column.filterable !== false,
            visible: column.visible !== false,
            align: column.align || 'left',
            renderer: column.renderer || null,
            formatter: column.formatter || null,
            className: column.className || '',
            style: column.style || {},
            headerStyle: column.headerStyle || {},
            cellStyle: column.cellStyle || {},
            ...defaultColumn,
            ...column
        };
        
        // Validate column
        this.validateColumn(normalized);
        
        return normalized;
    }

    /**
     * Generate unique column ID
     * @param {Object} column - Column configuration
     * @returns {string} Column ID
     */
    generateColumnId(column) {
        if (column.field) {
            return column.field.replace(/[^a-zA-Z0-9_]/g, '_');
        }
        return `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Validate configuration
     */
    validateConfig() {
        // Validate page size
        if (this.config.pageSize < 1 || this.config.pageSize > 1000) {
            throw new Error('Page size must be between 1 and 1000');
        }
        
        // Validate theme
        if (!PDFTableConfig.THEMES[this.config.theme]) {
            console.warn(`Unknown theme: ${this.config.theme}, using default`);
            this.config.theme = 'default';
        }
        
        // Validate locale
        if (!PDFTableConfig.LOCALES[this.config.locale]) {
            console.warn(`Unknown locale: ${this.config.locale}, using default`);
            this.config.locale = 'zh-CN';
        }
        
        // Validate virtual scroll settings
        if (this.config.virtualScroll) {
            if (this.config.virtualScrollRowHeight < 20) {
                throw new Error('Virtual scroll row height must be at least 20px');
            }
            if (this.config.virtualScrollBufferSize < 1) {
                throw new Error('Virtual scroll buffer size must be at least 1');
            }
        }
        
        // Validate columns
        this.columns.forEach(col => this.validateColumn(col));
    }

    /**
     * Validate a single column
     * @param {Object} column - Column configuration
     */
    validateColumn(column) {
        if (!column.id) {
            throw new Error('Column must have an ID');
        }
        
        if (!column.field && !column.renderer) {
            throw new Error(`Column ${column.id} must have either field or renderer`);
        }
        
        if (column.minWidth && column.maxWidth && column.minWidth > column.maxWidth) {
            throw new Error(`Column ${column.id}: minWidth cannot be greater than maxWidth`);
        }
        
        if (column.width !== 'auto' && typeof column.width === 'string') {
            if (!column.width.match(/^\d+(px|%)$/)) {
                throw new Error(`Column ${column.id}: width must be 'auto', number, or valid CSS width string`);
            }
        }
        
        const validAlignments = ['left', 'center', 'right'];
        if (!validAlignments.includes(column.align)) {
            throw new Error(`Column ${column.id}: align must be one of ${validAlignments.join(', ')}`);
        }
    }

    /**
     * Freeze configuration to prevent runtime modifications
     */
    freezeConfig() {
        // Deep freeze configuration
        Object.freeze(this.config);
        Object.freeze(this.columns);
        this.columns.forEach(col => Object.freeze(col));
    }

    /**
     * Get column by ID
     * @param {string} columnId - Column ID
     * @returns {Object|null} Column configuration
     */
    getColumn(columnId) {
        return this.columns.find(col => col.id === columnId) || null;
    }

    /**
     * Get visible columns
     * @returns {Array} Visible columns
     */
    getVisibleColumns() {
        return this.columns.filter(col => col.visible);
    }

    /**
     * Get sortable columns
     * @returns {Array} Sortable columns
     */
    getSortableColumns() {
        return this.columns.filter(col => col.sortable && col.visible);
    }

    /**
     * Get filterable columns
     * @returns {Array} Filterable columns
     */
    getFilterableColumns() {
        return this.columns.filter(col => col.filterable && col.visible);
    }

    /**
     * Get column by field name
     * @param {string} field - Field name
     * @returns {Object|null} Column configuration
     */
    getColumnByField(field) {
        return this.columns.find(col => col.field === field) || null;
    }

    /**
     * Set table theme
     * @param {string} theme - Theme name
     */
    setTheme(theme) {
        if (!PDFTableConfig.THEMES[theme]) {
            throw new Error(`Unknown theme: ${theme}`);
        }
        
        // Note: In a real implementation, you might want to create a new config instance
        // or implement a proper theme switching mechanism
        this.config.theme = theme;
    }

    /**
     * Set page size
     * @param {number} pageSize - New page size
     */
    setPageSize(pageSize) {
        if (pageSize < 1 || pageSize > 1000) {
            throw new Error('Page size must be between 1 and 1000');
        }
        
        this.config.pageSize = pageSize;
    }

    /**
     * Show/hide column
     * @param {string} columnId - Column ID
     * @param {boolean} visible - Visibility
     */
    setColumnVisibility(columnId, visible) {
        const column = this.getColumn(columnId);
        if (!column) {
            throw new Error(`Column not found: ${columnId}`);
        }
        
        column.visible = visible;
    }

    /**
     * Get column width
     * @param {string} columnId - Column ID
     * @returns {string|number} Column width
     */
    getColumnWidth(columnId) {
        const column = this.getColumn(columnId);
        if (!column) {
            throw new Error(`Column not found: ${columnId}`);
        }
        
        return column.width;
    }

    /**
     * Set column width
     * @param {string} columnId - Column ID
     * @param {string|number} width - New width
     */
    setColumnWidth(columnId, width) {
        const column = this.getColumn(columnId);
        if (!column) {
            throw new Error(`Column not found: ${columnId}`);
        }
        
        if (width !== 'auto' && typeof width === 'string') {
            if (!width.match(/^\d+(px|%)$/)) {
                throw new Error('Width must be \'auto\', number, or valid CSS width string');
            }
        }
        
        column.width = width;
    }

    /**
     * Get configuration value
     * @param {string} key - Configuration key
     * @returns {*} Configuration value
     */
    get(key) {
        return this.config[key];
    }

    /**
     * Check if feature is enabled
     * @param {string} feature - Feature name
     * @returns {boolean} Feature enabled
     */
    isFeatureEnabled(feature) {
        return this.config[feature] === true;
    }

    /**
     * Get localized text
     * @param {string} key - Text key
     * @returns {string} Localized text
     */
    getText(key) {
        return this.config[key] || key;
    }

    /**
     * Clone configuration
     * @returns {PDFTableConfig} New configuration instance
     */
    clone() {
        return new PDFTableConfig(JSON.parse(JSON.stringify(this.config)));
    }

    /**
     * Export configuration to JSON
     * @returns {string} JSON string
     */
    toJSON() {
        return JSON.stringify(this.config, null, 2);
    }

    /**
     * Import configuration from JSON
     * @param {string} json - JSON string
     * @returns {PDFTableConfig} New configuration instance
     */
    static fromJSON(json) {
        const config = JSON.parse(json);
        return new PDFTableConfig(config);
    }

    /**
     * Get available themes
     * @returns {Object} Available themes
     */
    static getAvailableThemes() {
        return { ...PDFTableConfig.THEMES };
    }

    /**
     * Get available locales
     * @returns {Object} Available locales
     */
    static getAvailableLocales() {
        return { ...PDFTableConfig.LOCALES };
    }

    /**
     * Get default columns
     * @returns {Array} Default columns
     */
    static getDefaultColumns() {
        return PDFTableConfig.DEFAULT_COLUMNS.map(col => ({ ...col }));
    }
}

// Export for use in other modules
// ES6 Module Export
export default PDFTableConfig;

// Legacy export for compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFTableConfig;
} else if (typeof window !== 'undefined') {
    window.PDFTableConfig = PDFTableConfig;
}