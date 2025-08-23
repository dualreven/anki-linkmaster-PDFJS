# 集群B：消息系统升级详细规划

## 集群概述
**集群ID**: CLUSTER-B
**目标**: 升级WebSocket消息系统到标准格式
**状态**: 等待CLUSTER-A完成
**依赖**: CLUSTER-A

## 任务清单

### 任务B1：消息格式升级
**任务ID**: TASK-001
**优先级**: 高
**预计工时**: 4小时

#### 具体实施
1. 升级WebSocketManager.send方法
2. 升级所有消息发送调用
3. 确保所有消息包含标准字段

#### 代码实现
```javascript
// 升级WebSocketManager.send方法
const WebSocketManager = {
    // ... 现有代码 ...
    
    /**
     * 发送标准格式消息
     * @param {string} type - 消息类型
     * @param {Object} data - 消息数据
     * @returns {string} request_id用于追踪响应
     */
    send(type, data = {}) {
        if (!this.connected || !this.socket) {
            Logger.warn('websocket', 'WebSocket未连接，无法发送消息');
            return null;
        }
        
        try {
            // 构建标准消息
            const message = buildStandardRequest(type, data);
            
            this.socket.send(JSON.stringify(message));
            Logger.debug('websocket', `发送消息: ${JSON.stringify(message)}`);
            
            return message.request_id; // 返回request_id用于匹配响应
        } catch (error) {
            Logger.error('websocket', `发送消息失败: ${error.message}`);
            return null;
        }
    },
    
    /**
     * 发送消息并等待响应（新功能）
     * @param {string} type - 消息类型
     * @param {Object} data - 消息数据
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Promise} 响应Promise
     */
    sendAndWait(type, data = {}, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const requestId = this.send(type, data);
            if (!requestId) {
                reject(new Error('发送消息失败'));
                return;
            }
            
            // 设置超时
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('请求超时'));
            }, timeout);
            
            // 存储待处理请求
            if (!this.pendingRequests) {
                this.pendingRequests = new Map();
            }
            this.pendingRequests.set(requestId, {
                resolve: (response) => {
                    clearTimeout(timeoutId);
                    resolve(response);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });
        });
    }
};
```

### 任务B2：响应解析升级
**任务ID**: TASK-002
**优先级**: 高
**预计工时**: 4小时

#### 具体实施
1. 升级WebSocketManager.handleMessage方法
2. 升级PDFManager的事件监听器
3. 支持新旧格式并存

#### 代码实现
```javascript
// 升级WebSocketManager.handleMessage方法
const WebSocketManager = {
    // ... 现有代码 ...
    
    /**
     * 处理WebSocket消息（支持新旧格式）
     * @param {Object} data - 消息数据
     */
    handleMessage(data) {
        if (!data || !data.type) {
            Logger.warn('websocket', '收到无效消息格式');
            return;
        }
        
        try {
            const version = detectMessageVersion(data);
            Logger.debug('websocket', `检测到消息格式版本: ${version}`);
            
            switch (version) {
                case 'new':
                    this.handleNewFormatMessage(data);
                    break;
                case 'old':
                    this.handleOldFormatMessage(data);
                    break;
                default:
                    Logger.warn('websocket', '无法识别的消息格式');
            }
        } catch (error) {
            Logger.error('websocket', `处理消息时出错: ${error.message}`);
        }
    },
    
    /**
     * 处理新格式消息
     * @param {Object} data - 标准格式消息
     */
    handleNewFormatMessage(data) {
        // 检查是否是响应消息
        if (data.type === 'response' || data.status) {
            this.handleResponseMessage(data);
            return;
        }
        
        // 处理普通消息
        this.handleRegularMessage(data);
    },
    
    /**
     * 处理旧格式消息（向后兼容）
     * @param {Object} data - 旧格式消息
     */
    handleOldFormatMessage(data) {
        Logger.debug('websocket', '处理旧格式消息');
        
        // 映射旧格式到新的事件系统
        switch (data.type) {
            case 'pdf_list':
                EventBus.emit('pdf:list:updated', { files: data.files || [] });
                break;
            case 'pdf_added':
                EventBus.emit('pdf:add:success', { file: data.file });
                break;
            case 'pdf_removed':
                EventBus.emit('pdf:remove:success', { filename: data.filename });
                break;
            case 'error':
                EventBus.emit('sys:websocket:message_error', data);
                break;
            default:
                Logger.debug('websocket', `未处理的旧格式消息类型: ${data.type}`);
        }
    },
    
    /**
     * 处理响应消息
     * @param {Object} response - 响应消息
     */
    handleResponseMessage(response) {
        const requestId = response.request_id;
        if (requestId && this.pendingRequests && this.pendingRequests.has(requestId)) {
            const pending = this.pendingRequests.get(requestId);
            this.pendingRequests.delete(requestId);
            
            if (response.status === 'success') {
                pending.resolve(response);
            } else {
                pending.reject(new Error(response.message));
            }
            return;
        }
        
        // 处理广播响应
        this.handleRegularMessage(response);
    },
    
    /**
     * 处理常规消息
     * @param {Object} message - 消息对象
     */
    handleRegularMessage(message) {
        // 根据消息类型触发相应事件
        switch (message.type) {
            case 'pdf_list':
            case 'pdf_list_updated':
                if (message.data && message.data.files) {
                    EventBus.emit('pdf:list:updated', message.data);
                }
                break;
            case 'pdf_added':
                if (message.data && message.data.file) {
                    EventBus.emit('pdf:add:success', message.data);
                }
                break;
            case 'pdf_removed':
                if (message.data && message.data.filename) {
                    EventBus.emit('pdf:remove:success', message.data);
                }
                break;
            case 'error':
                EventBus.emit('sys:websocket:message_error', message);
                break;
            default:
                Logger.debug('websocket', `未处理的常规消息类型: ${message.type}`);
        }
    }
};
```

## 升级调用点

### PDFManager中的调用升级
```javascript
const PDFManager = {
    // ... 现有代码 ...
    
    /**
     * 加载PDF列表（升级版本）
     */
    async loadPDFList() {
        Logger.info('pdf', '加载PDF列表');
        try {
            const response = await WebSocketManager.sendAndWait('get_pdf_list');
            if (response && response.data && response.data.files) {
                this.updatePDFList(response.data.files);
            }
        } catch (error) {
            Logger.error('pdf', `加载PDF列表失败: ${error.message}`);
            EventBus.emit('ui:message:error', '加载PDF列表失败');
        }
    },
    
    /**
     * 添加PDF文件（升级版本）
     */
    async addPDF() {
        Logger.info('pdf', '请求添加PDF文件');
        try {
            const response = await WebSocketManager.sendAndWait('add_pdf');
            if (response && response.status === 'success') {
                this.handlePDFAddSuccess(response.data.file);
            } else {
                EventBus.emit('ui:message:error', response?.message || '添加失败');
            }
        } catch (error) {
            Logger.error('pdf', `添加PDF失败: ${error.message}`);
            EventBus.emit('ui:message:error', '添加PDF失败');
        }
    }
};
```

## 依赖关系
- 依赖CLUSTER-A完成（常量定义和工具函数）
- 为CLUSTER-C提供消息系统支持

## 风险识别
- 消息格式不兼容：通过版本检测解决
- 性能影响：异步处理最小化阻塞
- 向后兼容：保留旧格式处理

## 验证标准
- 所有消息发送使用标准格式
- 响应解析支持新旧格式
- 异步操作正常
- 错误处理完善