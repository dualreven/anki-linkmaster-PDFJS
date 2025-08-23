/**
 * 业务逻辑管理器基类
 * 处理业务逻辑、数据管理和API调用
 */
import DebugTools from './debug-tools.js';

class BusinessLogicManager {
    constructor(options = {}) {
        this.name = options.name || 'BusinessLogicManager';
        this.apiBaseUrl = options.apiBaseUrl || '';
        this.debug = new DebugTools({
            prefix: this.name,
            enabled: true
        });
        
        this.state = {};
        this.data = {};
        this.loading = false;
        this.error = null;
        
        this.eventHandlers = {};
        
        this.initialized = false;
    }
    
    initialize() {
        this.debug.info(`初始化业务逻辑管理器: ${this.name}`);
        this.setupEventListeners();
        this.loadInitialData();
        this.initialized = true;
        
        this.debug.info(`业务逻辑管理器初始化完成: ${this.name}`);
        // qtWebEngineAdapter.execute(() -> {
            
        // }, this);
    }
    
    setupEventListeners() {
        // 子类重写此方法来设置事件监听器
    }
    
    async loadInitialData() {
        // 子类重写此方法来加载初始数据
    }
    
    updateState(newState) {
        this.state = { ...this.state, ...newState };
        this.emit('stateChanged', this.state);
    }
    
    setState(key, value) {
        this.state[key] = value;
        this.emit('stateChanged', this.state);
    }
    
    getState(key = null) {
        return key !== null ? this.state[key] : this.state;
    }
    
    updateData(newData) {
        this.data = { ...this.data, ...newData };
        this.emit('dataChanged', this.data);
    }
    
    setData(key, value) {
        this.data[key] = value;
        this.emit('dataChanged', this.data);
    }
    
    getData(key = null) {
        return key !== null ? this.data[key] : this.data;
    }
    
    setLoading(loading) {
        this.loading = loading;
        this.emit('loadingChanged', loading);
    }
    
    isLoading() {
        return this.loading;
    }
    
    setError(error) {
        this.error = error;
        this.emit('errorChanged', error);
    }
    
    getError() {
        return this.error;
    }
    
    clearError() {
        this.setError(null);
    }
    
    async apiCall(endpoint, options = {}) {
        const url = `${this.apiBaseUrl}${endpoint}`;
        const config = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        };
        
        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }
        
        try {
            this.debug.debug(`API调用: ${config.method} ${url}`);
            
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.debug.debug(`API响应: ${endpoint}`, data);
            
            return data;
        } catch (error) {
            this.debug.error(`API调用失败: ${endpoint}`, error);
            throw error;
        }
    }
    
    async get(endpoint, params = {}) {
        const url = new URL(`${this.apiBaseUrl}${endpoint}`);
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });
        
        return this.apiCall(url.pathname + url.search, { method: 'GET' });
    }
    
    async post(endpoint, data = {}) {
        return this.apiCall(endpoint, {
            method: 'POST',
            body: data
        });
    }
    
    async put(endpoint, data = {}) {
        return this.apiCall(endpoint, {
            method: 'PUT',
            body: data
        });
    }
    
    async delete(endpoint) {
        return this.apiCall(endpoint, {
            method: 'DELETE'
        });
    }
    
    validate(data, rules) {
        const errors = [];
        
        Object.entries(rules).forEach(([field, rule]) => {
            const value = data[field];
            
            if (rule.required && (value === undefined || value === null || value === '')) {
                errors.push(`${field}是必填项`);
                return;
            }
            
            if (rule.type && typeof value !== rule.type) {
                errors.push(`${field}类型必须是${rule.type}`);
                return;
            }
            
            if (rule.minLength && String(value).length < rule.minLength) {
                errors.push(`${field}长度不能少于${rule.minLength}个字符`);
                return;
            }
            
            if (rule.maxLength && String(value).length > rule.maxLength) {
                errors.push(`${field}长度不能超过${rule.maxLength}个字符`);
                return;
            }
            
            if (rule.pattern && !rule.pattern.test(String(value))) {
                errors.push(`${field}格式不正确`);
                return;
            }
            
            if (rule.custom && !rule.custom(value, data)) {
                errors.push(`${field}验证失败`);
                return;
            }
        });
        
        return errors;
    }
    
    emit(event, data) {
        const handlers = this.eventHandlers[event];
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    this.debug.error(`事件处理器错误 [${event}]:`, error);
                }
            });
        }
    }
    
    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
    }
    
    off(event, handler) {
        if (this.eventHandlers[event]) {
            const index = this.eventHandlers[event].indexOf(handler);
            if (index > -1) {
                this.eventHandlers[event].splice(index, 1);
            }
        }
    }
    
    once(event, handler) {
        const onceHandler = (data) => {
            handler(data);
            this.off(event, onceHandler);
        };
        this.on(event, onceHandler);
    }
    
    async retry(fn, maxAttempts = 3, delay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                this.debug.warn(`重试 (${attempt}/${maxAttempts}):`, error);
                
                if (attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, delay * attempt));
                }
            }
        }
        
        throw lastError;
    }
    
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
    
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    destroy() {
        this.eventHandlers = {};
        this.initialized = false;
        this.debug.info(`业务逻辑管理器已销毁: ${this.name}`);
    }
}

// ES6模块导出
export default BusinessLogicManager;