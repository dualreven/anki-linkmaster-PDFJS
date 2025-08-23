# PDF主页JSON标准迁移原子任务分解

## 任务清单

### 任务1：消息格式升级
**任务ID**: TASK-001
**功能**: 升级WebSocket消息格式到标准格式
**文件**: src/frontend/pdf-home/index.js
**函数**: WebSocketManager.send, WebSocketManager.handleMessage
**验收标准**:
- 所有发送消息包含type, timestamp, request_id
- 所有响应消息符合标准格式
- 单元测试通过

### 任务2：响应解析升级
**任务ID**: TASK-002
**功能**: 升级响应消息解析逻辑
**文件**: src/frontend/pdf-home/index.js
**函数**: WebSocketManager.handleMessage, PDFManager.setupEventListeners
**验收标准**:
- 支持标准响应格式(status, code, message, data)
- 保持对旧格式的兼容性
- 错误处理正确

### 任务3：错误处理升级
**任务ID**: TASK-003
**功能**: 升级错误处理和用户提示
**文件**: src/frontend/pdf-home/index.js
**函数**: 全局错误处理函数
**验收标准**:
- 统一错误响应格式
- 用户友好的错误提示
- 错误日志记录

### 任务4：向后兼容性实现
**任务ID**: TASK-004
**功能**: 实现新旧格式并存
**文件**: src/frontend/pdf-home/index.js
**函数**: WebSocketManager.handleMessage
**验收标准**:
- 支持接收新旧两种格式
- 自动检测消息格式
- 平滑过渡

### 任务5：消息类型常量定义
**任务ID**: TASK-005
**功能**: 定义标准消息类型常量
**文件**: src/frontend/pdf-home/index.js
**位置**: 文件顶部常量区域
**验收标准**:
- 所有消息类型定义清晰
- 符合命名规范
- 易于维护

### 任务6：工具函数升级
**任务ID**: TASK-006
**功能**: 升级工具函数支持新格式
**文件**: src/frontend/pdf-home/index.js
**函数**: 消息验证和构建函数
**验收标准**:
- 标准消息构建函数
- 消息格式验证函数
- UUID生成函数优化

## 任务依赖关系图

```
TASK-005 (消息类型常量) → TASK-001 (消息格式) → TASK-002 (响应解析)
                                     ↓
TASK-006 (工具函数) → TASK-004 (向后兼容) → TASK-003 (错误处理)
```

## 任务执行顺序

1. **阶段1：基础准备**
   - TASK-005: 定义消息类型常量
   - TASK-006: 升级工具函数

2. **阶段2：核心升级**
   - TASK-001: 升级消息格式
   - TASK-002: 升级响应解析

3. **阶段3：兼容性**
   - TASK-004: 实现向后兼容
   - TASK-003: 升级错误处理

## 测试任务

### 任务7：单元测试
**任务ID**: TEST-001
**功能**: 测试新消息格式
**文件**: 测试文件待创建
**验收标准**:
- 消息格式验证100%
- 响应解析测试100%
- 错误场景测试100%

### 任务8：集成测试
**任务ID**: TEST-002
**功能**: 测试完整消息流程
**文件**: 测试文件待创建
**验收标准**:
- 端到端测试通过
- 新旧格式兼容测试通过
- 性能测试通过