# JSON通信标准

## 消息格式

### 基础结构
```json
{
  "type": "消息类型",
  "timestamp": 1635768000.123,
  "request_id": "uuid",
  "data": {},
  "metadata": {}
}
```

### 响应结构
```json
{
  "type": "response",
  "timestamp": 1635768000.123,
  "request_id": "uuid",
  "status": "success|error|pending",
  "code": 200,
  "message": "描述",
  "data": {},
  "error": {}
}
```

## 状态码
| 码 | 含义 |
|---|---|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 参数错误 |
| 401 | 未授权 |
| 404 | 未找到 |
| 409 | 冲突 |
| 422 | 业务错误 |
| 500 | 服务器错误 |

## 消息类型

### PDF管理
| 类型 | 方向 | 描述 |
|---|---|---|
| `get_pdf_list` | 请求 | 获取PDF列表 |
| `pdf_list` | 响应 | PDF列表数据 |
| `add_pdf` | 请求 | 添加PDF |
| `pdf_added` | 响应 | PDF添加成功 |
| `remove_pdf` | 请求 | 删除PDF |
| `pdf_removed` | 响应 | PDF删除成功 |

### 心跳
| 类型 | 描述 |
|---|---|
| `heartbeat` | 心跳请求 |
| `heartbeat_response` | 心跳响应 |

## 数据类型
- **时间戳**: Unix时间戳(秒)
- **ID**: UUID格式
- **文件大小**: 字节数
- **路径**: UTF-8字符串

## 错误格式
```json
{
  "type": "error类型",
  "message": "错误描述",
  "details": {}
}
```

## 验证规则
- 必填字段检查
- 类型验证
- 格式验证(UUID、时间戳)
- 业务规则验证

## 版本控制
- 主版本: 不兼容修改
- 次版本: 兼容新增
- 修订版: bug修复