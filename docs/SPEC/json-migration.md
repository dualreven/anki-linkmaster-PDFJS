# JSON标准迁移指南

## 迁移步骤

### 阶段1: 双格式支持
**后端**: 同时接受新旧格式
```python
# 版本检测
if 'request_id' in message:
    handle_standard(message)
else:
    handle_legacy(message)  # 向后兼容
```

**前端**: 版本协商
```javascript
// 检测服务器版本
const version = await getServerVersion();
const useStandard = version >= '2.0.0';
```

### 阶段2: 强制升级
**后端**: 移除旧格式支持
```python
# 只接受标准格式
if 'request_id' not in message:
    return error(426, "需要升级客户端")
```

**前端**: 统一使用新标准
```javascript
// 统一标准格式
const message = {
  type, timestamp: Date.now()/1000, 
  request_id: uuid(), data
};
```

## 代码修改清单

| 文件 | 修改内容 |
|---|---|
| `backend/websocket/protocol.py` | 添加request_id生成 |
| `frontend/websocket-manager.js` | 添加版本检测 |
| `backend/api/pdf_controller.py` | 更新响应格式 |
| `frontend/pdf-service.js` | 使用新格式发送请求 |

## 测试验证

### 兼容性测试
```python
# 测试用例
def test_backward_compatibility():
    old_format = {"type": "get_list", "data": {}}
    new_format = {"type": "get_list", "request_id": "123", "data": {}}
    
    assert handle(old_format)  # 应该成功
    assert handle(new_format)  # 应该成功
```

### 回滚策略
```bash
# 紧急回滚
git checkout v1.0.0
systemctl restart backend
```

## 时间表
| 周 | 任务 |
|---|---|
| 1 | 代码更新、测试 |
| 2 | 双格式支持 |
| 3 | 监控收集 |
| 4 | 强制升级 |
| 5 | 验证完成 |

## 检查清单
- [ ] 所有服务更新完成
- [ ] 测试环境验证通过
- [ ] 回滚方案准备就绪
- [ ] 监控告警配置完成