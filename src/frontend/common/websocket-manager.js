/**
 * 通用WebSocket管理器
 * 处理WebSocket连接、消息队列和重连逻辑
 */
import DebugTools from './debug-tools.js';

class WebSocketManager {
    constructor(options = {}) {
        this.url = options.url || 'ws://localhost:8765';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
        this.reconnectDelay = options.reconnectDelay || 1000;
        this.heartbeatInterval = options.heartbeatInterval || 15000;
        
        this.ws = null;
        this.messageQueue = [];
        this.messageHandlers = {};
        this.connectionHandlers = {
            open: [],
            close: [],
            error: []
        };
        
        this.heartbeatTimer = null;
        this.connectionStartTime = null;
        
        this.debug = new DebugTools({
            prefix: 'WebSocket',
            enabled: true
        });
    }
    
    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.debug.warn('WebSocket已经连接');
            return;
        }
        
        this.debug.info('正在连接WebSocket...');
        this.connectionStartTime = Date.now();
        
        try {
            this.ws = new WebSocket(this.url);
            this.setupEventListeners();
        } catch (error) {
            this.debug.error('WebSocket连接失败:', error);
            this.scheduleReconnect();
        }
    }
    
    setupEventListeners() {
        this.ws.onopen = (event) => {
            this.onOpen(event);
        };
        
        this.ws.onmessage = (event) => {
            this.onMessage(event);
        };
        
        this.ws.onclose = (event) => {
            this.onClose(event);
        };
        
        this.ws.onerror = (event) => {
            this.onError(event);
        };
    }
    
    onOpen(event) {
        const connectionTime = Date.now() - this.connectionStartTime;
        this.debug.info(`WebSocket连接已建立 (耗时: ${connectionTime}ms)`);
        
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.processMessageQueue();
        
        this.emit('open', event);
    }
    
    onMessage(event) {
        try {
            const data = JSON.parse(event.data);
            this.debug.debug(`收到消息: ${data.type}`);
            
            // 处理心跳响应
            if (data.type === 'heartbeat_response') {
                return;
            }
            
            // 调用相应的消息处理器
            if (this.messageHandlers[data.type]) {
                this.messageHandlers[data.type].forEach(handler => {
                    try {
                        handler(data);
                    } catch (error) {
                        this.debug.error(`消息处理器错误 [${data.type}]:`, error);
                    }
                });
            } else {
                this.debug.warn(`未注册的消息处理器: ${data.type}`);
            }
            
            this.emit('message', data);
        } catch (error) {
            this.debug.error('消息解析失败:', error);
        }
    }
    
    onClose(event) {
        this.debug.warn('WebSocket连接已关闭');
        this.stopHeartbeat();
        this.scheduleReconnect();
        this.emit('close', event);
    }
    
    onError(event) {
        this.debug.error('WebSocket错误:', event);
        this.emit('error', event);
    }
    
    send(type, data = {}) {
        const message = { type, ...data };
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
            this.debug.debug(`发送消息: ${type}`);
        } else {
            this.debug.warn(`WebSocket未连接，消息加入队列: ${type}`);
            this.messageQueue.push(message);
            
            // 尝试重新连接
            if (this.reconnectAttempts === 0) {
                this.connect();
            }
        }
    }
    
    processMessageQueue() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN && this.messageQueue.length > 0) {
            this.debug.info(`处理队列中的 ${this.messageQueue.length} 条消息`);
            
            while (this.messageQueue.length > 0) {
                const message = this.messageQueue.shift();
                this.ws.send(JSON.stringify(message));
            }
        }
    }
    
    startHeartbeat() {
        this.stopHeartbeat();
        
        this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.send('heartbeat');
            }
        }, this.heartbeatInterval);
        
        this.debug.debug('心跳已启动');
    }
    
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
            this.debug.debug('心跳已停止');
        }
    }
    
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.debug.error('达到最大重连次数，停止重连');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;
        
        this.debug.warn(`计划重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})，延迟: ${delay}ms`);
        
        setTimeout(() => {
            this.connect();
        }, delay);
    }
    
    on(type, handler) {
        if (this.connectionHandlers[type]) {
            this.connectionHandlers[type].push(handler);
        } else if (type === 'message') {
            // 特殊处理消息事件
            if (!this.connectionHandlers.message) {
                this.connectionHandlers.message = [];
            }
            this.connectionHandlers.message.push(handler);
        }
    }
    
    off(type, handler) {
        if (this.connectionHandlers[type]) {
            const index = this.connectionHandlers[type].indexOf(handler);
            if (index > -1) {
                this.connectionHandlers[type].splice(index, 1);
            }
        }
    }
    
    emit(type, event) {
        const handlers = this.connectionHandlers[type];
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(event);
                } catch (error) {
                    this.debug.error(`事件处理器错误 [${type}]:`, error);
                }
            });
        }
    }
    
    onMessage(type, handler) {
        if (!this.messageHandlers[type]) {
            this.messageHandlers[type] = [];
        }
        this.messageHandlers[type].push(handler);
    }
    
    offMessage(type, handler) {
        if (this.messageHandlers[type]) {
            const index = this.messageHandlers[type].indexOf(handler);
            if (index > -1) {
                this.messageHandlers[type].splice(index, 1);
            }
        }
    }
    
    getState() {
        return {
            readyState: this.ws ? this.ws.readyState : 'null',
            reconnectAttempts: this.reconnectAttempts,
            messageQueueLength: this.messageQueue.length,
            url: this.url
        };
    }
    
    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }
    
    initialize() {
        this.debug.info('初始化WebSocket管理器');
        this.connect();
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
        this.stopHeartbeat();
    }
}

// ES6模块导出
export default WebSocketManager;