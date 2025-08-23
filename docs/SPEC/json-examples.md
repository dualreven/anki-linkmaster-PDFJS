# JSON标准示例

## 基础示例

### 获取PDF列表
```json
// 请求
{
  "type": "get_pdf_list",
  "timestamp": 1635768000.123,
  "request_id": "req-123",
  "data": {"page": 1, "per_page": 20}
}

// 响应
{
  "type": "pdf_list",
  "timestamp": 1635768000.456,
  "request_id": "req-123",
  "status": "success",
  "code": 200,
  "data": {
    "files": [{
      "id": "abc123",
      "filename": "test.pdf",
      "page_count": 10,
      "file_size": 1024000
    }],
    "pagination": {"total": 1}
  }
}
```

### 上传PDF
```json
// 请求
{
  "type": "add_pdf",
  "request_id": "req-456",
  "data": {"filename": "doc.pdf", "file_size": 2048000}
}

// 响应
{
  "type": "pdf_added",
  "request_id": "req-456",
  "status": "success",
  "code": 201,
  "data": {"file": {"id": "xyz789", "filename": "doc.pdf"}}
}
```

### 错误响应
```json
{
  "type": "response",
  "request_id": "req-789",
  "status": "error",
  "code": 404,
  "message": "文件不存在",
  "error": {
    "type": "not_found",
    "message": "PDF文件未找到"
  }
}
```

## 代码示例

### 前端发送请求
```javascript
// 发送消息
const send = (type, data) => ({
  type,
  timestamp: Date.now()/1000,
  request_id: 'req_' + Math.random().toString(36).substr(2,9),
  data
});

// 使用
const message = send('get_pdf_list', {page: 1});
```

### 后端构建响应
```python
# Python
import json, time, uuid

def response(request_id, status="success", code=200, message="", data=None):
    return json.dumps({
        "type": "response",
        "timestamp": time.time(),
        "request_id": request_id,
        "status": status,
        "code": code,
        "message": message,
        "data": data or {}
    })
```

### 错误处理
```javascript
// 统一错误处理
const errors = {
  400: "参数错误",
  404: "未找到",
  500: "服务器错误"
};

const handleError = (response) => {
  console.error(errors[response.code] || response.message);
};
```