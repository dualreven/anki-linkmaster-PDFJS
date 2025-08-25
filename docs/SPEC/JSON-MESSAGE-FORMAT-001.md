- **规范名称**: JSON消息格式规范
- **规范描述**: 定义JSON通信消息的标准格式，包括基础消息结构和响应结构，确保消息的一致性和可解析性。
- **当前版本**: 1.0
- **所属范畴**: API规范
- **适用范围**: 所有前后端JSON通信消息
- **详细内容**: 
  - 基础消息必须包含以下字段：type, timestamp, request_id, data, metadata
  - 响应消息必须包含以下字段：type, timestamp, request_id, status, code, message, data, error
  - type字段表示消息类型，必须是字符串
  - timestamp字段使用Unix时间戳（秒级精度）
  - request_id字段使用UUID格式的唯一标识符
  - data字段包含主要的业务数据
  - metadata字段包含额外的元数据信息
  - status字段表示请求状态：success, error, pending

- **正向例子**:
  ```json
  // 基础请求消息
  {
    "type": "get_pdf_list",
    "timestamp": 1635768000.123,
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "data": {"page": 1, "per_page": 20},
    "metadata": {"version": "1.0"}
  }

  // 获取PDF列表响应
  {
    "type": "pdf_list",
    "timestamp": 1635768000.456,
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
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

  // 上传PDF请求
  {
    "type": "add_pdf",
    "request_id": "req-456",
    "data": {"filename": "doc.pdf", "file_size": 2048000}
  }

  // 上传PDF响应
  {
    "type": "pdf_added",
    "request_id": "req-456",
    "status": "success",
    "code": 201,
    "data": {"file": {"id": "xyz789", "filename": "doc.pdf"}}
  }
  ```

- **反向例子**:
  ```json
  // 错误：缺少必需字段
  {
    "type": "get_pdf_list",
    "timestamp": 1635768000.123
    // 缺少 request_id 和 data 字段
  }

  // 错误：字段类型不正确
  {
    "type": "get_pdf_list",
    "timestamp": "2023-11-01", // 应该是数字时间戳
    "request_id": 12345, // 应该是字符串UUID
    "data": {"page": 1}
  }

  // 错误：响应状态格式错误
  {
    "type": "response",
    "status": "SUCCESS", // 应该使用小写
    "code": 200,
    "data": {}
  }