# 前后端集成测试使用说明

## 📋 测试目标

自动验证前后端通信的数据格式一致性，避免常见的数据格式错误：

1. ✅ WebSocket 连接正常
2. ✅ 消息结构正确（type, data 字段）
3. ✅ 字段命名一致（snake_case）
4. ✅ 数据类型正确（int, str, bool, list）
5. ✅ 时间戳格式统一（Unix 秒）
6. ✅ PDF 记录字段完整

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install websockets
```

### 2. 启动后端服务

```bash
# 方式1: 使用 ai-launcher（推荐）
python ai-launcher.py start

# 方式2: 直接启动后端
cd src/backend
python main.py --module pdf-home --ws-port 8765
```

### 3. 运行测试

```bash
# 基础测试（默认端口 8765）
python test_frontend_backend_integration.py

# 指定端口
python test_frontend_backend_integration.py --port 8790

# 指定主机和端口
python test_frontend_backend_integration.py --host localhost --port 8765
```

## 📊 测试报告示例

### 成功的测试报告

```
✅ 成功连接到 ws://localhost:8765/

================================================================================
测试: PDF 列表获取 (pdf-library:list:records)
================================================================================

📤 发送: {"type": "pdf-library:list:records", "data": {}}
📥 接收: {"type": "pdf-library:list:records", "data": {"records": [...]}}

📊 收到 3 条 PDF 记录

验证记录 #1: example.pdf
验证记录 #2: tutorial.pdf
验证记录 #3: guide.pdf

================================================================================
消息验证报告
================================================================================

✅ 无错误

================================================================================
```

### 发现错误的测试报告

```
❌ 错误 (3 个):
  1. 字段 'createdAt' 不符合 snake_case 规范
  2. 字段 'pageCount' 类型错误: 期望 int, 实际 str
  3. PDF 记录缺少字段: last_accessed_at
```

## 🔍 常见问题检测

### 1. 字段命名不一致

**问题**: 前端使用 camelCase，后端使用 snake_case

```javascript
// ❌ 错误 - 前端发送 camelCase
{
  type: 'pdf-library:open:viewer',
  data: { fileName: 'test.pdf' }  // 应该是 filename
}

// ✅ 正确 - 使用 snake_case
{
  type: 'pdf-library:open:viewer',
  data: { filename: 'test.pdf' }
}
```

### 2. 数据类型错误

**问题**: 数字被序列化为字符串

```python
# ❌ 错误
{
  'page_count': '10',  # 字符串
  'file_size': '1024'  # 字符串
}

# ✅ 正确
{
  'page_count': 10,    # 数字
  'file_size': 1024    # 数字
}
```

### 3. 时间戳格式不统一

**问题**: 混用秒和毫秒

```python
# ❌ 错误 - 毫秒
{
  'created_at': 1696262400000  # 13位毫秒
}

# ✅ 正确 - 秒
{
  'created_at': 1696262400  # 10位秒
}
```

## 📝 扩展测试用例

### 添加自定义测试

编辑 `test_frontend_backend_integration.py`，添加新的测试方法：

```python
async def test_pdf_add(self, websocket):
    """测试 PDF 添加"""
    request = {
        'type': 'pdf-library:add:records',
        'data': {
            'file_paths': ['/path/to/test.pdf']
        }
    }
    response = await self.send_and_receive(websocket, request)
    self.validator.validate_message_structure(response)
    # 添加更多验证...
```

## 🛠️ 调试技巧

### 1. 查看原始消息

修改测试脚本，打印原始 JSON：

```python
print(f"原始消息: {json.dumps(response, indent=2, ensure_ascii=False)}")
```

### 2. 跳过特定验证

临时禁用某些验证规则：

```python
# 跳过命名规范检查（调试时使用）
# self.validate_naming(field_name, 'snake_case')
```

### 3. 保存测试日志

```bash
python test_frontend_backend_integration.py > test_log.txt 2>&1
```

## 🎯 最佳实践

1. **开发前测试**: 修改数据格式前先运行测试，建立基线
2. **开发后验证**: 修改完成后再次测试，确保没有破坏兼容性
3. **持续集成**: 将测试脚本加入 CI/CD 流程
4. **定期更新 Schema**: 添加新字段时同步更新 `test_message_schemas.py`

## 📚 相关文件

- `test_message_schemas.py`: 数据格式定义（Schema）
- `test_frontend_backend_integration.py`: 主测试脚本
- `INTEGRATION_TEST_README.md`: 本说明文档

## ⚠️ 注意事项

1. 测试脚本需要后端服务运行中
2. 某些测试需要数据库中有测试数据
3. 删除测试可能会影响实际数据（生产环境慎用）
4. 时间戳验证范围: 2001-09-09 到 2286-11-20

## 🔄 更新记录

- 2025-10-02: 初版创建，支持 PDF 列表验证
- TODO: 添加 PDF 添加/删除/打开测试
- TODO: 添加性能测试（响应时间）
- TODO: 添加并发测试
