- **规范名称**: 错误格式规范
- **规范描述**: 定义JSON通信中错误信息的标准格式，包括错误代码、错误消息和详细错误信息的结构，确保错误处理的一致性和可读性。
- **当前版本**: 1.0
- **所属范畴**: API规范
- **适用范围**: 所有JSON通信响应中的错误信息
- **详细内容**: 
  - 错误响应必须包含以下字段：code, message, details
  - code字段必须使用标准的HTTP状态码或自定义错误码
  - message字段必须提供人类可读的错误描述
  - details字段可选，提供详细的错误信息或调试数据
  - 错误信息应该简洁明了，便于开发和调试
  - 自定义错误码应该遵循一致的编号规则

- **正向例子**:
  ```json
  // 标准HTTP错误响应
  {
    "status": "error",
    "code": 400,
    "message": "请求参数无效",
    "details": {
      "field": "filename",
      "reason": "文件格式不支持"
    }
  }

  // 自定义错误码响应
  {
    "status": "error",
    "code": 1001,
    "message": "PDF文件解析失败",
    "details": {
      "filename": "test.pdf",
      "error": "文件损坏或格式不正确"
    }
  }

  // 验证错误响应
  {
    "status": "error",
    "code": 422,
    "message": "数据验证失败",
    "details": {
      "errors": [
        {
          "field": "email",
          "message": "邮箱格式不正确"
        },
        {
          "field": "password",
          "message": "密码长度至少8位"
        }
      ]
    }
  }

  // 文件不存在错误响应
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

- **反向例子**:
  ```json
  // 错误：缺少必要字段
  {
    "status": "error",
    "code": 400
    // 缺少message字段
  }

  // 错误：错误信息不清晰
  {
    "status": "error",
    "code": 500,
    "message": "系统错误" // 过于模糊，没有具体信息
  }

  // 错误：错误格式不一致
  {
    "status": "error",
    "code": 404,
    "error_message": "资源未找到" // 应该使用message字段
  }

  // 错误：details格式混乱
  {
    "status": "error",
    "code": 400,
    "message": "参数错误",
    "details": "filename is invalid" // 应该使用结构化数据
  }
  ```

- **错误码参考表**:
  | 错误码 | 类型 | 描述 |
  |--------|------|------|
  | 400 | HTTP | 请求参数无效 |
  | 401 | HTTP | 未授权访问 |
  | 404 | HTTP | 资源未找到 |
  | 422 | HTTP | 数据验证失败 |
  | 500 | HTTP | 服务器内部错误 |
  | 1001 | 自定义 | PDF解析失败 |
  | 1002 | 自定义 | 文件上传失败 |
  | 1003 | 自定义 | 数据库操作失败 |