/**
 * PDF Table Utilities - Helper Functions and Tools
 * @module PDFTableUtils
 */

class PDFTableUtils {
    /**
     * Debounce function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @param {Object} options - Debounce options
     * @returns {Function} Debounced function
     */
    static debounce(func, wait, options = {}) {
        let timeout;
        let lastArgs;
        let lastThis;
        let result;
        let lastCallTime = 0;
        
        const { leading = false, trailing = true, maxWait } = options;
        
        const debounced = function(...args) {
            const now = Date.now();
            const waitTime = wait - (now - lastCallTime);
            
            lastArgs = args;
            lastThis = this;
            lastCallTime = now;
            
            if (timeout) {
                clearTimeout(timeout);
            }
            
            if (leading && waitTime <= 0) {
                result = func.apply(this, args);
                lastCallTime = now;
            } else if (trailing) {
                const maxWaitTime = maxWait ? Math.min(waitTime, maxWait - (now - lastCallTime)) : waitTime;
                timeout = setTimeout(() => {
                    lastCallTime = leading ? Date.now() : 0;
                    timeout = null;
                    result = func.apply(this, args);
                }, maxWaitTime);
            }
            
            return result;
        };
        
        debounced.cancel = function() {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            lastCallTime = 0;
        };
        
        debounced.flush = function() {
            if (timeout) {
                clearTimeout(timeout);
                result = func.apply(lastThis, lastArgs);
                timeout = null;
                lastCallTime = leading ? Date.now() : 0;
            }
            return result;
        };
        
        return debounced;
    }

    /**
     * Throttle function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Limit time in milliseconds
     * @param {Object} options - Throttle options
     * @returns {Function} Throttled function
     */
    static throttle(func, limit, options = {}) {
        const { leading = true, trailing = true } = options;
        let inThrottle;
        let lastFunc;
        let lastRan;
        
        return function(...args) {
            const context = this;
            
            if (!inThrottle && leading) {
                func.apply(context, args);
                lastRan = Date.now();
                inThrottle = true;
            } else {
                clearTimeout(lastFunc);
                lastFunc = setTimeout(() => {
                    if (trailing) {
                        func.apply(context, args);
                    }
                    lastRan = Date.now();
                    inThrottle = false;
                }, limit - (Date.now() - lastRan));
            }
        };
    }

    /**
     * Deep clone object
     * @param {*} obj - Object to clone
     * @returns {*} Cloned object
     */
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }
        
        if (obj instanceof Array) {
            return obj.map(item => PDFTableUtils.deepClone(item));
        }
        
        if (obj instanceof Object) {
            const cloned = {};
            Object.keys(obj).forEach(key => {
                cloned[key] = PDFTableUtils.deepClone(obj[key]);
            });
            return cloned;
        }
        
        return obj;
    }

    /**
     * Generate unique ID
     * @param {string} prefix - ID prefix
     * @returns {string} Unique ID
     */
    static generateId(prefix = 'pdf-table') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Format file size
     * @param {number} bytes - Bytes to format
     * @param {number} decimals - Decimal places
     * @returns {string} Formatted file size
     */
    static formatFileSize(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
    }

    /**
     * Format date
     * @param {string|Date} date - Date to format
     * @param {string} format - Date format
     * @returns {string} Formatted date
     */
    static formatDate(date, format = 'YYYY-MM-DD') {
        if (!date) return '';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    }

    /**
     * Format relative time
     * @param {string|Date} date - Date to format
     * @returns {string} Relative time
     */
    static formatRelativeTime(date) {
        if (!date) return '';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        
        const now = new Date();
        const diffMs = now - d;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        const diffMonth = Math.floor(diffDay / 30);
        const diffYear = Math.floor(diffMonth / 12);
        
        if (diffSec < 60) return '刚刚';
        if (diffMin < 60) return `${diffMin}分钟前`;
        if (diffHour < 24) return `${diffHour}小时前`;
        if (diffDay < 30) return `${diffDay}天前`;
        if (diffMonth < 12) return `${diffMonth}个月前`;
        return `${diffYear}年前`;
    }

    /**
     * Escape HTML
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML
     */
    static escapeHtml(text) {
        if (!text) return '';
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Unescape HTML
     * @param {string} html - HTML to unescape
     * @returns {string} Unescaped text
     */
    static unescapeHtml(html) {
        if (!html) return '';
        
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }

    /**
     * Parse query string
     * @param {string} queryString - Query string
     * @returns {Object} Parsed query parameters
     */
    static parseQueryString(queryString) {
        if (!queryString) return {};
        
        const query = queryString.startsWith('?') ? queryString.slice(1) : queryString;
        const pairs = query.split('&');
        const result = {};
        
        pairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (key) {
                result[decodeURIComponent(key)] = value ? decodeURIComponent(value.replace(/\+/g, ' ')) : '';
            }
        });
        
        return result;
    }

    /**
     * Build query string
     * @param {Object} params - Query parameters
     * @returns {string} Query string
     */
    static buildQueryString(params) {
        const pairs = [];
        
        Object.keys(params).forEach(key => {
            const value = params[key];
            if (value !== null && value !== undefined) {
                pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
            }
        });
        
        return pairs.length > 0 ? `?${pairs.join('&')}` : '';
    }

    /**
     * Validate email
     * @param {string} email - Email to validate
     * @returns {boolean} Email is valid
     */
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate URL
     * @param {string} url - URL to validate
     * @returns {boolean} URL is valid
     */
    static isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Truncate text
     * @param {string} text - Text to truncate
     * @param {number} length - Maximum length
     * @param {string} suffix - Truncation suffix
     * @returns {string} Truncated text
     */
    static truncate(text, length = 100, suffix = '...') {
        if (!text || text.length <= length) return text;
        return text.substring(0, length - suffix.length) + suffix;
    }

    /**
     * Capitalize string
     * @param {string} text - Text to capitalize
     * @returns {string} Capitalized text
     */
    static capitalize(text) {
        if (!text) return '';
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }

    /**
     * Convert to camel case
     * @param {string} text - Text to convert
     * @returns {string} Camel case text
     */
    static toCamelCase(text) {
        if (!text) return '';
        return text.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');
    }

    /**
     * Convert to kebab case
     * @param {string} text - Text to convert
     * @returns {string} Kebab case text
     */
    static toKebabCase(text) {
        if (!text) return '';
        return text.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    }

    /**
     * Convert to snake case
     * @param {string} text - Text to convert
     * @returns {string} Snake case text
     */
    static toSnakeCase(text) {
        if (!text) return '';
        return text.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    }

    /**
     * Get object property by path
     * @param {Object} obj - Object to get property from
     * @param {string} path - Property path
     * @param {*} defaultValue - Default value
     * @returns {*} Property value
     */
    static getProperty(obj, path, defaultValue = undefined) {
        if (!obj || !path) return defaultValue;
        
        const keys = path.split('.');
        let result = obj;
        
        for (const key of keys) {
            if (result === null || result === undefined) {
                return defaultValue;
            }
            result = result[key];
        }
        
        return result !== undefined ? result : defaultValue;
    }

    /**
     * Set object property by path
     * @param {Object} obj - Object to set property on
     * @param {string} path - Property path
     * @param {*} value - Property value
     */
    static setProperty(obj, path, value) {
        if (!obj || !path) return;
        
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
    }

    /**
     * Merge objects
     * @param {Object} target - Target object
     * @param {...Object} sources - Source objects
     * @returns {Object} Merged object
     */
    static merge(target, ...sources) {
        if (!sources.length) return target;
        
        const source = sources.shift();
        
        if (PDFTableUtils.isObject(target) && PDFTableUtils.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (PDFTableUtils.isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    PDFTableUtils.merge(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            });
        }
        
        return PDFTableUtils.merge(target, ...sources);
    }

    /**
     * Check if value is object
     * @param {*} value - Value to check
     * @returns {boolean} Value is object
     */
    static isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    /**
     * Check if value is empty
     * @param {*} value - Value to check
     * @returns {boolean} Value is empty
     */
    static isEmpty(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim() === '';
        if (Array.isArray(value)) return value.length === 0;
        if (PDFTableUtils.isObject(value)) return Object.keys(value).length === 0;
        return false;
    }

    /**
     * Generate array range
     * @param {number} start - Start value
     * @param {number} end - End value
     * @param {number} step - Step value
     * @returns {Array} Range array
     */
    static range(start, end, step = 1) {
        const result = [];
        for (let i = start; i < end; i += step) {
            result.push(i);
        }
        return result;
    }

    /**
     * Shuffle array
     * @param {Array} array - Array to shuffle
     * @returns {Array} Shuffled array
     */
    static shuffle(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Unique array values
     * @param {Array} array - Array to unique
     * @returns {Array} Unique array
     */
    static unique(array) {
        return [...new Set(array)];
    }

    /**
     * Group array by key
     * @param {Array} array - Array to group
     * @param {string|Function} key - Group key
     * @returns {Object} Grouped object
     */
    static groupBy(array, key) {
        const grouped = {};
        
        array.forEach(item => {
            const groupKey = typeof key === 'function' ? key(item) : item[key];
            if (!grouped[groupKey]) {
                grouped[groupKey] = [];
            }
            grouped[groupKey].push(item);
        });
        
        return grouped;
    }

    /**
     * Sort array by key
     * @param {Array} array - Array to sort
     * @param {string|Function} key - Sort key
     * @param {string} direction - Sort direction
     * @returns {Array} Sorted array
     */
    static sortBy(array, key, direction = 'asc') {
        const sorted = [...array];
        
        sorted.sort((a, b) => {
            const valueA = typeof key === 'function' ? key(a) : a[key];
            const valueB = typeof key === 'function' ? key(b) : b[key];
            
            if (valueA < valueB) return direction === 'asc' ? -1 : 1;
            if (valueA > valueB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        
        return sorted;
    }

    /**
     * Format number with commas
     * @param {number} num - Number to format
     * @returns {string} Formatted number
     */
    static formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /**
     * Calculate percentage
     * @param {number} value - Value
     * @param {number} total - Total
     * @param {number} decimals - Decimal places
     * @returns {number} Percentage
     */
    static percentage(value, total, decimals = 2) {
        if (total === 0) return 0;
        return Number(((value / total) * 100).toFixed(decimals));
    }

    /**
     * Sleep for specified time
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} Sleep promise
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Retry function
     * @param {Function} fn - Function to retry
     * @param {Object} options - Retry options
     * @returns {Promise} Retry promise
     */
    static async retry(fn, options = {}) {
        const { maxAttempts = 3, delay = 1000, backoff = 2 } = options;
        let lastError;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                if (attempt < maxAttempts) {
                    const waitTime = delay * Math.pow(backoff, attempt - 1);
                    await PDFTableUtils.sleep(waitTime);
                }
            }
        }
        
        throw lastError;
    }

    /**
     * Create memoized function
     * @param {Function} fn - Function to memoize
     * @param {Function} keyGenerator - Key generator
     * @returns {Function} Memoized function
     */
    static memoize(fn, keyGenerator = (...args) => JSON.stringify(args)) {
        const cache = new Map();
        
        return (...args) => {
            const key = keyGenerator(...args);
            
            if (cache.has(key)) {
                return cache.get(key);
            }
            
            const result = fn(...args);
            cache.set(key, result);
            return result;
        };
    }

    /**
     * Create throttle function that caches last result
     * @param {Function} fn - Function to throttle
     * @param {number} limit - Limit time
     * @returns {Function} Throttled function
     */
    static throttleWithCache(fn, limit) {
        let lastResult;
        let lastTime = 0;
        
        return function(...args) {
            const now = Date.now();
            
            if (now - lastTime >= limit) {
                lastResult = fn.apply(this, args);
                lastTime = now;
            }
            
            return lastResult;
        };
    }
}

/**
 * 数据清理和标准化工具
 * 用于修复和标准化可能损坏的PDF数据
 */
PDFTableUtils.DataSanitizer = {
    /**
     * 清理和标准化PDF数据
     * @param {Array} data - 原始数据数组
     * @returns {Array} 清理后的数据数组
     */
    sanitizePDFData(data) {
        if (!Array.isArray(data)) {
            console.warn('数据不是数组，返回空数组');
            return [];
        }

        return data
            .filter(item => item !== null && item !== undefined)
            .map((item, index) => this.sanitizePDFItem(item, index))
            .filter(item => item !== null);
    },

    /**
     * 清理单个PDF数据项
     * @param {Object} item - 单个PDF数据项
     * @param {number} index - 数据项索引
     * @returns {Object|null} 清理后的数据项或null（如果无效）
     */
    sanitizePDFItem(item, index) {
        if (!item || typeof item !== 'object') {
            console.warn(`索引 ${index}: 数据项无效，跳过`);
            return null;
        }

        const sanitized = {};

        // 必需字段处理
        sanitized.id = this.sanitizeString(item.id, `pdf_${index}`);
        sanitized.filename = this.sanitizeString(item.filename, '未命名.pdf');
        sanitized.path = this.sanitizeString(item.path, '');
        sanitized.size = this.sanitizeNumber(item.size, 0);
        sanitized.pageCount = this.sanitizeNumber(item.pageCount, 1);
        sanitized.createdAt = this.sanitizeDate(item.createdAt, new Date());
        sanitized.updatedAt = this.sanitizeDate(item.updatedAt, new Date());
        sanitized.status = this.sanitizeEnum(item.status, ['pending', 'processing', 'completed', 'failed'], 'pending');

        // 可选字段处理
        sanitized.title = this.sanitizeString(item.title, sanitized.filename);
        sanitized.author = this.sanitizeString(item.author, '未知作者');
        sanitized.tags = this.sanitizeArray(item.tags, []);
        sanitized.notes = this.sanitizeString(item.notes, '');
        sanitized.preview = this.sanitizeString(item.preview, '');
        sanitized.processedPages = this.sanitizeNumber(item.processedPages, 0);
        sanitized.errorMessage = this.sanitizeString(item.errorMessage, '');
        sanitized.lastAccessed = this.sanitizeDate(item.lastAccessed, new Date());

        return sanitized;
    },

    /**
     * 清理字符串值
     * @param {*} value - 原始值
     * @param {string} defaultValue - 默认值
     * @returns {string} 清理后的字符串
     */
    sanitizeString(value, defaultValue = '') {
        if (typeof value === 'string') {
            return value.trim();
        }
        if (typeof value === 'number') {
            return String(value);
        }
        return defaultValue;
    },

    /**
     * 清理数字值
     * @param {*} value - 原始值
     * @param {number} defaultValue - 默认值
     * @returns {number} 清理后的数字
     */
    sanitizeNumber(value, defaultValue = 0) {
        if (typeof value === 'number' && !isNaN(value)) {
            return Math.max(0, Math.floor(value));
        }
        if (typeof value === 'string') {
            const num = parseInt(value, 10);
            return isNaN(num) ? defaultValue : Math.max(0, num);
        }
        return defaultValue;
    },

    /**
     * 清理日期值
     * @param {*} value - 原始值
     * @param {Date} defaultValue - 默认值
     * @returns {Date} 清理后的日期
     */
    sanitizeDate(value, defaultValue = new Date()) {
        if (value instanceof Date) {
            return isNaN(value.getTime()) ? defaultValue : value;
        }
        if (typeof value === 'string' || typeof value === 'number') {
            const date = new Date(value);
            return isNaN(date.getTime()) ? defaultValue : date;
        }
        return defaultValue;
    },

    /**
     * 清理枚举值
     * @param {*} value - 原始值
     * @param {Array} validValues - 有效枚举值数组
     * @param {*} defaultValue - 默认值
     * @returns {*} 清理后的枚举值
     */
    sanitizeEnum(value, validValues, defaultValue) {
        if (validValues.includes(value)) {
            return value;
        }
        return defaultValue;
    },

    /**
     * 清理数组值
     * @param {*} value - 原始值
     * @param {Array} defaultValue - 默认值
     * @returns {Array} 清理后的数组
     */
    sanitizeArray(value, defaultValue = []) {
        if (Array.isArray(value)) {
            return value.filter(item => item !== null && item !== undefined);
        }
        return defaultValue;
    },

    /**
     * 快速验证数据有效性
     * @param {Array} data - 数据数组
     * @returns {boolean} 是否有效
     */
    isValidData(data) {
        return Array.isArray(data) && 
               data.length > 0 && 
               data.every(item => 
                   item && 
                   typeof item === 'object' && 
                   item.id && 
                   item.filename
               );
    }
};

/**
 * 错误处理工具
 */
PDFTableUtils.ErrorHandler = {
    /**
     * 创建用户友好的错误消息
     * @param {Error|string} error - 错误对象或消息
     * @returns {string} 用户友好的错误消息
     */
    createUserFriendlyMessage(error) {
        const message = typeof error === 'string' ? error : error.message;
        
        const errorMap = {
            'NetworkError': '网络连接异常，请检查网络设置',
            'TimeoutError': '请求超时，请稍后重试',
            'TypeError': '数据格式错误，请联系技术支持',
            'SyntaxError': '数据解析错误，请联系技术支持',
            'ValidationError': '数据验证失败，部分信息可能不完整',
            'ENOENT': '文件未找到，请确认文件路径正确'
        };

        for (const [key, value] of Object.entries(errorMap)) {
            if (message.includes(key)) {
                return value;
            }
        }

        return message || '发生未知错误，请稍后重试';
    },

    /**
     * 记录错误日志
     * @param {Error} error - 错误对象
     * @param {Object} context - 上下文信息
     */
    logError(error, context = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            message: error.message,
            stack: error.stack,
            context: context,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        console.error('PDF Table Error:', logEntry);
        
        // 可以发送到后端日志服务
        if (window.errorReporter) {
            window.errorReporter.log(logEntry);
        }
    }
};

// Export for use in other modules
// ES6 Module Export
export default PDFTableUtils;

// Legacy export for compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFTableUtils;
} else if (typeof window !== 'undefined') {
    window.PDFTableUtils = PDFTableUtils;
}