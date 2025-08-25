- **规范名称**: 消息类型定义规范
- **规范描述**: 定义JSON通信中使用的标准消息类型及其含义，确保消息类型的一致性和正确使用。
- **当前版本**: 1.0
- **所属范畴**: API规范
- **适用范围**: 所有JSON通信消息中的type字段
- **详细内容**: 
  - 消息类型必须使用小写字母和下划线命名
  - 消息类型应该清晰地表达其用途和方向
  - 请求消息类型应该以动词开头，描述要执行的操作
  - 响应消息类型应该与请求类型对应，表明操作结果
  - 消息类型应该保持稳定，避免频繁变更

- **正向例子**:
  ```json
  // PDF管理相关消息类型
  {
    "type": "get_pdf_list", // 请求获取PDF列表
    "data": {"page": 1}
  }

  {
    "type": "pdf_list", // 响应PDF列表数据
    "data": {"files": []}
  }

  {
    "type": "add_pdf", // 请求添加PDF
    "data": {"filename": "test.pdf"}
  }

  {
    "type": "pdf_added", // 响应PDF添加成功
    "data": {"file": {}}
  }

  // 心跳消息类型
  {
    "type": "heartbeat", // 心跳请求
    "timestamp": 1635768000.123
  }

  {
    "type": "heartbeat_response", // 心跳响应
    "timestamp": 1635768000.456
  }
  ```

- **反向例子**:
  ```json
  // 错误：消息类型命名不规范
  {
    "type": "GetPDFList", // 应该使用小写和下划线
    "data": {}
  }

  // 错误：消息类型含义不清晰
  {
    "type": "do_action", // 过于模糊，不知道具体操作
    "data": {}
  }

  // 错误：请求和响应类型不匹配
  {
    "type": "get_pdf_list", // 请求类型
    "data": {}
  }
  // 响应应该使用 pdf_list 而不是其他类型
  {
    "type": "response", // 应该使用具体的响应类型
    "data": {}
  }
  ```

- **消息类型参考表**:
  | 消息类型 | 方向 | 描述 |
  |----------|------|------|
  | get_pdf_list | 请求 | 获取PDF列表 |
  | pdf_list | 响应 | PDF列表数据 |
  | add_pdf | 请求 | 添加PDF |
  | pdf_added | 响应 | PDF添加成功 |
  | remove_pdf | 请求 | 删除PDF |
  | pdf_removed | 响应 | PDF删除成功 |
  | heartbeat | 请求 | 心跳请求 |
  | heartbeat_response | 响应 | 心跳响应 |