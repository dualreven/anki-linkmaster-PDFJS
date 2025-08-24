<!-- SPEC-JSON-EXAMPLE-001.md -->
- 规范名称: JSON标准示例
- 规范描述: 提供项目中JSON通信的具体示例，展示各种场景下的标准消息格式
- 当前版本: 1.0
- 所属范畴: 编码规范
- 适用范围: 全项目所有JSON格式数据通信的参考实现
- 正向例子:
  ```json
  // 示例1：获取PDF列表请求与响应
  
  // 请求
  {
    "type": "get_pdf_list",
    "timestamp": 1635768000.123,
    "request_id": "req-123",
    "data": {
      "page": 1,
      "per_page": 20,
      "filter": {
        "status": "active",
        "created_after": "2024-01-01T00:00:00Z"
      }
    },
    "metadata": {
      "client_version": "1.0.0",
      "user_id": "user-456"
    }
  }
  
  // 响应
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
          "mime_type": "application/pdf",
          "created_at": "2024-01-01T00:00:00Z",
          "updated_at": "2024-01-01T00:00:00Z",
          "status": "active"
        },
        {
          "id": "def456",
          "filename": "document.pdf",
          "page_count": 25,
          "file_size": 2560000,
          "mime_type": "application/pdf",
          "created_at": "2024-01-02T00:00:00Z",
          "updated_at": "2024-01-02T00:00:00Z",
          "status": "active"
        }
      ],
      "pagination": {
        "total": 2,
        "page": 1,
        "per_page": 20,
        "total_pages": 1
      }
    }
  }
  
  // 示例2：上传PDF请求与响应
  
  // 请求
  {
    "type": "add_pdf",
    "timestamp": 1635768001.123,
    "request_id": "req-456",
    "data": {
      "filename": "new-document.pdf",
      "file_size": 3072000,
      "mime_type": "application/pdf",
      "checksum": "sha256:abc123..."
    },
    "metadata": {
      "upload_session": "session-789"
    }
  }
  
  // 响应
  {
    "type": "pdf_added",
    "timestamp": 1635768001.456,
    "request_id": "req-456",
    "status": "success",
    "code": 201,
    "message": "PDF文件添加成功",
    "data": {
      "file": {
        "id": "ghi789",
        "filename": "new-document.pdf",
        "file_size": 3072000,
        "page_count": 0,
        "status": "processing",
        "created_at": "2024-01-03T00:00:00Z",
        "updated_at": "2024-01-03T00:00:00Z"
      },
      "upload_url": "https://example.com/upload/ghi789",
      "expires_at": "2024-01-03T00:05:00Z"
    }
  }
  
  // 示例3：删除PDF请求与响应
  
  // 请求
  {
    "type": "remove_pdf",
    "timestamp": 1635768002.123,
    "request_id": "req-789",
    "data": {
      "file_id": "abc123"
    }
  }
  
  // 响应
  {
    "type": "pdf_removed",
    "timestamp": 1635768002.456,
    "request_id": "req-789",
    "status": "success",
    "code": 200,
    "message": "PDF文件删除成功",
    "data": {
      "removed_file": {
        "id": "abc123",
        "filename": "test.pdf"
      }
    }
  }
  
  // 示例4：错误响应
  
  // 请求
  {
    "type": "get_pdf_list",
    "timestamp": 1635768003.123,
    "request_id": "req-999",
    "data": {
      "page": -1  // 无效的页码
    }
  }
  
  // 响应
  {
    "type": "response",
    "timestamp": 1635768003.456,
    "request_id": "req-999",
    "status": "error",
    "code": 400,
    "message": "参数错误",
    "error": {
      "type": "validation_error",
      "message": "页码必须大于0",
      "details": {
        "field": "page",
        "value": -1,
        "constraint": "min",
        "expected": ">= 1"
      }
    }
  }
  
  // 示例5：文件不存在错误
  
  // 请求
  {
    "type": "remove_pdf",
    "timestamp": 1635768004.123,
    "request_id": "req-000",
    "data": {
      "file_id": "nonexistent-id"
    }
  }
  
  // 响应
  {
    "type": "response",
    "timestamp": 1635768004.456,
    "request_id": "req-000",
    "status": "error",
    "code": 404,
    "message": "文件不存在",
    "error": {
      "type": "not_found",
      "message": "PDF文件未找到",
      "details": {
        "file_id": "nonexistent-id",
        "searched_locations": [
          "/storage/pdfs",
          "/storage/temp"
        ]
      }
    }
  }
  
  // 示例6：心跳请求与响应
  
  // 请求
  {
    "type": "heartbeat",
    "timestamp": 1635768005.123,
    "request_id": "req-111",
    "data": {
      "client_id": "client-123",
      "status": "active",
      "version": "1.0.0"
    }
  }
  
  // 响应
  {
    "type": "heartbeat_response",
    "timestamp": 1635768005.456,
    "request_id": "req-111",
    "status": "success",
    "code": 200,
    "message": "心跳正常",
    "data": {
      "server_time": "2024-01-01T00:00:00Z",
      "server_status": "healthy",
      "server_version": "1.0.0",
      "uptime": 86400
    }
  }
  ```
  
  ```javascript
  // 前端实现示例
  
  // 消息发送工具类
  class JsonMessageClient {
    constructor(baseUrl = '/api') {
      this.baseUrl = baseUrl;
      this.requestId = 0;
    }
    
    // 生成请求ID
    generateRequestId() {
      return `req_${++this.requestId}_${Date.now()}`;
    }
    
    // 发送请求
    async sendRequest(type, data = {}, metadata = {}) {
      const message = {
        type,
        timestamp: Date.now() / 1000,
        request_id: this.generateRequestId(),
        data,
        metadata
      };
      
      try {
        const response = await fetch(`${this.baseUrl}/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(message)
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('请求发送失败:', error);
        throw error;
      }
    }
    
    // 获取PDF列表
    async getPdfList(page = 1, perPage = 20, filter = {}) {
      return this.sendRequest('get_pdf_list', {
        page,
        per_page: perPage,
        filter
      });
    }
    
    // 添加PDF
    async addPdf(filename, fileSize, mimeType, checksum) {
      return this.sendRequest('add_pdf', {
        filename,
        file_size: fileSize,
        mime_type: mimeType,
        checksum
      });
    }
    
    // 删除PDF
    async removePdf(fileId) {
      return this.sendRequest('remove_pdf', {
        file_id: fileId
      });
    }
    
    // 发送心跳
    async sendHeartbeat(clientId, status = 'active') {
      return this.sendRequest('heartbeat', {
        client_id: clientId,
        status,
        version: '1.0.0'
      });
    }
  }
  
  // 使用示例
  const client = new JsonMessageClient();
  
  // 获取PDF列表
  async function loadPdfList() {
    try {
      const response = await client.getPdfList(1, 20);
      
      if (response.status === 'success') {
        console.log('PDF列表:', response.data.files);
        return response.data.files;
      } else {
        console.error('获取PDF列表失败:', response.message);
        throw new Error(response.message);
      }
    } catch (error) {
      console.error('加载PDF列表出错:', error);
      throw error;
    }
  }
  
  // 上传PDF
  async function uploadPdf(file) {
    try {
      const response = await client.addPdf(
        file.name,
        file.size,
        file.type,
        await calculateChecksum(file)
      );
      
      if (response.status === 'success') {
        console.log('PDF添加成功:', response.data.file);
        return response.data;
      } else {
        console.error('PDF添加失败:', response.message);
        throw new Error(response.message);
      }
    } catch (error) {
      console.error('上传PDF出错:', error);
      throw error;
    }
  }
  
  // 计算文件校验和
  async function calculateChecksum(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const buffer = e.target.result;
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        resolve(`sha256:${hashHex}`);
      };
      reader.readAsArrayBuffer(file);
    });
  }
  ```
  
  ```python
  # 后端实现示例
  
  import json
  import time
  from typing import Dict, Any, Optional
  from datetime import datetime
  
  class JsonMessageHandler:
    def __init__(self):
      self.handlers = {
        'get_pdf_list': self.handle_get_pdf_list,
        'add_pdf': self.handle_add_pdf,
        'remove_pdf': self.handle_remove_pdf,
        'heartbeat': self.handle_heartbeat
      }
    
    def handle_message(self, message_str: str) -> str:
      """处理接收到的消息"""
      try:
        message = json.loads(message_str)
        
        # 验证消息格式
        if not self.validate_message(message):
          return self.create_error_response(
            message.get('request_id', ''),
            'invalid_message',
            '消息格式无效'
          )
        
        # 获取处理器
        handler = self.handlers.get(message['type'])
        if not handler:
          return self.create_error_response(
            message.get('request_id', ''),
            'unknown_message_type',
            f'未知的消息类型: {message["type"]}'
          )
        
        # 处理消息
        return handler(message)
        
      except json.JSONDecodeError:
        return self.create_error_response(
          '',
          'invalid_json',
          'JSON格式错误'
        )
      except Exception as e:
        return self.create_error_response(
          message.get('request_id', '') if 'message' in locals() else '',
          'server_error',
          '服务器内部错误',
          {'exception': str(e)}
        )
    
    def validate_message(self, message: Dict) -> bool:
      """验证消息格式"""
      required_fields = ['type', 'timestamp', 'request_id']
      return all(field in message for field in required_fields)
    
    def create_success_response(
      self,
      request_id: str,
      response_type: str,
      data: Any = None,
      message: str = "操作成功",
      code: int = 200
    ) -> str:
      """创建成功响应"""
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
    
    def create_error_response(
      self,
      request_id: str,
      error_type: str,
      message: str,
      details: Optional[Dict] = None,
      code: int = 500
    ) -> str:
      """创建错误响应"""
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
    
    def handle_get_pdf_list(self, message: Dict) -> str:
      """处理获取PDF列表请求"""
      request_id = message['request_id']
      data = message.get('data', {})
      
      # 验证参数
      page = data.get('page', 1)
      if page < 1:
        return self.create_error_response(
          request_id,
          'validation_error',
          '页码必须大于0',
          {'field': 'page', 'value': page, 'constraint': 'min', 'expected': '>= 1'},
          400
        )
      
      per_page = data.get('per_page', 20)
      if per_page < 1 or per_page > 100:
        return self.create_error_response(
          request_id,
          'validation_error',
          '每页数量必须在1-100之间',
          {'field': 'per_page', 'value': per_page, 'constraint': 'range', 'expected': '1-100'},
          400
        )
      
      # 获取PDF列表（模拟）
      pdf_files = [
        {
          "id": "abc123",
          "filename": "test.pdf",
          "page_count": 10,
          "file_size": 1024000,
          "mime_type": "application/pdf",
          "created_at": "2024-01-01T00:00:00Z",
          "updated_at": "2024-01-01T00:00:00Z",
          "status": "active"
        }
      ]
      
      response_data = {
        "files": pdf_files,
        "pagination": {
          "total": len(pdf_files),
          "page": page,
          "per_page": per_page,
          "total_pages": 1
        }
      }
      
      return self.create_success_response(
        request_id,
        "pdf_list",
        response_data,
        "获取PDF列表成功",
        200
      )
    
    def handle_heartbeat(self, message: Dict) -> str:
      """处理心跳请求"""
      request_id = message['request_id']
      data = message.get('data', {})
      
      response_data = {
        "server_time": datetime.utcnow().isoformat() + 'Z',
        "server_status": "healthy",
        "server_version": "1.0.0",
        "uptime": 86400
      }
      
      return self.create_success_response(
        request_id,
        "heartbeat_response",
        response_data,
        "心跳正常",
        200
      )
  
  # 使用示例
  handler = JsonMessageHandler()
  
  # 模拟处理消息
  request_message = json.dumps({
    "type": "get_pdf_list",
    "timestamp": time.time(),
    "request_id": "req-123",
    "data": {
      "page": 1,
      "per_page": 20
    }
  })
  
  response = handler.handle_message(request_message)
  print("响应:", response)
  ```
- 反向例子:
  ```json
  // 错误的JSON示例
  
  // 缺少必要字段的请求
  {
    "type": "get_pdf_list",
    // 缺少timestamp字段
    // 缺少request_id字段
    "data": {
      "page": 1
    }
  }
  
  // 不一致的字段命名
  {
    "type": "get_pdf_list",
    "timestamp": 1635768000.123,
    "request_id": "req-123",
    "data": {
      "pageNumber": 1,        // 应该是page
      "itemsPerPage": 20,     // 应该是per_page
      "filters": {            // 应该是filter
        "fileStatus": "active" // 应该是status
      }
    }
  }
  
  // 错误的数据类型
  {
    "type": "add_pdf",
    "timestamp": "1635768001.123",  // 应该是数字
    "request_id": 123,              // 应该是字符串
    "data": {
      "filename": true,             // 应该是字符串
      "fileSize": "2048000",        // 应该是数字
      "mimeType": ["application/pdf"] // 应该是字符串
    }
  }
  
  // 不完整的错误响应
  {
    "type": "response",
    "timestamp": 1635768003.456,
    "request_id": "req-999",
    "status": "error",
    "code": 400,
    // 缺少message字段
    "error": {
      // 缺少type字段
      "message": "页码必须大于0"
      // 缺少details字段
    }
  }
  
  // 不正确的分页结构
  {
    "type": "pdf_list",
    "timestamp": 1635768000.456,
    "request_id": "req-123",
    "status": "success",
    "code": 200,
    "message": "获取PDF列表成功",
    "data": {
      "files": [],
      "pagination": {
        "total": 0,
        "currentPage": 1,        // 应该是page
        "itemsPerPage": 20,      // 应该是per_page
        "totalPages": 0          // 应该是total_pages
      }
    }
  }
  ```
  
  ```javascript
  // 错误的前端实现示例
  
  // 硬编码请求ID
  function sendRequest(type, data) {
    const message = {
      type,
      timestamp: Date.now() / 1000,
      request_id: "fixed-id",  // 硬编码，可能导致冲突
      data
    };
    
    return fetch('/api/message', {
      method: 'POST',
      body: JSON.stringify(message)  // 缺少Content-Type头
    });
  }
  
  // 不一致的响应处理
  function handleResponse(response) {
    if (response.code === 200) {
      return response.data;
    } else if (response.error) {  // 不一致的检查方式
      throw new Error(response.error.message);
    }
  }
  
  // 缺少错误处理
  async function getPdfList() {
    const response = await fetch('/api/pdf/list');
    return response.json();  // 如果response不是JSON，会抛出异常
  }
  ```
  
  ```python
  # 错误的后端实现示例
  
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