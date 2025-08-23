# PDF主页JSON标准迁移技术规范

## 命名规范
- 消息类型：使用小写下划线格式，如 `get_pdf_list`
- 字段名：使用小写下划线格式，如 `request_id`
- 常量：使用大写下划线格式，如 `MESSAGE_TYPES`

## 消息格式规范

### 请求消息格式
```javascript
{
  "type": "message_type",
  "timestamp": 1635768000.123,
  "request_id": "uuid-string",
  "data": {}
}
```

### 响应消息格式
```javascript
{
  "type": "response_type",
  "timestamp": 1635768000.123,
  "request_id": "uuid-string",
  "status": "success|error|pending",
  "code": 200,
  "message": "操作成功",
  "data": {}
}
```

## 消息类型映射

### 现有消息类型升级
| 旧类型 | 新类型 | 说明 |
|--------|--------|------|
| get_pdf_list | get_pdf_list | 保持相同 |
| pdf_list | pdf_list | 响应格式升级 |
| add_pdf | add_pdf | 保持相同 |
| pdf_added | pdf_added | 响应格式升级 |
| remove_pdf | remove_pdf | 保持相同 |
| pdf_removed | pdf_removed | 响应格式升级 |

### 新增消息类型
- `heartbeat`: 心跳检测
- `error`: 统一错误响应

## 向后兼容策略

### 版本检测机制
```javascript
// 前端版本检测
const SUPPORTS_NEW_FORMAT = true; // 通过配置控制
```

### 双格式支持
- 发送：始终使用新格式
- 接收：支持新旧两种格式
- 响应：根据请求格式返回对应格式

## 错误处理规范

### 错误码映射
| HTTP码 | 业务码 | 描述 |
|--------|--------|------|
| 200 | SUCCESS | 成功 |
| 400 | VALIDATION_ERROR | 参数错误 |
| 404 | NOT_FOUND | 资源不存在 |
| 500 | INTERNAL_ERROR | 服务器错误 |

### 错误响应格式
```javascript
{
  "type": "error",
  "timestamp": 1635768000.123,
  "request_id": "uuid-string",
  "status": "error",
  "code": 400,
  "message": "参数错误",
  "error": {
    "type": "validation_error",
    "message": "缺少必需参数",
    "details": {}
  }
}
```

## 代码结构规范

### 文件组织
- 常量定义：文件顶部
- 工具函数：单独区域
- 事件处理：集中管理
- 错误处理：统一函数

### 函数命名
- 发送消息：`sendMessageType`
- 处理响应：`handleMessageType`
- 错误处理：`handleError`

## 测试规范

### 单元测试
- 消息格式验证
- 响应解析测试
- 错误处理测试

### 集成测试
- 端到端消息流程
- 新旧格式兼容性
- 错误场景覆盖

## 性能要求
- 消息序列化：≤1ms
- 响应解析：≤1ms
- 内存使用：≤10MB增量