/**
 * 通用调试工具
 * 提供统一的调试和日志功能
 */
class DebugTools {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.prefix = options.prefix || '[Debug]';
        this.logLevel = options.logLevel || 'debug';
        this.maxLogEntries = options.maxLogEntries || 100;
        
        this.logs = [];
        this.performanceMetrics = {};
        this.customMetrics = {};
        
        this.setupConsoleOverrides();
    }
    
    setupConsoleOverrides() {
        if (!this.enabled) return;
        
        // 保存原始console方法
        this.originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info
        };
        
        // 重写console方法以添加日志记录
        console.log = (...args) => this.log('debug', ...args);
        console.warn = (...args) => this.log('warn', ...args);
        console.error = (...args) => this.log('error', ...args);
        console.info = (...args) => this.log('info', ...args);
    }
    
    log(level, ...args) {
        if (!this.enabled) return;
        
        const timestamp = new Date().toISOString();
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        
        const logEntry = {
            timestamp,
            level,
            message,
            args
        };
        
        this.logs.push(logEntry);
        
        // 限制日志数量
        if (this.logs.length > this.maxLogEntries) {
            this.logs = this.logs.slice(-this.maxLogEntries / 2);
        }
        
        // 输出到原始console
        const prefix = `[${timestamp}] [${level.toUpperCase()}] ${this.prefix}`;
        const originalMethod = this.originalConsole[level] || this.originalConsole.log;
        originalMethod(prefix, ...args);
    }
    
    debug(...args) {
        this.log('debug', ...args);
    }
    
    info(...args) {
        this.log('info', ...args);
    }
    
    warn(...args) {
        this.log('warn', ...args);
    }
    
    error(...args) {
        this.log('error', ...args);
    }
    
    startPerformanceTimer(key) {
        if (!this.enabled) return;
        
        this.performanceMetrics[key] = {
            startTime: performance.now(),
            endTime: null,
            duration: null
        };
        
        if (window.performance && window.performance.mark) {
            window.performance.mark(`${key}_start`);
        }
    }
    
    endPerformanceTimer(key) {
        if (!this.enabled || !this.performanceMetrics[key]) return;
        
        const metric = this.performanceMetrics[key];
        metric.endTime = performance.now();
        metric.duration = metric.endTime - metric.startTime;
        
        if (window.performance && window.performance.mark) {
            window.performance.mark(`${key}_end`);
            window.performance.measure(key, `${key}_start`, `${key}_end`);
        }
        
        this.debug(`性能指标 [${key}]: ${metric.duration.toFixed(2)}ms`);
        return metric.duration;
    }
    
    setCustomMetric(key, value) {
        this.customMetrics[key] = value;
    }
    
    getCustomMetric(key) {
        return this.customMetrics[key];
    }
    
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            custom: this.customMetrics
        };
    }
    
    getLogs(level = null, limit = null) {
        let filteredLogs = this.logs;
        
        if (level) {
            filteredLogs = filteredLogs.filter(log => log.level === level);
        }
        
        if (limit) {
            filteredLogs = filteredLogs.slice(-limit);
        }
        
        return filteredLogs;
    }
    
    clearLogs() {
        this.logs = [];
        this.debug('调试日志已清除');
    }
    
    createDebugPanel(options = {}) {
        if (!this.enabled) return;
        
        const panel = document.createElement('div');
        panel.id = 'debug-panel';
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: ${options.width || '400px'};
            max-height: ${options.height || '600px'};
            background: white;
            border: 2px solid #333;
            border-radius: 8px;
            padding: 15px;
            z-index: 10000;
            font-family: monospace;
            font-size: 12px;
            overflow-y: auto;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            display: ${options.show !== false ? 'block' : 'none'};
        `;
        
        this.updateDebugPanel(panel);
        document.body.appendChild(panel);
        
        return panel;
    }
    
    updateDebugPanel(panel) {
        const logs = this.getLogs(null, 20);
        const metrics = this.getPerformanceMetrics();
        
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h3 style="margin: 0; color: #333;">🔧 调试面板</h3>
                <button onclick="this.parentElement.parentElement.remove()" style="background: #f44; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">关闭</button>
            </div>
            <div style="margin-bottom: 15px;">
                <strong>性能指标:</strong><br>
                ${Object.entries(metrics).map(([key, metric]) => {
                    if (metric.duration !== undefined) {
                        return `<div>${key}: ${metric.duration.toFixed(2)}ms</div>`;
                    } else if (typeof metric === 'object') {
                        return `<div>${key}: ${JSON.stringify(metric)}</div>`;
                    }
                    return `<div>${key}: ${metric}</div>`;
                }).join('')}
            </div>
            <div style="border-top: 1px solid #ccc; padding-top: 10px;">
                <strong>最近日志:</strong>
                <div style="max-height: 200px; overflow-y: auto; margin-top: 5px;">
                    ${logs.map(log => `<div style="margin-bottom: 3px; color: ${log.level === 'error' ? '#f44' : log.level === 'warn' ? '#fa0' : '#333'};">[${log.timestamp}] ${log.level}: ${log.message}</div>`).join('')}
                </div>
            </div>
        `;
    }
}

// ES6模块导出
export default DebugTools;