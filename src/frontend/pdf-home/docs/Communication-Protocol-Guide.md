# PDF-Home 前后端通信协议指南

## 📋 目录

1. [通信架构概述](#通信架构概述)
2. [通信流程详解](#通信流程详解)
3. [标准消息格式](#标准消息格式)
4. [消息类型定义](#消息类型定义)
5. [前端实现规范](#前端实现规范)
6. [后端实现规范](#后端实现规范)
7. [错误处理机制](#错误处理机制)
8. [调试与排查](#调试与排查)

---

## 通信架构概述

### 整体架构

```
┌─────────────┐    WebSocket     ┌──────────────────┐    Python API    ┌──────────────┐
│   Frontend  │◄─────────────────►│   Message Center │◄────────────────►│   Backend    │
│  (Browser)  │                   │   (WS Server)    │                  │ (PDFManager) │
└─────────────┘                   └──────────────────┘                  └──────────────┘
     ▲                                     ▲                                    ▲
     │                                     │                                    │
EventBus                            QWebSocket                          Qt Signals/Slots
```

### 核心组件

| 组件 | 文件路径 | 职责 |
|------|---------|------|
| **WSClient** | `src/frontend/common/ws/ws-client.js` | 前端 WebSocket 客户端，处理连接、重连、消息发送/接收 |
| **StandardWebSocketServer** | `src/backend/msgCenter_server/standard_server.py` | 消息中心服务器，路由消息到后端处理器 |
| **StandardMessageHandler** | `src/backend/msgCenter_server/standard_protocol.py` | 标准消息格式处理器，构建和解析消息 |
| **PDFManager** | `src/backend/pdf_manager/manager.py` | 后端业务逻辑，处理 PDF 文件管理 |

---

## 通信流程详解

### 完整请求-响应流程

```
1. 用户操作
   ↓
2. 前端 Feature 触发事件 (EventBus)
   ↓
3. PDFManager (前端) 监听事件并构建消息
   ↓
4. WSClient 发送消息到 WebSocket 服务器
   ↓
5. StandardWebSocketServer 接收并解析消息
   ↓
6. 服务器路由到对应的消息处理器
   ↓
7. 后端 PDFManager 执行业务逻辑
   ↓
8. 构建响应消息并返回
   ↓
9. StandardWebSocketServer 发送响应到前端
   ↓
10. WSClient 接收并分发消息 (EventBus)
   ↓
11. 前端 Feature 监听事件并更新 UI
```

### 关键检查点

**数据格式校验必须在以下每个阶段进行：**

1. ✅ **前端发送前**：构建消息时确保包含所有必需字段
2. ✅ **消息中心接收后**：验证消息结构是否符合标准
3. ✅ **后端处理前**：检查业务数据的完整性和有效性
4. ✅ **后端响应前**：构建标准响应格式
5. ✅ **前端接收后**：验证响应类型和数据完整性

---

## 标准消息格式

### 请求消息格式

所有从前端发送到后端的消息必须遵循以下格式：

```javascript
{
  "type": "消息类型字符串",           // 必需，定义消息的意图
  "request_id": "唯一请求标识",      // 必需，用于匹配请求和响应
  "timestamp": 1696300800000,       // 必需，消息发送时间（毫秒级时间戳）
  "data": {                         // 可选，消息携带的业务数据
    // 业务数据字段
  }
}
```

**字段说明：**

- **type** (string): 消息类型，采用 `模块:动作:对象` 命名规范（详见消息类型定义）
- **request_id** (string): UUID v4 格式，用于关联请求和响应
- **timestamp** (number): 毫秒级 Unix 时间戳
- **data** (object): 根据消息类型包含不同的业务数据

### 响应消息格式

后端返回的响应消息遵循以下统一格式：

```javascript
{
  "type": "response",               // 固定为 "response"
  "request_id": "对应的请求ID",      // 必需，用于匹配原始请求
  "timestamp": 1696300800.123,      // 必需，响应时间（秒级时间戳）
  "status": "success",              // 必需，状态：success | error | pending
  "code": 200,                      // 必需，HTTP 状态码
  "message": "操作成功描述",         // 必需，人类可读的消息
  "data": {                         // 可选，成功时的返回数据
    // 返回数据字段
  },
  "error": {                        // 可选，失败时的错误信息
    "type": "错误类型",
    "message": "详细错误描述",
    "details": {}                   // 额外的错误详情
  }
}
```

**字段说明：**

- **status** (string):
  - `success` - 操作成功
  - `error` - 操作失败
  - `pending` - 操作进行中（异步操作）

- **code** (number): HTTP 状态码
  - `200` - 请求成功
  - `201` - 资源创建成功
  - `400` - 请求参数错误
  - `404` - 资源不存在
  - `500` - 服务器内部错误

---

## 消息类型定义

### 命名规范

消息类型采用 **主语:谓语:宾语** 的三段式命名：

```
<模块>:<动作>:<对象>
```

例如：
- `pdf-home:get:pdf-list` - PDF Home 模块获取 PDF 列表
- `pdf-home:add:pdf-files` - PDF Home 模块添加 PDF 文件
- `pdf-home:remove:pdf-files` - PDF Home 模块删除 PDF 文件

### 当前支持的消息类型

#### 1. 获取 PDF 列表

**请求**
```javascript
{
  "type": "pdf-home:get:pdf-list",
  "request_id": "req_xxx",
  "timestamp": 1696300800000,
  "data": {}  // 无需额外参数
}
```

**响应**
```javascript
{
  "type": "response",
  "request_id": "req_xxx",
  "status": "success",
  "code": 200,
  "message": "PDF列表获取成功",
  "data": {
    "files": [
      {
        "id": "文件唯一标识",
        "filename": "文件名.pdf",
        "file_path": "完整文件路径",
        "size": 1234567,
        "pages": 100,
        "created_at": "2024-10-03T10:00:00Z",
        "modified_at": "2024-10-03T10:00:00Z",
        "importance": "high|medium|low",
        "notes": "备注信息"
      }
    ],
    "pagination": {
      "total": 100  // 总文件数
    }
  }
}
```

#### 2. 添加 PDF 文件

**请求**
```javascript
{
  "type": "pdf-home:add:pdf-files",
  "request_id": "req_xxx",
  "timestamp": 1696300800000,
  "data": {
    "filepath": "C:/path/to/file.pdf"  // 文件完整路径
  }
}
```

**响应**
```javascript
{
  "type": "response",
  "request_id": "req_xxx",
  "status": "success",
  "code": 201,
  "message": "PDF文件上传成功",
  "data": {
    "file": {
      "id": "新文件ID",
      "filename": "file.pdf",
      "file_size": 1234567
    }
  }
}
```

#### 3. 删除 PDF 文件（批量）

**请求**
```javascript
{
  "type": "pdf-home:remove:pdf-files",
  "request_id": "req_xxx",
  "timestamp": 1696300800000,
  "data": {
    "file_ids": ["id1", "id2", "id3"]  // 要删除的文件ID列表
  }
}
```

**响应**
```javascript
{
  "type": "response",
  "request_id": "req_xxx",
  "status": "success",
  "code": 200,
  "message": "批量删除完成，成功删除 2 个文件",
  "data": {
    "removed_files": ["id1", "id2"],     // 成功删除的文件
    "failed_files": {                     // 失败的文件及原因
      "id3": "文件不存在"
    },
    "total_removed": 2,
    "total_failed": 1
  }
}
```

#### 4. 打开 PDF 文件

**请求**
```javascript
{
  "type": "pdf-home:open:pdf-file",
  "request_id": "req_xxx",
  "timestamp": 1696300800000,
  "data": {
    "file_id": "要打开的文件ID"
  }
}
```

**响应**
```javascript
{
  "type": "response",
  "request_id": "req_xxx",
  "status": "success",
  "code": 200,
  "message": "PDF viewer window opened successfully",
  "data": {
    "file_id": "文件ID",
    "opened": true
  }
}
```

#### 5. 更新 PDF 元数据

**请求**
```javascript
{
  "type": "pdf-home:update:pdf",
  "request_id": "req_xxx",
  "timestamp": 1696300800000,
  "data": {
    "file_id": "要更新的文件ID",
    "updates": {
      "importance": "high",
      "notes": "更新后的备注",
      "tags": ["标签1", "标签2"]
    }
  }
}
```

**响应**
```javascript
{
  "type": "response",
  "request_id": "req_xxx",
  "status": "success",
  "code": 200,
  "message": "PDF文件更新成功",
  "data": {
    "file_id": "文件ID",
    "updates": {
      "importance": "high",
      "notes": "更新后的备注"
    }
  }
}
```

#### 6. 获取 PDF 详情

**请求**
```javascript
{
  "type": "pdf-home:get:pdf-info",
  "request_id": "req_xxx",
  "timestamp": 1696300800000,
  "data": {
    "file_id": "文件ID"
  }
}
```

**响应**
```javascript
{
  "type": "response",
  "request_id": "req_xxx",
  "status": "success",
  "code": 200,
  "message": "PDF详情获取成功",
  "data": {
    "id": "文件ID",
    "filename": "文件名.pdf",
    "file_path": "完整路径",
    "size": 1234567,
    "pages": 100,
    "metadata": {
      "title": "文档标题",
      "author": "作者",
      "subject": "主题"
    }
  }
}
```

### 广播消息

当 PDF 列表发生变化时，后端会主动广播更新消息给所有连接的客户端：

```javascript
{
  "type": "list",  // 列表更新广播
  "request_id": null,
  "timestamp": 1696300800.123,
  "status": "success",
  "code": 200,
  "message": "PDF列表获取成功",
  "data": {
    "files": [/* 最新的文件列表 */],
    "pagination": {
      "total": 100
    }
  }
}
```

---

## 前端实现规范

### 1. 发送消息

**正确方式：通过 EventBus 发送**

```javascript
// ✅ 推荐：使用事件总线
this.eventBus.emit(
  WEBSOCKET_EVENTS.MESSAGE.SEND,
  {
    type: 'pdf-home:get:pdf-list',
    data: {}
  },
  { actorId: 'PDFManager' }
);
```

**错误方式：**

```javascript
// ❌ 不要直接调用 WebSocket
wsClient.send({ type: 'get_pdf_list' });  // 缺少必需字段
```

### 2. 接收消息

**在 Feature 中监听事件：**

```javascript
class PDFListFeature {
  install(container) {
    const eventBus = container.resolve('eventBus');

    // 监听 PDF 列表更新
    eventBus.on(
      WEBSOCKET_MESSAGE_EVENTS.PDF_LIST,
      (message) => this.#handlePDFListUpdate(message),
      { subscriberId: 'PDFListFeature' }
    );
  }

  #handlePDFListUpdate(message) {
    // 验证消息格式
    if (!message.data || !Array.isArray(message.data.files)) {
      console.error('Invalid PDF list format:', message);
      return;
    }

    // 更新 UI
    this.#updateTable(message.data.files);
  }
}
```

### 3. 错误处理

```javascript
eventBus.on(
  WEBSOCKET_MESSAGE_EVENTS.ERROR,
  (errorData) => {
    // 显示错误提示
    const errorMsg = errorData.error?.message || errorData.message || '操作失败';
    showError(errorMsg);
  },
  { subscriberId: 'PDFManager' }
);
```

---

## 后端实现规范

### 1. 消息处理器结构

```python
def handle_message(self, message: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """处理具体消息"""
    message_type = message.get("type")
    request_id = message.get("request_id")
    data = message.get("data", {})

    # 根据消息类型路由
    if message_type == "pdf-home:get:pdf-list":
        return self.handle_pdf_list_request(request_id, data)

    # 其他消息类型...
```

### 2. 构建响应

**成功响应：**

```python
return StandardMessageHandler.build_response(
    "response",
    request_id,
    status="success",
    code=200,
    message="操作成功",
    data={
        "result": "数据"
    }
)
```

**错误响应：**

```python
return StandardMessageHandler.build_error_response(
    request_id,
    "ERROR_TYPE",
    "详细错误描述",
    error_details={"field": "具体错误信息"},
    code=400
)
```

### 3. 广播消息

当数据变更时，广播更新给所有客户端：

```python
def on_pdf_list_changed(self):
    """PDF列表变更时广播更新"""
    files = self.pdf_manager.get_files()
    message = PDFMessageBuilder.build_pdf_list_response(
        request_id=None,
        files=files
    )
    message["type"] = "list"  # 广播类型
    self.broadcast_message(message)
```

---

## 错误处理机制

### 常见错误类型

| 错误类型 | HTTP Code | 说明 | 处理方式 |
|---------|-----------|------|---------|
| `INVALID_MESSAGE` | 400 | 消息格式错误 | 检查消息结构是否符合标准 |
| `MISSING_FIELD` | 400 | 缺少必需字段 | 补充缺失的字段 |
| `INVALID_REQUEST` | 400 | 请求参数无效 | 验证业务参数的有效性 |
| `FILE_NOT_FOUND` | 404 | 文件不存在 | 检查文件ID是否正确 |
| `PROCESSING_ERROR` | 500 | 服务器处理错误 | 查看后端日志排查问题 |
| `CONNECTION_ERROR` | N/A | WebSocket 连接错误 | 检查网络连接和服务器状态 |

### 错误响应示例

```javascript
{
  "type": "response",
  "request_id": "req_xxx",
  "status": "error",
  "code": 404,
  "message": "未找到文件ID为 abc123 的PDF文件",
  "error": {
    "type": "FILE_NOT_FOUND",
    "message": "未找到文件ID为 abc123 的PDF文件",
    "details": {
      "file_id": "abc123",
      "available_ids": ["id1", "id2"]  // 可选：提供可用的ID列表
    }
  }
}
```

---

## 调试与排查

### 1. 启用日志

**前端日志：**

WSClient 使用 Logger 系统，默认输出到控制台和后端日志文件：

```javascript
import Logger from '../utils/logger.js';
const logger = new Logger('YourFeature');
logger.info('消息内容', { data });
```

**后端日志：**

查看日志文件：`logs/ws-server.log`

```python
import logging
logger = logging.getLogger(__name__)
logger.info(f"处理消息: {message_type}")
```

### 2. 消息追踪

使用 `request_id` 追踪完整的请求-响应流程：

```
[前端] req_abc123 发送消息: pdf-home:get:pdf-list
    ↓
[后端] req_abc123 接收到消息
    ↓
[后端] req_abc123 处理完成，返回响应
    ↓
[前端] req_abc123 收到响应
```

### 3. 常见问题排查

#### 问题：消息发送后无响应

**排查步骤：**
1. 检查 WebSocket 连接状态：`wsClient.isConnected()`
2. 检查消息是否正确发送：查看浏览器 Network 选项卡的 WS 标签
3. 检查后端日志：确认消息是否被接收
4. 检查 `request_id` 是否匹配

#### 问题：消息类型未知

**排查步骤：**
1. 检查前端 `VALID_MESSAGE_TYPES` 是否包含该类型
2. 检查后端 `MessageType` 枚举是否定义
3. 检查消息类型命名是否符合规范

#### 问题：数据格式错误

**排查步骤：**
1. 对照本文档的消息格式定义
2. 使用浏览器开发工具查看实际发送/接收的消息
3. 检查 `data` 字段是否包含所有必需参数
4. 验证数据类型是否正确（字符串、数组、对象等）

### 4. 调试工具

**前端调试：**

```javascript
// 获取 WebSocket 连接信息
wsClient.getDebugInfo();

// 获取连接历史
wsClient.getConnectionHistory();

// 获取最后的错误
wsClient.getLastError();
```

**后端调试：**

```python
# 获取客户端数量
server.get_client_count()

# 获取客户端列表
server.get_client_ids()
```

---

## 最佳实践

### ✅ 应该做的

1. **总是通过 EventBus 通信**，不要直接调用组件方法
2. **验证消息格式**，在发送前和接收后都要验证
3. **使用 request_id 追踪**，便于问题排查
4. **记录详细日志**，包括请求ID、消息类型、数据内容
5. **优雅处理错误**，给用户友好的错误提示
6. **实现重试机制**，对于网络错误自动重试
7. **广播数据变更**，保持所有客户端数据同步

### ❌ 不应该做的

1. **不要跳过数据验证**，即使"确定"数据是正确的
2. **不要忽略错误**，所有错误都应该被处理
3. **不要假设连接总是可用**，始终检查连接状态
4. **不要在消息中包含敏感信息**，除非经过加密
5. **不要使用旧的消息类型**，使用新的命名规范
6. **不要硬编码消息类型字符串**，使用常量定义
7. **不要同步等待响应**，使用异步事件机制

---

## 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|---------|
| 1.0.0 | 2024-10-03 | 初始版本，定义标准通信协议 |

---

## 参考资料

- **前端 WebSocket 客户端**：`src/frontend/common/ws/ws-client.js`
- **后端消息服务器**：`src/backend/msgCenter_server/standard_server.py`
- **消息协议定义**：`src/backend/msgCenter_server/standard_protocol.py`
- **事件常量定义**：`src/frontend/common/event/event-constants.js`
- **PDF 管理器（前端）**：`src/frontend/pdf-home/features/pdf-manager/`
- **PDF 管理器（后端）**：`src/backend/pdf_manager/manager.py`
