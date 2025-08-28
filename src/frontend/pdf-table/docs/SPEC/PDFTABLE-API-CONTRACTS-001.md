<![CDATA[<!-- PDFTABLE-API-CONTRACTS-001.md -->
- **规范名称**: PDF-Table API契约规范
- **规范描述**: 定义PDF-Table模块与外部模块交互的API契约，包括接口名、请求/响应结构、字段说明、错误码等。
- **当前版本**: 1.0
- **所属范畴**: API规范
- **适用范围**: PDF-Table模块的所有对外API接口
- **详细内容**: 
  - 所有API接口必须通过事件总线进行通信
  - 请求和响应必须遵循JSON消息格式规范
  - 每个接口必须定义明确的错误码和处理方式
  - 接口命名必须遵循前端事件命名规范

- **正向例子**:
  ```javascript
  // 正确：通过事件总线通信的API接口
 // 排序接口
  const sortRequest = {
    type: "table:sort:request",
    timestamp: 1635768000.123,
    request_id: "550e8400-e29b-41d4-a716-44655440000",
    data: {
      column: "filename",
      order: "asc"
    }
  };

  const sortResponse = {
    type: "table:sort:response",
    timestamp: 1635768000.456,
    request_id: "550e8400-e29b-41d4-a716-44655440000",
    status: "success",
    code: 200,
    data: {
      files: [{
        id: "abc123",
        filename: "test.pdf",
        page_count: 10,
        file_size: 1024000
      }]
    }
  };

  // 筛选接口
  const filterRequest = {
    type: "table:filter:request",
    timestamp: 1635768000.123,
    request_id: "550e8400-e29b-41d4-a716-446655440001",
    data: {
      keyword: "test"
    }
  };

  const filterResponse = {
    type: "table:filter:response",
    timestamp: 1635768000.456,
    request_id: "550e8400-e29b-41d4-a716-446655440001",
    status: "success",
    code: 200,
    data: {
      files: [{
        id: "abc123",
        filename: "test.pdf",
        page_count: 10,
        file_size: 1024000
      }]
    }
  };
  ```

- **反向例子**:
  ```javascript
  // 错误：直接函数调用，未通过事件总线
  const result = pdfTable.sortData({column: "filename", order: "asc"}); // 应该通过事件总线

  // 错误：不符合JSON消息格式规范
  const badRequest = {
    action: "sort", // 应该使用type字段
    data: {
      column: "filename",
      order: "asc"
    }
    // 缺少timestamp和request_id字段
  };

  // 错误：错误码使用不规范
  const badResponse = {
    type: "table:sort:response",
    status: "success",
    code: 999, // 使用了非标准错误码
    data: {}
  };
  ```

- **接口清单**:
  - 接口名：table:sort:request
    - 描述：对表格数据进行排序
    - 请求示例：{ "type": "table:sort:request", "data": { "column": "string", "order": "asc|desc" } }
    - 响应示例：{ "type": "table:sort:response", "status": "success", "code": 200, "data": [...] }
    - 错误码：400(参数错误), 500(内部错误)
  - 接口名：table:filter:request
    - 描述：对表格数据进行筛选
    - 请求示例：{ "type": "table:filter:request", "data": { "keyword": "string" } }
    - 响应示例：{ "type": "table:filter:response", "status": "success", "code": 200, "data": [...] }
    - 错误码：400(参数错误), 500(内部错误)
  - 接口名：table:paginate:request
    - 描述：对表格数据进行分页
    - 请求示例：{ "type": "table:paginate:request", "data": { "page": 1, "size": 10 } }
    - 响应示例：{ "type": "table:paginate:response", "status": "success", "code": 200, "data": [...], "total": 100 }
    - 错误码：400(参数错误), 500(内部错误)
]]>