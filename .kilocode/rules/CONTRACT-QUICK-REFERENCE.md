# 契约编程快速参考卡片

> **📌 用途：** 快速定位契约相关文件，排查契约违规问题

## 🎯 三层契约体系

```
Layer 1: 前端内部契约 (EventBus)     → event-bus.js
Layer 2: 前后端通信契约 (Message)     → standard_protocol.py
Layer 3: 能力注册契约 (Capability)    → service_registry.py
```

---

## 📋 快速诊断表

| 问题现象 | 可能原因 | 检查文件 | 行号 |
|---------|---------|---------|------|
| ❌ 事件发布被阻止 | 违反三段式命名 | `event-bus.js` | 13-131 |
| ❌ 消息被服务器拒绝 | 消息类型未定义 | `standard_protocol.py` | 14-136 |
| ❌ 能力发现失败 | 服务未注册 | `service_registry.py` | 1-100 |
| ❌ Schema 验证失败 | 数据格式不匹配 | `schemas/*.json` | - |
| ❌ request_id 未匹配 | 消息结构错误 | `standard_protocol.py` | 146-180 |

---

## 🔍 快速定位指南

### 前端问题

**事件名称验证失败？**
```bash
# 1. 查看验证规则
src/frontend/common/event/event-bus.js:13-131

# 2. 查看正确示例
src/frontend/CLAUDE.md:62-100

# 3. 查看测试用例
src/frontend/common/event/__tests__/event-name-validation.test.js
```

**局部/全局事件混淆？**
```bash
# 1. 查看 ScopedEventBus 实现
src/frontend/common/event/scoped-event-bus.js:1-200

# 2. 查看使用指南
src/frontend/common/event/EVENTBUS-USAGE-GUIDE.md

# 3. 查看白名单注册
src/frontend/common/event/global-event-registry.js
```

**WebSocket 消息发送失败？**
```bash
# 1. 查看 WSClient 实现
src/frontend/common/ws/ws-client.js:1-500

# 2. 查看消息格式定义
src/frontend/pdf-home/docs/Communication-Protocol-Guide.md

# 3. 查看调试方法
# wsClient.getDebugInfo()
# wsClient.getConnectionHistory()
```

### 后端问题

**消息类型未知？**
```bash
# 1. 查看 MessageType 枚举
src/backend/msgCenter_server/standard_protocol.py:14-136

# 2. 添加新消息类型
# class MessageType(Enum):
#     YOUR_NEW_TYPE = "module:action:status"

# 3. 查看路由处理
src/backend/msgCenter_server/standard_server.py:100-150
```

**消息结构验证失败？**
```bash
# 1. 查看验证函数
src/backend/msgCenter_server/standard_protocol.py:146-180

# 2. 查看响应构建器
# StandardMessageHandler.build_response()
# StandardMessageHandler.build_error_response()

# 3. 查看测试示例
src/backend/msgCenter_server/__tests__/test_standard_server_messages.py
```

**能力注册失败？**
```bash
# 1. 查看 ServiceRegistry 实现
src/backend/api/service_registry.py:1-100

# 2. 查看服务注册示例
src/backend/api/pdf-home/search/service.py
src/backend/api/pdf-home/add/service.py
src/backend/api/pdf-viewer/bookmark/service.py

# 3. 查看注册测试
src/backend/api/__tests__/test_api_service_registry.py
```

---

## 📦 Schema 文件速查

```bash
# 能力发现
todo-and-doing/.../schemas/capability/discover-v1.json
todo-and-doing/.../schemas/capability/describe-v1.json

# PDF 管理
todo-and-doing/.../schemas/pdf-library/list-v1.json
todo-and-doing/.../schemas/pdf-library/add-v1.json
todo-and-doing/.../schemas/pdf-library/remove-v1.json

# 书签管理
todo-and-doing/.../schemas/bookmark/list-v1.json
todo-and-doing/.../schemas/bookmark/save-v1.json

# 存储服务
todo-and-doing/.../schemas/storage-kv/get-v1.json
todo-and-doing/.../schemas/storage-kv/set-v1.json
todo-and-doing/.../schemas/storage-fs/read-v1.json
todo-and-doing/.../schemas/storage-fs/write-v1.json
```

---

## 🧪 测试运行命令

```bash
# 前端事件契约测试
pnpm test -- event-bus.test.js
pnpm test -- event-name-validation.test.js
pnpm test -- scoped-event-bus.test.js

# 后端消息契约测试
PYTHONPATH=src python -m pytest src/backend/msgCenter_server/__tests__/test_standard_server_messages.py
PYTHONPATH=src python -m pytest src/backend/msgCenter_server/__tests__/test_capability_registry.py

# 能力注册测试
PYTHONPATH=src python -m pytest src/backend/api/__tests__/test_api_service_registry.py

# 集成测试（书签持久化）
PYTHONPATH=src python -m pytest src/backend/api/__tests__/test_bookmark_persistence.py
```

---

## 🔧 常见修复模式

### 修复事件名称违规

```javascript
// ❌ 错误
eventBus.emit('loadData', data);

// ✅ 修复
eventBus.emit('data:load:completed', data);
```

### 修复消息格式错误

```javascript
// ❌ 错误
wsClient.send({ type: 'pdf-library:list:requested' });

// ✅ 修复
wsClient.send({
  type: 'pdf-library:list:requested',
  request_id: generateId(),
  timestamp: Date.now(),
  data: {}
});
```

### 修复后端响应错误

```python
# ❌ 错误
return { "status": "success", "data": {} }

# ✅ 修复
return StandardMessageHandler.build_response(
    "response",
    request_id,
    status="success",
    code=200,
    message="操作成功",
    data={}
)
```

---

## 📞 调试技巧速查

### 前端调试

```javascript
// 查看 WebSocket 连接信息
wsClient.getDebugInfo();

// 查看连接历史
wsClient.getConnectionHistory();

// 查看最后的错误
wsClient.getLastError();

// 查看 EventBus 状态
eventBusManager.getAllEventBuses();
```

### 后端调试

```python
# 查看日志文件
# logs/ws-server.log

# 使用 request_id 追踪
# grep "req_abc123" logs/ws-server.log

# 查看服务注册状态
service_registry.has('pdf-home.search')
service_registry.get('pdf-home.search')
```

---

## 📚 深入学习路径

1. **入门：** `src/frontend/CLAUDE.md` - 前端开发规范
2. **进阶：** `src/frontend/common/event/EVENTBUS-USAGE-GUIDE.md` - EventBus 完整指南
3. **高级：** `.kilocode/rules/memory-bank/architecture.md` - 契约编程架构
4. **实战：** `src/frontend/pdf-home/docs/Communication-Protocol-Guide.md` - 通信协议详解
5. **调试：** `src/frontend/HOW-TO-ENABLE-EVENT-TRACING.md` - 事件追踪指南

---

## 📊 契约统计（截至 2025-10-06）

- ✅ 前端事件验证器：1 个核心类
- ✅ 后端消息类型：100+ 枚举值
- ✅ JSON Schema：11 个协议文件
- ✅ 测试覆盖：300+ 用例
- ✅ 验证检查点：5 个
- ✅ 支持的能力：7 大模块

---

**最后更新：** 2025-10-06
**维护者：** AI Assistant
**相关文档：** architecture.md, context.md
