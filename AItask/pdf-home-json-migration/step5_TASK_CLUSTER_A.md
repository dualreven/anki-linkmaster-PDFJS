# 集群A：基础架构升级详细规划

## 集群概述
**集群ID**: CLUSTER-A
**目标**: 建立新标准的基础架构，为后续升级做准备
**状态**: 准备执行

## 任务清单

### 任务A1：消息类型常量定义
**任务ID**: TASK-005
**优先级**: 高
**预计工时**: 2小时

#### 具体实施
1. 在文件顶部添加消息类型常量
2. 定义标准消息格式常量
3. 定义错误码常量

#### 代码实现
```javascript
// 在文件顶部添加
const MESSAGE_TYPES = {
    // PDF管理
    GET_PDF_LIST: 'get_pdf_list',
    PDF_LIST: 'pdf_list',
    PDF_LIST_UPDATED: 'pdf_list_updated',
    ADD_PDF: 'add_pdf',
    PDF_ADDED: 'pdf_added',
    REMOVE_PDF: 'remove_pdf',
    PDF_REMOVED: 'pdf_removed',
    BATCH_ADD_PDFS: 'batch_add_pdfs',
    
    // 系统消息
    HEARTBEAT: 'heartbeat',
    ERROR: 'error',
    SUCCESS: 'success',
    
    // 响应类型
    RESPONSE: 'response'
};

const ERROR_CODES = {
    SUCCESS: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
};

const RESPONSE_STATUS = {
    SUCCESS: 'success',
    ERROR: 'error',
    PENDING: 'pending'
};
```

### 任务A2：工具函数升级
**任务ID**: TASK-006
**优先级**: 高
**预计工时**: 3小时

#### 具体实施
1. 升级UUID生成函数
2. 添加消息验证函数
3. 添加消息构建函数
4. 添加时间戳生成函数

#### 代码实现
```javascript
/**
 * 生成标准UUID
 * @returns {string} UUID字符串
 */
function generateStandardUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * 生成时间戳（秒，精确到毫秒）
 * @returns {number} Unix时间戳
 */
function generateTimestamp() {
    return Date.now() / 1000;
}

/**
 * 构建标准请求消息
 * @param {string} type - 消息类型
 * @param {Object} data - 消息数据
 * @returns {Object} 标准格式消息
 */
function buildStandardRequest(type, data = {}) {
    return {
        type: type,
        timestamp: generateTimestamp(),
        request_id: generateStandardUUID(),
        data: data
    };
}

/**
 * 验证消息格式
 * @param {Object} message - 消息对象
 * @returns {boolean} 是否有效
 */
function validateMessageFormat(message) {
    return message && 
           typeof message.type === 'string' &&
           typeof message.timestamp === 'number' &&
           typeof message.request_id === 'string';
}

/**
 * 检测消息格式版本
 * @param {Object} message - 消息对象
 * @returns {string} 版本标识 ('new' | 'old' | 'invalid')
 */
function detectMessageVersion(message) {
    if (!message || !message.type) return 'invalid';
    
    // 新标准格式检测
    if (message.request_id && message.timestamp) {
        return 'new';
    }
    
    // 旧格式检测
    if (message.type && (message.data || message.files)) {
        return 'old';
    }
    
    return 'invalid';
}
```

## 依赖关系
- 无前置依赖
- 为CLUSTER-B提供基础支持

## 风险识别
- 常量命名冲突：检查现有代码避免重复定义
- 函数兼容性：确保新函数不影响现有功能

## 验证标准
- 所有常量正确定义
- 工具函数单元测试通过
- 无语法错误
- 不影响现有功能