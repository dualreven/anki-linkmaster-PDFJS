# QWebChannel 开发规范和常见问题指南

## 🚨 重要提醒：避免常见陷阱

### 1. 类型转换错误 (TypeError: unable to convert dict to PyQt_PyObject)

**❌ 错误做法：**
```python
@pyqtSlot(result=dict)
def someMethod(self) -> dict:
    return {"success": True, "data": "some data"}  # 这会导致类型转换错误
```

**✅ 正确做法：**
```python
@pyqtSlot(result=str)
def someMethod(self) -> str:
    import json
    result = {"success": True, "data": "some data"}
    return json.dumps(result, ensure_ascii=False)  # 返回JSON字符串
```

**前端对应处理：**
```javascript
async someMethod() {
    const resultStr = await this.#bridge.someMethod();
    try {
        const result = JSON.parse(resultStr);
        return result;
    } catch (parseError) {
        return { success: false, error: "Failed to parse response" };
    }
}
```

### 2. 支持的PyQt返回类型

**✅ 安全的返回类型：**
- `str` (字符串)
- `int` (整数)
- `float` (浮点数)
- `bool` (布尔值)
- `list` (简单列表，但建议转为JSON字符串)

**❌ 避免使用的返回类型：**
- `dict` (字典对象)
- 复杂的Python对象
- NumPy数组
- pandas DataFrame

### 3. 异常处理最佳实践

**PyQt端异常处理模板：**
```python
@pyqtSlot(str, result=str)
def methodName(self, param: str) -> str:
    try:
        import json
        logger.info("🔗 [PyQt Bridge] methodName called: %s", param)

        # 你的业务逻辑
        result = {"success": True, "data": "processed"}

        logger.info("🔗 [PyQt Bridge] methodName completed successfully")
        return json.dumps(result, ensure_ascii=False)

    except Exception as exc:
        import json
        logger.error("🔗 [PyQt Bridge] methodName failed: %s", exc, exc_info=True)
        error_result = {"success": False, "error": str(exc)}
        return json.dumps(error_result, ensure_ascii=False)
```

**前端异常处理模板：**
```javascript
async methodName(param) {
    if (!this.isReady()) {
        throw new Error('QWebChannel not ready');
    }

    try {
        this.#logger.info("Calling methodName via QWebChannel:", param);
        const resultStr = await this.#bridge.methodName(param);

        try {
            const result = JSON.parse(resultStr);
            this.#logger.info("methodName result:", result);
            return result;
        } catch (parseError) {
            this.#logger.error("Failed to parse methodName result:", parseError);
            return {
                success: false,
                error: "Failed to parse response",
                raw_response: resultStr
            };
        }
    } catch (error) {
        this.#logger.error("methodName failed:", error);
        throw error;
    }
}
```

## 🛠️ 开发工作流

### 1. 添加新的QWebChannel方法

1. **定义PyQt方法** (pdf_home_bridge.py)
2. **更新API包装器** (qwebchannel/api-wrapper.js)
3. **在管理器中暴露方法** (qwebchannel-manager.js)
4. **添加事件处理** (ui/ui-event-handlers.js)
5. **测试验证**

### 2. 测试检查清单

- [ ] PyQt方法返回JSON字符串格式
- [ ] 前端正确解析JSON响应
- [ ] 异常情况都有适当处理
- [ ] 日志记录清晰可追踪
- [ ] 不会导致界面冻结或闪退

### 3. 调试指南

**查看PyQt日志：**
```bash
# 查看实时日志
tail -f logs/pdf-home.log

# 或直接运行launcher查看控制台输出
python src/frontend/pdf-home/launcher.py
```

**常见错误模式：**

1. **类型转换错误**
   - 错误信息：`TypeError: unable to convert dict to PyQt_PyObject`
   - 解决：改用JSON字符串传输

2. **QWebChannel未就绪**
   - 错误信息：`QWebChannel not ready`
   - 解决：检查初始化顺序和时机

3. **方法调用超时**
   - 现象：界面冻结
   - 解决：检查PyQt方法是否有死循环或阻塞操作

## 🔍 代码审查要点

在代码审查时，重点检查：

1. **PyQt方法签名**
   - 是否使用了安全的返回类型
   - 是否有完整的异常处理

2. **JSON序列化**
   - 是否使用了`ensure_ascii=False`
   - 是否处理了序列化异常

3. **前端解析**
   - 是否正确处理了JSON解析异常
   - 是否有回退机制

4. **日志记录**
   - 是否有足够的调试信息
   - 是否使用了统一的日志格式

## 📚 相关文档

- [Qt QWebChannel官方文档](https://doc.qt.io/qt-5/qwebchannel.html)
- [PyQt QWebChannel绑定](https://doc.qt.io/qtforpython/PySide2/QtWebChannel/QWebChannel.html)
- 项目异常处理规范：`docs/Exception-Handling-Best-Practices.md`

## 🏷️ 版本历史

- v1.0 (2025-09-29): 初始版本，基于TypeError修复经验创建
- 后续版本将根据遇到的新问题持续更新

---

⚠️ **重要提醒**：在修改QWebChannel相关代码时，请务必参考此文档，避免重复踩坑！