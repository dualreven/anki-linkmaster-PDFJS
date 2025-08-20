# Anki LinkMaster PDFJS - task2-homepageDev 任务文档

## 1. 任务概述

本任务文档详细描述了修复PDF主页功能缺陷的具体实现步骤，包括前端WebSocket消息处理修复、后端WebSocket消息处理逻辑实现、各类消息处理方法实现、错误处理机制完善以及集成测试与验证等内容。

## 2. 任务详情

### T2-001：修复前端WebSocket消息处理

**任务描述**：修复main.js中的removePDF方法递归调用问题，确保handleFileSelect方法正确处理浏览器环境下的文件路径。

**实现步骤**：

1. 打开文件 `src/frontend/pdf-home/main.js`

2. 修复 `removePDF` 方法的递归调用问题：
   - 移除重复定义的 `removePDF` 方法
   - 保留带有确认对话框的版本，并确保其正确实现

3. 优化 `handleFileSelect` 方法，确保正确处理浏览器环境下的文件路径：
   - 由于浏览器安全限制，无法直接获取文件的完整本地路径
   - 修改消息格式，确保传递足够的信息给后端

**代码修改建议**：

```javascript
// 修复前
removePDF(filename) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
            type: 'remove_pdf',
            filename: filename
        }));
    }
}

// ... 其他代码 ...

removePDF(filename) {
    if (confirm('确定要删除这个PDF文件吗？')) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'remove_pdf',
                filename: filename
            }));
        }
    }
}

// 修复后
removePDF(filename) {
    if (confirm('确定要删除这个PDF文件吗？')) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'remove_pdf',
                filename: filename
            }));
        }
    }
}

// 优化handleFileSelect方法
handleFileSelect(event) {
    const files = Array.from(event.target.files);
    files.forEach(file => {
        if (file.type === 'application/pdf') {
            // 在浏览器中，我们不能直接获取文件路径，需要通过其他方式
            // 这里简单处理，仅发送文件名，实际文件处理需要后端支持
            this.addPDF(file.name);
        }
    });
    event.target.value = ''; // 重置文件输入
}
```

### T2-002：实现后端WebSocket消息处理逻辑

**任务描述**：在application.py中连接websocket_server.message_received信号，实现消息处理函数。

**实现步骤**：

1. 打开文件 `src/backend/app/application.py`

2. 在 `run` 方法中，添加对 `setup_websocket_handlers` 方法的调用

3. 实现 `setup_websocket_handlers` 方法，连接 `websocket_server.message_received` 信号

4. 实现 `handle_websocket_message` 方法，根据消息类型调用相应的处理函数

**代码修改建议**：

```python
def run(self):
    """运行应用"""
    # 初始化PDF管理器
    self.pdf_manager = PDFManager()
    logger.info("PDF管理器初始化成功")
    
    # 初始化并启动WebSocket服务器
    self.websocket_server = WebSocketServer(host="127.0.0.1", port=8765)
    if self.websocket_server.start():
        logger.info("WebSocket服务器启动成功")
        # 设置WebSocket消息处理器
        self.setup_websocket_handlers()
    else:
        logger.error("WebSocket服务器启动失败")
    
    # 初始化主窗口
    self.main_window = MainWindow()
    # 加载前端页面，使用Vite配置的端口和正确的入口路径
    self.main_window.load_frontend("http://localhost:3000/pdf-home/index.html")
    self.main_window.show()


def setup_websocket_handlers(self):
    """设置WebSocket消息处理器"""
    self.websocket_server.message_received.connect(self.handle_websocket_message)
    logger.info("WebSocket消息处理器设置成功")


def handle_websocket_message(self, client_id, message):
    """处理WebSocket消息
    
    Args:
        client_id: 客户端ID
        message: 消息内容（已解析为字典）
    """
    try:
        message_type = message.get('type')
        if message_type == 'add_pdf':
            self.handle_add_pdf(client_id, message)
        elif message_type == 'get_pdf_list':
            self.handle_get_pdf_list(client_id)
        elif message_type == 'remove_pdf':
            self.handle_remove_pdf(client_id, message)
        else:
            logger.warning(f"未知的消息类型: {message_type}")
            self.send_error_response(client_id, "未知的消息类型", message_type)
    except Exception as e:
        logger.error(f"处理WebSocket消息时发生错误: {e}")
        self.send_error_response(client_id, f"服务器内部错误: {str(e)}", message.get('type'))


def send_response(self, client_id, data, original_message_id=None):
    """发送响应消息
    
    Args:
        client_id: 客户端ID
        data: 响应数据
        original_message_id: 原始消息ID
    """
    response = {
        **data,
        'id': original_message_id
    }
    self.websocket_server.send_message(client_id, json.dumps(response))


def send_success_response(self, client_id, original_type, result=None, original_message_id=None):
    """发送成功响应
    
    Args:
        client_id: 客户端ID
        original_type: 原始消息类型
        result: 操作结果
        original_message_id: 原始消息ID
    """
    response_data = {
        'type': 'success',
        'data': {
            'original_type': original_type,
            'result': result or {}
        }
    }
    self.send_response(client_id, response_data, original_message_id)


def send_error_response(self, client_id, error_message, original_type=None, error_code="SERVER_ERROR", original_message_id=None):
    """发送错误响应
    
    Args:
        client_id: 客户端ID
        error_message: 错误消息
        original_type: 原始消息类型
        error_code: 错误码
        original_message_id: 原始消息ID
    """
    response_data = {
        'type': 'error',
        'data': {
            'original_type': original_type,
            'code': error_code,
            'message': error_message
        }
    }
    self.send_response(client_id, response_data, original_message_id)
```

### T2-003：实现add_pdf消息处理

**任务描述**：实现handle_add_pdf方法，处理前端发送的添加PDF文件请求。

**实现步骤**：

1. 在 `application.py` 中实现 `handle_add_pdf` 方法

2. 解析消息中的文件信息，调用 `PDFManager.add_file` 方法添加文件

3. 处理操作结果，发送成功或失败响应

**代码修改建议**：

```python
def handle_add_pdf(self, client_id, message):
    """处理添加PDF文件请求
    
    Args:
        client_id: 客户端ID
        message: 消息内容
    """
    try:
        # 从消息中获取文件信息
        file_path = message.get('path')
        if not file_path:
            self.send_error_response(client_id, "文件路径不能为空", "add_pdf", "INVALID_PARAMS", message.get('id'))
            return
        
        # 调用PDF管理器添加文件
        success = self.pdf_manager.add_file(file_path)
        
        if success:
            logger.info(f"成功添加PDF文件: {file_path}")
            self.send_success_response(client_id, "add_pdf", {"success": True}, message.get('id'))
            
            # 通知所有客户端PDF列表已更新
            self.broadcast_pdf_list_updated()
        else:
            self.send_error_response(client_id, "添加文件失败", "add_pdf", "FILE_ADD_FAILED", message.get('id'))
    except Exception as e:
        logger.error(f"添加PDF文件时发生错误: {e}")
        self.send_error_response(client_id, f"添加文件时发生错误: {str(e)}", "add_pdf", "FILE_ADD_ERROR", message.get('id'))


def broadcast_pdf_list_updated(self):
    """广播PDF列表更新消息给所有客户端"""
    pdf_list = self.pdf_manager.get_files()
    message = {
        'type': 'pdf_list_updated',
        'data': {
            'files': pdf_list
        }
    }
    self.websocket_server.broadcast_message(json.dumps(message))
```

### T2-004：实现get_pdf_list消息处理

**任务描述**：实现handle_get_pdf_list方法，处理前端发送的获取PDF列表请求。

**实现步骤**：

1. 在 `application.py` 中实现 `handle_get_pdf_list` 方法

2. 调用 `PDFManager.get_files` 方法获取PDF文件列表

3. 发送PDF列表给客户端

**代码修改建议**：

```python
def handle_get_pdf_list(self, client_id):
    """处理获取PDF列表请求
    
    Args:
        client_id: 客户端ID
    """
    try:
        # 调用PDF管理器获取文件列表
        pdf_list = self.pdf_manager.get_files()
        
        logger.info(f"获取PDF列表成功，共 {len(pdf_list)} 个文件")
        
        # 构造响应数据
        response_data = {
            'type': 'pdf_list',
            'pdfs': pdf_list
        }
        
        # 发送响应
        self.websocket_server.send_message(client_id, json.dumps(response_data))
    except Exception as e:
        logger.error(f"获取PDF列表时发生错误: {e}")
        self.send_error_response(client_id, f"获取文件列表时发生错误: {str(e)}", "get_pdf_list", "LIST_GET_ERROR")
```

### T2-005：实现remove_pdf消息处理

**任务描述**：实现handle_remove_pdf方法，处理前端发送的删除PDF文件请求。

**实现步骤**：

1. 在 `application.py` 中实现 `handle_remove_pdf` 方法

2. 解析消息中的文件信息，调用 `PDFManager.remove_file` 方法删除文件

3. 处理操作结果，发送成功或失败响应

**代码修改建议**：

```python
def handle_remove_pdf(self, client_id, message):
    """处理删除PDF文件请求
    
    Args:
        client_id: 客户端ID
        message: 消息内容
    """
    try:
        # 从消息中获取文件名
        filename = message.get('filename')
        if not filename:
            self.send_error_response(client_id, "文件名不能为空", "remove_pdf", "INVALID_PARAMS", message.get('id'))
            return
        
        # 找到对应的文件ID
        pdf_files = self.pdf_manager.get_files()
        file_to_remove = None
        for pdf_file in pdf_files:
            if pdf_file.get('filename') == filename:
                file_to_remove = pdf_file
                break
        
        if not file_to_remove:
            self.send_error_response(client_id, f"文件不存在: {filename}", "remove_pdf", "FILE_NOT_FOUND", message.get('id'))
            return
        
        # 调用PDF管理器删除文件
        success = self.pdf_manager.remove_file(file_to_remove.get('id'))
        
        if success:
            logger.info(f"成功删除PDF文件: {filename}")
            self.send_success_response(client_id, "remove_pdf", {"success": True}, message.get('id'))
            
            # 通知所有客户端PDF列表已更新
            self.broadcast_pdf_list_updated()
        else:
            self.send_error_response(client_id, "删除文件失败", "remove_pdf", "FILE_REMOVE_FAILED", message.get('id'))
    except Exception as e:
        logger.error(f"删除PDF文件时发生错误: {e}")
        self.send_error_response(client_id, f"删除文件时发生错误: {str(e)}", "remove_pdf", "FILE_REMOVE_ERROR", message.get('id'))
```

### T2-006：完善错误处理机制

**任务描述**：实现统一的错误处理机制，确保前后端能够正确处理各类异常情况。

**实现步骤**：

1. 在前端 `main.js` 中，完善 `handleWebSocketMessage` 方法中的错误处理逻辑

2. 在后端 `application.py` 中，确保所有方法都有适当的异常捕获和错误处理

3. 定义统一的错误码和错误消息格式

**代码修改建议**：

前端错误处理完善：

```javascript
handleWebSocketMessage(data) {
    switch (data.type) {
        case 'pdf_list':
            this.updatePDFList(data.pdfs);
            break;
        case 'pdf_added':
            this.addPDFToList(data.pdf);
            break;
        case 'pdf_removed':
            this.removePDFFromList(data.filename);
            break;
        case 'pdf_list_updated':
            this.updatePDFList(data.data.files);
            break;
        case 'success':
            // 处理成功响应
            console.log('操作成功:', data);
            break;
        case 'error':
            // 显示详细的错误信息
            const errorDetails = data.data;
            const errorMessage = errorDetails.message || '操作失败';
            const originalType = errorDetails.original_type || '未知操作';
            const errorCode = errorDetails.code || 'UNKNOWN_ERROR';
            
            console.error(`错误(${errorCode}): ${errorMessage} (操作类型: ${originalType})`);
            this.showError(errorMessage);
            break;
        default:
            console.warn('未知的消息类型:', data.type);
    }
}
```

后端错误处理完善（在application.py中添加以下内容）：

```python
# 在文件顶部导入必要的模块
import json
import traceback

# 添加错误码常量定义
class ErrorCodes:
    INVALID_FILE = "INVALID_FILE"
    FILE_NOT_FOUND = "FILE_NOT_FOUND"
    FILE_ACCESS_DENIED = "FILE_ACCESS_DENIED"
    INVALID_FORMAT = "INVALID_FORMAT"
    INVALID_MESSAGE_TYPE = "INVALID_MESSAGE_TYPE"
    SERVER_ERROR = "SERVER_ERROR"
    INVALID_PARAMS = "INVALID_PARAMS"
    FILE_ADD_FAILED = "FILE_ADD_FAILED"
    FILE_ADD_ERROR = "FILE_ADD_ERROR"
    FILE_REMOVE_FAILED = "FILE_REMOVE_FAILED"
    FILE_REMOVE_ERROR = "FILE_REMOVE_ERROR"
    LIST_GET_ERROR = "LIST_GET_ERROR"

# 优化异常处理逻辑
def handle_websocket_message(self, client_id, message):
    """处理WebSocket消息
    
    Args:
        client_id: 客户端ID
        message: 消息内容（已解析为字典）
    """
    try:
        # 处理消息...
    except json.JSONDecodeError:
        logger.error("接收到无效的JSON格式消息")
        self.send_error_response(client_id, "无效的消息格式", None, ErrorCodes.INVALID_FORMAT)
    except KeyError as e:
        logger.error(f"消息缺少必要的字段: {e}")
        self.send_error_response(client_id, f"消息缺少必要的字段: {str(e)}", message.get('type'), ErrorCodes.INVALID_PARAMS, message.get('id'))
    except Exception as e:
        logger.error(f"处理WebSocket消息时发生错误: {e}\n{traceback.format_exc()}")
        self.send_error_response(client_id, f"服务器内部错误: {str(e)}", message.get('type'), ErrorCodes.SERVER_ERROR, message.get('id'))
```

### T2-007：集成测试与验证

**任务描述**：对修复的功能进行全面测试，确保所有功能都能按照预期工作。

**测试步骤**：

1. **功能测试**：
   - 启动应用程序，确保WebSocket服务器正常启动
   - 打开前端页面，确保WebSocket连接正常建立
   - 尝试添加PDF文件，检查是否能够成功添加并显示在列表中
   - 尝试删除PDF文件，检查是否能够成功删除并从列表中移除
   - 刷新页面，检查PDF列表是否能够正确加载

2. **异常测试**：
   - 尝试添加非PDF文件，检查是否能够正确提示错误
   - 尝试添加不存在的文件路径，检查是否能够正确提示错误
   - 尝试删除不存在的文件，检查是否能够正确提示错误
   - 模拟WebSocket连接断开，检查是否能够正确处理和恢复

3. **性能测试**：
   - 尝试添加多个PDF文件，检查列表刷新速度
   - 尝试添加大尺寸的PDF文件，检查添加速度和响应时间

**测试工具和方法**：
   - 使用浏览器的开发者工具查看控制台输出和网络请求
   - 使用PyQt的日志功能查看后端日志
   - 手动测试和自动化测试相结合

### T2-008：文档更新

**任务描述**：更新相关文档，确保文档与代码实现一致。

**实现步骤**：

1. 更新 `README.md` 文件，添加关于PDF主页功能的说明和使用方法

2. 更新 `docs/task2-homepageDev/step1_CONSENSUS_task2-homepageDev.md` 文件，补充最终的实现细节

3. 更新 `docs/task2-homepageDev/step2_DESIGN_task2-homepageDev.md` 文件，确保设计文档与实际实现一致

4. 更新 `docs/task2-homepageDev/step3_TASK_DEPENDENCY_task2-homepageDev.md` 和 `docs/task2-homepageDev/step3_TASK_task2-homepageDev.md` 文件，记录实际的开发进度和实现细节

**文档更新建议**：
   - 清晰描述PDF主页的功能和使用方法
   - 详细说明前后端的通信协议和消息格式
   - 记录常见问题和解决方案
   - 添加示例代码和截图（可选）

## 3. 总结

通过完成以上任务，我们将修复PDF主页的功能缺陷，确保能够正常地展示和管理PDF文件。任务的关键在于实现后端的WebSocket消息处理逻辑，将WebSocket消息与PDF管理器的操作正确连接起来，并确保前端能够正确处理各类消息和异常情况。

同时，我们还需要对修复的功能进行全面测试，确保所有功能都能按照预期工作，并及时更新相关文档，确保文档与代码实现一致。