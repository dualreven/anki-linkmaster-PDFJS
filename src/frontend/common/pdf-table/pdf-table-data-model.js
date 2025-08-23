/**
 * PDF Table Data Model and Validation
 * @module PDFTableDataModel
 */

class PDFTableDataModel {
    /**
     * Data schema definition
     */
    static SCHEMA = {
        id: {
            type: 'string',
            required: true,
            description: 'Unique identifier for the PDF file',
            validator: (value) => typeof value === 'string' && value.length > 0
        },
        filename: {
            type: 'string',
            required: true,
            description: 'PDF filename',
            validator: (value) => typeof value === 'string' && value.length > 0
        },
        filepath: {
            type: 'string',
            required: true,
            description: 'Full path to the PDF file',
            validator: (value) => typeof value === 'string' && value.length > 0
        },
        title: {
            type: 'string',
            required: false,
            description: 'PDF title',
            validator: (value) => value === null || value === undefined || typeof value === 'string'
        },
        author: {
            type: 'string',
            required: false,
            description: 'PDF author',
            validator: (value) => value === null || value === undefined || typeof value === 'string'
        },
        subject: {
            type: 'string',
            required: false,
            description: 'PDF subject',
            validator: (value) => value === null || value === undefined || typeof value === 'string'
        },
        keywords: {
            type: 'string',
            required: false,
            description: 'PDF keywords',
            validator: (value) => value === null || value === undefined || typeof value === 'string'
        },
        size: {
            type: 'number',
            required: true,
            description: 'File size in bytes',
            validator: (value) => typeof value === 'number' && value >= 0
        },
        created_time: {
            type: 'number',
            required: false,
            description: 'File creation timestamp',
            validator: (value) => value === null || value === undefined || (typeof value === 'number' && value >= 0)
        },
        modified_time: {
            type: 'number',
            required: false,
            description: 'File modification timestamp',
            validator: (value) => value === null || value === undefined || (typeof value === 'number' && value >= 0)
        },
        page_count: {
            type: 'number',
            required: false,
            description: 'Total number of pages',
            validator: (value) => value === null || value === undefined || (typeof value === 'number' && value >= 0)
        },
        thumbnail_path: {
            type: 'string',
            required: false,
            description: 'Path to thumbnail image',
            validator: (value) => value === null || value === undefined || typeof value === 'string'
        },
        tags: {
            type: 'array',
            required: false,
            description: 'Array of tags',
            default: [],
            validator: (value) => Array.isArray(value) && value.every(tag => typeof tag === 'string')
        },
        notes: {
            type: 'string',
            required: false,
            description: 'User notes',
            validator: (value) => value === null || value === undefined || typeof value === 'string'
        },
        // Extended fields
        import_date: {
            type: 'string',
            required: false,
            description: 'Import date in ISO format',
            validator: (value) => {
                if (value === null || value === undefined) return true;
                return typeof value === 'string' && !isNaN(Date.parse(value));
            }
        },
        access_date: {
            type: 'string',
            required: false,
            description: 'Last access date in ISO format',
            validator: (value) => {
                if (value === null || value === undefined) return true;
                return typeof value === 'string' && !isNaN(Date.parse(value));
            }
        },
        importance: {
            type: 'string',
            required: false,
            description: 'Importance level',
            enum: ['high', 'medium', 'low'],
            validator: (value) => {
                if (value === null || value === undefined) return true;
                return ['high', 'medium', 'low'].includes(value);
            }
        },
        unread_pages: {
            type: 'number',
            required: false,
            description: 'Number of unread pages',
            default: 0,
            validator: (value) => value === null || value === undefined || (typeof value === 'number' && value >= 0)
        },
        total_pages: {
            type: 'number',
            required: false,
            description: 'Total number of pages',
            default: 0,
            validator: (value) => value === null || value === undefined || (typeof value === 'number' && value >= 0)
        },
        annotations_count: {
            type: 'number',
            required: false,
            description: 'Number of annotations',
            default: 0,
            validator: (value) => value === null || value === undefined || (typeof value === 'number' && value >= 0)
        },
        cards_count: {
            type: 'number',
            required: false,
            description: 'Number of flash cards',
            default: 0,
            validator: (value) => value === null || value === undefined || (typeof value === 'number' && value >= 0)
        }
    };

    /**
     * Validation error types
     */
    static ERROR_TYPES = {
        REQUIRED: 'required',
        TYPE: 'type',
        ENUM: 'enum',
        CUSTOM: 'custom',
        UNKNOWN: 'unknown'
    };

    /**
     * Create a new PDFTableDataModel instance
     */
    constructor() {
        this.schema = PDFTableDataModel.SCHEMA;
        this.validators = this.createValidators();
        this.formatters = this.createFormatters();
        this.parsers = this.createParsers();
    }

    /**
     * Create validators for each field
     * @returns {Object} Validators object
     */
    createValidators() {
        const validators = {};
        
        Object.entries(this.schema).forEach(([field, config]) => {
            validators[field] = {
                validate: (value) => {
                    const errors = [];
                    
                    // Check required
                    if (config.required && (value === undefined || value === null || value === '')) {
                        errors.push({
                            type: PDFTableDataModel.ERROR_TYPES.REQUIRED,
                            message: `${field} is required`
                        });
                        return errors;
                    }
                    
                    // Skip further validation if not required and value is empty
                    if (!config.required && (value === undefined || value === null || value === '')) {
                        return errors;
                    }
                    
                    // Check type
                    const typeError = this.validateType(value, config.type);
                    if (typeError) {
                        errors.push(typeError);
                    }
                    
                    // Check enum
                    if (config.enum && !config.enum.includes(value)) {
                        errors.push({
                            type: PDFTableDataModel.ERROR_TYPES.ENUM,
                            message: `${field} must be one of: ${config.enum.join(', ')}`
                        });
                    }
                    
                    // Check custom validator
                    if (config.validator && !config.validator(value)) {
                        errors.push({
                            type: PDFTableDataModel.ERROR_TYPES.CUSTOM,
                            message: `${field} failed custom validation`
                        });
                    }
                    
                    return errors;
                }
            };
        });
        
        return validators;
    }

    /**
     * Validate value type
     * @param {*} value - Value to validate
     * @param {string} type - Expected type
     * @returns {Object|null} Validation error
     */
    validateType(value, type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        
        if (actualType !== type) {
            return {
                type: PDFTableDataModel.ERROR_TYPES.TYPE,
                message: `Expected ${type}, got ${actualType}`
            };
        }
        
        return null;
    }

    /**
     * Create formatters for each field
     * @returns {Object} Formatters object
     */
    createFormatters() {
        return {
            size: (bytes) => {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            },
            
            date: (dateString) => {
                if (!dateString) return '';
                const date = new Date(dateString);
                const now = new Date();
                const diffTime = Math.abs(now - date);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays === 0) {
                    return '今天';
                } else if (diffDays === 1) {
                    return '昨天';
                } else if (diffDays < 7) {
                    return `${diffDays}天前`;
                } else {
                    return date.toLocaleDateString('zh-CN');
                }
            },
            
            importance: (value) => {
                const icons = {
                    high: '⚡',
                    medium: '⭐',
                    low: '🔍'
                };
                return `${icons[value] || ''} ${value}`;
            },
            
            pageProgress: (unread, total) => {
                if (!total) return '0/0';
                return `${unread}/${total}`;
            },
            
            default: (value) => value !== null && value !== undefined ? String(value) : ''
        };
    }

    /**
     * Create parsers for each field
     * @returns {Object} Parsers object
     */
    createParsers() {
        return {
            size: (value) => {
                if (typeof value === 'number') return value;
                if (typeof value === 'string') {
                    const matches = value.match(/^(\d+(?:\.\d+)?)\s*(Bytes|KB|MB|GB)$/i);
                    if (matches) {
                        const num = parseFloat(matches[1]);
                        const unit = matches[2].toUpperCase();
                        const multipliers = { BYTES: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
                        return num * multipliers[unit];
                    }
                }
                return 0;
            },
            
            date: (value) => {
                if (value instanceof Date) return value.toISOString();
                if (typeof value === 'string') {
                    const date = new Date(value);
                    return isNaN(date.getTime()) ? null : date.toISOString();
                }
                if (typeof value === 'number') {
                    return new Date(value).toISOString();
                }
                return null;
            },
            
            importance: (value) => {
                const normalized = String(value).toLowerCase();
                if (['high', 'medium', 'low'].includes(normalized)) {
                    return normalized;
                }
                return 'medium';
            },
            
            number: (value) => {
                const num = parseFloat(value);
                return isNaN(num) ? 0 : num;
            },
            
            string: (value) => {
                return value !== null && value !== undefined ? String(value) : '';
            },
            
            array: (value) => {
                if (Array.isArray(value)) return value;
                if (typeof value === 'string') {
                    return value.split(',').map(item => item.trim()).filter(item => item);
                }
                return [];
            },
            
            default: (value) => value
        };
    }

    /**
     * Validate entire data array
     * @param {Array} data - Array of data objects
     * @returns {Array} Array of validation error messages
     */
    validateData(data) {
        const errors = [];
        
        if (!Array.isArray(data)) {
            errors.push({
                type: 'TYPE_ERROR',
                message: 'Data must be an array',
                expected: 'array',
                actual: typeof data
            });
            return errors;
        }
        
        data.forEach((item, index) => {
            const itemErrors = this.validateItem(item);
            if (itemErrors.length > 0) {
                errors.push({
                    row: index,
                    errors: itemErrors
                });
            }
        });
        
        return errors;
    }

    /**
     * Validate a single data item
     * @param {Object} item - Item to validate
     * @param {number} index - Index of the item in the array
     * @returns {Array} Array of validation error messages
     */
    validateItem(item, index) {
        const errors = [];
        
        // 防御性编程：处理空值和类型问题
        if (item === null || item === undefined) {
            errors.push({
                type: PDFTableDataModel.ERROR_TYPES.TYPE,
                message: `Item at index ${index} cannot be null or undefined`,
                row: index
            });
            return errors;
        }
        
        if (typeof item !== 'object') {
            errors.push({
                type: PDFTableDataModel.ERROR_TYPES.TYPE,
                message: `Item at index ${index} must be an object`,
                expected: 'object',
                actual: typeof item,
                row: index
            });
            return errors;
        }
        
        // 检查必需字段
        for (const [field, config] of Object.entries(this.schema)) {
            if (config.required && !(field in item)) {
                errors.push({
                    type: PDFTableDataModel.ERROR_TYPES.REQUIRED,
                    message: `Missing required field: ${field}`,
                    field: field,
                    row: index
                });
            }
        }
        
        // 验证每个字段
        for (const [field, value] of Object.entries(item)) {
            const fieldErrors = this.validateField(field, value);
            fieldErrors.forEach(err => {
                err.row = index;
                if (!err.field) err.field = field;
            });
            errors.push(...fieldErrors);
        }
        
        return errors;
    }

    /**
     * Validate a specific field
     * @param {string} field - Field name
     * @param {*} value - Field value
     * @returns {Array} Validation errors
     */
    validateField(field, value) {
        const validator = this.validators[field];
        if (!validator) {
            return [{
                type: PDFTableDataModel.ERROR_TYPES.UNKNOWN,
                message: `Unknown field: ${field}`
            }];
        }
        
        return validator.validate(value);
    }

    /**
     * Format a field value
     * @param {string} field - Field name
     * @param {*} value - Field value
     * @param {Object} options - Formatting options
     * @returns {string} Formatted value
     */
    formatField(field, value, options = {}) {
        const formatter = this.formatters[field] || this.formatters.default;
        
        try {
            if (field === 'pageProgress') {
                return formatter(value, options.total);
            }
            return formatter(value);
        } catch (error) {
            console.warn(`Failed to format field ${field}:`, error);
            return this.formatters.default(value);
        }
    }

    /**
     * Parse a field value
     * @param {string} field - Field name
     * @param {*} value - Field value
     * @returns {*} Parsed value
     */
    parseField(field, value) {
        const parser = this.parsers[field] || this.parsers.default;
        
        try {
            return parser(value);
        } catch (error) {
            console.warn(`Failed to parse field ${field}:`, error);
            return value;
        }
    }

    /**
     * Sanitize data item
     * @param {Object} item - Item to sanitize
     * @returns {Object} Sanitized item
     */
    sanitizeItem(item) {
        const sanitized = {};
        
        Object.entries(this.schema).forEach(([field, config]) => {
            const value = item[field];
            
            // Use default value if not provided
            if (value === undefined || value === null) {
                sanitized[field] = config.default !== undefined ? config.default : null;
                return;
            }
            
            // Parse and validate the value
            const parsed = this.parseField(field, value);
            const errors = this.validateField(field, parsed);
            
            if (errors.length === 0) {
                sanitized[field] = parsed;
            } else {
                // Use default value if validation fails
                sanitized[field] = config.default !== undefined ? config.default : null;
                console.warn(`Validation failed for field ${field}:`, errors);
            }
        });
        
        return sanitized;
    }

    /**
     * Sanitize entire data array
     * @param {Array} data - Data to sanitize
     * @returns {Array} Sanitized data
     */
    sanitizeData(data) {
        if (!Array.isArray(data)) {
            return [];
        }
        
        return data.map(item => this.sanitizeItem(item));
    }

    /**
     * Get field schema
     * @param {string} field - Field name
     * @returns {Object|null} Field schema
     */
    getFieldSchema(field) {
        return this.schema[field] || null;
    }

    /**
     * Get all field names
     * @returns {Array} Field names
     */
    getFieldNames() {
        return Object.keys(this.schema);
    }

    /**
     * Get required field names
     * @returns {Array} Required field names
     */
    getRequiredFields() {
        return Object.entries(this.schema)
            .filter(([_, config]) => config.required)
            .map(([field, _]) => field);
    }

    /**
     * Get optional field names
     * @returns {Array} Optional field names
     */
    getOptionalFields() {
        return Object.entries(this.schema)
            .filter(([_, config]) => !config.required)
            .map(([field, _]) => field);
    }

    /**
     * Check if field exists in schema
     * @param {string} field - Field name
     * @returns {boolean} Field exists
     */
    hasField(field) {
        return field in this.schema;
    }

    /**
     * Check if field is required
     * @param {string} field - Field name
     * @returns {boolean} Field is required
     */
    isRequired(field) {
        const config = this.schema[field];
        return config && config.required;
    }

    /**
     * Get field type
     * @param {string} field - Field name
     * @returns {string|null} Field type
     */
    getFieldType(field) {
        const config = this.schema[field];
        return config ? config.type : null;
    }

    /**
     * Create empty data item with defaults
     * @returns {Object} Empty data item
     */
    createEmptyItem() {
        const item = {};
        
        Object.entries(this.schema).forEach(([field, config]) => {
            item[field] = config.default !== undefined ? config.default : null;
        });
        
        return item;
    }

    /**
     * Get validation error messages
     * @param {Array} errors - Validation errors
     * @returns {Array} Error messages
     */
    getErrorMessages(errors) {
        return errors.map(error => {
            if (error.row !== undefined) {
                return `Row ${error.row}: ${error.errors.map(e => e.message).join(', ')}`;
            }
            return error.message;
        });
    }

    /**
     * Export schema to JSON
     * @returns {string} JSON string
     */
    exportSchema() {
        return JSON.stringify(this.schema, null, 2);
    }

    /**
     * Import schema from JSON
     * @param {string} json - JSON string
     * @returns {PDFTableDataModel} New data model instance
     */
    static importSchema(json) {
        const schema = JSON.parse(json);
        const model = new PDFTableDataModel();
        model.schema = schema;
        model.validators = model.createValidators();
        return model;
    }
}

// Export for use in other modules
// ES6 Module Export
export default PDFTableDataModel;

// Legacy export for compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFTableDataModel;
} else if (typeof window !== 'undefined') {
    window.PDFTableDataModel = PDFTableDataModel;
}