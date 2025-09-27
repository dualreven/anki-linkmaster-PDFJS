# WebSocket通信中心模块 (msgCenter_server)

WebSocket通信中心模块是Anki LinkMaster PDFJS项目的核心消息转发和处理中心，提供实时双向通信能力，支持前端与后端之间的PDF管理、页面传输和系统状态同步。

## 目录

- [模块概述](#模块概述)
- [架构设计](#架构设计)
- [核心功能](#核心功能)
- [API接口](#api接口)
- [使用方法](#使用方法)
- [安全特性](#安全特性)
- [配置说明](#配置说明)
- [故障排除](#故障排除)

## 模块概述

### 设计理念

WebSocket通信中心采用分层架构设计，遵循以下核心原则：

- **协议标准化**: 基于JSON通信标准，确保消息格式的一致性
- **安全第一**: 内置AES-256-GCM加密和HMAC-SHA256验证
- **高可靠性**: 支持心跳检测、自动重连和错误恢复
- **模块化**: 清晰的职责分离，易于扩展和维护

### 主要特性

- 🔄 **实时双向通信**: 基于WebSocket协议的低延迟消息传输
- 🔒 **端到端加密**: AES-256-GCM加密确保数据安全
- 🛡️ **消息完整性**: HMAC-SHA256验证防止篡改
- 📋 **标准化协议**: 统一的JSON消息格式和错误处理
- 🔍 **智能路由**: 基于消息类型的自动分发机制
- 📊 **状态管理**: 完整的连接状态和会话管理
- 🔧 **开发友好**: 详细的日志记录和调试支持

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    前端应用层                                │
│  (pdf-home, pdf-viewer, 其他前端模块)                       │
└─────────────────┬───────────────────────────────────────────┘
                  │ WebSocket连接
                  │
┌─────────────────▼───────────────────────────────────────────┐
│               WebSocket通信中心                             │
│  ┌─────────────────┬─────────────────┬─────────────────┐   │
│  │  标准服务器     │   协议处理器    │   安全模块      │   │
│  │ StandardServer  │ StandardProtocol│ Crypto/HMAC     │   │
│  └─────────────────┼─────────────────┼─────────────────┘   │
│  ┌─────────────────┼─────────────────┼─────────────────┐   │
│  │  客户端管理     │   消息路由      │   会话管理      │   │
│  │ ClientManager   │ MessageRouter   │ SessionManager  │   │
│  └─────────────────┴─────────────────┴─────────────────┘   │
└─────────────────┬───────────────────────────────────────────┘
                  │ 内部API调用
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                    后端服务层                               │
│  ┌───────────────┬───────────────┬───────────────────────┐ │
│  │  PDF管理器    │  文件服务器   │  页面传输管理器       │ │
│  │ PDFManager    │ HttpFileServer│ PageTransferManager   │ │
│  └───────────────┴───────────────┴───────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 核心组件

#### 1. StandardWebSocketServer (标准WebSocket服务器)
- **职责**: WebSocket连接管理和消息分发
- **特性**: 多客户端支持、连接状态监控、自动错误恢复
- **接口**: QObject信号槽机制，支持Qt事件循环

#### 2. StandardMessageHandler (标准消息处理器)
- **职责**: JSON消息的解析、验证和构建
- **特性**: 消息格式验证、错误响应生成、类型安全
- **标准**: 符合项目JSON通信标准规范

#### 3. AESGCMCrypto (加密处理器)
- **职责**: 消息加密/解密和完整性验证
- **算法**: AES-256-GCM + HMAC-SHA256
- **特性**: 密钥管理、会话隔离、自动密钥轮换

#### 4. WebSocketClient (客户端管理器)
- **职责**: 单个客户端连接的生命周期管理
- **特性**: 心跳检测、自动重连、状态同步

#### 5. PDFMessageBuilder (PDF消息构建器)
- **职责**: PDF相关消息的标准化构建
- **特性**: 类型安全、响应格式统一、错误处理

## 核心功能

### 1. PDF文件管理

#### 获取PDF列表
```javascript
// 请求格式
{
  "type": "get_pdf_list",
  "request_id": "uuid-string",
  "timestamp": 1640995200000,
  "data": {}
}

// 响应格式
{
  "type": "response",
  "request_id": "uuid-string",
  "status": "success",
  "code": 200,
  "message": "PDF列表获取成功",
  "data": {
    "files": [
      {
        "id": "pdf_001",
        "filename": "document.pdf",
        "file_size": 2048576,
        "page_count": 10,
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "total": 1
    }
  }
}
```

#### 添加PDF文件
```javascript
// 请求格式
{
  "type": "add_pdf",
  "request_id": "uuid-string",
  "timestamp": 1640995200000,
  "data": {
    "filepath": "/path/to/document.pdf"
  }
}

// 响应格式
{
  "type": "response",
  "request_id": "uuid-string",
  "status": "success",
  "code": 201,
  "message": "PDF文件上传成功",
  "data": {
    "file": {
      "id": "pdf_001",
      "filename": "document.pdf",
      "file_size": 2048576
    }
  }
}
```

### 2. PDF页面传输

#### 请求PDF页面
```javascript
// 请求格式
{
  "type": "pdf_page_request",
  "request_id": "uuid-string",
  "timestamp": 1640995200000,
  "data": {
    "file_id": "pdf_001",
    "page_number": 1,
    "compression": "zlib_base64"
  }
}

// 响应格式
{
  "type": "pdf_page_response",
  "request_id": "uuid-string",
  "status": "success",
  "code": 200,
  "data": {
    "file_id": "pdf_001",
    "page_number": 1,
    "page_data": {
      "content": "base64-encoded-data",
      "width": 595,
      "height": 842
    },
    "compression": "zlib_base64",
    "metadata": {
      "retrieved_at": 1640995200000
    }
  }
}
```

### 3. 系统状态管理

#### 心跳检测
```javascript
// 心跳请求
{
  "type": "heartbeat",
  "request_id": "uuid-string",
  "timestamp": 1640995200000
}

// 心跳响应
{
  "type": "response",
  "request_id": "uuid-string",
  "status": "success",
  "code": 200,
  "message": "心跳响应",
  "data": {
    "timestamp": 1640995200000
  }
}
```

### 4. 错误处理

#### 标准错误响应
```javascript
{
  "type": "response",
  "request_id": "uuid-string",
  "status": "error",
  "code": 400,
  "message": "请求参数错误",
  "error": {
    "type": "INVALID_REQUEST",
    "message": "缺少必需的file_id参数",
    "details": {
      "missing_fields": ["file_id"]
    }
  }
}
```

## API接口

### 消息类型 (MessageType)

| 类型 | 说明 | 请求/响应 |
|------|------|-----------|
| `get_pdf_list` | 获取PDF文件列表 | 请求 |
| `pdf_list` | PDF文件列表响应 | 响应 |
| `add_pdf` | 添加PDF文件 | 请求 |
| `pdf_added` | PDF添加成功响应 | 响应 |
| `remove_pdf` | 删除PDF文件 | 请求 |
| `pdf_removed` | PDF删除成功响应 | 响应 |
| `batch_remove_pdf` | 批量删除PDF文件 | 请求 |
| `batch_pdf_removed` | 批量删除成功响应 | 响应 |
| `open_pdf` | 打开PDF查看器 | 请求 |
| `pdf_detail_request` | 获取PDF详细信息 | 请求 |
| `pdf_detail_response` | PDF详细信息响应 | 响应 |
| `pdf_page_request` | 请求PDF页面 | 请求 |
| `pdf_page_response` | PDF页面响应 | 响应 |
| `pdf_page_preload` | 预加载PDF页面 | 请求 |
| `pdf_page_cache_clear` | 清理PDF页面缓存 | 请求 |
| `console_log` | 前端控制台日志 | 请求 |
| `heartbeat` | 心跳检测 | 请求 |
| `system_status` | 系统状态 | 广播 |
| `error` | 错误信息 | 响应 |

### 状态码 (Status Codes)

| 状态码 | 含义 | 说明 |
|--------|------|------|
| 200 | OK | 请求成功 |
| 201 | Created | 资源创建成功 |
| 400 | Bad Request | 请求参数错误 |
| 404 | Not Found | 资源不存在 |
| 500 | Internal Server Error | 服务器内部错误 |

### 错误类型 (Error Types)

| 错误类型 | 说明 |
|----------|------|
| `INVALID_MESSAGE` | 消息格式错误 |
| `INVALID_REQUEST` | 请求参数错误 |
| `PROCESSING_ERROR` | 处理过程中出错 |
| `PDF_LIST_ERROR` | PDF列表获取错误 |
| `UPLOAD_FAILED` | 文件上传失败 |
| `REMOVE_FAILED` | 文件删除失败 |
| `FILE_NOT_FOUND` | 文件不存在 |
| `PAGE_EXTRACTION_ERROR` | 页面提取错误 |
| `CONSOLE_LOG_ERROR` | 控制台日志处理错误 |

## 使用方法

### 1. 基本使用

#### 启动WebSocket服务器

```python
import sys
from PyQt6.QtCore import QCoreApplication
from src.backend.msgCenter_server.standard_server import StandardWebSocketServer

# 创建Qt应用实例
app = QCoreApplication(sys.argv)

# 创建WebSocket服务器
server = StandardWebSocketServer(host="127.0.0.1", port=8765)

# 启动服务器
if server.start():
    print("WebSocket服务器启动成功")
    sys.exit(app.exec())
else:
    print("WebSocket服务器启动失败")
    sys.exit(1)
```

#### 命令行启动

```bash
# 使用默认端口启动
python src/backend/msgCenter_server/standard_server.py

# 指定端口启动
python src/backend/msgCenter_server/standard_server.py --port 8766
```

### 2. 客户端连接

#### JavaScript客户端示例

```javascript
// 建立WebSocket连接
const ws = new WebSocket('ws://localhost:8765');

// 连接成功
ws.onopen = function(event) {
    console.log('WebSocket连接已建立');

    // 发送PDF列表请求
    const request = {
        type: 'get_pdf_list',
        request_id: generateUUID(),
        timestamp: Date.now(),
        data: {}
    };

    ws.send(JSON.stringify(request));
};

// 接收消息
ws.onmessage = function(event) {
    const message = JSON.parse(event.data);
    console.log('收到响应:', message);

    if (message.type === 'response' && message.status === 'success') {
        // 处理成功响应
        console.log('操作成功:', message.data);
    } else if (message.status === 'error') {
        // 处理错误响应
        console.error('操作失败:', message.error);
    }
};

// 连接错误
ws.onerror = function(error) {
    console.error('WebSocket错误:', error);
};

// 连接关闭
ws.onclose = function(event) {
    console.log('WebSocket连接已关闭');
};

// 生成UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
```

### 3. 扩展开发

#### 添加自定义消息处理器

```python
# 继承StandardWebSocketServer
class CustomWebSocketServer(StandardWebSocketServer):

    def handle_message(self, message: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """处理自定义消息"""
        message_type = message.get("type")
        request_id = message.get("request_id")
        data = message.get("data", {})

        # 处理自定义消息类型
        if message_type == "custom_operation":
            return self.handle_custom_operation(request_id, data)

        # 调用父类处理器处理标准消息
        return super().handle_message(message)

    def handle_custom_operation(self, request_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """处理自定义操作"""
        try:
            # 执行自定义逻辑
            result = self.perform_custom_logic(data)

            # 构建成功响应
            return StandardMessageHandler.build_response(
                "response",
                request_id,
                status="success",
                code=200,
                message="自定义操作成功",
                data={"result": result}
            )
        except Exception as e:
            # 构建错误响应
            return StandardMessageHandler.build_error_response(
                request_id,
                "CUSTOM_OPERATION_ERROR",
                f"自定义操作失败: {str(e)}"
            )

    def perform_custom_logic(self, data: Dict[str, Any]) -> Any:
        """执行自定义业务逻辑"""
        # 实现具体的业务逻辑
        return {"processed": True, "data": data}
```

## 安全特性

### 1. 加密传输

#### AES-256-GCM加密

```python
from src.backend.msgCenter_server.crypto import AESGCMCrypto

# 创建加密器
crypto = AESGCMCrypto()

# 加密消息
message = {"type": "sensitive_data", "data": {"secret": "top_secret"}}
encrypted_message = crypto.encrypt_message(message)

# 发送加密消息
ws.send(json.dumps(encrypted_message))

# 解密消息
decrypted_message = crypto.decrypt_message(encrypted_message)
```

#### HMAC-SHA256验证

```python
from src.backend.msgCenter_server.crypto import HMACVerifier

# 创建HMAC验证器
hmac_verifier = HMACVerifier()

# 计算HMAC签名
data = b"important message"
signature = hmac_verifier.compute_hmac_base64(data)

# 验证HMAC签名
is_valid = hmac_verifier.verify_hmac_base64(data, signature)
```

### 2. 会话管理

#### 密钥轮换

```python
from src.backend.msgCenter_server.crypto import key_manager

# 启动自动密钥轮换（24小时周期）
key_manager.start_rotation()

# 为会话生成密钥
session_key = key_manager.generate_session_key("session_001")

# 手动轮换密钥
new_key = key_manager.rotate_session_key("session_001")

# 停止密钥轮换
key_manager.stop_rotation()
```

### 3. 权限控制

#### 客户端认证

```python
class AuthenticatedWebSocketServer(StandardWebSocketServer):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.authenticated_clients = set()

    def handle_message(self, message: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """处理需要认证的消息"""
        client_socket = self.sender()

        # 检查客户端是否已认证
        if client_socket not in self.authenticated_clients:
            if message.get("type") != "authenticate":
                return StandardMessageHandler.build_error_response(
                    message.get("request_id", "unknown"),
                    "AUTHENTICATION_REQUIRED",
                    "需要先进行身份认证"
                )

        return super().handle_message(message)
```

## 配置说明

### 1. 服务器配置

#### 端口配置

服务器支持多种端口配置方式，优先级如下：

1. **命令行参数**: `--port 8766`
2. **配置文件**: `logs/runtime-ports.json`
3. **默认值**: `8765`

#### 配置文件格式

```json
{
  "ws_server": 8765,
  "http_server": 8080,
  "last_updated": "2024-01-01T00:00:00Z"
}
```

### 2. 日志配置

#### 日志级别

```python
import logging

# 设置日志级别
logging.getLogger('src.backend.msgCenter_server').setLevel(logging.DEBUG)
```

#### 日志文件

- **服务器日志**: `logs/ws-server.log`
- **统一控制台日志**: `logs/unified-console.log`
- **后端启动器日志**: `logs/backend-launcher.log`

### 3. 性能配置

#### 连接数限制

```python
class LimitedWebSocketServer(StandardWebSocketServer):
    MAX_CLIENTS = 100

    def on_new_connection(self):
        if len(self.clients) >= self.MAX_CLIENTS:
            socket = self.server.nextPendingConnection()
            if socket:
                socket.close()
                logger.warning(f"连接数已达上限，拒绝新连接")
            return

        super().on_new_connection()
```

#### 消息大小限制

```python
class SizeLimitedWebSocketServer(StandardWebSocketServer):
    MAX_MESSAGE_SIZE = 10 * 1024 * 1024  # 10MB

    def on_message_received(self, message):
        if len(message) > self.MAX_MESSAGE_SIZE:
            logger.warning(f"消息过大，已忽略: {len(message)} bytes")
            return

        super().on_message_received(message)
```

## 故障排除

### 1. 常见问题

#### 连接失败

**问题**: WebSocket连接无法建立

**排查步骤**:
1. 检查服务器是否正常启动
2. 验证端口是否被占用
3. 确认防火墙设置
4. 检查网络连接

```bash
# 检查端口状态
netstat -an | grep 8765

# 测试网络连接
telnet localhost 8765
```

#### 消息解析错误

**问题**: 收到消息格式错误

**解决方案**:
1. 验证JSON格式是否正确
2. 检查必需字段是否完整
3. 确认时间戳格式

```javascript
// 正确的消息格式
const message = {
    type: "get_pdf_list",
    request_id: generateUUID(),
    timestamp: Date.now(),  // 毫秒时间戳
    data: {}
};
```

#### 加密失败

**问题**: 消息加密/解密失败

**排查步骤**:
1. 检查cryptography库是否正确安装
2. 验证密钥是否有效
3. 确认IV和标签完整性

```bash
# 安装加密依赖
pip install cryptography
```

### 2. 调试技巧

#### 启用详细日志

```python
import logging

# 启用详细调试日志
logging.getLogger('src.backend.msgCenter_server').setLevel(logging.DEBUG)
logging.getLogger('src.qt.compat').setLevel(logging.DEBUG)
```

#### 消息跟踪

```javascript
// 客户端消息跟踪
const originalSend = WebSocket.prototype.send;
WebSocket.prototype.send = function(data) {
    console.log('发送消息:', data);
    return originalSend.call(this, data);
};

ws.onmessage = function(event) {
    console.log('接收消息:', event.data);
    // 原始处理逻辑
};
```

#### 性能监控

```python
import time

class PerformanceMonitoredServer(StandardWebSocketServer):

    def handle_message(self, message: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        start_time = time.time()

        result = super().handle_message(message)

        end_time = time.time()
        processing_time = (end_time - start_time) * 1000  # 毫秒

        logger.info(f"消息处理耗时: {processing_time:.2f}ms, 类型: {message.get('type')}")

        return result
```

### 3. 维护建议

#### 定期清理

```python
# 清理过期会话
def cleanup_expired_sessions():
    current_time = time.time()
    expired_sessions = []

    for session_id, (_, creation_time) in key_manager._session_keys.items():
        if current_time - creation_time > 86400:  # 24小时
            expired_sessions.append(session_id)

    for session_id in expired_sessions:
        key_manager.remove_session_key(session_id)
        logger.info(f"清理过期会话: {session_id}")
```

#### 健康检查

```python
def health_check():
    """服务器健康检查"""
    checks = {
        "server_running": hasattr(server, 'running') and server.running,
        "client_count": len(server.clients),
        "memory_usage": get_memory_usage(),
        "disk_space": get_disk_space()
    }

    logger.info(f"健康检查结果: {checks}")
    return checks
```

---

## 贡献指南

欢迎为WebSocket通信中心模块贡献代码！请遵循以下指南：

1. **代码风格**: 遵循PEP 8规范
2. **文档**: 为新功能编写完整的文档
3. **测试**: 确保所有测试通过
4. **日志**: 添加适当的日志记录

## 许可证

本模块遵循项目整体许可证协议。

---

*最后更新: 2025-09-27*