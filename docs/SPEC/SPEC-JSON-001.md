<!-- SPEC-JSON-001.md -->
- 规范名称: JSON通信标准
- 规范描述: 规定项目中JSON消息的格式、结构和处理规范，确保前后端通信的一致性和可靠性
- 当前版本: 1.0
- 所属范畴: 编码规范
- 适用范围: 全项目所有JSON格式的数据通信
- 正向例子:
  ```json
  // 基础请求结构
  {
    "type": "get_pdf_list",
    "timestamp": 1635768000.123,
    "request_id": "req-123",
    "data": {
      "page": 1,
      "per_page": 20,
      "filter": {
        "status": "active"
      }
    },
    "metadata": {
      "client_version": "1.0.0",
      "user_id": "user-456"
    }
  }
  
  // 成功响应结构
  {
    "type": "pdf_list",
    "timestamp": 1635768000.456,
    "request_id": "req-123",
    "status": "success",
    "code": 200,
    "message": "获取PDF列表成功",
    "data": {
      "files": [
        {
          "id": "abc123",
          "filename": "test.pdf",
          "page_count": 10,
          "file_size": 1024000,
          "created_at": "2024-01-01T00:00:00Z",
          "updated_at": "2024-01-01T00:00:00Z"
        }
      ],
      "pagination": {
        "total": 1,
        "page": 1,
        "per_page": 20,
        "total_pages": 1
      }
    }
  }
  
  // 错误响应结构
  {
    "type": "response",
    "timestamp": 1635768000.789,
    "request_id": "req-123",
    "status": "error",
    "code": 404,
    "message": "文件不存在",
    "error": {
      "type": "not_found",
      "message": "PDF文件未找到",
      "details": {
        "file_id": "abc123",
        "search_path": "/path/to/files"
      }
    }
  }
  
  // PDF管理相关消息
  {
    "type": "add_pdf",
    "timestamp": 1635768001.123,
    "request_id": "req-456",
    "data": {
      "filename": "document.pdf",
      "file_size": 2048000,
      "mime_type": "application/pdf"
    }
  }
  
  // PDF添加成功响应
  {
    "type": "pdf_added",
    "timestamp": 1635768001.456,
    "request_id": "req-456",
    "status": "success",
    "code": 201,
    "message": "PDF文件添加成功",
    "data": {
      "file": {
        "id": "xyz789",
        "filename": "document.pdf",
        "file_size": 2048000,
        "created_at": "2024-01-01T00:00:00Z"
      }
    }
  }
  
  // 心跳消息
  {
    "type": "heartbeat",
    "timestamp": 1635768002.123,
    "request_id": "req-789",
    "data": {
      "client_id": "client-123",
      "status": "active"
    }
  }
  
  // 心跳响应
  {
    "type": "heartbeat_response",
    "timestamp": 1635768002.456,
    "request_id": "req-789",
    "status": "success",
    "code": 200,
    "message": "心跳正常",
    "data": {
      "server_time": "2024-01-01T00:00:00Z",
      "server_status": "healthy"
    }
  }
  ```
  
  ```javascript
  // 前端发送请求的封装函数
  class MessageSender {
    constructor() {
      this.requestIdCounter = 0;
    }
    
    // 创建标准请求消息
    createRequest(type, data = {}, metadata = {}) {
      return {
        type,
        timestamp: Date.now() / 1000,
        request_id: `req_${this.requestIdCounter++}`,
        data,
        metadata
      };
    }
    
    // 发送消息
    async send(type, data = {}, metadata = {}) {
      const message = this.createRequest(type, data, metadata);
      
      try {
        const response = await fetch('/api/message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(message)
        });
        
        return await response.json();
      } catch (error) {
        console.error('发送消息失败:', error);
        throw error;
      }
    }
  }
  
  // 使用示例
  const messageSender = new MessageSender();
  
  // 获取PDF列表
  async function getPdfList(page = 1, perPage = 20) {
    return messageSender.send('get_pdf_list', {
      page,
      per_page: perPage
    });
  }
  
  // 添加PDF
  async function addPdf(filename, fileSize, mimeType) {
    return messageSender.send('add_pdf', {
      filename,
      file_size: fileSize,
      mime_type: mimeType
    });
  }
  ```
  
  ```python
  # 后端构建响应的封装函数
  import json
  import time
  import uuid
  from typing import Dict, Any, Optional
  
  class ResponseBuilder:
    @staticmethod
    def success(
        request_id: str,
        data: Any = None,
        message: str = "操作成功",
        code: int = 200
    ) -> str:
      """构建成功响应"""
      response = {
        "type": "response",
        "timestamp": time.time(),
        "request_id": request_id,
        "status": "success",
        "code": code,
        "message": message,
        "data": data or {}
      }
      return json.dumps(response)
    
    @staticmethod
    def error(
        request_id: str,
        error_type: str,
        message: str,
        details: Optional[Dict] = None,
        code: int = 500
    ) -> str:
      """构建错误响应"""
      response = {
        "type": "response",
        "timestamp": time.time(),
        "request_id": request_id,
        "status": "error",
        "code": code,
        "message": message,
        "error": {
          "type": error_type,
          "message": message,
          "details": details or {}
        }
      }
      return json.dumps(response)
    
    @staticmethod
    def typed_response(
        response_type: str,
        request_id: str,
        data: Any = None,
        message: str = "操作成功",
        code: int = 200
    ) -> str:
      """构建类型化响应"""
      response = {
        "type": response_type,
        "timestamp": time.time(),
        "request_id": request_id,
        "status": "success",
        "code": code,
        "message": message,
        "data": data or {}
      }
      return json.dumps(response)
  
  # 使用示例
  def handle_get_pdf_list(request_data):
    request_id = request_data.get("request_id")
    page = request_data.get("data", {}).get("page", 1)
    per_page = request_data.get("data", {}).get("per_page", 20)
    
    try:
      # 获取PDF列表逻辑
      pdf_files = get_pdf_files_from_db(page, per_page)
      total = get_total_pdf_count()
      
      response_data = {
        "files": pdf_files,
        "pagination": {
          "total": total,
          "page": page,
          "per_page": per_page,
          "total_pages": (total + per_page - 1) // per_page
        }
      }
      
      return ResponseBuilder.typed_response(
        "pdf_list",
        request_id,
        response_data,
        "获取PDF列表成功",
        200
      )
      
    except Exception as e:
      return ResponseBuilder.error(
        request_id,
        "server_error",
        "服务器内部错误",
        {"exception": str(e)},
        500
      )
  ```
- 反向例子:
  ```json
  // 错误的请求结构
  {
    // 缺少type字段
    "timestamp": 1635768000.123,
    "data": {
      "page": 1
    }
  }
  
  // 错误的响应结构
  {
    "type": "pdf_list",
    // 缺少timestamp字段
    "request_id": "req-123",
    // 缺少status字段
    "code": 200,
    // 缺少message字段
    "data": {
      "files": []
    }
  }
  
  // 不一致的字段命名
  {
    "type": "get_pdf_list",
    "timestamp": 1635768000.123,
    "request_id": "req-123",
    "data": {
      "pageNumber": 1,        // 应该是page
      "perPage": 20,          // 应该是per_page
      "filter": {
        "statusType": "active" // 应该是status
      }
    }
  }
  
  // 错误的错误响应结构
  {
    "type": "response",
    "timestamp": 1635768000.789,
    "request_id": "req-123",
    "status": "error",
    "code": 404,
    // 缺少message字段
    "error": {
      // 缺少type字段
      "message": "PDF文件未找到"
      // 缺少details字段
    }
  }
  
  // 不正确的数据类型
  {
    "type": "add_pdf",
    "timestamp": "1635768001.123",  // 应该是数字，不是字符串
    "request_id": 123,              // 应该是字符串，不是数字
    "data": {
      "filename": true,             // 应该是字符串，不是布尔值
      "file_size": "2048000",       // 应该是数字，不是字符串
      "mime_type": ["application/pdf"] // 应该是字符串，不是数组
    }
  }
  
  // 缺少必要字段的响应
  {
    "type": "pdf_added",
    "timestamp": 1635768001.456,
    "request_id": "req-456",
    "status": "success",
    "code": 201,
    "message": "PDF文件添加成功",
    // 缺少data字段
  }
  ```
  
  ```javascript
  // 错误的前端发送请求实现
  // 硬编码请求ID
  function sendRequest(type, data) {
    const message = {
      type,
      timestamp: Date.now() / 1000,
      request_id: "fixed-request-id",  // 硬编码，可能导致冲突
      data
    };
    
    return fetch('/api/message', {
      method: 'POST',
      // 缺少Content-Type头
      body: JSON.stringify(message)
    });
  }
  
  // 缺少错误处理
  async function getPdfList() {
    const response = await fetch('/api/pdf/list');
    return response.json();  // 如果response不是JSON，会抛出异常
  }
  
  // 不一致的响应处理
  function handleResponse(response) {
    if (response.code === 200) {
      return response.data;
    } else if (response.status === 'error') {  // 不一致的检查方式
      throw new Error(response.message);
    }
  }
  ```
  
  ```python
  # 错误的后端响应构建
  # 硬编码响应
  def handle_get_pdf_list(request):
    return json.dumps({
      "type": "pdf_list",
      "data": {"files": []}
      # 缺少多个必要字段
    })
  
  # 不一致的错误处理
  def handle_error(request_id, error):
    if isinstance(error, FileNotFoundError):
      return json.dumps({
        "type": "response",
        "request_id": request_id,
        "status": "error",
        "code": 404,
        "message": "文件不存在"
        # 缺少error字段
      })
    else:
      return json.dumps({
        "type": "response",
        "request_id": request_id,
        "status": "error",
        "code": 500,
        "message": "服务器错误"
        # 缺少error字段
      })
  
  # 不正确的数据序列化
  def handle_add_pdf(request):
    pdf_data = request.get("data")
    
    # 直接返回Python对象，未序列化
    return {
      "type": "pdf_added",
      "request_id": request.get("request_id"),
      "status": "success",
      "data": pdf_data
    }