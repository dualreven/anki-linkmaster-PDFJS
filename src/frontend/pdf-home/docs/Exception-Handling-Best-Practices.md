# 异常处理最佳实践指南

## 🎯 目标

确保所有异常都能被正确捕获、记录和处理，提供清晰的调试信息，避免应用程序崩溃。

## 🏗️ 分层异常处理策略

### 1. PyQt层异常处理

**目标**：捕获所有PyQt操作的异常，确保界面不会冻结或闪退

**模板：**
```python
def _setup_critical_component(self):
    try:
        logger.info("开始初始化关键组件...")

        # 分步骤初始化，每步都有独立异常处理
        step1_result = self._init_step1()
        logger.info("步骤1完成")

        step2_result = self._init_step2()
        logger.info("步骤2完成")

        logger.info("关键组件初始化完成")

    except Exception as exc:
        logger.error("关键组件初始化失败: %s", exc, exc_info=True)
        logger.error("错误类型: %s", type(exc).__name__)

        # 添加完整堆栈跟踪
        try:
            import traceback
            full_traceback = traceback.format_exc()
            logger.error("完整堆栈跟踪:\n%s", full_traceback)
        except Exception as tb_exc:
            logger.error("获取堆栈跟踪失败: %s", tb_exc)

        # 决定是否重新抛出异常
        raise  # 对于关键组件，应该停止初始化
```

### 2. QWebChannel Bridge异常处理

**目标**：防止Bridge方法异常导致前端调用失败

**模板：**
```python
@pyqtSlot(str, result=str)
def bridgeMethod(self, param: str) -> str:
    """Bridge方法异常处理模板"""
    try:
        import json
        logger.info("🔗 [PyQt Bridge] bridgeMethod called: %s", param)

        # 参数验证
        if not param:
            raise ValueError("参数不能为空")

        # 业务逻辑
        result = self._do_business_logic(param)

        # 返回成功结果
        success_result = {
            "success": True,
            "data": result,
            "timestamp": datetime.datetime.now().isoformat()
        }

        logger.info("🔗 [PyQt Bridge] bridgeMethod completed successfully")
        return json.dumps(success_result, ensure_ascii=False)

    except Exception as exc:
        import json, datetime
        logger.error("🔗 [PyQt Bridge] bridgeMethod failed: %s", exc, exc_info=True)

        # 返回错误结果（仍然是有效的JSON）
        error_result = {
            "success": False,
            "error": str(exc),
            "error_type": type(exc).__name__,
            "timestamp": datetime.datetime.now().isoformat()
        }

        return json.dumps(error_result, ensure_ascii=False)
```

### 3. JavaScript异常处理

**目标**：确保前端能够优雅处理所有异步操作的异常

**模板：**
```javascript
async apiMethod(param) {
    // 1. 前置检查
    if (!this.isReady()) {
        throw new Error('API not ready');
    }

    if (!param) {
        throw new Error('Parameter is required');
    }

    try {
        this.#logger.info("Calling apiMethod:", param);

        // 2. 调用底层API
        const resultStr = await this.#bridge.bridgeMethod(param);
        this.#logger.debug("Raw response:", resultStr);

        // 3. 解析响应
        let result;
        try {
            result = JSON.parse(resultStr);
        } catch (parseError) {
            this.#logger.error("Failed to parse response:", parseError);
            throw new Error(`Invalid response format: ${parseError.message}`);
        }

        // 4. 检查业务逻辑错误
        if (!result.success) {
            const error = new Error(result.error || 'Unknown error');
            error.errorType = result.error_type;
            error.timestamp = result.timestamp;
            throw error;
        }

        this.#logger.info("apiMethod completed successfully");
        return result.data;

    } catch (error) {
        this.#logger.error("apiMethod failed:", error);

        // 5. 错误分类和处理
        if (error.message.includes('QWebChannel')) {
            // QWebChannel连接问题
            throw new Error('PyQt connection lost');
        } else if (error.message.includes('timeout')) {
            // 超时问题
            throw new Error('Operation timed out');
        } else {
            // 其他错误，直接传播
            throw error;
        }
    }
}
```

### 4. 事件处理异常

**目标**：防止事件处理器异常影响整个事件系统

**模板：**
```javascript
#handleSomeEvent(data) {
    try {
        this.#logger.info("Handling event with data:", data);

        // 事件处理逻辑
        this.#processEventData(data);

        this.#logger.debug("Event handled successfully");

    } catch (error) {
        this.#logger.error("Event handling failed:", error);

        // 显示用户友好的错误信息
        this.#showUserError("操作失败，请稍后重试");

        // 不重新抛出异常，避免影响其他事件处理器
    }
}

#showUserError(message) {
    try {
        // 显示错误信息的逻辑
        DOMUtils.showError(message);
    } catch (displayError) {
        // 连显示错误都失败了，使用最基本的方式
        console.error("Failed to display error:", displayError);
        alert(message);
    }
}
```

## 🔍 调试和诊断

### 1. 日志级别策略

```python
# 关键操作：INFO级别
logger.info("开始执行关键操作")

# 详细步骤：DEBUG级别
logger.debug("处理参数: %s", param)

# 警告情况：WARNING级别
logger.warning("检测到潜在问题: %s", issue)

# 错误情况：ERROR级别
logger.error("操作失败: %s", error, exc_info=True)

# 致命错误：CRITICAL级别
logger.critical("系统组件初始化失败，无法继续运行")
```

### 2. 错误信息格式

```python
# 包含上下文的错误信息
logger.error("初始化组件[%s]失败，参数[%s]: %s",
            component_name, params, exc, exc_info=True)

# 包含调试提示
logger.error("QWebChannel方法[%s]调用失败，检查bridge连接状态: %s",
            method_name, exc)
```

### 3. 异常恢复策略

```python
def robust_operation(self):
    """具有异常恢复能力的操作"""
    max_retries = 3
    retry_delay = 1.0

    for attempt in range(max_retries):
        try:
            return self._do_operation()

        except TemporaryError as exc:
            if attempt < max_retries - 1:
                logger.warning("操作失败，%d秒后重试 (第%d次): %s",
                             retry_delay, attempt + 1, exc)
                time.sleep(retry_delay)
                retry_delay *= 2  # 指数退避
            else:
                logger.error("操作最终失败，已重试%d次: %s", max_retries, exc)
                raise

        except FatalError as exc:
            logger.error("遇到致命错误，不进行重试: %s", exc)
            raise
```

## 📋 异常处理检查清单

开发时请确认：

- [ ] 所有的`try-catch`块都有适当的日志记录
- [ ] 异常信息包含足够的上下文信息
- [ ] 使用了`exc_info=True`记录完整堆栈跟踪
- [ ] 区分了可恢复和不可恢复的错误
- [ ] QWebChannel方法都返回JSON格式的错误信息
- [ ] 前端有适当的错误显示和用户反馈
- [ ] 异常不会导致整个应用程序崩溃
- [ ] 关键资源在异常时能够正确清理

## 🚨 常见异常类型和处理

### 1. QWebChannel相关异常

```python
# TypeError: unable to convert dict to PyQt_PyObject
# 解决：使用JSON字符串传输复杂数据

# QWebChannel not ready
# 解决：检查初始化顺序和时机
```

### 2. 网络相关异常

```python
# WebSocket连接失败
# 解决：实现重连机制和状态检查

# 超时异常
# 解决：合理设置超时时间和重试策略
```

### 3. 文件操作异常

```python
# 文件不存在、权限不足
# 解决：添加文件状态检查和权限验证
```

## 📚 相关文档

- QWebChannel开发规范：`QWebChannel-Development-Guide.md`
- 错误码定义：`Error-Codes.md`（待创建）
- 调试指南：`Debugging-Guide.md`（待创建）

---

⚠️ **重要提醒**：异常处理不是可选项，而是代码质量的基本要求！