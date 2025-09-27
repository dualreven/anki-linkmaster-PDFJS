# PDF应用服务器模块 (pdfTable_server)

PDF应用服务器模块是Anki LinkMaster PDFJS项目的核心应用协调器，负责整合WebSocket通信、PDF管理、HTTP文件服务等后端组件，为前端提供统一的PDF处理服务。

## 目录

- [模块概述](#模块概述)
- [架构设计](#架构设计)
- [核心功能](#核心功能)
- [子模块详解](#子模块详解)
- [使用方法](#使用方法)
- [配置说明](#配置说明)
- [开发规范](#开发规范)
- [故障排除](#故障排除)

## 模块概述

### 设计理念

PDF应用服务器采用分层模块化架构，遵循以下核心原则：

- **服务协调**: 统一管理WebSocket、HTTP、PDF等多个后端服务
- **模块解耦**: 通过子模块实现职责分离，提高代码可维护性
- **事件驱动**: 基于Qt信号槽机制实现组件间的松耦合通信
- **配置灵活**: 支持环境变量、命令行参数等多种配置方式

### 主要特性

- 🎯 **应用生命周期管理**: 统一的服务启动、运行和关闭流程
- 🔄 **多服务协调**: WebSocket服务器、HTTP文件服务器、PDF管理器的统一调度
- 📡 **WebSocket消息路由**: 智能的消息分发和处理机制
- 🔌 **客户端连接管理**: 完整的客户端生命周期管理和状态同步
- 📁 **命令行文件处理**: 支持命令行传入的PDF文件自动处理
- 🛡️ **错误处理机制**: 完善的错误分类和响应处理
- 📝 **统一日志管理**: 集成的日志记录和前端日志收集

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    前端应用层                                │
│         (pdf-home, pdf-viewer)                              │
└─────────────────┬───────────────────────────────────────────┘
                  │ WebSocket + HTTP请求
                  │
┌─────────────────▼───────────────────────────────────────────┐
│               PDF应用服务器                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              AnkiLinkMasterApp                       │   │
│  │         (主应用协调器)                               │   │
│  └─────────────────┬───────────────────────────────────┘   │
│  ┌─────────────────▼───────────────────────────────────┐   │
│  │            应用子模块层                             │   │
│  │  ┌────────────┬────────────┬────────────────────┐  │   │
│  │  │WebSocket   │响应处理    │客户端连接管理      │  │   │
│  │  │消息处理器  │工具        │                    │  │   │
│  │  └────────────┼────────────┼────────────────────┘  │   │
│  │  ┌────────────┼────────────┼────────────────────┐  │   │
│  │  │命令行文件  │辅助函数    │错误码映射          │  │   │
│  │  │处理器      │            │                    │  │   │
│  │  └────────────┴────────────┴────────────────────┘  │   │
│  └─────────────────┬───────────────────────────────────┘   │
└──────────────────────┬─────────────────────────────────────┘
                       │ 内部API调用
┌──────────────────────▼─────────────────────────────────────┐
│                    后端服务层                               │
│  ┌───────────────┬───────────────┬───────────────────────┐ │
│  │ WebSocket     │ HTTP文件      │ PDF管理器             │ │
│  │ 通信中心      │ 服务器        │                       │ │
│  │(msgCenter)    │(pdfFile)      │(pdf_manager)          │ │
│  └───────────────┴───────────────┴───────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 核心组件

#### 1. AnkiLinkMasterApp (主应用类)
- **职责**: 应用生命周期管理和服务协调
- **特性**: 多服务启动/停止、配置管理、错误恢复
- **接口**: run(), shutdown(), broadcast_pdf_list()

#### 2. WebSocketHandlers (WebSocket消息处理器)
- **职责**: WebSocket消息的路由和业务逻辑处理
- **特性**: 消息类型识别、参数验证、错误处理
- **支持消息**: PDF管理、文件详情、控制台日志等

#### 3. ResponseHandlers (响应处理工具)
- **职责**: 标准化的WebSocket响应构建和发送
- **特性**: 统一错误码、状态码映射、格式标准化
- **方法**: send_success_response(), send_error_response()

#### 4. ClientHandler (客户端连接管理器)
- **职责**: 客户端连接生命周期管理和数据同步
- **特性**: 连接状态监控、初始数据推送、广播机制
- **优化**: QtWebEngine延迟加载优化

#### 5. CommandLineHandler (命令行文件处理器)
- **职责**: 命令行传入PDF文件的自动处理
- **特性**: 文件复制、路径管理、前端通知
- **限制**: 仅在pdf-viewer模块下有效

## 核心功能

### 1. PDF文件管理

#### 添加PDF文件
支持通过WebSocket请求添加PDF文件到管理器：

```javascript
// 请求格式
{
  "type": "add_pdf",
  "request_id": "uuid-string",
  "data": {
    "file_path": "/path/to/document.pdf"
  }
}

// 成功响应
{
  "type": "response",
  "request_id": "uuid-string",
  "status": "success",
  "code": 200,
  "message": "操作成功",
  "data": {
    "file": {
      "id": "pdf_001",
      "filename": "document.pdf",
      "file_size": 2048576,
      "page_count": 10
    }
  }
}
```

#### 获取PDF列表
```javascript
// 请求格式
{
  "type": "get_pdf_list",
  "request_id": "uuid-string"
}

// 响应格式
{
  "type": "response",
  "request_id": "uuid-string",
  "status": "success",
  "code": 200,
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

#### 删除PDF文件
```javascript
// 单文件删除
{
  "type": "remove_pdf",
  "request_id": "uuid-string",
  "data": {
    "filename": "document.pdf"
  }
}

// 批量删除
{
  "type": "batch_remove_pdf",
  "request_id": "uuid-string",
  "data": {
    "filenames": ["file1.pdf", "file2.pdf"]
  }
}
```

### 2. PDF详情查询

```javascript
// 请求PDF详细信息
{
  "type": "pdf_detail_request",
  "request_id": "uuid-string",
  "data": {
    "file_id": "pdf_001"
  }
}

// 响应包含完整的文件元数据
{
  "type": "response",
  "status": "success",
  "data": {
    "id": "pdf_001",
    "filename": "document.pdf",
    "file_size": 2048576,
    "page_count": 10,
    "created_at": "2024-01-01T00:00:00Z",
    "metadata": {
      "title": "Document Title",
      "author": "Author Name"
    }
  }
}
```

### 3. PDF查看器集成

```javascript
// 打开PDF查看器
{
  "type": "open_pdf",
  "request_id": "uuid-string",
  "data": {
    "file_id": "pdf_001"
  }
}

// 成功响应
{
  "type": "response",
  "status": "success",
  "data": {
    "file_id": "pdf_001",
    "opened": true
  }
}
```

### 4. 前端日志收集

```javascript
// 前端控制台日志
{
  "type": "console_log",
  "data": {
    "source": "pdf-home",
    "level": "info",
    "timestamp": 1640995200000,
    "message": "Application initialized"
  }
}

// 日志会被写入 logs/unified-console.log
```

### 5. 系统状态管理

#### 心跳检测
```javascript
// 心跳请求
{
  "type": "heartbeat",
  "request_id": "uuid-string"
}

// 系统会自动处理，无需特殊响应
```

#### 客户端连接事件
- 新客户端连接时自动推送PDF列表
- QtWebEngine优化的延迟数据加载
- 文件列表变更时的实时广播

## 子模块详解

### application_subcode 模块结构

```
application_subcode/
├── __init__.py                    # 模块初始化
├── helpers.py                     # 辅助函数
├── response_handlers.py           # 响应处理工具
├── websocket_handlers.py          # WebSocket消息处理器
├── client_handler.py              # 客户端连接管理器
├── command_line_handler.py        # 命令行文件处理器
└── docs/                          # 模块规范文档
    └── SPEC/
        ├── SPEC-HEAD-application_subcode.json
        ├── BACKEND-APPSUBCODE-EVENT-NAMING-001.md
        ├── BACKEND-APPSUBCODE-VARIABLE-NAMING-001.md
        ├── BACKEND-APPSUBCODE-MESSAGE-TYPE-001.md
        ├── BACKEND-APPSUBCODE-MODULE-STRUCTURE-001.md
        ├── BACKEND-APPSUBCODE-ERROR-HANDLING-001.md
        └── BACKEND-APPSUBCODE-LIFECYCLE-001.md
```

### 错误处理机制

#### 错误码映射
```python
error_mapping = {
    "MISSING_PARAMETERS": 400,        # 缺少必需参数
    "INVALID_PARAMETER_FORMAT": 400,  # 参数格式错误
    "FILE_NOT_FOUND": 404,            # 文件不存在
    "DIRECTORY_NOT_FOUND": 404,       # 目录不存在
    "PERMISSION_DENIED": 403,         # 权限不足
    "REMOVE_FILE_FAILED": 422,        # 文件删除失败
    "PARTIAL_SUCCESS": 207,           # 部分成功
    "SERVER_ERROR": 500,              # 服务器错误
    "FILE_EXISTS": 409,               # 文件已存在
    "FEATURE_NOT_AVAILABLE": 501,     # 功能不可用
    "FILE_SELECTION_ERROR": 500,      # 文件选择错误
    "INTERNAL_ERROR": 500,            # 内部错误
    "INVALID_FILE_FORMAT": 415        # 文件格式无效
}
```

#### 标准错误响应格式
```javascript
{
  "type": "response",
  "request_id": "uuid-string",
  "status": "error",
  "code": 400,
  "message": "参数格式错误",
  "error": {
    "type": "invalid_parameter_format",
    "message": "参数格式错误",
    "details": {}
  }
}
```

## 使用方法

### 1. 基本使用

#### 直接实例化运行
```python
from src.backend.pdfTable_server.application import AnkiLinkMasterApp

# 创建应用实例
app = AnkiLinkMasterApp()

# 启动应用
app.run(
    module="pdf-home",        # 前端模块
    vite_port=3000,          # Vite开发服务器端口
    pdf_id=None,             # PDF文件ID (可选)
    ws_port=8765,            # WebSocket服务器端口
    http_port=8080           # HTTP文件服务器端口
)

# 应用关闭
app.shutdown()
```

#### 通过后端启动器运行
```bash
# 使用默认配置启动
python src/backend/launcher.py start

# 指定端口启动
python src/backend/launcher.py start --ws-port 8766 --http-port 8081

# 指定前端模块
python src/backend/launcher.py start --module pdf-home
```

#### 通过AI启动器运行
```bash
# 完整启动所有服务
python ai_launcher.py start --module pdf-home

# 检查服务状态
python ai_launcher.py status

# 停止所有服务
python ai_launcher.py stop
```

### 2. 环境变量配置

应用支持通过环境变量覆盖端口配置：

```bash
# 设置后端服务端口
export BACKEND_WS_PORT=8766
export BACKEND_HTTP_PORT=8081

# 启动应用
python src/backend/launcher.py start
```

### 3. 客户端连接示例

#### JavaScript WebSocket客户端
```javascript
// 建立连接
const ws = new WebSocket('ws://localhost:8765');

// 连接成功
ws.onopen = function(event) {
    console.log('WebSocket连接已建立');

    // 获取PDF列表
    const request = {
        type: 'get_pdf_list',
        request_id: generateUUID()
    };
    ws.send(JSON.stringify(request));
};

// 接收消息
ws.onmessage = function(event) {
    const message = JSON.parse(event.data);

    if (message.type === 'pdf_list') {
        // 处理PDF列表更新
        updatePDFList(message.data.files);
    } else if (message.status === 'error') {
        // 处理错误
        console.error('操作失败:', message.error);
    }
};

// 发送添加PDF请求
function addPDF(filePath) {
    const request = {
        type: 'add_pdf',
        request_id: generateUUID(),
        data: {
            file_path: filePath
        }
    };
    ws.send(JSON.stringify(request));
}

// UUID生成函数
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
```

### 4. 扩展开发

#### 添加自定义消息处理器

```python
# 扩展WebSocketHandlers
class CustomWebSocketHandlers(WebSocketHandlers):

    def handle_websocket_message(self, client, message):
        """扩展消息处理"""
        message_type = message.get('type')

        # 处理自定义消息类型
        if message_type == 'custom_operation':
            self.handle_custom_operation(client, message)
        else:
            # 调用父类处理器
            super().handle_websocket_message(client, message)

    def handle_custom_operation(self, client, message):
        """处理自定义操作"""
        try:
            # 实现自定义业务逻辑
            result = self.perform_custom_logic(message.get('data', {}))

            # 发送成功响应
            self.response.send_success_response(
                client,
                "custom_operation",
                {"result": result},
                message.get('request_id')
            )
        except Exception as e:
            # 发送错误响应
            self.response.send_error_response(
                client,
                f"自定义操作失败: {str(e)}",
                "custom_operation",
                "INTERNAL_ERROR",
                message.get('request_id')
            )

    def perform_custom_logic(self, data):
        """实现自定义业务逻辑"""
        return {"processed": True, "data": data}
```

#### 扩展应用类

```python
class CustomAnkiLinkMasterApp(AnkiLinkMasterApp):

    def run(self, **kwargs):
        """扩展应用启动逻辑"""
        # 执行自定义初始化
        self.custom_initialization()

        # 调用父类启动逻辑
        super().run(**kwargs)

        # 执行自定义后处理
        self.custom_post_processing()

    def custom_initialization(self):
        """自定义初始化逻辑"""
        logger.info("执行自定义初始化")
        # 实现自定义初始化逻辑

    def custom_post_processing(self):
        """自定义后处理逻辑"""
        logger.info("执行自定义后处理")
        # 实现自定义后处理逻辑
```

## 配置说明

### 1. 端口配置

应用支持多种端口配置方式，优先级如下：

1. **环境变量**: `BACKEND_WS_PORT`, `BACKEND_HTTP_PORT`
2. **命令行参数**: `--ws-port`, `--http-port`
3. **配置文件**: `logs/runtime-ports.json`
4. **默认值**: WebSocket端口8765，HTTP端口8080

### 2. 模块配置

```bash
# 启动pdf-home模块
python ai_launcher.py start --module pdf-home

# 启动pdf-viewer模块并指定PDF文件
python ai_launcher.py start --module pdf-viewer --pdf-id "sample.pdf"
```

### 3. 日志配置

#### 日志文件分布
- **应用日志**: 控制台输出 + Python logging
- **前端日志**: `logs/unified-console.log`
- **PDF.js日志**: 通过pdfjs_logger模块管理
- **WebSocket日志**: `logs/ws-server.log`

#### 自定义日志级别
```python
import logging

# 设置应用日志级别
logging.getLogger('src.backend.pdfTable_server').setLevel(logging.DEBUG)
```

### 4. 文件路径配置

```python
# 项目根目录结构
project_root/
├── data/
│   └── pdfs/              # PDF文件存储目录
├── logs/                  # 日志文件目录
├── src/
│   ├── backend/
│   │   └── pdfTable_server/
│   └── frontend/
└── ai_launcher.py
```

## 开发规范

### 1. 代码规范

参考模块内的SPEC规范文档：

- **事件命名**: 遵循 `BACKEND-APPSUBCODE-EVENT-NAMING-001.md`
- **变量命名**: 遵循 `BACKEND-APPSUBCODE-VARIABLE-NAMING-001.md`
- **消息类型**: 遵循 `BACKEND-APPSUBCODE-MESSAGE-TYPE-001.md`
- **模块结构**: 遵循 `BACKEND-APPSUBCODE-MODULE-STRUCTURE-001.md`
- **错误处理**: 遵循 `BACKEND-APPSUBCODE-ERROR-HANDLING-001.md`
- **生命周期**: 遵循 `BACKEND-APPSUBCODE-LIFECYCLE-001.md`

### 2. 消息格式规范

#### 请求消息格式
```javascript
{
  "type": "message_type",          // 必需: 消息类型
  "request_id": "uuid-string",     // 必需: 请求ID
  "timestamp": 1640995200000,      // 可选: 时间戳
  "data": {                        // 可选: 消息数据
    // 具体数据内容
  }
}
```

#### 响应消息格式
```javascript
{
  "type": "response",              // 固定: response
  "request_id": "uuid-string",     // 必需: 对应的请求ID
  "status": "success|error",       // 必需: 状态
  "code": 200,                     // 必需: HTTP状态码
  "message": "操作成功",           // 必需: 描述信息
  "timestamp": 1640995200000,      // 必需: 响应时间戳
  "data": {                        // 可选: 响应数据
    // 具体响应内容
  },
  "error": {                       // 可选: 错误信息(status=error时)
    "type": "error_type",
    "message": "错误描述",
    "details": {}
  }
}
```

### 3. 错误处理规范

#### 异常处理模式
```python
def handle_operation(self, client, message):
    """标准操作处理模式"""
    try:
        # 参数验证
        if not self.validate_parameters(message):
            self.response.send_error_response(
                client,
                "参数验证失败",
                message.get('type'),
                "MISSING_PARAMETERS",
                message.get('request_id')
            )
            return

        # 执行业务逻辑
        result = self.perform_business_logic(message)

        # 发送成功响应
        self.response.send_success_response(
            client,
            message.get('type'),
            result,
            message.get('request_id')
        )

    except ValueError as e:
        # 参数格式错误
        self.response.send_error_response(
            client,
            f"参数格式错误: {str(e)}",
            message.get('type'),
            "INVALID_PARAMETER_FORMAT",
            message.get('request_id')
        )
    except FileNotFoundError as e:
        # 文件不存在
        self.response.send_error_response(
            client,
            f"文件不存在: {str(e)}",
            message.get('type'),
            "FILE_NOT_FOUND",
            message.get('request_id')
        )
    except Exception as e:
        # 通用错误
        logger.error(f"处理操作时出错: {str(e)}")
        self.response.send_error_response(
            client,
            f"处理操作时出错: {str(e)}",
            message.get('type'),
            "INTERNAL_ERROR",
            message.get('request_id')
        )
```

## 故障排除

### 1. 常见问题

#### 应用启动失败

**问题**: 应用无法正常启动

**排查步骤**:
1. 检查端口是否被占用
2. 验证Python依赖包安装
3. 确认Qt环境配置
4. 检查文件权限

```bash
# 检查端口占用
netstat -an | grep 8765

# 检查Python依赖
pip list | grep PyQt

# 测试Qt环境
python -c "from src.qt.compat import QCoreApplication; print('Qt环境正常')"
```

#### WebSocket连接失败

**问题**: 前端无法建立WebSocket连接

**解决方案**:
1. 确认WebSocket服务器正常启动
2. 检查防火墙设置
3. 验证端口配置一致性

```python
# 检查WebSocket服务器状态
if app.websocket_server and app.websocket_server.running:
    print("WebSocket服务器运行正常")
else:
    print("WebSocket服务器未启动")
```

#### PDF文件处理错误

**问题**: PDF文件添加、删除失败

**排查步骤**:
1. 检查文件路径有效性
2. 验证文件权限
3. 确认PDF文件格式
4. 查看PDF管理器日志

```python
# 检查文件存在性
import os
file_path = "/path/to/document.pdf"
if os.path.exists(file_path):
    print(f"文件存在: {file_path}")
    if os.access(file_path, os.R_OK):
        print("文件可读")
    else:
        print("文件权限不足")
else:
    print("文件不存在")
```

### 2. 调试技巧

#### 启用详细日志

```python
import logging

# 启用所有模块的详细日志
logging.getLogger('src.backend.pdfTable_server').setLevel(logging.DEBUG)
logging.getLogger('src.backend.msgCenter_server').setLevel(logging.DEBUG)
logging.getLogger('src.backend.pdf_manager').setLevel(logging.DEBUG)
```

#### WebSocket消息跟踪

```javascript
// 前端消息跟踪
const originalSend = WebSocket.prototype.send;
WebSocket.prototype.send = function(data) {
    console.log('[SEND]', JSON.parse(data));
    return originalSend.call(this, data);
};

ws.onmessage = function(event) {
    console.log('[RECV]', JSON.parse(event.data));
    // 原始处理逻辑
};
```

#### 性能监控

```python
import time
from functools import wraps

def monitor_performance(func):
    """性能监控装饰器"""
    @wraps(func)
    def wrapper(self, *args, **kwargs):
        start_time = time.time()
        result = func(self, *args, **kwargs)
        end_time = time.time()

        processing_time = (end_time - start_time) * 1000
        logger.info(f"{func.__name__} 执行耗时: {processing_time:.2f}ms")

        return result
    return wrapper

# 使用示例
class PerformanceMonitoredHandlers(WebSocketHandlers):

    @monitor_performance
    def handle_get_pdf_list(self, client, message):
        return super().handle_get_pdf_list(client, message)
```

### 3. 维护建议

#### 定期维护任务

```python
def maintenance_tasks():
    """定期维护任务"""

    # 清理过期日志文件
    cleanup_old_logs()

    # 检查PDF文件完整性
    validate_pdf_files()

    # 监控内存使用
    check_memory_usage()

    # 验证WebSocket连接状态
    check_websocket_connections()

def cleanup_old_logs():
    """清理7天前的日志文件"""
    import os
    import time

    log_dir = "logs"
    current_time = time.time()
    seven_days_ago = current_time - (7 * 24 * 60 * 60)

    for filename in os.listdir(log_dir):
        file_path = os.path.join(log_dir, filename)
        if os.path.getctime(file_path) < seven_days_ago:
            os.remove(file_path)
            logger.info(f"清理过期日志文件: {filename}")
```

#### 健康检查

```python
def health_check():
    """应用健康检查"""
    checks = {
        "websocket_server": check_websocket_server(),
        "http_server": check_http_server(),
        "pdf_manager": check_pdf_manager(),
        "disk_space": check_disk_space(),
        "memory_usage": check_memory_usage()
    }

    all_healthy = all(checks.values())

    logger.info(f"健康检查结果: {checks}")
    logger.info(f"整体状态: {'健康' if all_healthy else '异常'}")

    return checks

def check_websocket_server():
    """检查WebSocket服务器状态"""
    try:
        # 实现WebSocket服务器检查逻辑
        return True
    except Exception as e:
        logger.error(f"WebSocket服务器检查失败: {e}")
        return False
```

---

## 贡献指南

欢迎为PDF应用服务器模块贡献代码！请遵循以下指南：

1. **代码风格**: 遵循PEP 8规范和项目内SPEC规范
2. **文档**: 为新功能编写完整的文档和示例
3. **测试**: 确保所有测试通过，新功能需要添加测试用例
4. **日志**: 添加适当的日志记录，使用统一的日志格式

## 许可证

本模块遵循项目整体许可证协议。

---

*最后更新: 2025-09-27*