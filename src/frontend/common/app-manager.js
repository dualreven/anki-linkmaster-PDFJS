/**
 * 应用管理器基类
 * 整合UI管理器、业务逻辑管理器和WebSocket管理器
 */
import DebugTools from './debug-tools.js';
import WebSocketManager from './websocket-manager.js';
import UIManager from './ui-manager.js';
import BusinessLogicManager from './business-logic-manager.js';

class AppManager {
    constructor(options = {}) {
        this.name = options.name || 'App';
        this.containerId = options.containerId || 'app';
        this.websocketUrl = options.websocketUrl || 'ws://localhost:8765';
        
        this.debug = new DebugTools({
            prefix: this.name,
            enabled: true
        });
        
        this.components = {
            ui: null,
            business: null,
            websocket: null
        };
        
        this.initialized = false;
        this.started = false;
        
        this.debug.info(`创建应用管理器: ${this.name}`);
    }
    
    initialize() {
        this.debug.info(`开始初始化应用: ${this.name}`);
        
        // 检查QtWebEngine适配器是否可用
        // if (typeof window !== 'undefined' && window.qtWebEngineAdapter) {
        //     window.qtWebEngineAdapter.onReady(() => {
        //         this.initializeComponents();
        //         this.setupComponentCommunication();
        //         this.startApplication();
                
        //         this.initialized = true;
        //         this.debug.info(`应用初始化完成: ${this.name}`);
        //     });
        // } else {
            // 标准浏览器环境，直接初始化
            this.initializeComponents();
            this.setupComponentCommunication();
            this.startApplication();
            this.initialized = true;
            this.debug.info(`应用初始化完成: ${this.name}`);
        // }
    }
    
    initializeComponents() {
        this.debug.info('初始化组件');
        
        // 初始化WebSocket管理器
        this.components.websocket = this.createWebSocketManager();
        this.components.websocket.initialize();
        
        // 初始化业务逻辑管理器
        this.components.business = this.createBusinessLogicManager();
        this.components.business.initialize();
        
        // 初始化UI管理器
        this.components.ui = this.createUIManager();
        this.components.ui.initialize();
    }
    
    createWebSocketManager() {
        return new WebSocketManager({
            url: this.websocketUrl,
            maxReconnectAttempts: 5,
            reconnectDelay: 1000,
            heartbeatInterval: 15000
        });
    }
    
    createBusinessLogicManager() {
        return new BusinessLogicManager({
            name: `${this.name}BusinessLogic`
        });
    }
    
    createUIManager() {
        return new UIManager({
            containerId: this.containerId
        });
    }
    
    setupComponentCommunication() {
        this.debug.info('设置组件间通信');
        
        const { websocket, business, ui } = this.components;
        
        // WebSocket事件处理
        websocket.on('open', () => {
            this.debug.info('WebSocket连接已建立');
            business.setState('websocketConnected', true);
            ui.setState('websocketConnected', true);
        });
        
        websocket.on('close', () => {
            this.debug.warn('WebSocket连接已关闭');
            business.setState('websocketConnected', false);
            ui.setState('websocketConnected', false);
        });
        
        websocket.on('error', (error) => {
            this.debug.error('WebSocket错误:', error);
            business.setError('WebSocket连接失败');
            ui.showError('WebSocket连接失败');
        });
        
        // 业务逻辑状态变化处理
        business.on('stateChanged', (state) => {
            ui.updateState(state);
        });
        
        business.on('dataChanged', (data) => {
            ui.updateState({ data });
        });
        
        business.on('loadingChanged', (loading) => {
            ui.setState('loading', loading);
        });
        
        business.on('errorChanged', (error) => {
            if (error) {
                ui.showError(error);
            }
        });
        
        // UI事件处理
        ui.on('action', (action) => {
            this.handleUIAction(action);
        });
    }
    
    startApplication() {
        this.debug.info('启动应用');
        
        // 子类重写此方法来启动应用
        this.setupRoutes();
        this.setupGlobalEventHandlers();
        
        this.started = true;
        this.debug.info('应用启动完成');
    }
    
    setupRoutes() {
        // 子类重写此方法来设置路由
    }
    
    setupGlobalEventHandlers() {
        // 子类重写此方法来设置全局事件处理器
        
        // 键盘快捷键
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
        
        // 窗口事件
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        // 页面卸载事件
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }
    
    handleKeyDown(event) {
        // 子类重写此方法来处理键盘事件
        
        // 常用快捷键
        if (event.ctrlKey && event.key === 'd') {
            event.preventDefault();
            this.toggleDebugPanel();
        }
    }
    
    handleResize() {
        // 子类重写此方法来处理窗口大小变化
    }
    
    handleUIAction(action) {
        this.debug.debug('处理UI动作:', action);
        
        switch (action.type) {
            case 'websocket_send':
                this.components.websocket.send(action.messageType, action.data);
                break;
                
            case 'api_call':
                this.handleAPICall(action);
                break;
                
            case 'navigation':
                this.handleNavigation(action);
                break;
                
            default:
                this.debug.warn(`未知的UI动作类型: ${action.type}`);
        }
    }
    
    async handleAPICall(action) {
        const { endpoint, method = 'GET', data, onSuccess, onError } = action;
        
        try {
            this.components.business.setLoading(true);
            
            let response;
            switch (method.toUpperCase()) {
                case 'GET':
                    response = await this.components.business.get(endpoint, data);
                    break;
                case 'POST':
                    response = await this.components.business.post(endpoint, data);
                    break;
                case 'PUT':
                    response = await this.components.business.put(endpoint, data);
                    break;
                case 'DELETE':
                    response = await this.components.business.delete(endpoint);
                    break;
                default:
                    throw new Error(`不支持的HTTP方法: ${method}`);
            }
            
            if (onSuccess) {
                onSuccess(response);
            }
        } catch (error) {
            this.debug.error('API调用失败:', error);
            
            if (onError) {
                onError(error);
            } else {
                this.components.ui.showError('操作失败，请稍后重试');
            }
        } finally {
            this.components.business.setLoading(false);
        }
    }
    
    handleNavigation(action) {
        const { route, params } = action;
        this.debug.debug(`导航到: ${route}`, params);
        
        // 子类重写此方法来处理导航
    }
    
    toggleDebugPanel() {
        if (window.debugTools) {
            const panel = document.getElementById('debug-panel');
            if (panel) {
                panel.remove();
            } else {
                window.debugTools.createDebugPanel({ show: true });
            }
        }
    }
    
    getState() {
        return {
            name: this.name,
            initialized: this.initialized,
            started: this.started,
            components: {
                ui: this.components.ui ? this.components.ui.getState() : null,
                business: this.components.business ? this.components.business.getState() : null,
                websocket: this.components.websocket ? this.components.websocket.getState() : null
            }
        };
    }
    
    cleanup() {
        this.debug.info('清理应用资源');
        
        // 清理组件
        Object.values(this.components).forEach(component => {
            if (component && typeof component.destroy === 'function') {
                component.destroy();
            }
        });
        
        this.components = {};
        this.initialized = false;
        this.started = false;
    }
    
    restart() {
        this.debug.info('重启应用');
        this.cleanup();
        this.initialize();
    }
}

// ES6模块导出
export default AppManager;
