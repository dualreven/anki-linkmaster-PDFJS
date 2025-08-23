/**
 * QtWebEngine环境适配器
 * 处理QtWebEngine环境下的特殊问题和优化
 */
class QtWebEngineAdapter {
    constructor() {
        this.isQtWebEngine = this.detectQtWebEngine();
        this.domReady = false;
        this.windowLoaded = false;
        this.execQueue = [];
        this.initCallbacks = [];
        
        this.initialize();
    }
    
    detectQtWebEngine() {
        // 检测是否在QtWebEngine环境中
        return !!(window.chrome && window.chrome.webstore && 
                   navigator.userAgent.includes('QtWebEngine'));
    }
    
    initialize() {
        if (this.isQtWebEngine) {
            console.log('[QtWebEngineAdapter] 检测到QtWebEngine环境，启用特殊优化');
            this.setupQtWebEngineOptimizations();
        } else {
            console.log('[QtWebEngineAdapter] 检测到标准浏览器环境');
        }
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // 确保DOM完全加载后再执行初始化
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.onDomReady();
            });
        } else {
            this.onDomReady();
        }
        
        // 确保窗口资源完全加载
        if (document.readyState === 'complete') {
            this.onWindowLoaded();
        } else {
            window.addEventListener('load', () => {
                this.onWindowLoaded();
            });
        }
    }
    
    setupQtWebEngineOptimizations() {
        // QtWebEngine特殊优化
        console.log('[QtWebEngineAdapter] 设置QtWebEngine优化');
        
        // 设置全局错误处理
        window.addEventListener('error', (event) => {
            console.warn('[QtWebEngineAdapter] 全局错误:', event.error);
        });
        
        // 优化性能设置
        if (window.performance && window.performance.mark) {
            window.performance.mark('qtwebengine_adapter_start');
        }
    }
    
    onDomReady() {
        this.domReady = true;
        console.log('[QtWebEngineAdapter] DOM已加载完成');
        this.executeQueue();
    }
    
    onWindowLoaded() {
        this.windowLoaded = true;
        console.log('[QtWebEngineAdapter] 窗口资源已加载完成');
        this.executeQueue();
    }
    
    isReady() {
        return this.domReady && this.windowLoaded;
    }
    
    execute(callback, context = null, args = []) {
        if (this.isReady()) {
            // 如果已经准备好，立即执行
            callback.apply(context, args);
        } else {
            // 否则加入队列等待
            this.execQueue.push({
                callback,
                context,
                args
            });
            console.log('[QtWebEngineAdapter] 命令已加入执行队列');
        }
    }
    
    executeQueue() {
        if (this.isReady() && this.execQueue.length > 0) {
            console.log(`[QtWebEngineAdapter] 执行队列中的 ${this.execQueue.length} 个命令`);
            
            while (this.execQueue.length > 0) {
                const task = this.execQueue.shift();
                try {
                    task.callback.apply(task.context, task.args);
                } catch (error) {
                    console.error('[QtWebEngineAdapter] 执行队列命令失败:', error);
                }
            }
            
            // 执行初始化回调
            this.initCallbacks.forEach(callback => callback());
            this.initCallbacks = [];
        }
    }
    
    onReady(callback) {
        if (this.isReady()) {
            callback();
        } else {
            this.initCallbacks.push(callback);
        }
    }
    
    // QtWebEngine专用方法
    forceRepaint() {
        if (this.isQtWebEngine) {
            // 强制重绘，解决QtWebEngine渲染问题
            document.body.style.display = 'none';
            document.body.offsetHeight; // 触发重排
            document.body.style.display = '';
        }
    }
    
    safeSetTimeout(callback, delay) {
        // QtWebEngine安全的setTimeout
        const safeCallback = () => {
            try {
                callback();
            } catch (error) {
                console.error('[QtWebEngineAdapter] setTimeout执行失败:', error);
            }
        };
        
        return setTimeout(safeCallback, delay);
    }
    
    safeSetInterval(callback, interval) {
        // QtWebEngine安全的setInterval
        const safeCallback = () => {
            try {
                callback();
            } catch (error) {
                console.error('[QtWebEngineAdapter] setInterval执行失败:', error);
            }
        };
        
        return setInterval(safeCallback, interval);
    }
}

// ES6模块导出
export default QtWebEngineAdapter;