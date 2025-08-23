/**
 * Frontend Error Collector - 自动收集前端错误并发送到后端
 * @module ErrorCollector
 */

import DebugTools from './debug-tools.js';

class ErrorCollector {
    constructor(options = {}) {
        this.errorQueue = [];
        this.isProcessing = false;
        this.endpoint = '/api/errors';
        this.maxRetries = 3;
        this.retryDelay = 1000;
        this.sessionId = this.generateSessionId();
        this.debug = new DebugTools({
            prefix: 'ErrorCollector',
            enabled: true
        });
        
        this.initialize();
    }

    /**
     * 初始化错误收集器
     */
    initialize() {
        // 捕获全局JavaScript错误
        window.addEventListener('error', this.handleGlobalError.bind(this));
        
        // 捕获未处理的Promise拒绝
        window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
        
        // 捕获资源加载错误
        window.addEventListener('error', this.handleResourceError.bind(this), true);
        
        // 监听控制台错误
        this.overrideConsoleError();
        
        // 定期发送错误队列
        setInterval(this.processErrorQueue.bind(this), 5000);
        
        console.log('ErrorCollector initialized with session:', this.sessionId);
    }

    /**
     * 生成会话ID
     */
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 处理全局JavaScript错误
     */
    handleGlobalError(event) {
        const error = {
            type: 'javascript_error',
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error?.stack,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        
        this.queueError(error);
    }

    /**
     * 处理未处理的Promise拒绝
     */
    handleUnhandledRejection(event) {
        const error = {
            type: 'promise_rejection',
            message: event.reason?.message || String(event.reason),
            stack: event.reason?.stack,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        
        this.queueError(error);
        
        // 阻止默认行为
        event.preventDefault();
    }

    /**
     * 处理资源加载错误
     */
    handleResourceError(event) {
        if (event.target && (event.target.tagName === 'SCRIPT' || event.target.tagName === 'LINK' || event.target.tagName === 'IMG')) {
            const error = {
                type: 'resource_error',
                message: `Failed to load resource: ${event.target.src || event.target.href}`,
                element: event.target.tagName.toLowerCase(),
                source: event.target.src || event.target.href,
                timestamp: new Date().toISOString(),
                sessionId: this.sessionId,
                url: window.location.href,
                userAgent: navigator.userAgent
            };
            
            this.queueError(error);
        }
    }

    /**
     * 重写console.error以捕获控制台错误
     */
    overrideConsoleError() {
        const originalConsoleError = console.error;
        const self = this;
        
        console.error = function(...args) {
            // 调用原始方法
            originalConsoleError.apply(console, args);
            
            // 创建错误对象
            const error = {
                type: 'console_error',
                message: args.map(arg => {
                    if (typeof arg === 'object') {
                        try {
                            return JSON.stringify(arg);
                        } catch {
                            return String(arg);
                        }
                    }
                    return String(arg);
                }).join(' '),
                arguments: args,
                timestamp: new Date().toISOString(),
                sessionId: self.sessionId,
                url: window.location.href,
                userAgent: navigator.userAgent
            };
            
            self.queueError(error);
        };
    }

    /**
     * 手动记录错误
     */
    logError(message, type = 'manual', additionalData = {}) {
        const error = {
            type,
            message,
            ...additionalData,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        
        this.queueError(error);
    }

    /**
     * 将错误加入队列
     */
    queueError(error) {
        this.errorQueue.push(error);
        
        // 如果队列过长，立即处理
        if (this.errorQueue.length > 10) {
            this.processErrorQueue();
        }
    }

    /**
     * 处理错误队列
     */
    async processErrorQueue() {
        if (this.isProcessing || this.errorQueue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        
        try {
            const errorsToSend = [...this.errorQueue];
            this.errorQueue = [];
            
            await this.sendErrorsToServer(errorsToSend);
            
        } catch (error) {
            console.error('Failed to process error queue:', error);
            // 将错误重新加入队列
            this.errorQueue.unshift(...errorsToSend);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 发送错误到服务器
     */
    async sendErrorsToServer(errors, retryCount = 0) {
        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    errors,
                    session_id: this.sessionId,
                    timestamp: new Date().toISOString()
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Errors sent successfully:', result);
            
        } catch (error) {
            console.error('Failed to send errors to server:', error);
            
            if (retryCount < this.maxRetries) {
                setTimeout(() => {
                    this.sendErrorsToServer(errors, retryCount + 1);
                }, this.retryDelay * Math.pow(2, retryCount));
            } else {
                console.error('Max retries reached for sending errors');
            }
        }
    }

    /**
     * 获取错误统计
     */
    getErrorStats() {
        const stats = {
            totalErrors: 0,
            errorTypes: {},
            recentErrors: []
        };
        
        // 统计队列中的错误
        this.errorQueue.forEach(error => {
            stats.totalErrors++;
            stats.errorTypes[error.type] = (stats.errorTypes[error.type] || 0) + 1;
        });
        
        stats.recentErrors = this.errorQueue.slice(-5);
        
        return stats;
    }

    /**
     * 清空错误队列
     */
    clearErrorQueue() {
        this.errorQueue = [];
    }

    /**
     * 销毁错误收集器
     */
    destroy() {
        // 处理剩余的错误
        if (this.errorQueue.length > 0) {
            this.processErrorQueue();
        }
        
        // 移除事件监听器
        window.removeEventListener('error', this.handleGlobalError);
        window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
        
        // 恢复原始console.error
        if (this.originalConsoleError) {
            console.error = this.originalConsoleError;
        }
        
        console.log('ErrorCollector destroyed');
    }
}

// ES6模块导出
export default ErrorCollector;