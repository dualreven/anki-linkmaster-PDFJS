/**
 * UI管理器基类
 * 处理UI渲染、事件绑定和DOM操作
 */
import DebugTools from './debug-tools.js';

class UIManager {
    constructor(options = {}) {
        this.containerId = options.containerId || 'app';
        this.template = options.template || '';
        this.debug = new DebugTools({
            prefix: 'UI',
            enabled: true
        });
        
        this.elements = {};
        this.eventListeners = [];
        this.state = {};
        this.eventHandlers = {}; // 存储事件处理器
        
        this.initialized = false;
    }
    
    initialize() {
        this.debug.info('初始化UI管理器');
        
        // qtWebEngineAdapter.execute(() => {
            this.setupElements();
            this.setupEventListeners();
            this.render();
            this.initialized = true;
            
            this.debug.info('UI管理器初始化完成');
        // }, this);
    }
    
    setupElements() {
        // 查找并缓存DOM元素
        const container = document.getElementById(this.containerId);
        if (!container) {
            this.debug.error(`容器元素未找到: ${this.containerId}`);
            return;
        }
        
        this.elements.container = container;
        
        // 查找所有具有data-ref属性的元素
        const refElements = container.querySelectorAll('[data-ref]');
        refElements.forEach(element => {
            const ref = element.getAttribute('data-ref');
            this.elements[ref] = element;
        });
        
        this.debug.debug(`找到 ${refElements.length} 个引用元素`);
    }
    
    setupEventListeners() {
        // 子类重写此方法来设置事件监听器
    }
    
    addEventListener(element, event, handler, options = {}) {
        const el = typeof element === 'string' ? this.elements[element] : element;
        if (!el) {
            this.debug.warn(`元素未找到: ${element}`);
            return;
        }
        
        el.addEventListener(event, handler, options);
        this.eventListeners.push({ element: el, event, handler });
        
        this.debug.debug(`添加事件监听器: ${event} on ${element}`);
    }
    
    removeEventListeners() {
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners = [];
    }
    
    render() {
        // 子类重写此方法来渲染UI
    }
    
    updateState(newState) {
        this.state = { ...this.state, ...newState };
        this.render();
    }
    
    setState(key, value) {
        this.state[key] = value;
        this.render();
    }
    
    getState(key = null) {
        return key !== null ? this.state[key] : this.state;
    }
    
    showElement(elementRef) {
        const element = this.elements[elementRef];
        if (element) {
            element.style.display = '';
        }
    }
    
    hideElement(elementRef) {
        const element = this.elements[elementRef];
        if (element) {
            element.style.display = 'none';
        }
    }
    
    toggleElement(elementRef) {
        const element = this.elements[elementRef];
        if (element) {
            element.style.display = element.style.display === 'none' ? '' : 'none';
        }
    }
    
    setElementText(elementRef, text) {
        const element = this.elements[elementRef];
        if (element) {
            element.textContent = text;
        }
    }
    
    setElementHtml(elementRef, html) {
        const element = this.elements[elementRef];
        if (element) {
            element.innerHTML = html;
        }
    }
    
    addElementClass(elementRef, className) {
        const element = this.elements[elementRef];
        if (element) {
            element.classList.add(className);
        }
    }
    
    removeElementClass(elementRef, className) {
        const element = this.elements[elementRef];
        if (element) {
            element.classList.remove(className);
        }
    }
    
    toggleElementClass(elementRef, className) {
        const element = this.elements[elementRef];
        if (element) {
            element.classList.toggle(className);
        }
    }
    
    createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.entries(value).forEach(([styleKey, styleValue]) => {
                    element.style[styleKey] = styleValue;
                });
            } else if (key.startsWith('on') && typeof value === 'function') {
                const eventType = key.substring(2).toLowerCase();
                element.addEventListener(eventType, value);
            } else {
                element.setAttribute(key, value);
            }
        });
        
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof HTMLElement) {
                element.appendChild(child);
            }
        });
        
        return element;
    }
    
    renderTemplate(template, data = {}) {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data[key] !== undefined ? String(data[key]) : match;
        });
    }
    
    showError(message, duration = 5000) {
        const errorElement = this.createElement('div', {
            className: 'error-message',
            style: {
                position: 'fixed',
                top: '20px',
                right: '20px',
                background: '#f8d7da',
                color: '#721c24',
                border: '1px solid #f5c6cb',
                padding: '15px',
                borderRadius: '4px',
                zIndex: '10000',
                maxWidth: '400px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }
        }, [message]);
        
        document.body.appendChild(errorElement);
        
        setTimeout(() => {
            if (errorElement.parentNode) {
                errorElement.parentNode.removeChild(errorElement);
            }
        }, duration);
    }
    
    showSuccess(message, duration = 3000) {
        const successElement = this.createElement('div', {
            className: 'success-message',
            style: {
                position: 'fixed',
                top: '20px',
                right: '20px',
                background: '#d4edda',
                color: '#155724',
                border: '1px solid #c3e6cb',
                padding: '15px',
                borderRadius: '4px',
                zIndex: '10000',
                maxWidth: '400px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }
        }, [message]);
        
        document.body.appendChild(successElement);
        
        setTimeout(() => {
            if (successElement.parentNode) {
                successElement.parentNode.removeChild(successElement);
            }
        }, duration);
    }
    
    destroy() {
        this.removeEventListeners();
        this.eventHandlers = {};
        this.initialized = false;
        this.debug.info('UI管理器已销毁');
    }
    
    /**
     * 注册事件监听器
     * @param {string} event - 事件名称
     * @param {Function} handler - 事件处理器
     */
    on(event, handler) {
        if (typeof handler !== 'function') {
            this.debug.warn('事件处理器必须是函数');
            return;
        }
        
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        
        this.eventHandlers[event].push(handler);
        this.debug.debug(`注册事件监听器: ${event}`);
    }
    
    /**
     * 移除事件监听器
     * @param {string} event - 事件名称
     * @param {Function} handler - 要移除的事件处理器（可选）
     */
    off(event, handler = null) {
        if (!this.eventHandlers[event]) {
            return;
        }
        
        if (handler === null) {
            // 移除所有该事件的监听器
            this.eventHandlers[event] = [];
        } else {
            // 移除特定的事件监听器
            const index = this.eventHandlers[event].indexOf(handler);
            if (index > -1) {
                this.eventHandlers[event].splice(index, 1);
            }
        }
        
        this.debug.debug(`移除事件监听器: ${event}`);
    }
    
    /**
     * 触发事件
     * @param {string} event - 事件名称
     * @param {...any} args - 传递给事件处理器的参数
     */
    emit(event, ...args) {
        if (!this.eventHandlers[event]) {
            return;
        }
        
        this.debug.debug(`触发事件: ${event}`, args);
        this.eventHandlers[event].forEach(handler => {
            try {
                handler(...args);
            } catch (error) {
                this.debug.error(`事件处理器执行失败: ${event}`, error);
            }
        });
    }
}

// ES6模块导出
export default UIManager;