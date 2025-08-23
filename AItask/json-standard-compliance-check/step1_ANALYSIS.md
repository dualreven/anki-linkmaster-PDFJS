# JSON通信标准合规性分析报告

## 执行时间
2024年分析时间

## 分析范围
- `docs/SPEC/json-communication-standard.md` - JSON通信标准规范
- `docs/SPEC/json-examples.md` - JSON标准示例
- `src/backend/websocket/standard_protocol.py` - 标准协议处理器
- `src/backend/websocket/standard_server.py` - WebSocket服务器
- `src/backend/pdf_manager/standard_manager.py` - PDF管理器

## 发现的不匹配问题

### 1. 消息类型命名不匹配

#### 标准规范中的消息类型：
- `get_pdf_list` (请求)
- `pdf_list` (响应)
- `add_pdf` (请求)
- `pdf_added` (响应)
- `remove_pdf` (请求)
- `pdf_removed` (响应)

#### 当前代码中的消息类型：
- `pdf_list_request` / `pdf_list_response`
- `pdf_upload_request` / `pdf_upload_response`
- `pdf_remove_request` / `pdf_remove_response`

**问题**: 消息类型命名与标准规范不一致

### 2. 响应结构不匹配

#### 标准规范响应结构：
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

#### 当前代码响应结构：
```json
{
  "type": "具体消息类型",
  "timestamp": 123456789,
  "request_id": "uuid",
  "success": true,
  "data": {}
}
```

**问题**: 
- 缺少 `status` 字段
- 缺少 `code` 字段
- 缺少 `message` 字段
- 使用 `success` 而不是 `status`

### 3. 时间戳格式不匹配

#### 标准规范：
- Unix时间戳(秒)
- 示例: `1635768000.123`

#### 当前代码：
- 毫秒级时间戳
- 实际使用: `int(time.time() * 1000)`

**问题**: 时间戳单位与标准规范不一致

### 4. 错误响应格式不匹配

#### 标准规范错误格式：
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

#### 当前代码错误格式：
```json
{
  "type": "error",
  "request_id": "uuid",
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述"
  }
}
```

**问题**: 
- 错误响应结构与标准规范不符
- 缺少 `status` 和 `code` 字段
- 错误信息嵌套结构不一致

### 5. PDF管理器返回格式不一致

#### 标准规范：
- 响应应该包含在标准响应结构中

#### 当前代码：
- PDF管理器直接返回数据对象，没有包装在标准响应结构中

## 需要修正的组件

### 高优先级修正：
1. `standard_protocol.py` - 修正消息类型和响应结构
2. `standard_server.py` - 修正消息处理和响应格式
3. `standard_manager.py` - 修正返回数据格式

### 中优先级修正：
1. 时间戳单位统一
2. 错误处理格式统一
3. 消息类型命名统一

## 影响评估

### 前端影响：
- 需要同步更新前端消息处理逻辑
- 可能需要版本兼容处理

### 后端影响：
- 需要修改所有消息构建和解析逻辑
- 需要更新测试用例
- 需要确保向后兼容性

## 建议的修正策略

### 阶段1：协议层修正
1. 更新 `standard_protocol.py` 以符合标准规范
2. 统一消息类型命名
3. 修正响应结构格式

### 阶段2：服务器层修正
1. 更新 `standard_server.py` 的消息处理逻辑
2. 确保所有响应符合标准格式

### 阶段3：管理器层修正
1. 更新 `standard_manager.py` 的返回格式
2. 确保数据格式与标准兼容

### 阶段4：测试验证
1. 更新测试用例
2. 验证前后端兼容性
3. 进行集成测试